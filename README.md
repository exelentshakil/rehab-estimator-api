# Photo Condition & Rehab Estimator API

Upload 5–50 property photos plus a property record. Get back classified photos,
scored components, coverage gaps, standardized repair line items with quantities,
and a low / expected / high rehab estimate — as structured JSON.

**The vision model never produces a dollar amount.** It reports observations from
a closed vocabulary. Every dollar is computed by a deterministic engine reading a
versioned cost book.

```
photos ──▶ [ VISION LAYER ]  ──▶ observations  ──▶ [ PRICING ENGINE ] ──▶ $ low/exp/high
           non-deterministic       (no dollars)      fully deterministic
           Gemini / OpenAI                            cost book v1.0.0
```

Full spec: [`docs/PRD.md`](docs/PRD.md) · Commercials: [`docs/ESTIMATE.md`](docs/ESTIMATE.md)

---

## Why this split matters

An LLM asked "what does this rehab cost?" gives a number that cannot be reconciled
to a cost book, drifts between model versions, and cannot be defended to a credit
committee. So the model is never asked.

It is handed a JSON schema with **no cost field in it**. It answers four questions
only: *what room, what defects, how severe, how much of the surface*. Then it is
out of the loop. Quantities come from the property record via named takeoff rules;
prices come from the cost book; the arithmetic is pure and replayable.

Consequences that matter commercially:

- **Auditable** — every line carries `cost_item_id`, unit cost, quantity, and a
  plain-English `basis` string an underwriter can check by hand.
- **Stable** — same observations in, byte-identical dollars out. Forever.
- **Re-priceable** — update the cost book, re-run steps 4–6 against stored
  observations, pay for zero new vision calls.
- **Yours** — swapping in a proprietary pricing database is one adapter file
  (`CostBookProvider`), not a rewrite.

## Run it

```bash
npm install && npm run dev
```

Open http://localhost:3000. It runs with **no environment variables at all** —
vision falls back to a deterministic simulator, jobs run inline, storage is
in-process. Enough to review the whole pricing engine. Add `GEMINI_API_KEY` (or
`OPENAI_API_KEY`) to `.env.local` to turn on real photo analysis.

`GET /api/health` tells you which layers are live.

## API

### `POST /api/evaluate`

```jsonc
{
  "property": {
    "address": "812 Kingsley Ave, Akron, OH 44305",
    "square_feet": 1640, "beds": 3, "baths": 2,
    "year_built": 1972,          // optional
    "region_code": "OH-AKRON"    // optional, drives the market multiplier
  },
  "photos": [
    { "id": "p1", "url": "https://cdn.example.com/1.jpg" },
    { "id": "p2", "data": "data:image/jpeg;base64,..." }
  ],
  "options": { "contingency_pct": 0.10 }
}
```

- **202** `{ job_id, poll }` when Inngest is configured — poll `GET /api/jobs/{id}`.
- **200** the full evaluation when running inline. Force with `?mode=sync`.
- **422** with per-field issues when the body fails validation.

### `GET /api/jobs/{id}`

Job status and progress while running; the complete evaluation once done.

### `GET /api/costbook` · `GET /api/costbook?include=mapping`

The pricing source itself, and the full defect → cost-item mapping. This endpoint
exists so a reviewer can verify — without running a single photo through a model —
that every dollar the system is capable of producing is enumerable in advance.

### `GET /api/health`

Which vision provider, queue and storage backend are actually live.

## Response shape (abridged)

```jsonc
{
  "job_id": "job_...", "status": "complete", "costbook_version": "1.0.0",
  "model": { "provider": "gemini", "model": "gemini-3.7-flash" },
  "condition": {
    "overall_score": 61, "confidence": 0.78,
    "components": [{ "component": "kitchen", "score": 2.5, "confidence": 0.86,
                     "photo_ids": ["p1","p4"], "defects": [...] }]
  },
  "coverage": { "score": 0.72, "photos_analyzed": 22, "photos_rejected": 1,
                "missing": [{ "component": "roof", "severity": "critical",
                              "impact": "No roof photo. Priced from inference only…" }] },
  "repairs": [{ "cost_item_id": "ROOF-SHNG-REPL", "quantity": 18.9, "unit": "sq",
                "basis": "1640 sf footprint × 1.15 pitch ÷ 100",
                "low": 7277, "expected": 8789, "high": 11529,
                "confidence": 0.55, "driving_defects": ["ROOF_AGE_END_OF_LIFE"],
                "source_photo_ids": ["p9"] }],
  "estimate": { "subtotal_expected": 52310, "contingency_pct": 0.10,
                "region_code": "OH-AKRON", "region_multiplier": 0.92,
                "low": 38940, "expected": 52310, "high": 71880, "confidence": 0.71 }
}
```

## How the numbers are built

**Component score (0–5).** Starts at 5. Each defect subtracts
`scoreImpact × (severity/4) × (0.4 + 0.6 × extent)`. Repeat sightings of the same
defect across photos collapse to the worst severity and widest extent — three
photos of one cracked wall is one cracked wall, and corroboration raises
confidence rather than doubling the damage.

**Overall condition (0–100).** Component scores weighted by their share of a
typical property's value, renormalized over whatever was actually photographed.

**Quantities.** Named, pure takeoff rules over the property record — e.g. roof
squares = `footprint × 1.15 pitch ÷ 100`; exterior wall area =
`perimeter × 9ft × stories × 0.85 opening deduction`. Every rule emits the sentence
explaining itself. The model never picks a quantity; it only reports `extent`.

**Cost matching.** Each defect + severity selects a repair rule → a `cost_item_id`.
Severity routes between strategies: light shingle damage → patch, severe → full
replacement. When two defects reach the same cost item the engine takes the
**larger** quantity, never the sum.

**Confidence.** Three separate levels — per photo, per component (model certainty ×
photo quality × evidence count), and per estimate (dollar-weighted, then penalized
by coverage). Low confidence **widens the band**; it never shifts the midpoint. An
honest wide range beats a confident wrong number.

## Architecture

| Path | Role |
| --- | --- |
| `src/lib/taxonomy.ts` | Closed vocabulary: 14 components, 44 defect codes, repair rules |
| `src/lib/vision.ts` | Provider layer — Gemini/OpenAI, model fallback chain, simulator |
| `src/lib/quantities.ts` | Pure takeoff rules; every quantity states its derivation |
| `src/lib/costbook.ts` | `CostBookProvider` — the seam for a client pricing DB |
| `src/lib/engine.ts` | Deterministic: scoring, coverage, matching, rollup |
| `src/lib/inngest.ts` | Async fan-out with per-photo retries |
| `src/lib/pipeline.ts` | Same pipeline, inline, for small jobs and local dev |
| `data/repair-costs.v1.json` | The cost book. The only file with dollars in it. |

**Failure isolation.** One unreadable photo returns `quality: "unusable"` with an
error string, is excluded from scoring, and lowers coverage. It never fails the job.

**Model risk.** `GEMINI_MODEL` / `OPENAI_MODEL` are comma-separated fallback chains;
the first model that answers wins. A deprecation cannot take the endpoint down.

## Deploy

Vercel + Inngest. Set on the Vercel project:

```
GEMINI_API_KEY, VISION_PROVIDER=gemini
NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
INNGEST_EVENT_KEY, INNGEST_SIGNING_KEY
```

Then register `https://<your-app>/api/inngest` in the Inngest dashboard. Without
Inngest keys the API still works — jobs simply run inline. Table DDL is in
`docs/PRD.md §5`; the app creates nothing at runtime.

## Status

Working demo covering the full brief. Not yet production: no auth/API keys, no
rate limiting, no webhooks, and the quantity curves are national approximations
that want calibration against real invoices before anyone underwrites off them.
Those are Phases 1–4 in the PRD.
