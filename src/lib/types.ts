import { z } from "zod";
import { COMPONENTS, DEFECT_CODES, type Component } from "./taxonomy";

// ---------------------------------------------------------------- input

export const PhotoInput = z
  .object({
    id: z.string().min(1).max(64).optional(),
    url: z.string().url().optional(),
    /** data: URI or bare base64 */
    data: z.string().min(32).optional(),
    mime_type: z.string().optional(),
  })
  .refine((p) => Boolean(p.url || p.data), { message: "photo requires `url` or `data`" });

export const PropertyInput = z.object({
  address: z.string().min(3),
  square_feet: z.number().int().min(200).max(25_000),
  beds: z.number().int().min(0).max(20),
  baths: z.number().min(0).max(20),
  year_built: z.number().int().min(1700).max(2100).optional(),
  stories: z.number().min(1).max(4).optional(),
  region_code: z.string().max(32).optional(),
});

export const EvaluateRequest = z.object({
  property: PropertyInput,
  photos: z.array(PhotoInput).min(5, "at least 5 photos required").max(50, "at most 50 photos"),
  options: z
    .object({
      contingency_pct: z.number().min(0).max(0.5).optional(),
      costbook_version: z.string().optional(),
    })
    .optional(),
});

export type EvaluateRequest = z.infer<typeof EvaluateRequest>;
export type PropertyInput = z.infer<typeof PropertyInput>;
export type PhotoInput = z.infer<typeof PhotoInput>;

// ------------------------------------------------- vision layer output
// Note: no dollar amounts anywhere in this shape. That is deliberate and
// enforced by the schema handed to the model.

export const DefectObservation = z.object({
  code: z.enum(DEFECT_CODES as [string, ...string[]]),
  severity: z.number().min(0).max(4),
  extent: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  note: z.string().max(240).optional(),
});

export const PhotoAnalysis = z.object({
  photo_id: z.string(),
  component: z.enum(COMPONENTS as unknown as [Component, ...Component[]]),
  component_confidence: z.number().min(0).max(1),
  quality: z.enum(["good", "fair", "poor", "unusable"]),
  caption: z.string().max(240).optional(),
  defects: z.array(DefectObservation).max(12),
  /** Set when the analysis failed; the job continues without this photo. */
  error: z.string().optional(),
});

export type DefectObservation = z.infer<typeof DefectObservation>;
export type PhotoAnalysis = z.infer<typeof PhotoAnalysis>;

// ------------------------------------------------------------ result

export interface ComponentScore {
  component: Component;
  /** 0 (unusable / must replace) .. 5 (as-new). */
  score: number;
  confidence: number;
  photo_ids: string[];
  photo_count: number;
  defects: {
    code: string;
    label: string;
    severity: number;
    extent: number;
    confidence: number;
    photo_ids: string[];
  }[];
}

export interface CoverageGap {
  component: Component;
  severity: "critical" | "recommended";
  impact: string;
}

export interface RepairLineItem {
  cost_item_id: string;
  label: string;
  component: Component;
  trade: string;
  unit: string;
  quantity: number;
  /** Human-readable derivation of the quantity — shown in the audit trail. */
  basis: string;
  unit_cost_low: number;
  unit_cost_expected: number;
  unit_cost_high: number;
  low: number;
  expected: number;
  high: number;
  confidence: number;
  driving_defects: string[];
  source_photo_ids: string[];
}

export interface EvaluationResult {
  job_id: string;
  status: "complete";
  created_at: string;
  completed_at: string;
  costbook_version: string;
  model: { provider: string; model: string };
  property: z.infer<typeof PropertyInput>;
  condition: {
    overall_score: number; // 0..100
    confidence: number;
    components: ComponentScore[];
  };
  coverage: {
    score: number;
    photos_analyzed: number;
    photos_rejected: number;
    missing: CoverageGap[];
  };
  repairs: RepairLineItem[];
  estimate: {
    subtotal_low: number;
    subtotal_expected: number;
    subtotal_high: number;
    contingency_pct: number;
    region_code: string;
    region_multiplier: number;
    low: number;
    expected: number;
    high: number;
    confidence: number;
  };
  photo_analyses: PhotoAnalysis[];
  warnings: string[];
}

export type JobStatus = "queued" | "analyzing" | "pricing" | "complete" | "failed";

export interface JobRecord {
  id: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  progress: { analyzed: number; total: number };
  request?: EvaluateRequest;
  result?: EvaluationResult;
  error?: string;
}
