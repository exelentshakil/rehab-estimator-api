import book from "../../data/repair-costs.v1.json";
import type { Component } from "./taxonomy";

export interface CostItem {
  id: string;
  label: string;
  component: Component;
  trade: string;
  unit: string;
  unit_cost_low: number;
  unit_cost_expected: number;
  unit_cost_high: number;
}

/**
 * The seam where a client's proprietary pricing database plugs in.
 *
 * The pricing engine only ever talks to this interface. Swapping the bundled
 * national book for a client's Postgres/Snowflake/RSMeans feed means writing one
 * adapter that satisfies these four methods — no change to scoring, quantities,
 * taxonomy or the API surface.
 */
export interface CostBookProvider {
  version(): string;
  get(costItemId: string): CostItem | undefined;
  all(): CostItem[];
  regionMultiplier(regionCode?: string): { code: string; multiplier: number };
}

class JsonCostBook implements CostBookProvider {
  private items = new Map<string, CostItem>();

  constructor() {
    for (const item of book.items as CostItem[]) this.items.set(item.id, item);
  }

  version() {
    return book.version;
  }

  get(id: string) {
    return this.items.get(id);
  }

  all() {
    return [...this.items.values()];
  }

  regionMultiplier(regionCode?: string) {
    const table = book.region_multipliers as Record<string, number>;
    const code = regionCode && table[regionCode] ? regionCode : "US-NATIONAL";
    return { code, multiplier: table[code] ?? 1 };
  }
}

let cached: CostBookProvider | null = null;

export function getCostBook(): CostBookProvider {
  if (!cached) cached = new JsonCostBook();
  return cached;
}

/** Test/adapter hook — lets an integrator inject their own pricing source. */
export function setCostBook(provider: CostBookProvider) {
  cached = provider;
}

export const costBookMeta = {
  version: book.version,
  currency: book.currency,
  basis: book.basis,
  item_count: (book.items as CostItem[]).length,
  regions: Object.keys(book.region_multipliers as Record<string, number>),
};
