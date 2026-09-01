# Estimate — Photo Condition & Rehab Estimator API

**Prepared by:** Shakil Ahmed · BarakahSoft LLC
**Rate:** $150/hr
**Date:** 2026-09-02

---

## Phase 0 — Working demo · **already built, not billed**

Delivered before the contract as proof of approach. Everything below already runs:

- 14-component photo classification with per-photo confidence
- 44-code defect taxonomy, severity 0–4 + extent 0–1
- Component scoring 0–5, overall condition 0–100
- Coverage-gap detection with stated dollar impact
- Named quantity takeoff rules, each emitting its own derivation
- 53-item national cost book + 22 regional multipliers
- Deterministic pricing engine → low / expected / high
- Async job pipeline (Inngest fan-out) + inline fallback
- Full JSON API + web UI + `/api/costbook` audit endpoint

**≈14 hours. Billed at $0.**

---

## Phased build

| # | Phase | Scope | Hrs | @ $150 |
|---|---|---|---:|---:|
| 1 | **Your pricing database** | `CostBookProvider` adapter against your repair-cost DB; schema mapping; regional multiplier import; defect→item mapping reviewed line by line with your estimator | 16 | $2,400 |
| 2 | **Production hardening** | API keys + per-tenant scoping, rate limits, idempotency keys, Postgres schema & migrations, structured logging, error budgets, S3/CDN photo ingest | 24 | $3,600 |
| 3 | **Calibration** | Harness to replay 50–100 closed jobs against actual invoices; tune severity→quantity curves and confidence weights; accuracy report per component | 18 | $2,700 |
| 4 | **Integration & ops** | Webhooks on completion, batch endpoint, portfolio dashboard, runbook, handover docs | 16 | $2,400 |
| | | **Total** | **74** | **$11,100** |

Phases are independently shippable. Phase 1 alone gives you a system running on
your own pricing data — that is the shortest path to something usable.

## Suggested cadence

~20 hrs/week → **Phase 1 live in week 1**, Phases 1–2 in ~3 weeks, all four in
~5 weeks. Comfortably inside your 1–3 month window and under 30 hrs/week.

## Running cost at volume

Pricing is deterministic and free to compute. The only variable cost is vision.

| Photos/property | Vision cost | 1,000 properties/mo |
|---:|---:|---:|
| 10 | ~$0.05 | ~$50 |
| 25 | ~$0.13 | ~$130 |
| 50 | ~$0.26 | ~$260 |

Flash-tier vision, one call per photo. Hosting (Vercel + Inngest + Postgres) runs
$20–60/mo at that volume. Re-pricing after a cost-book update costs **$0** — the
observations are stored, so only steps 4–6 re-run.

## On the rate

The posting says $25–55/hr. I bill $150. The number that matters is the total,
not the rate:

- **74 hrs × $150 = $11,100**, with Phase 0 already done and in your hands today.
- The same scope at $45/hr generally runs 250–350 hrs once you include the
  discovery, rework and the architecture conversation that produces the
  model-emits-no-dollars split — **$11,250–15,750**, over a longer calendar.

You are not paying for hours here, you are paying for the fact that the hard
design decision was already made and shipped before we spoke. If the budget is
firm, the honest move is to scope down rather than slow down: **Phase 1 + 2 =
40 hrs / $6,000** gets you a production API on your own pricing data, and Phases
3–4 wait until the system has real jobs to calibrate against.

## Fixed-price alternative

If you prefer certainty over hourly:

| Package | Scope | Price |
|---|---|---:|
| **Starter** | Phase 1 | $2,800 fixed |
| **Production** | Phases 1–2 | $6,400 fixed |
| **Complete** | Phases 1–4 | $11,900 fixed |

Fixed price includes a 10% buffer against scope drift and is billed 40% on start,
60% on acceptance.

## What I need from you

1. Your repair-cost database — schema, or a CSV export of items + unit costs
2. 10–20 sample properties with photos (ideally with known actual rehab costs)
3. Regional multiplier table, if you maintain one
4. Whether photos arrive as URLs or uploads, and expected monthly volume

Item 1 unblocks Phase 1 on day one. Item 2 is what makes Phase 3 worth paying for.
