/**
 * The closed vocabulary the vision model is allowed to speak.
 *
 * This file is the contract between the non-deterministic perception layer and
 * the deterministic pricing engine. The model picks codes from these lists and
 * nothing else — it never names a repair in free text and never names a price.
 */

export const COMPONENTS = [
  "kitchen",
  "bathroom",
  "bedroom",
  "living_area",
  "exterior",
  "roof",
  "foundation",
  "landscaping",
  "garage",
  "basement",
  "attic",
  "hvac",
  "electrical",
  "plumbing",
] as const;

export type Component = (typeof COMPONENTS)[number];

/** Components we expect photo coverage for on a typical single-family property. */
export const EXPECTED_COVERAGE: { component: Component; weight: number; critical: boolean }[] = [
  { component: "kitchen", weight: 0.18, critical: true },
  { component: "bathroom", weight: 0.14, critical: true },
  { component: "exterior", weight: 0.16, critical: true },
  { component: "roof", weight: 0.14, critical: true },
  { component: "living_area", weight: 0.12, critical: false },
  { component: "bedroom", weight: 0.1, critical: false },
  { component: "basement", weight: 0.06, critical: false },
  { component: "hvac", weight: 0.05, critical: false },
  { component: "electrical", weight: 0.03, critical: false },
  { component: "garage", weight: 0.02, critical: false },
];

/**
 * Quantity bases. Each is a named, auditable takeoff rule — see quantities.ts.
 * The model never chooses a quantity; it only reports how much of a surface is
 * affected (`extent`, 0..1). The basis converts property metrics into units.
 */
export const QUANTITY_BASES = [
  "each",
  "per_bath",
  "per_bedroom",
  "floor_area",
  "room_floor_area",
  "roof_squares",
  "roof_deck_sf",
  "ext_wall_area",
  "int_wall_area",
  "ceiling_area_room",
  "kitchen_cabinet_lf",
  "kitchen_counter_sf",
  "backsplash_sf",
  "bath_tile_sf",
  "window_count",
  "gutter_lf",
  "driveway_sf",
  "lot_area",
  "foundation_lf",
  "basement_perimeter_lf",
  "duct_lf",
] as const;

export type QuantityBasis = (typeof QUANTITY_BASES)[number];

export interface RepairRule {
  /** Applies when observed severity is <= this value (rules evaluated in order). */
  maxSeverity: number;
  costItemId: string;
  basis: QuantityBasis;
  /** Multiply the takeoff quantity by the observed extent (0..1)? */
  scaleByExtent: boolean;
  /** Fixed multiplier applied after the basis (e.g. 0.35 = only a third of walls). */
  factor?: number;
}

export interface DefectDefinition {
  code: string;
  label: string;
  /** Components this defect can legitimately be reported against. */
  components: Component[];
  /** How much this defect drags the component's 0-5 score down at severity 4. */
  scoreImpact: number;
  repairs: RepairRule[];
}

export const DEFECTS: DefectDefinition[] = [
  // ---------------------------------------------------------------- kitchen
  {
    code: "KIT_CABINET_DATED",
    label: "Cabinets dated, worn or damaged",
    components: ["kitchen"],
    scoreImpact: 1.6,
    repairs: [
      { maxSeverity: 2, costItemId: "KIT-CAB-REFACE", basis: "kitchen_cabinet_lf", scaleByExtent: true },
      { maxSeverity: 4, costItemId: "KIT-CAB-REPLACE", basis: "kitchen_cabinet_lf", scaleByExtent: false },
    ],
  },
  {
    code: "KIT_COUNTER_DAMAGED",
    label: "Countertops damaged or obsolete",
    components: ["kitchen"],
    scoreImpact: 1.0,
    repairs: [
      { maxSeverity: 2, costItemId: "KIT-CTR-LAM", basis: "kitchen_counter_sf", scaleByExtent: false },
      { maxSeverity: 4, costItemId: "KIT-CTR-GRAN", basis: "kitchen_counter_sf", scaleByExtent: false },
    ],
  },
  {
    code: "KIT_APPLIANCES_MISSING",
    label: "Appliances missing, dated or non-functional",
    components: ["kitchen"],
    scoreImpact: 1.0,
    repairs: [{ maxSeverity: 4, costItemId: "KIT-APPL-PKG", basis: "each", scaleByExtent: false }],
  },
  {
    code: "KIT_SINK_FIXTURE_WORN",
    label: "Sink / faucet worn or leaking",
    components: ["kitchen"],
    scoreImpact: 0.5,
    repairs: [{ maxSeverity: 4, costItemId: "KIT-SINK-FAUC", basis: "each", scaleByExtent: false }],
  },
  {
    code: "KIT_BACKSPLASH_MISSING",
    label: "Backsplash missing or damaged",
    components: ["kitchen"],
    scoreImpact: 0.4,
    repairs: [{ maxSeverity: 4, costItemId: "KIT-BACKSPL", basis: "backsplash_sf", scaleByExtent: true }],
  },

  // --------------------------------------------------------------- bathroom
  {
    code: "BATH_VANITY_WORN",
    label: "Vanity / cabinetry worn or damaged",
    components: ["bathroom"],
    scoreImpact: 0.9,
    repairs: [{ maxSeverity: 4, costItemId: "BATH-VAN-REPL", basis: "per_bath", scaleByExtent: true }],
  },
  {
    code: "BATH_TUB_SHOWER_WORN",
    label: "Tub / shower surround worn, stained or cracked",
    components: ["bathroom"],
    scoreImpact: 1.3,
    repairs: [
      { maxSeverity: 2, costItemId: "BATH-TUB-REGL", basis: "per_bath", scaleByExtent: true },
      { maxSeverity: 4, costItemId: "BATH-TUB-REPL", basis: "per_bath", scaleByExtent: true },
    ],
  },
  {
    code: "BATH_TILE_CRACKED",
    label: "Tile cracked, missing or failing grout",
    components: ["bathroom"],
    scoreImpact: 1.1,
    repairs: [{ maxSeverity: 4, costItemId: "BATH-TILE-REPL", basis: "bath_tile_sf", scaleByExtent: true }],
  },
  {
    code: "BATH_TOILET_WORN",
    label: "Toilet damaged, dated or missing",
    components: ["bathroom"],
    scoreImpact: 0.5,
    repairs: [{ maxSeverity: 4, costItemId: "BATH-TOILET", basis: "per_bath", scaleByExtent: true }],
  },
  {
    code: "BATH_VENT_MISSING",
    label: "No exhaust ventilation / moisture staining",
    components: ["bathroom"],
    scoreImpact: 0.5,
    repairs: [{ maxSeverity: 4, costItemId: "BATH-FAN-VENT", basis: "per_bath", scaleByExtent: true }],
  },
  {
    code: "BATH_GUT_REQUIRED",
    label: "Bathroom beyond component repair — full gut indicated",
    components: ["bathroom"],
    scoreImpact: 2.6,
    repairs: [{ maxSeverity: 4, costItemId: "BATH-FULL-GUT", basis: "per_bath", scaleByExtent: true }],
  },

  // ------------------------------------------------------------------- roof
  {
    code: "ROOF_SHINGLE_MISSING",
    label: "Shingles missing, lifted or curling",
    components: ["roof"],
    scoreImpact: 1.8,
    repairs: [
      { maxSeverity: 2, costItemId: "ROOF-SHNG-PATCH", basis: "roof_squares", scaleByExtent: true },
      { maxSeverity: 4, costItemId: "ROOF-SHNG-REPL", basis: "roof_squares", scaleByExtent: false },
    ],
  },
  {
    code: "ROOF_AGE_END_OF_LIFE",
    label: "Roof visibly at end of service life",
    components: ["roof"],
    scoreImpact: 2.2,
    repairs: [{ maxSeverity: 4, costItemId: "ROOF-SHNG-REPL", basis: "roof_squares", scaleByExtent: false }],
  },
  {
    code: "ROOF_DECK_SAGGING",
    label: "Decking sagging or visibly deteriorated",
    components: ["roof"],
    scoreImpact: 2.4,
    repairs: [{ maxSeverity: 4, costItemId: "ROOF-DECK-REPL", basis: "roof_deck_sf", scaleByExtent: true }],
  },
  {
    code: "ROOF_GUTTER_DAMAGED",
    label: "Gutters damaged, detached or missing",
    components: ["roof", "exterior"],
    scoreImpact: 0.6,
    repairs: [{ maxSeverity: 4, costItemId: "ROOF-GUTTER", basis: "gutter_lf", scaleByExtent: true }],
  },
  {
    code: "ROOF_FLASHING_FAILED",
    label: "Flashing, valley or boot failure",
    components: ["roof"],
    scoreImpact: 0.8,
    repairs: [{ maxSeverity: 4, costItemId: "ROOF-FLASH", basis: "each", scaleByExtent: false }],
  },

  // --------------------------------------------------------------- exterior
  {
    code: "EXT_PAINT_PEELING",
    label: "Exterior paint peeling, chalking or bare",
    components: ["exterior"],
    scoreImpact: 1.0,
    repairs: [{ maxSeverity: 4, costItemId: "EXT-PAINT-FULL", basis: "ext_wall_area", scaleByExtent: true }],
  },
  {
    code: "EXT_SIDING_DAMAGED",
    label: "Siding cracked, warped, rotted or missing",
    components: ["exterior"],
    scoreImpact: 1.5,
    repairs: [
      { maxSeverity: 2, costItemId: "EXT-SIDING-PATCH", basis: "ext_wall_area", scaleByExtent: true },
      { maxSeverity: 4, costItemId: "EXT-SIDING-REPL", basis: "ext_wall_area", scaleByExtent: true },
    ],
  },
  {
    code: "EXT_WINDOW_DAMAGED",
    label: "Windows broken, fogged or failed",
    components: ["exterior"],
    scoreImpact: 1.2,
    repairs: [{ maxSeverity: 4, costItemId: "EXT-WIN-REPL", basis: "window_count", scaleByExtent: true }],
  },
  {
    code: "EXT_DOOR_DAMAGED",
    label: "Entry door damaged or missing",
    components: ["exterior"],
    scoreImpact: 0.6,
    repairs: [{ maxSeverity: 4, costItemId: "EXT-DOOR-ENTRY", basis: "each", scaleByExtent: false }],
  },
  {
    code: "EXT_DECK_DETERIORATED",
    label: "Deck / porch structure deteriorated",
    components: ["exterior"],
    scoreImpact: 1.0,
    repairs: [{ maxSeverity: 4, costItemId: "EXT-DECK-REPL", basis: "each", scaleByExtent: true, factor: 140 }],
  },
  {
    code: "EXT_CONCRETE_CRACKED",
    label: "Driveway / walkway cracked or heaved",
    components: ["exterior"],
    scoreImpact: 0.7,
    repairs: [{ maxSeverity: 4, costItemId: "EXT-CONC-DRIVE", basis: "driveway_sf", scaleByExtent: true }],
  },

  // ------------------------------------------------------------- foundation
  {
    code: "FND_CRACK_VISIBLE",
    label: "Foundation cracking visible",
    components: ["foundation", "basement"],
    scoreImpact: 1.9,
    repairs: [
      { maxSeverity: 2, costItemId: "FND-CRACK-SEAL", basis: "foundation_lf", scaleByExtent: true },
      { maxSeverity: 4, costItemId: "FND-PIER-STAB", basis: "each", scaleByExtent: true, factor: 6 },
    ],
  },
  {
    code: "FND_WATER_INTRUSION",
    label: "Water intrusion / efflorescence at foundation",
    components: ["basement", "foundation"],
    scoreImpact: 1.7,
    repairs: [{ maxSeverity: 4, costItemId: "FND-WATERPROOF", basis: "basement_perimeter_lf", scaleByExtent: true }],
  },

  // ---------------------------------------------------------------- interior
  {
    code: "FLOOR_CARPET_STAINED",
    label: "Carpet stained, worn or odorous",
    components: ["bedroom", "living_area"],
    scoreImpact: 0.8,
    repairs: [{ maxSeverity: 4, costItemId: "FLR-CARP-REPL", basis: "room_floor_area", scaleByExtent: true }],
  },
  {
    code: "FLOOR_HARD_DAMAGED",
    label: "Hard flooring damaged, buckled or missing",
    components: ["kitchen", "living_area", "bedroom", "bathroom"],
    scoreImpact: 1.0,
    repairs: [
      { maxSeverity: 2, costItemId: "FLR-HDWD-REFIN", basis: "room_floor_area", scaleByExtent: true },
      { maxSeverity: 4, costItemId: "FLR-LVP-REPL", basis: "room_floor_area", scaleByExtent: true },
    ],
  },
  {
    code: "WALL_PAINT_WORN",
    label: "Interior paint worn, marked or mismatched",
    components: ["kitchen", "bathroom", "bedroom", "living_area", "basement"],
    scoreImpact: 0.6,
    repairs: [{ maxSeverity: 4, costItemId: "PAINT-INT-ROOM", basis: "each", scaleByExtent: true }],
  },
  {
    code: "WALL_DRYWALL_DAMAGED",
    label: "Drywall holes, cracking or missing sections",
    components: ["kitchen", "bathroom", "bedroom", "living_area", "basement", "garage"],
    scoreImpact: 1.0,
    repairs: [
      { maxSeverity: 2, costItemId: "DRY-WALL-PATCH", basis: "int_wall_area", scaleByExtent: true },
      { maxSeverity: 4, costItemId: "DRY-WALL-REPL", basis: "int_wall_area", scaleByExtent: true },
    ],
  },
  {
    code: "WATER_DAMAGE_CEILING",
    label: "Ceiling water staining or collapse",
    components: ["kitchen", "bathroom", "bedroom", "living_area", "basement", "attic"],
    scoreImpact: 1.8,
    repairs: [{ maxSeverity: 4, costItemId: "DRY-CEIL-PATCH", basis: "ceiling_area_room", scaleByExtent: true }],
  },
  {
    code: "MOLD_VISIBLE",
    label: "Visible mold or biological growth",
    components: ["bathroom", "basement", "attic", "living_area"],
    scoreImpact: 2.1,
    repairs: [{ maxSeverity: 4, costItemId: "MOLD-REMED", basis: "room_floor_area", scaleByExtent: true }],
  },
  {
    code: "DEBRIS_CLUTTER",
    label: "Debris, abandoned contents or trash-out required",
    components: ["kitchen", "bathroom", "bedroom", "living_area", "basement", "garage", "attic", "exterior"],
    scoreImpact: 0.5,
    repairs: [{ maxSeverity: 4, costItemId: "JUNK-HAUL", basis: "each", scaleByExtent: false }],
  },

  // ------------------------------------------------------------------ mech.
  {
    code: "HVAC_UNIT_AGED",
    label: "Furnace / air handler aged or non-functional",
    components: ["hvac", "basement"],
    scoreImpact: 1.5,
    repairs: [{ maxSeverity: 4, costItemId: "HVAC-FURN-REPL", basis: "each", scaleByExtent: false }],
  },
  {
    code: "HVAC_CONDENSER_AGED",
    label: "Condenser missing, damaged or aged",
    components: ["hvac", "exterior"],
    scoreImpact: 1.2,
    repairs: [{ maxSeverity: 4, costItemId: "HVAC-AC-REPL", basis: "each", scaleByExtent: false }],
  },
  {
    code: "HVAC_DUCT_DAMAGED",
    label: "Ductwork disconnected, crushed or missing",
    components: ["hvac", "basement", "attic"],
    scoreImpact: 0.9,
    repairs: [{ maxSeverity: 4, costItemId: "HVAC-DUCT-REPL", basis: "duct_lf", scaleByExtent: true }],
  },
  {
    code: "WATER_HEATER_AGED",
    label: "Water heater aged, leaking or missing",
    components: ["plumbing", "basement"],
    scoreImpact: 0.8,
    repairs: [{ maxSeverity: 4, costItemId: "HVAC-WH-REPL", basis: "each", scaleByExtent: false }],
  },
  {
    code: "ELEC_PANEL_OBSOLETE",
    label: "Panel obsolete, unsafe or undersized",
    components: ["electrical", "basement"],
    scoreImpact: 1.6,
    repairs: [{ maxSeverity: 4, costItemId: "ELEC-PANEL-REPL", basis: "each", scaleByExtent: false }],
  },
  {
    code: "ELEC_WIRING_UNSAFE",
    label: "Knob & tube, aluminum or exposed wiring",
    components: ["electrical", "basement", "attic"],
    scoreImpact: 2.0,
    repairs: [{ maxSeverity: 4, costItemId: "ELEC-REWIRE", basis: "floor_area", scaleByExtent: true }],
  },
  {
    code: "ELEC_FIXTURES_MISSING",
    label: "Fixtures, switches or outlets missing / damaged",
    components: ["electrical", "kitchen", "bathroom", "bedroom", "living_area"],
    scoreImpact: 0.5,
    repairs: [{ maxSeverity: 4, costItemId: "ELEC-FIXT-REPL", basis: "each", scaleByExtent: true, factor: 8 }],
  },
  {
    code: "PLUMB_SUPPLY_FAILING",
    label: "Galvanized / failing supply piping",
    components: ["plumbing", "basement"],
    scoreImpact: 1.5,
    repairs: [{ maxSeverity: 4, costItemId: "PLM-SUPPLY-REPL", basis: "floor_area", scaleByExtent: true }],
  },
  {
    code: "PLUMB_LEAK_VISIBLE",
    label: "Active leak or drain failure visible",
    components: ["plumbing", "kitchen", "bathroom", "basement"],
    scoreImpact: 1.2,
    repairs: [{ maxSeverity: 4, costItemId: "PLM-DRAIN-REPR", basis: "each", scaleByExtent: false }],
  },

  // ------------------------------------------------------------------ other
  {
    code: "LAND_OVERGROWN",
    label: "Landscaping overgrown or bare",
    components: ["landscaping", "exterior"],
    scoreImpact: 0.5,
    repairs: [{ maxSeverity: 4, costItemId: "LAND-CLEAR", basis: "lot_area", scaleByExtent: true }],
  },
  {
    code: "LAND_TREE_HAZARD",
    label: "Hazard tree or limbs over structure",
    components: ["landscaping", "exterior", "roof"],
    scoreImpact: 0.6,
    repairs: [{ maxSeverity: 4, costItemId: "LAND-TREE-REM", basis: "each", scaleByExtent: false }],
  },
  {
    code: "GARAGE_DOOR_DAMAGED",
    label: "Garage door damaged or inoperable",
    components: ["garage", "exterior"],
    scoreImpact: 0.7,
    repairs: [{ maxSeverity: 4, costItemId: "GAR-DOOR-REPL", basis: "each", scaleByExtent: false }],
  },
  {
    code: "PEST_DAMAGE",
    label: "Termite / pest activity or damage",
    components: ["foundation", "basement", "attic", "exterior"],
    scoreImpact: 1.4,
    repairs: [{ maxSeverity: 4, costItemId: "PEST-TERMITE", basis: "each", scaleByExtent: false }],
  },
];

export const DEFECT_BY_CODE = new Map(DEFECTS.map((d) => [d.code, d]));
export const DEFECT_CODES = DEFECTS.map((d) => d.code);

/** Pick the repair rule that matches an observed severity. */
export function selectRepairRules(def: DefectDefinition, severity: number): RepairRule[] {
  for (const rule of def.repairs) {
    if (severity <= rule.maxSeverity) return [rule];
  }
  return def.repairs.length ? [def.repairs[def.repairs.length - 1]] : [];
}
