import {
  DEFECT_BY_CODE,
  EXPECTED_COVERAGE,
  selectRepairRules,
  type Component,
} from "./taxonomy";
import { getCostBook } from "./costbook";
import { takeoff } from "./quantities";
import type {
  ComponentScore,
  CoverageGap,
  EvaluateRequest,
  EvaluationResult,
  PhotoAnalysis,
  PropertyInput,
  RepairLineItem,
} from "./types";

/**
 * The deterministic half of the system.
 *
 * Everything below is a pure function of (photo observations + property record +
 * cost book). No network calls, no model calls, no clock, no randomness. Run it
 * twice on the same observations and you get byte-identical dollars — which is
 * the whole reason an underwriter can sign off on the number.
 *
 * It is also independently re-runnable: if the cost book is updated, re-price
 * stored observations without paying for a single vision call again.
 */

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const round2 = (n: number) => Math.round(n * 100) / 100;
const money = (n: number) => Math.round(n);

// ---------------------------------------------------------------- step 2
// Photo observations → component scores (0–5)

export function scoreComponents(analyses: PhotoAnalysis[]): ComponentScore[] {
  const usable = analyses.filter((a) => !a.error && a.quality !== "unusable");
  const byComponent = new Map<Component, PhotoAnalysis[]>();

  for (const a of usable) {
    const list = byComponent.get(a.component) ?? [];
    list.push(a);
    byComponent.set(a.component, list);
  }

  const out: ComponentScore[] = [];

  for (const [component, photos] of byComponent) {
    // Collapse repeated sightings of the same defect: take the worst severity
    // and the widest extent seen, not the sum — three photos of one cracked
    // wall is one cracked wall.
    const merged = new Map<
      string,
      { severity: number; extent: number; confidence: number; photo_ids: string[]; n: number }
    >();

    for (const photo of photos) {
      for (const d of photo.defects) {
        const prev = merged.get(d.code);
        if (!prev) {
          merged.set(d.code, {
            severity: d.severity,
            extent: d.extent,
            confidence: d.confidence,
            photo_ids: [photo.photo_id],
            n: 1,
          });
        } else {
          prev.severity = Math.max(prev.severity, d.severity);
          prev.extent = Math.max(prev.extent, d.extent);
          // Corroboration across photos raises confidence, with diminishing return.
          prev.confidence = clamp(
            (prev.confidence * prev.n + d.confidence) / (prev.n + 1) + 0.05,
            0,
            0.98,
          );
          prev.photo_ids.push(photo.photo_id);
          prev.n += 1;
        }
      }
    }

    // 5.0 = as-new. Each defect subtracts scoreImpact scaled by severity and
    // how much of the surface it covers.
    let score = 5;
    const defects: ComponentScore["defects"] = [];

    for (const [code, m] of merged) {
      const def = DEFECT_BY_CODE.get(code);
      if (!def) continue;
      const severityFactor = m.severity / 4;
      const extentFactor = 0.4 + 0.6 * m.extent; // even a small defect costs something
      score -= def.scoreImpact * severityFactor * extentFactor;
      defects.push({
        code,
        label: def.label,
        severity: round2(m.severity),
        extent: round2(m.extent),
        confidence: round2(m.confidence),
        photo_ids: m.photo_ids,
      });
    }

    defects.sort((a, b) => b.severity * b.extent - a.severity * a.extent);

    // Evidence weight: one photo of a room is thin, four is solid.
    const qualityFactor =
      photos.reduce((s, p) => s + (p.quality === "good" ? 1 : p.quality === "fair" ? 0.8 : 0.55), 0) /
      photos.length;
    const countFactor = clamp(0.6 + 0.14 * photos.length, 0, 1);
    const modelConfidence =
      photos.reduce((s, p) => s + p.component_confidence, 0) / photos.length;

    out.push({
      component,
      score: round2(clamp(score, 0, 5)),
      confidence: round2(clamp(modelConfidence * qualityFactor * countFactor, 0.05, 0.97)),
      photo_ids: photos.map((p) => p.photo_id),
      photo_count: photos.length,
      defects,
    });
  }

  out.sort((a, b) => a.score - b.score); // worst first — that is what gets read
  return out;
}

/** Coverage-weighted 0–100 condition score. */
export function overallCondition(components: ComponentScore[]): number {
  if (!components.length) return 0;
  const weights = new Map(EXPECTED_COVERAGE.map((e) => [e.component, e.weight]));
  let num = 0;
  let den = 0;
  for (const c of components) {
    const w = weights.get(c.component) ?? 0.04;
    num += (c.score / 5) * w;
    den += w;
  }
  return Math.round((num / den) * 100);
}

// ---------------------------------------------------------------- step 3
// Coverage gaps

export function assessCoverage(
  components: ComponentScore[],
  analyses: PhotoAnalysis[],
  property: PropertyInput,
) {
  const seen = new Set(components.map((c) => c.component));
  const missing: CoverageGap[] = [];
  let score = 0;
  let possible = 0;

  for (const exp of EXPECTED_COVERAGE) {
    possible += exp.weight;
    if (seen.has(exp.component)) {
      score += exp.weight;
    } else {
      missing.push({
        component: exp.component,
        severity: exp.critical ? "critical" : "recommended",
        impact: exp.critical
          ? `No ${exp.component} photo. This component is priced from inference only — the true figure can move materially in either direction.`
          : `No ${exp.component} photo. Condition assumed average for the property's apparent vintage.`,
      });
    }
  }

  // Multi-bathroom / multi-bedroom properties need more than one photo each.
  const bathPhotos = components.find((c) => c.component === "bathroom")?.photo_count ?? 0;
  const expectedBaths = Math.round(property.baths);
  if (bathPhotos > 0 && bathPhotos < expectedBaths) {
    missing.push({
      component: "bathroom",
      severity: "recommended",
      impact: `${bathPhotos} of ${expectedBaths} bathroom(s) photographed. Unseen baths priced at the observed average.`,
    });
    score -= 0.03;
  }

  const bedPhotos = components.find((c) => c.component === "bedroom")?.photo_count ?? 0;
  if (bedPhotos > 0 && bedPhotos < property.beds) {
    missing.push({
      component: "bedroom",
      severity: "recommended",
      impact: `${bedPhotos} of ${property.beds} bedroom(s) photographed. Unseen bedrooms priced at the observed average.`,
    });
    score -= 0.02;
  }

  const rejected = analyses.filter((a) => a.error || a.quality === "unusable").length;

  return {
    score: round2(clamp(score / possible, 0, 1)),
    photos_analyzed: analyses.length - rejected,
    photos_rejected: rejected,
    missing,
  };
}

// ------------------------------------------------------------ steps 4–6
// Quantity takeoff → cost-book match → priced line items.
//
// The model has now been left behind entirely. From here on, dollars come
// exclusively from the cost book.

export function priceRepairs(
  components: ComponentScore[],
  property: PropertyInput,
): { repairs: RepairLineItem[]; warnings: string[] } {
  const bookProvider = getCostBook();
  const warnings: string[] = [];

  interface Draft {
    item: ReturnType<typeof bookProvider.get>;
    quantity: number;
    basis: string;
    component: Component;
    confidence: number;
    defects: Set<string>;
    photos: Set<string>;
  }

  const drafts = new Map<string, Draft>();

  for (const comp of components) {
    for (const defect of comp.defects) {
      if (defect.severity < 1 || defect.extent <= 0) continue; // observed but negligible

      const def = DEFECT_BY_CODE.get(defect.code);
      if (!def) continue;

      for (const rule of selectRepairRules(def, defect.severity)) {
        const item = bookProvider.get(rule.costItemId);
        if (!item) {
          warnings.push(
            `Defect ${defect.code} maps to cost item ${rule.costItemId}, which is absent from cost book ${bookProvider.version()}. Line omitted.`,
          );
          continue;
        }

        const t = takeoff(rule.basis, property);
        let quantity = t.quantity;
        const parts = [t.basis];

        if (rule.factor != null) {
          quantity *= rule.factor;
          parts.push(`× ${rule.factor} rule factor`);
        }
        if (rule.scaleByExtent) {
          quantity *= defect.extent;
          parts.push(`× ${Math.round(defect.extent * 100)}% observed extent`);
        }

        // Discrete units can't be fractional — you do not gut 0.82 of a
        // bathroom or hang 3.4 doors. Round up to whole units.
        if (item.unit === "ea") {
          const whole = Math.max(1, Math.ceil(quantity - 0.001));
          if (whole !== quantity) parts.push(`→ ${whole} whole unit(s)`);
          quantity = whole;
        }

        quantity = Math.round(quantity * 100) / 100;
        if (quantity <= 0) continue;

        const confidence = round2(clamp(defect.confidence * comp.confidence, 0.05, 0.95));
        const existing = drafts.get(item.id);

        if (!existing) {
          drafts.set(item.id, {
            item,
            quantity,
            basis: parts.join(" "),
            component: comp.component,
            confidence,
            defects: new Set([defect.code]),
            photos: new Set(defect.photo_ids),
          });
        } else {
          // Same cost item reached by two different defects — take the larger
          // quantity, never the sum. A roof needing replacement because it is
          // old AND missing shingles is still one roof.
          existing.defects.add(defect.code);
          defect.photo_ids.forEach((p) => existing.photos.add(p));
          existing.confidence = Math.max(existing.confidence, confidence);
          if (quantity > existing.quantity) {
            existing.quantity = quantity;
            existing.basis = parts.join(" ");
          }
        }
      }
    }
  }

  const repairs: RepairLineItem[] = [...drafts.values()].map((d) => {
    const item = d.item!;
    return {
      cost_item_id: item.id,
      label: item.label,
      component: d.component,
      trade: item.trade,
      unit: item.unit,
      quantity: d.quantity,
      basis: d.basis,
      unit_cost_low: item.unit_cost_low,
      unit_cost_expected: item.unit_cost_expected,
      unit_cost_high: item.unit_cost_high,
      low: money(d.quantity * item.unit_cost_low),
      expected: money(d.quantity * item.unit_cost_expected),
      high: money(d.quantity * item.unit_cost_high),
      confidence: d.confidence,
      driving_defects: [...d.defects],
      source_photo_ids: [...d.photos],
    };
  });

  repairs.sort((a, b) => b.expected - a.expected); // biggest dollars first
  return { repairs, warnings };
}

export function rollUp(
  repairs: RepairLineItem[],
  coverage: { score: number },
  property: PropertyInput,
  contingencyPct: number,
) {
  const bookProvider = getCostBook();
  const region = bookProvider.regionMultiplier(property.region_code);

  const subtotal_low = repairs.reduce((s, r) => s + r.low, 0);
  const subtotal_expected = repairs.reduce((s, r) => s + r.expected, 0);
  const subtotal_high = repairs.reduce((s, r) => s + r.high, 0);

  // Dollar-weighted confidence: a shaky $400 line matters far less than a
  // shaky $18,000 roof.
  const weighted = subtotal_expected
    ? repairs.reduce((s, r) => s + r.expected * r.confidence, 0) / subtotal_expected
    : 0.4;
  const confidence = round2(clamp(weighted * Math.sqrt(Math.max(coverage.score, 0.05)), 0.05, 0.95));

  // Thin evidence must widen the band, not shift the midpoint. An honest wide
  // range beats a confident wrong number.
  const uncertainty = 1 - confidence;
  const lowAdj = 1 - uncertainty * 0.15;
  const highAdj = 1 + uncertainty * 0.4;

  const mul = region.multiplier * (1 + contingencyPct);

  return {
    subtotal_low: money(subtotal_low),
    subtotal_expected: money(subtotal_expected),
    subtotal_high: money(subtotal_high),
    contingency_pct: contingencyPct,
    region_code: region.code,
    region_multiplier: region.multiplier,
    low: money(subtotal_low * mul * lowAdj),
    expected: money(subtotal_expected * mul),
    high: money(subtotal_high * mul * highAdj),
    confidence,
  };
}

// --------------------------------------------------------------- compose

export function buildResult(args: {
  jobId: string;
  createdAt: string;
  request: EvaluateRequest;
  analyses: PhotoAnalysis[];
  model: { provider: string; model: string };
}): EvaluationResult {
  const { jobId, createdAt, request, analyses, model } = args;
  const property = request.property;

  const components = scoreComponents(analyses);
  const coverage = assessCoverage(components, analyses, property);
  const { repairs, warnings } = priceRepairs(components, property);
  const contingency = request.options?.contingency_pct ?? 0.1;
  const estimate = rollUp(repairs, coverage, property, contingency);

  const componentConfidence = components.length
    ? components.reduce((s, c) => s + c.confidence, 0) / components.length
    : 0;

  if (coverage.photos_rejected > 0) {
    warnings.push(
      `${coverage.photos_rejected} photo(s) were unusable and excluded from scoring.`,
    );
  }
  for (const gap of coverage.missing.filter((m) => m.severity === "critical")) {
    warnings.push(`Critical coverage gap: no ${gap.component} photo supplied.`);
  }

  return {
    job_id: jobId,
    status: "complete",
    created_at: createdAt,
    completed_at: new Date().toISOString(),
    costbook_version: getCostBook().version(),
    model,
    property,
    condition: {
      overall_score: overallCondition(components),
      confidence: round2(clamp(componentConfidence * Math.sqrt(Math.max(coverage.score, 0.05)), 0.05, 0.97)),
      components,
    },
    coverage,
    repairs,
    estimate,
    photo_analyses: analyses,
    warnings,
  };
}
