import { NextResponse } from "next/server";
import { getCostBook, costBookMeta } from "@/lib/costbook";
import { DEFECTS } from "@/lib/taxonomy";

export const runtime = "nodejs";

/**
 * GET /api/costbook
 *
 * Publishes the pricing source and the defect→cost-item mapping. This endpoint
 * exists so an underwriter can verify, independently of any model output, that
 * every dollar the system can produce is enumerable in advance.
 */
export async function GET(req: Request) {
  const book = getCostBook();
  const url = new URL(req.url);

  if (url.searchParams.get("include") === "mapping") {
    return NextResponse.json({
      ...costBookMeta,
      mapping: DEFECTS.map((d) => ({
        defect_code: d.code,
        label: d.label,
        components: d.components,
        resolves_to: d.repairs.map((r) => ({
          when_severity_up_to: r.maxSeverity,
          cost_item_id: r.costItemId,
          quantity_basis: r.basis,
          scales_with_extent: r.scaleByExtent,
        })),
      })),
    });
  }

  return NextResponse.json({ ...costBookMeta, items: book.all() });
}
