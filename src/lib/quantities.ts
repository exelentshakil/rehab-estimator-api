import type { PropertyInput } from "./types";
import type { QuantityBasis } from "./taxonomy";

/**
 * Quantity takeoff.
 *
 * Pure functions of the property record. No model involvement, no randomness —
 * given the same property, every basis returns the same number every time.
 * Each returns the value *and* the sentence explaining how it was derived, so
 * an underwriter can check the arithmetic by hand.
 *
 * These curves are the part most worth calibrating against real invoices; see
 * PRD §9 Phase 3. They are conservative national approximations today.
 */

export interface Takeoff {
  quantity: number;
  basis: string;
}

interface Derived {
  sqft: number;
  stories: number;
  footprint: number;
  perimeter: number;
  beds: number;
  baths: number;
  roomCount: number;
}

function derive(p: PropertyInput): Derived {
  const sqft = p.square_feet;
  const stories = p.stories ?? (sqft > 2200 ? 2 : 1);
  const footprint = sqft / stories;
  // Approximate a rectangle with a 1.4 aspect ratio: P = 2(w + 1.4w), A = 1.4w²
  const w = Math.sqrt(footprint / 1.4);
  const perimeter = 2 * (w + 1.4 * w);
  const roomCount = Math.max(1, p.beds + 3); // beds + kitchen + living + hall
  return { sqft, stories, footprint, perimeter, beds: p.beds, baths: p.baths, roomCount };
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r0 = (n: number) => Math.round(n);

export function takeoff(basis: QuantityBasis, p: PropertyInput): Takeoff {
  const d = derive(p);

  switch (basis) {
    case "each":
      return { quantity: 1, basis: "1 unit (lump sum line item)" };

    case "per_bath":
      return { quantity: Math.max(1, Math.round(d.baths)), basis: `${d.baths} bath(s) on record` };

    case "per_bedroom":
      return { quantity: Math.max(1, d.beds), basis: `${d.beds} bedroom(s) on record` };

    case "floor_area":
      return { quantity: d.sqft, basis: `${d.sqft} sf finished area` };

    case "room_floor_area":
      return {
        quantity: r0(d.sqft / d.roomCount),
        basis: `${d.sqft} sf ÷ ${d.roomCount} rooms (${d.beds} bed + 3)`,
      };

    case "roof_squares": {
      // Footprint → roof area with a 1.15 pitch factor, ÷100 sf per square.
      const q = (d.footprint * 1.15) / 100;
      return {
        quantity: r1(q),
        basis: `${r0(d.footprint)} sf footprint (${d.sqft} sf ÷ ${d.stories} stories) × 1.15 pitch ÷ 100`,
      };
    }

    case "roof_deck_sf":
      return {
        quantity: r0(d.footprint * 1.15),
        basis: `${r0(d.footprint)} sf footprint × 1.15 pitch factor`,
      };

    case "ext_wall_area": {
      const h = 9 * d.stories;
      const gross = d.perimeter * h;
      const net = gross * 0.85; // deduct openings
      return {
        quantity: r0(net),
        basis: `${r0(d.perimeter)} lf perimeter × ${h} ft wall height × 0.85 opening deduction`,
      };
    }

    case "int_wall_area":
      return { quantity: r0(d.sqft * 3.2), basis: `${d.sqft} sf × 3.2 interior wall factor` };

    case "ceiling_area_room":
      return {
        quantity: r0(d.sqft / d.roomCount),
        basis: `${d.sqft} sf ÷ ${d.roomCount} rooms (ceiling area of affected room)`,
      };

    case "kitchen_cabinet_lf": {
      const q = 12 + d.sqft / 220;
      return { quantity: r1(q), basis: `12 lf base + ${d.sqft} sf ÷ 220 size adjustment` };
    }

    case "kitchen_counter_sf": {
      const lf = 12 + d.sqft / 220;
      return { quantity: r1(lf * 2.1), basis: `${r1(lf)} lf cabinet run × 2.1 sf/lf counter` };
    }

    case "backsplash_sf": {
      const lf = 12 + d.sqft / 220;
      return { quantity: r1(lf * 0.75 * 1.5), basis: `${r1(lf)} lf run × 75% upper coverage × 1.5 ft height` };
    }

    case "bath_tile_sf":
      return { quantity: 110, basis: "110 sf per bath (tub surround 60 sf + floor 50 sf)" };

    case "window_count":
      return { quantity: Math.max(4, r0(d.sqft / 130)), basis: `${d.sqft} sf ÷ 130 sf per window opening` };

    case "gutter_lf":
      return { quantity: r0(d.perimeter), basis: `${r0(d.perimeter)} lf roof perimeter` };

    case "driveway_sf":
      return { quantity: 420, basis: "420 sf typical single-width drive + walk" };

    case "lot_area":
      return { quantity: r0(d.sqft * 3.2), basis: `${d.sqft} sf × 3.2 typical lot-to-living ratio` };

    case "foundation_lf":
      return { quantity: r0(d.perimeter), basis: `${r0(d.perimeter)} lf foundation perimeter` };

    case "basement_perimeter_lf":
      return { quantity: r0(d.perimeter), basis: `${r0(d.perimeter)} lf basement wall perimeter` };

    case "duct_lf":
      return { quantity: r0(d.sqft / 12), basis: `${d.sqft} sf ÷ 12 sf per lf of duct run` };

    default: {
      const _exhaustive: never = basis;
      return { quantity: 1, basis: `unmapped basis ${String(_exhaustive)}` };
    }
  }
}
