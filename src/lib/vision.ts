import { COMPONENTS, DEFECTS, DEFECT_CODES } from "./taxonomy";
import { PhotoAnalysis } from "./types";
import type { PhotoInput, PropertyInput } from "./types";

/**
 * The perception layer.
 *
 * Its entire job is to turn pixels into codes from a closed vocabulary. It is
 * given a JSON schema with no numeric cost field anywhere in it, so there is no
 * slot for the model to put a dollar amount into even if it wanted to.
 *
 * Providers are interchangeable (`VISION_PROVIDER=gemini|openai`) and each
 * provider walks a fallback chain of model ids, so a single model deprecation
 * cannot take the endpoint down.
 */

export interface VisionResult {
  analysis: PhotoAnalysis;
  model: string;
  provider: string;
}

const GEMINI_MODELS = (process.env.GEMINI_MODEL ?? "gemini-3.7-flash,gemini-3.5-flash,gemini-2.5-flash")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

const OPENAI_MODELS = (process.env.OPENAI_MODEL ?? "gpt-5,gpt-4.1-mini,gpt-4o-mini")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function defectMenu(): string {
  return DEFECTS.map((d) => `${d.code} — ${d.label} [valid on: ${d.components.join(", ")}]`).join("\n");
}

function systemPrompt(property: PropertyInput): string {
  return `You are a property condition inspector analysing a single photograph of a residential property.

PROPERTY CONTEXT
Address: ${property.address}
Size: ${property.square_feet} sf, ${property.beds} bed, ${property.baths} bath${
    property.year_built ? `, built ${property.year_built}` : ""
  }

YOUR TASK
1. Classify which component of the property this photo shows. Choose exactly one of:
${COMPONENTS.join(", ")}
2. Rate the photo's usefulness for inspection: good | fair | poor | unusable.
3. List every visible defect, using ONLY codes from the menu below.

DEFECT MENU
${defectMenu()}

RULES — these are hard constraints
- Report ONLY what is visibly evident in this photograph. Do not infer defects from
  the property's age, address, or from what is typical for such a home.
- severity: 0 none, 1 cosmetic, 2 moderate, 3 significant, 4 severe/failed.
- extent: the fraction (0.0-1.0) of the relevant surface or component visibly affected.
- confidence: your genuine certainty (0.0-1.0). Say 0.4 when you mean 0.4.
- If the photo is dark, blurred, or shows nothing assessable, set quality to
  "unusable" and return an empty defects array.
- A clean, well-maintained component should return zero defects. Do not invent
  problems to seem thorough.
- NEVER estimate, mention, or imply a repair cost, price, dollar amount, or budget.
  Pricing is handled by a separate system you have no access to. You report
  observations only.`;
}

// ------------------------------------------------------------- schemas

const geminiSchema = {
  type: "OBJECT",
  properties: {
    component: { type: "STRING", enum: [...COMPONENTS] },
    component_confidence: { type: "NUMBER" },
    quality: { type: "STRING", enum: ["good", "fair", "poor", "unusable"] },
    caption: { type: "STRING" },
    defects: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          code: { type: "STRING", enum: [...DEFECT_CODES] },
          severity: { type: "NUMBER" },
          extent: { type: "NUMBER" },
          confidence: { type: "NUMBER" },
          note: { type: "STRING" },
        },
        required: ["code", "severity", "extent", "confidence"],
      },
    },
  },
  required: ["component", "component_confidence", "quality", "defects"],
};

const openaiSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    component: { type: "string", enum: [...COMPONENTS] },
    component_confidence: { type: "number" },
    quality: { type: "string", enum: ["good", "fair", "poor", "unusable"] },
    caption: { type: "string" },
    defects: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          code: { type: "string", enum: [...DEFECT_CODES] },
          severity: { type: "number" },
          extent: { type: "number" },
          confidence: { type: "number" },
          note: { type: "string" },
        },
        required: ["code", "severity", "extent", "confidence", "note"],
      },
    },
  },
  required: ["component", "component_confidence", "quality", "caption", "defects"],
};

// -------------------------------------------------------------- helpers

async function toInline(photo: PhotoInput): Promise<{ mime: string; b64: string }> {
  if (photo.data) {
    const m = /^data:([^;]+);base64,(.*)$/.exec(photo.data);
    if (m) return { mime: m[1], b64: m[2] };
    return { mime: photo.mime_type ?? "image/jpeg", b64: photo.data };
  }
  const res = await fetch(photo.url!, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`fetch ${res.status} for ${photo.url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength > 12 * 1024 * 1024) throw new Error("photo exceeds 12MB");
  return {
    mime: res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg",
    b64: buf.toString("base64"),
  };
}

function toDataUri(photo: PhotoInput): string | null {
  if (!photo.data) return null;
  return photo.data.startsWith("data:")
    ? photo.data
    : `data:${photo.mime_type ?? "image/jpeg"};base64,${photo.data}`;
}

/** Strip anything the model returned that is not in our vocabulary. */
function coerce(raw: unknown, photoId: string): PhotoAnalysis {
  const parsed = PhotoAnalysis.safeParse({ ...(raw as object), photo_id: photoId });
  if (parsed.success) return parsed.data;

  const obj = (raw ?? {}) as Record<string, unknown>;
  const defects = Array.isArray(obj.defects) ? obj.defects : [];
  return PhotoAnalysis.parse({
    photo_id: photoId,
    component: (COMPONENTS as readonly string[]).includes(String(obj.component))
      ? obj.component
      : "living_area",
    component_confidence: Number(obj.component_confidence) || 0.3,
    quality: ["good", "fair", "poor", "unusable"].includes(String(obj.quality))
      ? obj.quality
      : "fair",
    caption: typeof obj.caption === "string" ? obj.caption.slice(0, 240) : undefined,
    defects: defects
      .filter((d) => d && DEFECT_CODES.includes(String((d as Record<string, unknown>).code)))
      .slice(0, 12)
      .map((d) => {
        const x = d as Record<string, unknown>;
        return {
          code: String(x.code),
          severity: Math.min(4, Math.max(0, Number(x.severity) || 0)),
          extent: Math.min(1, Math.max(0, Number(x.extent) || 0)),
          confidence: Math.min(1, Math.max(0, Number(x.confidence) || 0.4)),
          note: typeof x.note === "string" ? x.note.slice(0, 240) : undefined,
        };
      }),
  });
}

// ------------------------------------------------------------- providers

async function analyzeGemini(
  photo: PhotoInput,
  photoId: string,
  property: PropertyInput,
): Promise<VisionResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const { mime, b64 } = await toInline(photo);

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt(property) }] },
    contents: [
      {
        role: "user",
        parts: [
          { text: "Analyse this photograph and return the structured observation." },
          { inline_data: { mime_type: mime, data: b64 } },
        ],
      },
    ],
    generationConfig: {
      temperature: 0,
      responseMimeType: "application/json",
      responseSchema: geminiSchema,
    },
  };

  let lastErr: unknown;
  for (const model of GEMINI_MODELS) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(60_000),
        },
      );
      if (!res.ok) {
        lastErr = new Error(`${model}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const json = await res.json();
      const text = json?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text).join("") ?? "";
      return { analysis: coerce(JSON.parse(text), photoId), model, provider: "gemini" };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("all Gemini models failed");
}

async function analyzeOpenAI(
  photo: PhotoInput,
  photoId: string,
  property: PropertyInput,
): Promise<VisionResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY not set");

  const imageUrl = toDataUri(photo) ?? photo.url!;

  let lastErr: unknown;
  for (const model of OPENAI_MODELS) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt(property) },
            {
              role: "user",
              content: [
                { type: "text", text: "Analyse this photograph and return the structured observation." },
                { type: "image_url", image_url: { url: imageUrl, detail: "high" } },
              ],
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: { name: "photo_analysis", strict: true, schema: openaiSchema },
          },
        }),
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        lastErr = new Error(`${model}: ${res.status} ${(await res.text()).slice(0, 200)}`);
        continue;
      }
      const json = await res.json();
      const text = json?.choices?.[0]?.message?.content ?? "{}";
      return { analysis: coerce(JSON.parse(text), photoId), model, provider: "openai" };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("all OpenAI models failed");
}

/**
 * Deterministic stand-in used when no provider key is configured.
 *
 * This exists so the pipeline, pricing engine and UI can be demonstrated and
 * reviewed without API credentials. It is seeded from the photo id, so it is
 * repeatable — but it looks at no pixels and must never be enabled in
 * production. The API response always states which provider produced the
 * observations.
 */
function analyzeSimulated(photoId: string, index: number): VisionResult {
  let seed = 0;
  for (const ch of photoId) seed = (seed * 31 + ch.charCodeAt(0)) >>> 0;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

  const rota = ["kitchen", "bathroom", "bedroom", "living_area", "exterior", "roof", "basement"] as const;
  const component = rota[index % rota.length];
  const candidates = DEFECTS.filter((d) => d.components.includes(component));
  const count = Math.floor(rand() * 3);

  const defects = [];
  for (let i = 0; i < count && candidates.length; i++) {
    const def = candidates[Math.floor(rand() * candidates.length)];
    defects.push({
      code: def.code,
      severity: Math.round(1 + rand() * 3),
      extent: Math.round((0.2 + rand() * 0.7) * 100) / 100,
      confidence: Math.round((0.55 + rand() * 0.35) * 100) / 100,
      note: "Simulated observation — no vision model configured.",
    });
  }

  return {
    analysis: PhotoAnalysis.parse({
      photo_id: photoId,
      component,
      component_confidence: Math.round((0.6 + rand() * 0.35) * 100) / 100,
      quality: rand() > 0.9 ? "poor" : "good",
      caption: `Simulated ${component} observation`,
      defects,
    }),
    model: "simulated",
    provider: "simulator",
  };
}

export function activeProvider(): string {
  const configured = process.env.VISION_PROVIDER;
  if (configured === "openai") return process.env.OPENAI_API_KEY ? "openai" : "simulator";
  if (configured === "gemini") return process.env.GEMINI_API_KEY ? "gemini" : "simulator";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "simulator";
}

export async function analyzePhoto(
  photo: PhotoInput,
  photoId: string,
  property: PropertyInput,
  index = 0,
): Promise<VisionResult> {
  const provider = activeProvider();
  try {
    if (provider === "gemini") return await analyzeGemini(photo, photoId, property);
    if (provider === "openai") return await analyzeOpenAI(photo, photoId, property);
    return analyzeSimulated(photoId, index);
  } catch (err) {
    // A single bad photo degrades coverage; it never fails the job.
    return {
      provider,
      model: "error",
      analysis: PhotoAnalysis.parse({
        photo_id: photoId,
        component: "living_area",
        component_confidence: 0,
        quality: "unusable",
        defects: [],
        error: err instanceof Error ? err.message.slice(0, 200) : "analysis failed",
      }),
    };
  }
}
