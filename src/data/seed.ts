/* ============================================================================
 * seed.ts — realistic demo portfolio.
 * Eight properties spread across the BRRRR pipeline (lead → completed),
 * with loans, tenants, renovations, contractors, transactions, docs,
 * timeline events and tasks — so every module renders with life in it.
 * Dates are relative to "today" so the demo never goes stale.
 * ========================================================================== */
import type { AppData, Settings } from "./types";
import { UW_DEFAULTS } from "@/engine/underwrite";

const day = 86400000;
export const todayISO = (): string => new Date().toISOString().slice(0, 10);
const d = (offsetDays: number): string =>
  new Date(Date.now() + offsetDays * day).toISOString().slice(0, 10);

export const DEFAULT_SETTINGS: Settings = {
  theme: "dark",
  apiKey: "",
  model: "claude-sonnet-5",
  investorName: "Deniz",
  targetCashflowPerUnit: 150,
  targetCoCPct: 12,
  marketRefiRatePct: 6.6,
};

export function seedData(): AppData {
  const uw = (over: Partial<typeof UW_DEFAULTS>) => ({ ...UW_DEFAULTS, ...over });

  return {
    settings: { ...DEFAULT_SETTINGS },

    properties: [
      {
        id: "p1", name: "Maple Fourplex", address: "412 Maple Ave", city: "Hamilton, ON",
        propertyType: "fourplex", stage: "occupied", stageEnteredDate: d(-260),
        yearBuilt: 1962, sqft: 3800, photoHue: 210,
        underwriting: uw({
          units: 4, rentPerUnit: 1875, otherIncome: 120, vacancyPct: 4,
          taxesAnnual: 6400, insuranceAnnual: 3100, utilitiesAnnual: 2400,
          price: 610000, rehabBudget: 85000, downPct: 25, purchaseRatePct: 7.9,
          arvMode: "manual", arvManual: 840000, refiLtvPct: 70, refiRatePct: 6.9,
        }),
        currentValue: 852000, purchaseDate: d(-420), actualRehabSpent: 91500,
        notes: "First full BRRRR. Refied 8 months ago; rents pushed to market on turnover.",
      },
      {
        id: "p2", name: "Birch Duplex", address: "77 Birch St", city: "St. Catharines, ON",
        propertyType: "duplex", stage: "occupied", stageEnteredDate: d(-150),
        yearBuilt: 1948, sqft: 2100, photoHue: 150,
        underwriting: uw({
          units: 2, rentPerUnit: 2075, vacancyPct: 4,
          taxesAnnual: 4100, insuranceAnnual: 2100, utilitiesAnnual: 0,
          price: 455000, rehabBudget: 62000, downPct: 20, purchaseRatePct: 8.2,
          arvMode: "manual", arvManual: 610000, refiLtvPct: 75, refiRatePct: 6.8,
        }),
        currentValue: 618000, purchaseDate: d(-300), actualRehabSpent: 66800,
        notes: "Legal second suite added during rehab. Upper tenant is behind on rent.",
      },
      {
        id: "p3", name: "Queen St Six", address: "1203 Queen St E", city: "Brantford, ON",
        propertyType: "small_multifamily", stage: "renovation", stageEnteredDate: d(-55),
        yearBuilt: 1971, sqft: 5400, photoHue: 28,
        underwriting: uw({
          units: 6, rentPerUnit: 1400, otherIncome: 200, vacancyPct: 5,
          taxesAnnual: 8900, insuranceAnnual: 4600, utilitiesAnnual: 5200,
          price: 780000, rehabBudget: 140000, downPct: 25, purchaseRatePct: 8.4,
          arvMode: "income", marketCapPct: 6.75, refiLtvPct: 75, refiRatePct: 6.7,
        }),
        currentValue: 815000, purchaseDate: d(-70),
        notes: "Heaviest project yet. Kitchens in units 3–6, roof, panel upgrade.",
      },
      {
        id: "p4", name: "Erie Cottage STR", address: "18 Lakeshore Rd", city: "Port Colborne, ON",
        propertyType: "str", stage: "refinancing", stageEnteredDate: d(-14),
        yearBuilt: 1985, sqft: 1450, photoHue: 190,
        underwriting: uw({
          units: 1, rentPerUnit: 5800, vacancyPct: 28,
          taxesAnnual: 3300, insuranceAnnual: 2600, utilitiesAnnual: 3100,
          maintenancePct: 10, managementPct: 15, reservesPerUnit: 900,
          price: 385000, rehabBudget: 58000, downPct: 20, purchaseRatePct: 8.1,
          arvMode: "manual", arvManual: 525000, refiLtvPct: 70, refiRatePct: 7.1,
        }),
        currentValue: 531000, purchaseDate: d(-210), actualRehabSpent: 61200,
        notes: "Seasonal STR, strong summer bookings. Appraisal ordered for cash-out refi.",
      },
      {
        id: "p5", name: "Norfolk Triplex", address: "233 Norfolk St", city: "Simcoe, ON",
        propertyType: "triplex", stage: "under_contract", stageEnteredDate: d(-9),
        yearBuilt: 1955, sqft: 2900, photoHue: 270,
        underwriting: uw({
          units: 3, rentPerUnit: 1875, vacancyPct: 5,
          taxesAnnual: 4900, insuranceAnnual: 2700, utilitiesAnnual: 1800,
          price: 445000, rehabBudget: 85000, downPct: 25, purchaseRatePct: 8.0,
          arvMode: "manual", arvManual: 715000, refiLtvPct: 70, refiRatePct: 6.7,
        }),
        currentValue: 445000,
        notes: "Estate sale, negotiated $445K. Conditional on inspection & financing — recovers ~70% of capital at refi.",
      },
      {
        id: "p6", name: "Gore Park Mixed-Use", address: "55 King William St", city: "Hamilton, ON",
        propertyType: "commercial", stage: "offer", stageEnteredDate: d(-4),
        yearBuilt: 1930, sqft: 4100, photoHue: 330,
        underwriting: uw({
          units: 3, rentPerUnit: 2100, otherIncome: 1400, vacancyPct: 8,
          taxesAnnual: 11200, insuranceAnnual: 5400, utilitiesAnnual: 0,
          price: 900000, rehabBudget: 120000, downPct: 30, purchaseRatePct: 8.6,
          arvMode: "income", marketCapPct: 6.5, refiLtvPct: 70, refiRatePct: 7.2,
        }),
        currentValue: 900000,
        notes: "Storefront + 2 apartments. Offer in at $900K, asking $965K.",
      },
      {
        id: "p7", name: "Cannon St Fourplex", address: "689 Cannon St E", city: "Hamilton, ON",
        propertyType: "fourplex", stage: "lead", stageEnteredDate: d(-2),
        yearBuilt: 1958, sqft: 3600, photoHue: 90,
        underwriting: uw({
          units: 4, rentPerUnit: 1825, vacancyPct: 5,
          taxesAnnual: 5800, insuranceAnnual: 2900, utilitiesAnnual: 0,
          price: 585000, rehabBudget: 95000, downPct: 25, purchaseRatePct: 8.3,
          arvMode: "manual", arvManual: 790000, refiLtvPct: 75, refiRatePct: 6.7,
        }),
        currentValue: 585000,
        notes: "Off-market lead from wholesaler. Long-term tenants at $1,050 — big upside to ~$1,825 market rent after turnover + reno.",
      },
      {
        id: "p8", name: "Barton Duplex", address: "1450 Barton St", city: "Hamilton, ON",
        propertyType: "duplex", stage: "completed", stageEnteredDate: d(-540),
        yearBuilt: 1951, sqft: 1900, photoHue: 45,
        underwriting: uw({
          units: 2, rentPerUnit: 1885, vacancyPct: 4,
          taxesAnnual: 3600, insuranceAnnual: 1900,
          price: 350000, rehabBudget: 48000, downPct: 20, purchaseRatePct: 6.9,
          arvMode: "manual", arvManual: 520000, refiLtvPct: 75, refiRatePct: 5.9,
        }),
        currentValue: 560000, purchaseDate: d(-780), actualRehabSpent: 45200,
        notes: "The proof-of-concept deal. Full cycle done — capital recycled into Maple Fourplex.",
      },
    ],

    loans: [
      { id: "l1", propertyId: "p1", lender: "First National", kind: "refinance",
        originalAmount: 588000, currentBalance: 581200, ratePct: 6.9, termYears: 30,
        startDate: d(-240), monthlyPayment: 3873, active: true },
      { id: "l2", propertyId: "p2", lender: "Scotiabank", kind: "acquisition",
        originalAmount: 364000, currentBalance: 358900, ratePct: 8.2, termYears: 30,
        startDate: d(-300), monthlyPayment: 2721, active: true },
      { id: "l3", propertyId: "p3", lender: "Private — Meridian Capital", kind: "acquisition",
        originalAmount: 585000, currentBalance: 585000, ratePct: 8.4, termYears: 30,
        startDate: d(-70), monthlyPayment: 4458, active: true },
      { id: "l4", propertyId: "p4", lender: "TD Bank", kind: "acquisition",
        originalAmount: 308000, currentBalance: 303100, ratePct: 8.1, termYears: 30,
        startDate: d(-210), monthlyPayment: 2281, active: true },
      { id: "l5", propertyId: "p8", lender: "RBC", kind: "refinance",
        originalAmount: 390000, currentBalance: 377600, ratePct: 5.9, termYears: 30,
        startDate: d(-500), monthlyPayment: 2313, active: true },
    ],

    tenants: [
      { id: "t1", propertyId: "p1", unitLabel: "Unit 1", name: "Sarah Okafor",
        email: "s.okafor@example.com", phone: "905-555-0141", rent: 1895,
        leaseStart: d(-230), leaseEnd: d(135), status: "current", balanceOwed: 0 },
      { id: "t2", propertyId: "p1", unitLabel: "Unit 2", name: "James & Priya Patel",
        email: "jp.patel@example.com", phone: "905-555-0178", rent: 1850,
        leaseStart: d(-200), leaseEnd: d(165), status: "current", balanceOwed: 0 },
      { id: "t3", propertyId: "p1", unitLabel: "Unit 3", name: "Marc Tremblay",
        email: "m.tremblay@example.com", phone: "905-555-0122", rent: 1820,
        leaseStart: d(-320), leaseEnd: d(45), status: "current", balanceOwed: 0 },
      { id: "t4", propertyId: "p1", unitLabel: "Unit 4", name: "Alicia Fernandes",
        email: "a.fern@example.com", phone: "905-555-0186", rent: 1880,
        leaseStart: d(-90), leaseEnd: d(275), status: "current", balanceOwed: 0 },
      { id: "t5", propertyId: "p2", unitLabel: "Main Floor", name: "Devon Clarke",
        email: "d.clarke@example.com", phone: "289-555-0133", rent: 2100,
        leaseStart: d(-140), leaseEnd: d(225), status: "current", balanceOwed: 0 },
      { id: "t6", propertyId: "p2", unitLabel: "Upper Suite", name: "Hannah Liu",
        email: "h.liu@example.com", phone: "289-555-0164", rent: 2050,
        leaseStart: d(-140), leaseEnd: d(225), status: "late", balanceOwed: 4100 },
      { id: "t7", propertyId: "p8", unitLabel: "Unit A", name: "Robert Ansah",
        email: "r.ansah@example.com", phone: "905-555-0192", rent: 1895,
        leaseStart: d(-350), leaseEnd: d(15), status: "current", balanceOwed: 0 },
      { id: "t8", propertyId: "p8", unitLabel: "Unit B", name: "Emma Novak",
        email: "e.novak@example.com", phone: "905-555-0117", rent: 1870,
        leaseStart: d(-170), leaseEnd: d(195), status: "current", balanceOwed: 0 },
    ],

    renovations: [
      {
        id: "r1", propertyId: "p3", name: "Queen St Six — full reposition",
        status: "active", startDate: d(-50), targetEndDate: d(40), scenario: "standard",
        budgetLines: [
          { id: "b1", category: "Kitchens (×4)", budgeted: 48000, spent: 39200 },
          { id: "b2", category: "Roof", budgeted: 24000, spent: 26800, note: "Sheathing rot found" },
          { id: "b3", category: "Electrical panel + rewire", budgeted: 22000, spent: 14500 },
          { id: "b4", category: "Bathrooms (×3)", budgeted: 21000, spent: 8200 },
          { id: "b5", category: "Flooring & paint", budgeted: 16000, spent: 4100 },
          { id: "b6", category: "Exterior & landscaping", budgeted: 9000, spent: 0 },
        ],
        tasks: [
          { id: "rt1", title: "Roof replacement", status: "done", contractorId: "c2", cost: 26800 },
          { id: "rt2", title: "Panel upgrade to 400A", status: "done", contractorId: "c3", cost: 9800 },
          { id: "rt3", title: "Rewire units 3–6", status: "in_progress", contractorId: "c3", dueDate: d(8) },
          { id: "rt4", title: "Kitchen installs units 3–4", status: "in_progress", contractorId: "c1", dueDate: d(14) },
          { id: "rt5", title: "Kitchen installs units 5–6", status: "todo", contractorId: "c1", dueDate: d(24) },
          { id: "rt6", title: "Bathroom renos", status: "blocked", contractorId: "c4", dueDate: d(20) },
          { id: "rt7", title: "ESA inspection", status: "todo", dueDate: d(16) },
          { id: "rt8", title: "Flooring + paint throughout", status: "todo", dueDate: d(32) },
        ],
      },
      {
        id: "r2", propertyId: "p5", name: "Norfolk Triplex — scope planning",
        status: "planning", startDate: d(21), targetEndDate: d(111), scenario: "standard",
        budgetLines: [
          { id: "b7", category: "Kitchens (×3)", budgeted: 33000, spent: 0 },
          { id: "b8", category: "Bathrooms (×3)", budgeted: 19500, spent: 0 },
          { id: "b9", category: "Windows", budgeted: 14000, spent: 0 },
          { id: "b10", category: "Flooring & paint", budgeted: 11500, spent: 0 },
        ],
        tasks: [
          { id: "rt9", title: "Finalize scope with GC", status: "todo", contractorId: "c1", dueDate: d(18) },
          { id: "rt10", title: "Permit application", status: "todo", dueDate: d(25) },
        ],
      },
    ],

    contractors: [
      { id: "c1", name: "Northline Contracting", trade: "General Contractor", phone: "905-555-0250",
        email: "office@northline.example", rating: 4.5, insuranceOnFile: true, licenseOnFile: true,
        notes: "Reliable GC. Books out 3–4 weeks." },
      { id: "c2", name: "Apex Roofing", trade: "Roofing", phone: "905-555-0261",
        email: "quotes@apexroof.example", rating: 4.8, insuranceOnFile: true, licenseOnFile: true },
      { id: "c3", name: "Volt Electric", trade: "Electrical", phone: "289-555-0272",
        email: "jobs@voltelectric.example", rating: 4.2, insuranceOnFile: true, licenseOnFile: true },
      { id: "c4", name: "BlueWave Plumbing", trade: "Plumbing", phone: "905-555-0283",
        email: "dispatch@bluewave.example", rating: 3.6, insuranceOnFile: false, licenseOnFile: true,
        notes: "Good price, slow to schedule. Insurance cert expired — chase renewal." },
    ],

    transactions: [
      // recent months, mixed
      { id: "x1", propertyId: "p1", date: d(-6), category: "rent_income", description: "October rents — 4 units", amount: 7445 },
      { id: "x2", propertyId: "p1", date: d(-5), category: "mortgage", description: "First National payment", amount: -3873 },
      { id: "x3", propertyId: "p1", date: d(-12), category: "maintenance", description: "Furnace service + filter", amount: -310 },
      { id: "x4", propertyId: "p2", date: d(-6), category: "rent_income", description: "Rent — main floor", amount: 2100 },
      { id: "x5", propertyId: "p2", date: d(-5), category: "mortgage", description: "Scotiabank payment", amount: -2721 },
      { id: "x6", propertyId: "p2", date: d(-20), category: "maintenance", description: "Eaves + downspout repair", amount: -480 },
      { id: "x7", propertyId: "p3", date: d(-8), category: "rehab", description: "Kitchen cabinets — units 3–4", amount: -18400 },
      { id: "x8", propertyId: "p3", date: d(-15), category: "rehab", description: "Roof final invoice — Apex", amount: -12600 },
      { id: "x9", propertyId: "p3", date: d(-5), category: "mortgage", description: "Meridian interest payment", amount: -4458 },
      { id: "x10", propertyId: "p4", date: d(-9), category: "rent_income", description: "STR payouts (Airbnb/VRBO)", amount: 4120 },
      { id: "x11", propertyId: "p4", date: d(-5), category: "mortgage", description: "TD payment", amount: -2281 },
      { id: "x12", propertyId: "p4", date: d(-18), category: "management", description: "Co-host fee 15%", amount: -618 },
      { id: "x13", propertyId: "p8", date: d(-6), category: "rent_income", description: "Rents — both units", amount: 3765 },
      { id: "x14", propertyId: "p8", date: d(-5), category: "mortgage", description: "RBC payment", amount: -2313 },
      { id: "x15", propertyId: "p1", date: d(-36), category: "rent_income", description: "September rents — 4 units", amount: 7445 },
      { id: "x16", propertyId: "p1", date: d(-35), category: "mortgage", description: "First National payment", amount: -3873 },
      { id: "x17", propertyId: "p2", date: d(-36), category: "rent_income", description: "Rent — main floor only (upper late)", amount: 2100 },
      { id: "x18", propertyId: "p2", date: d(-35), category: "mortgage", description: "Scotiabank payment", amount: -2721 },
      { id: "x19", propertyId: "p3", date: d(-38), category: "rehab", description: "Electrical rough-in draw", amount: -14500 },
      { id: "x20", propertyId: "p4", date: d(-39), category: "rent_income", description: "STR payouts", amount: 5480 },
      { id: "x21", propertyId: "p8", date: d(-36), category: "rent_income", description: "Rents — both units", amount: 3765 },
      { id: "x22", propertyId: "p8", date: d(-35), category: "mortgage", description: "RBC payment", amount: -2313 },
      { id: "x23", propertyId: "p1", date: d(-240), category: "refi_proceeds", description: "Cash-out refinance proceeds", amount: 148000 },
      { id: "x24", propertyId: "p8", date: d(-500), category: "refi_proceeds", description: "Cash-out refinance proceeds", amount: 96000 },
      { id: "x25", propertyId: "p3", date: d(-70), category: "purchase", description: "Down payment + closing", amount: -218400 },
      { id: "x26", propertyId: null, date: d(-3), category: "misc_expense", description: "Landlord insurance umbrella policy", amount: -940 },
      { id: "x27", propertyId: "p4", date: d(-70), category: "utilities", description: "Hydro + water (quarterly)", amount: -760 },
      { id: "x28", propertyId: "p2", date: d(-66), category: "rent_income", description: "Rents — both units", amount: 4150 },
    ],

    docs: [
      { id: "doc1", propertyId: "p1", name: "Purchase Agreement — 412 Maple", kind: "purchase_agreement", addedDate: d(-420), aiSummary: "APS at $610K, 5-day inspection condition, closed with $15K price reduction after inspection." },
      { id: "doc2", propertyId: "p1", name: "Refi Appraisal Report", kind: "inspection", addedDate: d(-250), aiSummary: "Appraised $840K income approach; comps at 6.5–6.9% cap." },
      { id: "doc3", propertyId: "p1", name: "First National Mortgage Commitment", kind: "mortgage", addedDate: d(-245) },
      { id: "doc4", propertyId: "p2", name: "Second Suite Permit — Final", kind: "permit", addedDate: d(-200), aiSummary: "Legal second-suite permit closed; ESA and fire separation sign-offs attached." },
      { id: "doc5", propertyId: "p3", name: "Inspection Report — Queen St", kind: "inspection", addedDate: d(-80), aiSummary: "Roof at end of life, aluminum wiring in 4 units, kitchens original 1971. Est. remediation $130–150K." },
      { id: "doc6", propertyId: "p3", name: "Roof Invoice — Apex Roofing", kind: "invoice", addedDate: d(-15) },
      { id: "doc7", propertyId: "p4", name: "STR License — Port Colborne", kind: "permit", addedDate: d(-180) },
      { id: "doc8", propertyId: "p5", name: "APS — 233 Norfolk (conditional)", kind: "purchase_agreement", addedDate: d(-9), aiSummary: "Offer $520K, conditions: inspection (10 days), financing (15 days). Irrevocable Friday." },
      { id: "doc9", propertyId: null, name: "Umbrella Insurance Policy 2026", kind: "insurance", addedDate: d(-3) },
      { id: "doc10", propertyId: "p8", name: "Lease — Unit A (Ansah)", kind: "lease", addedDate: d(-350) },
    ],

    timeline: [
      { id: "e1", propertyId: "p5", date: d(-9), title: "Offer accepted — conditional", body: "$520K with inspection + financing conditions.", kind: "stage" },
      { id: "e2", propertyId: "p5", date: d(-2), title: "Inspection booked", body: "Thursday 10am with HomePro.", kind: "note" },
      { id: "e3", propertyId: "p3", date: d(-15), title: "Roof complete", body: "Came in $2,800 over — sheathing rot on north face.", kind: "reno" },
      { id: "e4", propertyId: "p3", date: d(-8), title: "Kitchens 3–4 cabinets delivered", kind: "reno" },
      { id: "e5", propertyId: "p4", date: d(-14), title: "Entered refinancing", body: "Appraisal ordered via TD. Target 70% LTV cash-out.", kind: "stage" },
      { id: "e6", propertyId: "p1", date: d(-240), title: "Cash-out refi funded", body: "$148K pulled out — capital recycled into Queen St Six.", kind: "money" },
      { id: "e7", propertyId: "p2", date: d(-32), title: "Upper tenant missed rent", body: "Second consecutive month. N4 served.", kind: "tenant" },
      { id: "e8", propertyId: "p6", date: d(-4), title: "Offer submitted — $900K", body: "Asking $965K. Seller motivated, vacant storefront.", kind: "stage" },
      { id: "e9", propertyId: "p7", date: d(-2), title: "Lead received from wholesaler", body: "Tenanted fourplex, rents 30% under market.", kind: "note" },
    ],

    todos: [
      { id: "td1", propertyId: "p5", title: "Attend inspection at 233 Norfolk", done: false, dueDate: d(2), stage: "under_contract" },
      { id: "td2", propertyId: "p5", title: "Send financing package to broker", done: false, dueDate: d(4), stage: "under_contract" },
      { id: "td3", propertyId: "p3", title: "Chase BlueWave insurance certificate", done: false, dueDate: d(-3) },
      { id: "td4", propertyId: "p3", title: "Book ESA inspection", done: false, dueDate: d(10), stage: "renovation" },
      { id: "td5", propertyId: "p4", title: "Send rent roll + STR statements to TD appraiser", done: false, dueDate: d(1), stage: "refinancing" },
      { id: "td6", propertyId: "p2", title: "File L1 if upper suite misses November rent", done: false, dueDate: d(12) },
      { id: "td7", propertyId: "p1", title: "Renew Unit 3 lease (Tremblay) — expiring soon", done: false, dueDate: d(20) },
      { id: "td8", propertyId: "p6", title: "Walk Gore Park storefront with GC for conversion scope", done: false, dueDate: d(6), stage: "offer" },
      { id: "td9", propertyId: "p7", title: "Underwrite Cannon St fourplex", done: true, dueDate: d(-1), stage: "lead" },
      { id: "td10", propertyId: null, title: "Quarterly HST filing for STR", done: false, dueDate: d(15) },
    ],
  };
}
