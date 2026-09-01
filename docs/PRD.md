# PRD — Photo Condition & Rehab Estimator API

**Version:** 1.0
**Date:** 2026-09-02
**Author:** Shakil Ahmed (BarakahSoft LLC)
**Status:** Working demo built · production plan below

---

## 1. Problem

Acquisition teams, iBuyers, lenders and insurers underwrite properties from a handful
of phone photos. Today a human looks at 5–50 images and guesses: "kitchen's dated,
roof looks rough, call it $40k." That guess is slow, inconsistent between analysts,
and impossible to audit six months later when the rehab comes in at $71k.

The obvious fix — "ask GPT what the rehab costs" — fails underwriting review, because
a language model inventing dollar amounts is not a defensible number. It cannot be
reconciled to a cost book, it drifts between model versions, and it cannot be
explained to a credit committee.

## 2. Core architectural principle

> **The vision model never emits a dollar amount. Ever.**

The AI is used strictly as a **perception layer**. It answers closed-vocabulary
questions about pixels:

- *What room is this?* → one of 14 enum values
- *What defects are visible?* → codes from a fixed defect taxonomy
- *How bad?* → severity 0–4
- *How much of the surface?* → extent 0.0–1.0
- *How sure are you?* → confidence 0.0–1.0

Everything with a `$` in front of it is computed by a **deterministic pricing engine**
reading a **versioned cost book**. Same observations in → same dollars out, forever.

```
photos ──▶ [ VISION LAYER ]  ──▶ observations  ──▶ [ PRICING ENGINE ] ──▶ $ low/exp/high
           non-deterministic       (no dollars)      fully deterministic
           Gemini / OpenAI                            cost book v1.0.0
```

This split is the product. It is what makes the output auditable: every dollar traces
to `costbook_version → cost_item_id → unit_cost × quantity × region_multiplier`.

## 3. Users & jobs-to-be-done

| User | Job |
| --- | --- |
| Acquisitions analyst | Screen 200 leads/day; kill obvious losers in seconds |
| Underwriter | Defend a rehab number line-by-line to committee |
| Asset manager | Compare condition across a portfolio on one 0–100 scale |
| Integrator (API consumer) | POST photos, GET structured JSON, no UI needed |

## 4. Scope — v1

### 4.1 In scope

1. **Photo classification** — each image labelled to a component with confidence.
2. **Defect identification** — closed taxonomy, per photo, with severity + extent.
3. **Component scoring** — every component scored **0–5**.
4. **Overall condition** — single **0–100** score, coverage-weighted.
5. **Confidence scores** — per photo, per component, and per estimate.
6. **Coverage gap detection** — "no roof photo", "3 of 4 bedrooms unseen".
7. **Standardized repair items** — normalized line items, not free text.
8. **Quantity estimation** — takeoff from sqft / beds / baths / extent.
9. **Cost-book matching** — every line item resolves to a priced DB row.
10. **Low / expected / high** rehab estimates, with contingency.
11. **Structured JSON API** + async job model + a demo web UI.

### 4.2 Explicitly out of scope for v1

- ARV / comps / valuation modelling (this prices *rehab*, not the house)
- Structural or engineering sign-off
- Interior measurement from photos (photogrammetry)
- Permit and fee schedules

## 5. Data model

### 5.1 Input

```jsonc
{
  "property": {
    "address": "812 Kingsley Ave, Akron, OH 44305",
    "square_feet": 1640,
    "beds": 3,
    "baths": 2,
    "year_built": 1972,          // optional
    "region_code": "OH-AKRON"    // optional, drives cost multiplier
  },
  "photos": [
    { "id": "p1", "url": "https://..." },        // url OR
    { "id": "p2", "data": "data:image/jpeg;..." } // inline base64
  ]
}
```

Constraint: **5–50 photos**. Under 5 the coverage penalty makes the estimate
untrustworthy; over 50 the marginal information is near zero and cost/latency rise
linearly.

### 5.2 Component taxonomy (14)

`kitchen`, `bathroom`, `bedroom`, `living_area`, `exterior`, `roof`, `foundation`,
`landscaping`, `garage`, `basement`, `attic`, `hvac`, `electrical`, `plumbing`

### 5.3 Defect taxonomy

Closed set of ~40 codes, each mapped to one or more cost-book items. Examples:

| Code | Component | Maps to |
| --- | --- | --- |
| `KIT_CABINET_DATED` | kitchen | `KIT-CAB-REFACE` / `KIT-CAB-REPLACE` |
| `KIT_COUNTER_DAMAGED` | kitchen | `KIT-CTR-LAM`, `KIT-CTR-GRAN` |
| `ROOF_SHINGLE_MISSING` | roof | `ROOF-SHNG-REPL` |
| `EXT_PAINT_PEELING` | exterior | `EXT-PAINT-FULL` |
| `BATH_TILE_CRACKED` | bathroom | `BATH-TILE-REPL` |
| `FLOOR_CARPET_STAINED` | any | `FLR-CARP-REPL` |
| `WATER_DAMAGE_CEILING` | any | `DRY-CEIL-PATCH`, `PAINT-INT-ROOM` |

Severity `0–4` (none → severe) and extent `0.0–1.0` (fraction of surface affected)
are what drive **quantity**, not the model's opinion of cost.

### 5.4 Cost book

Versioned table `cost_items`, shipped as `data/repair-costs.v1.json` and loadable to
Postgres:

```jsonc
{
  "id": "ROOF-SHNG-REPL",
  "label": "Asphalt shingle roof — tear off & replace",
  "unit": "sq",                 // squares (100 sf)
  "unit_cost_low": 385,
  "unit_cost_expected": 465,
  "unit_cost_high": 610,
  "component": "roof",
  "trade": "roofing",
  "source": "national_avg_2026Q1"
}
```

Regional multipliers live in a sibling table so one national book serves all markets.
**Swapping in the client's proprietary cost database is a config change, not a rewrite** —
implement the `CostBookProvider` interface and the engine is unchanged.

### 5.5 Output (abridged)

```jsonc
{
  "job_id": "job_01J...",
  "status": "complete",
  "costbook_version": "1.0.0",
  "condition": {
    "overall_score": 61,                 // 0-100
    "confidence": 0.78,
    "components": [
      { "component": "kitchen", "score": 2.5, "confidence": 0.86,
        "photo_ids": ["p1","p4"], "defects": [...] }
    ]
  },
  "coverage": {
    "score": 0.72,
    "missing": [
      { "component": "roof", "severity": "critical",
        "impact": "Roof priced from exterior inference only; ±$9,400 swing." }
    ]
  },
  "repairs": [
    { "cost_item_id": "ROOF-SHNG-REPL", "label": "...", "quantity": 18.5,
      "unit": "sq", "low": 7122, "expected": 8602, "high": 11285,
      "basis": "1640 sf ÷ 100 × 1.13 pitch factor", "confidence": 0.55,
      "source_photo_ids": ["p9"] }
  ],
  "estimate": { "low": 38940, "expected": 52310, "high": 71880,
                "contingency_pct": 0.10, "region_multiplier": 0.92 }
}
```

## 6. Pipeline

Async, because 50 photos × a vision call exceeds any sane HTTP timeout.

```
POST /api/evaluate
   └─▶ persist job (queued) ──▶ emit  rehab/evaluation.requested
                                   │
                        ┌──────────┴─────────── Inngest ────────────┐
                        │ step 1  fan-out: analyze each photo       │  ← concurrency-capped
                        │ step 2  aggregate → component scores      │
                        │ step 3  coverage gaps                     │
                        │ step 4  quantity takeoff                  │
                        │ step 5  cost-book match → line items      │
                        │ step 6  roll up low/expected/high         │
                        └────────────────────┬──────────────────────┘
                                             ▼
                              persist result (complete)
GET /api/jobs/{id}  ──▶ full structured JSON
```

Steps 4–6 are pure functions — no network, no model, fully replayable. If pricing
changes, re-run steps 4–6 against stored observations without re-billing a single
vision call.

## 7. Non-functional requirements

| Concern | Target |
| --- | --- |
| Latency | 25 photos ≈ 40–70s end to end (parallel fan-out) |
| Cost | ≈ $0.004–0.011 per photo (flash-tier vision) |
| Determinism | Identical observations ⇒ byte-identical dollars |
| Auditability | Every $ traceable to costbook version + item id |
| Idempotency | `Idempotency-Key` header on POST /evaluate |
| Failure isolation | One bad photo degrades coverage, never fails the job |
| Provider risk | Gemini ⇄ OpenAI swap via `VISION_PROVIDER` env |

## 8. Confidence model

Three levels, deliberately separated:

1. **Photo confidence** — model's own certainty on classification + defects.
2. **Component confidence** — photo confidence × photo count factor. One blurry
   photo of a bathroom is not the same evidence as four sharp ones.
3. **Estimate confidence** — component confidence weighted by each component's
   dollar share, then penalised by coverage gaps.

The band between `low` and `high` widens as confidence falls. A job with no roof
photo returns a wide roof range and says so, rather than quietly guessing.

## 9. Delivery phases

| Phase | Deliverable |
| --- | --- |
| 0 — **done, in this repo** | Working demo: full pipeline, 48-item cost book, API, UI |
| 1 | Client's proprietary cost DB adapter + regional multiplier import |
| 2 | Postgres persistence, API keys, rate limits, per-tenant cost books |
| 3 | Calibration harness: 50–100 closed jobs, tune severity→quantity curves |
| 4 | Webhooks, batch endpoint, S3/CDN photo ingest, dashboards |

## 10. Risks

| Risk | Mitigation |
| --- | --- |
| Vision model misclassifies room | Confidence floor + coverage gap flags; low-confidence photos excluded from scoring, listed for review |
| Quantity takeoff is the weak link | Every quantity carries an explicit `basis` string; Phase 3 calibration tunes it against actual invoices |
| Client cost DB has a different schema | `CostBookProvider` interface — one adapter file |
| Model deprecation | Runtime fallback chain across model ids + provider abstraction |
| Photos of the wrong property | EXIF/geo check flagged as Phase 2 |

## 11. Acceptance criteria

- [x] 5–50 photos accepted via URL or inline base64
- [x] Every photo classified with confidence
- [x] Defects from a closed taxonomy with severity + extent
- [x] Every component scored 0–5
- [x] Overall condition 0–100
- [x] Coverage gaps enumerated with impact
- [x] Standardized repair items, quantities with stated basis
- [x] 100% of line items resolved against the cost book
- [x] Low / expected / high with contingency and region multiplier
- [x] Structured JSON over HTTP; async job model
- [x] **Zero dollar amounts produced by the model**
