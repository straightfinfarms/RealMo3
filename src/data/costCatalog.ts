/* ============================================================================
 * costCatalog.ts — the renovation cost-element catalog.
 *
 * Based on the standard investor rehab-estimation framework (the J Scott /
 * BiggerPockets ~25-category method taught across the major BRRRR channels),
 * priced at RENTAL-GRADE finishes with 2026 average ranges. low/avg/high map
 * to the Budget / Standard / Premium quality tiers; every number is an
 * editable default, not gospel — costs vary heavily by market.
 *
 * Rules of thumb the catalog encodes:
 *   light cosmetic ≈ $15–25/sqft · medium ≈ $25–50/sqft · gut ≈ $60–100+/sqft
 *   + always carry a contingency (10–20% typical, more on older buildings).
 * ========================================================================== */

export type CostUnit = "project" | "each" | "sqft" | "unit";

/** Work-plan phases in build order — tasks are sequenced by this. */
export const PHASES = [
  "Demo & Prep",
  "Structure & Exterior",
  "Rough-Ins",
  "Insulation & Drywall",
  "Kitchens & Baths",
  "Finishes",
  "Final & Punch List",
] as const;
export type Phase = (typeof PHASES)[number];

/** Duration share of the total schedule per phase (rough planning heuristic). */
export const PHASE_WEIGHT: Record<Phase, number> = {
  "Demo & Prep": 8,
  "Structure & Exterior": 18,
  "Rough-Ins": 20,
  "Insulation & Drywall": 14,
  "Kitchens & Baths": 20,
  "Finishes": 15,
  "Final & Punch List": 5,
};

export interface CostItem {
  id: string;
  label: string;
  category: string;          // budget-line grouping
  phase: Phase;              // work-plan sequencing
  trade: string;             // vendor matching ("Roofing", "Electrical", …)
  unit: CostUnit;
  low: number;               // Budget tier $/unit
  avg: number;               // Standard tier $/unit
  high: number;              // Premium tier $/unit
  note?: string;
  /** Suggested quantity from property context. */
  defaultQty: (ctx: { sqft: number; units: number }) => number;
}

const per = (n: number) => () => n;
const perUnit = (mult = 1) => (c: { units: number }) => Math.max(1, Math.round(c.units * mult));
const perSqft = (frac = 1) => (c: { sqft: number }) => Math.max(100, Math.round(c.sqft * frac));

export const COST_CATALOG: CostItem[] = [
  // ---------- Demo & Prep ----------
  { id: "demo", label: "Demo & junk-out", category: "Demo & Prep", phase: "Demo & Prep",
    trade: "General Contractor", unit: "unit", low: 800, avg: 1500, high: 3000,
    note: "Tear-out of kitchens/baths/flooring, haul away", defaultQty: perUnit() },
  { id: "dumpster", label: "Dumpsters", category: "Demo & Prep", phase: "Demo & Prep",
    trade: "General Contractor", unit: "each", low: 550, avg: 680, high: 850,
    note: "~1 per 1,000 sqft of heavy demo", defaultQty: (c) => Math.max(1, Math.round(c.sqft / 1200)) },

  // ---------- Structure & Exterior ----------
  { id: "roof", label: "Roof replacement", category: "Roof & Exterior", phase: "Structure & Exterior",
    trade: "Roofing", unit: "project", low: 9000, avg: 14000, high: 22000,
    note: "Asphalt shingle, incl. tear-off; steel/flat costs more", defaultQty: per(1) },
  { id: "gutters", label: "Gutters & downspouts", category: "Roof & Exterior", phase: "Structure & Exterior",
    trade: "Roofing", unit: "project", low: 900, avg: 1500, high: 2600, defaultQty: per(1) },
  { id: "siding", label: "Siding / masonry repair", category: "Roof & Exterior", phase: "Structure & Exterior",
    trade: "General Contractor", unit: "project", low: 2000, avg: 5000, high: 12000, defaultQty: per(1) },
  { id: "windows", label: "Window replacement", category: "Roof & Exterior", phase: "Structure & Exterior",
    trade: "General Contractor", unit: "each", low: 450, avg: 650, high: 950,
    note: "Vinyl, installed", defaultQty: (c) => Math.max(4, Math.round(c.sqft / 150)) },
  { id: "ext_doors", label: "Exterior doors", category: "Roof & Exterior", phase: "Structure & Exterior",
    trade: "General Contractor", unit: "each", low: 400, avg: 650, high: 1100,
    defaultQty: (c) => c.units + 1 },
  { id: "deck", label: "Deck / porch repair", category: "Roof & Exterior", phase: "Structure & Exterior",
    trade: "General Contractor", unit: "project", low: 1200, avg: 3000, high: 8000, defaultQty: per(1) },
  { id: "foundation", label: "Foundation / structural repair", category: "Roof & Exterior", phase: "Structure & Exterior",
    trade: "General Contractor", unit: "project", low: 2500, avg: 7000, high: 20000,
    note: "Get an engineer's opinion before pricing", defaultQty: per(1) },

  // ---------- Rough-Ins ----------
  { id: "panel", label: "Electrical panel upgrade", category: "Electrical", phase: "Rough-Ins",
    trade: "Electrical", unit: "project", low: 1800, avg: 2600, high: 4200,
    note: "200A service; multi-unit 400A costs more", defaultQty: per(1) },
  { id: "rewire", label: "Full rewire", category: "Electrical", phase: "Rough-Ins",
    trade: "Electrical", unit: "sqft", low: 4, avg: 6, high: 9,
    note: "Knob & tube / aluminum remediation", defaultQty: perSqft() },
  { id: "elec_fixtures", label: "Fixtures, outlets & smoke alarms", category: "Electrical", phase: "Rough-Ins",
    trade: "Electrical", unit: "unit", low: 450, avg: 750, high: 1300, defaultQty: perUnit() },
  { id: "repipe", label: "Plumbing re-pipe", category: "Plumbing", phase: "Rough-Ins",
    trade: "Plumbing", unit: "sqft", low: 3, avg: 5, high: 8,
    note: "Replace galvanized/poly supply + stack", defaultQty: perSqft() },
  { id: "water_heater", label: "Water heaters", category: "Plumbing", phase: "Rough-Ins",
    trade: "Plumbing", unit: "each", low: 1400, avg: 1900, high: 2800, defaultQty: perUnit() },
  { id: "furnace", label: "Furnace / boiler replacement", category: "HVAC", phase: "Rough-Ins",
    trade: "HVAC", unit: "each", low: 4500, avg: 6500, high: 9500, defaultQty: per(1) },
  { id: "minisplit", label: "Heat pump / mini-splits", category: "HVAC", phase: "Rough-Ins",
    trade: "HVAC", unit: "unit", low: 3500, avg: 5000, high: 7500,
    note: "Per rental unit; rebates may apply", defaultQty: perUnit() },
  { id: "ducts", label: "Ductwork repair / venting", category: "HVAC", phase: "Rough-Ins",
    trade: "HVAC", unit: "project", low: 1500, avg: 3000, high: 6000, defaultQty: per(1) },

  // ---------- Insulation & Drywall ----------
  { id: "insulation", label: "Insulation (attic + walls)", category: "Insulation & Drywall", phase: "Insulation & Drywall",
    trade: "General Contractor", unit: "sqft", low: 1.5, avg: 2.5, high: 4,
    defaultQty: perSqft(0.5) },
  { id: "drywall_patch", label: "Drywall repair & patch", category: "Insulation & Drywall", phase: "Insulation & Drywall",
    trade: "General Contractor", unit: "project", low: 900, avg: 2200, high: 5000, defaultQty: per(1) },
  { id: "drywall_full", label: "Full drywall (gut areas)", category: "Insulation & Drywall", phase: "Insulation & Drywall",
    trade: "General Contractor", unit: "sqft", low: 6, avg: 9, high: 14,
    note: "Hang, tape, mud — per sqft of floor area gutted", defaultQty: perSqft(0.5) },

  // ---------- Kitchens & Baths ----------
  { id: "kitchen", label: "Kitchen — rental grade", category: "Kitchens", phase: "Kitchens & Baths",
    trade: "General Contractor", unit: "unit", low: 8000, avg: 12500, high: 20000,
    note: "Cabinets, counters, sink, backsplash; appliances separate", defaultQty: perUnit() },
  { id: "bath_full", label: "Bathroom — full renovation", category: "Bathrooms", phase: "Kitchens & Baths",
    trade: "Plumbing", unit: "each", low: 6000, avg: 9500, high: 15000,
    note: "Tub/surround, vanity, toilet, tile, fan", defaultQty: perUnit() },
  { id: "bath_refresh", label: "Bathroom — refresh only", category: "Bathrooms", phase: "Kitchens & Baths",
    trade: "General Contractor", unit: "each", low: 1500, avg: 3000, high: 5500,
    note: "Vanity, toilet, reglaze, paint", defaultQty: perUnit() },
  { id: "appliances", label: "Appliance set", category: "Kitchens", phase: "Kitchens & Baths",
    trade: "General Contractor", unit: "unit", low: 2200, avg: 3200, high: 5000,
    note: "Fridge, stove, OTR micro or hood — per unit", defaultQty: perUnit() },

  // ---------- Finishes ----------
  { id: "lvp", label: "Flooring — LVP installed", category: "Flooring & Paint", phase: "Finishes",
    trade: "General Contractor", unit: "sqft", low: 4, avg: 5.5, high: 8, defaultQty: perSqft(0.85) },
  { id: "refinish", label: "Hardwood refinish", category: "Flooring & Paint", phase: "Finishes",
    trade: "General Contractor", unit: "sqft", low: 3, avg: 4.5, high: 7, defaultQty: perSqft(0.5) },
  { id: "paint_int", label: "Interior paint", category: "Flooring & Paint", phase: "Finishes",
    trade: "General Contractor", unit: "sqft", low: 2, avg: 3, high: 4.5,
    note: "Walls, ceilings, trim — per sqft of floor area", defaultQty: perSqft() },
  { id: "paint_ext", label: "Exterior paint", category: "Flooring & Paint", phase: "Finishes",
    trade: "General Contractor", unit: "project", low: 3000, avg: 5500, high: 10000, defaultQty: per(1) },
  { id: "doors_trim", label: "Interior doors & trim", category: "Flooring & Paint", phase: "Finishes",
    trade: "General Contractor", unit: "unit", low: 800, avg: 1400, high: 2400, defaultQty: perUnit() },
  { id: "blinds", label: "Blinds & hardware", category: "Flooring & Paint", phase: "Finishes",
    trade: "General Contractor", unit: "unit", low: 250, avg: 450, high: 800, defaultQty: perUnit() },
  { id: "landscaping", label: "Landscaping & curb appeal", category: "Exterior Finish", phase: "Finishes",
    trade: "General Contractor", unit: "project", low: 800, avg: 2000, high: 5000, defaultQty: per(1) },

  // ---------- Final & Punch List ----------
  { id: "permits", label: "Permits & inspections", category: "Soft Costs", phase: "Final & Punch List",
    trade: "General Contractor", unit: "project", low: 500, avg: 1500, high: 4000,
    note: "ESA / building / plumbing — varies by municipality", defaultQty: per(1) },
  { id: "clean", label: "Final clean", category: "Soft Costs", phase: "Final & Punch List",
    trade: "General Contractor", unit: "unit", low: 300, avg: 450, high: 700, defaultQty: perUnit() },
  { id: "staging", label: "Listing photos / staging", category: "Soft Costs", phase: "Final & Punch List",
    trade: "General Contractor", unit: "project", low: 500, avg: 900, high: 1800, defaultQty: per(1) },
];

export type Tier = "budget" | "standard" | "premium";

export const TIER_LABELS: Record<Tier, string> = {
  budget: "Budget",
  standard: "Standard",
  premium: "Premium",
};

export function tierCost(item: CostItem, tier: Tier): number {
  return tier === "budget" ? item.low : tier === "premium" ? item.high : item.avg;
}
