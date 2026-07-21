/* ============================================================================
 * BRRRR OS domain model.
 * This mirrors the production database schema described in BLUEPRINT.md —
 * in the local-first app, these entities live in a persisted store instead
 * of Postgres, but the shapes are identical by design.
 * ========================================================================== */

export type ID = string;

/** BRRRR pipeline stages, in canonical order. */
export const STAGES = [
  "lead",
  "offer",
  "under_contract",
  "closing",
  "renovation",
  "ready_to_rent",
  "listed",
  "occupied",
  "refinancing",
  "completed",
] as const;
export type Stage = (typeof STAGES)[number];

export const STAGE_LABELS: Record<Stage, string> = {
  lead: "Lead",
  offer: "Offer",
  under_contract: "Under Contract",
  closing: "Closing",
  renovation: "Renovation",
  ready_to_rent: "Ready to Rent",
  listed: "Listed",
  occupied: "Occupied",
  refinancing: "Refinancing",
  completed: "Completed",
};

/** Stages considered "owned" (post-closing). */
export const OWNED_STAGES: Stage[] = [
  "renovation", "ready_to_rent", "listed", "occupied", "refinancing", "completed",
];

export type PropertyType =
  | "single_family" | "duplex" | "triplex" | "fourplex"
  | "small_multifamily" | "str" | "commercial" | "land";

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  single_family: "Single Family",
  duplex: "Duplex",
  triplex: "Triplex",
  fourplex: "Fourplex",
  small_multifamily: "Small Multifamily",
  str: "Short-Term Rental",
  commercial: "Commercial",
  land: "Land",
};

/** Underwriting inputs — one embedded doc per property, feeds the engine. */
export interface Underwriting {
  units: number;
  rentPerUnit: number;        // stabilized market rent / unit / month
  otherIncome: number;        // monthly (laundry, parking, storage)
  vacancyPct: number;
  taxesAnnual: number;
  insuranceAnnual: number;
  utilitiesAnnual: number;
  maintenancePct: number;     // % of EGI
  managementPct: number;      // % of EGI
  reservesPerUnit: number;    // $/unit/year
  expenseRatioPct: number;    // fallback if itemized are blank
  price: number;              // purchase price (actual or offer)
  rehabBudget: number;
  downPct: number;
  purchaseRatePct: number;
  purchaseTermYears: number;
  closingPct: number;
  holdingMonths: number;
  arvMode: "income" | "manual";
  arvManual: number;
  marketCapPct: number;
  refiLtvPct: number;
  refiRatePct: number;
  refiTermYears: number;
  refiClosingPct: number;
}

export interface Loan {
  id: ID;
  propertyId: ID;
  lender: string;
  kind: "acquisition" | "refinance" | "heloc" | "private";
  originalAmount: number;
  currentBalance: number;
  ratePct: number;
  termYears: number;
  startDate: string;          // ISO date
  monthlyPayment: number;
  active: boolean;
}

export interface Tenant {
  id: ID;
  propertyId: ID;
  unitLabel: string;
  name: string;
  email: string;
  phone: string;
  rent: number;               // monthly
  leaseStart: string;
  leaseEnd: string;
  status: "current" | "late" | "notice" | "vacant" | "eviction";
  balanceOwed: number;
}

export type RenoTaskStatus = "todo" | "in_progress" | "blocked" | "done";

export interface RenoTask {
  id: ID;
  title: string;
  status: RenoTaskStatus;
  contractorId?: ID;
  dueDate?: string;
  cost?: number;
}

export interface BudgetLine {
  id: ID;
  category: string;           // e.g. "Kitchen", "Roof", "Electrical"
  budgeted: number;
  spent: number;
  note?: string;
}

export interface RenovationProject {
  id: ID;
  propertyId: ID;
  name: string;
  status: "planning" | "active" | "on_hold" | "complete";
  startDate: string;
  targetEndDate: string;
  budgetLines: BudgetLine[];
  tasks: RenoTask[];
  scenario: "budget" | "standard" | "luxury";
}

export interface Contractor {
  id: ID;
  name: string;
  trade: string;
  phone: string;
  email: string;
  rating: number;             // 1..5
  insuranceOnFile: boolean;
  licenseOnFile: boolean;
  notes?: string;
}

export type TxnCategory =
  | "rent_income" | "other_income"
  | "mortgage" | "taxes" | "insurance" | "utilities" | "maintenance"
  | "management" | "capex" | "rehab" | "closing_costs" | "purchase" | "refi_proceeds"
  | "misc_expense";

export interface Transaction {
  id: ID;
  propertyId: ID | null;      // null = portfolio-level
  date: string;
  category: TxnCategory;
  description: string;
  amount: number;             // positive = inflow, negative = outflow
}

export interface Doc {
  id: ID;
  propertyId: ID | null;
  name: string;
  kind: "purchase_agreement" | "mortgage" | "insurance" | "lease" | "inspection"
      | "invoice" | "permit" | "photo" | "other";
  addedDate: string;
  note?: string;
  aiSummary?: string;
}

export interface TimelineEvent {
  id: ID;
  propertyId: ID;
  date: string;
  title: string;
  body?: string;
  kind: "stage" | "note" | "money" | "reno" | "tenant" | "doc";
}

export interface TodoItem {
  id: ID;
  propertyId: ID | null;
  title: string;
  done: boolean;
  dueDate?: string;
  stage?: Stage;              // stage-gate task
}

export interface Property {
  id: ID;
  name: string;
  address: string;
  city: string;
  propertyType: PropertyType;
  stage: Stage;
  stageEnteredDate: string;
  yearBuilt?: number;
  sqft?: number;
  photoHue: number;           // 0-360, drives the generated cover art
  underwriting: Underwriting;
  currentValue: number;       // best current estimate (appraisal / model)
  purchaseDate?: string;
  actualRehabSpent?: number;
  notes?: string;
  archived?: boolean;
}

/** App-level settings persisted alongside data. */
export interface Settings {
  theme: "dark" | "light";
  apiKey: string;             // Anthropic API key — stored ONLY in localStorage
  model: string;
  investorName: string;
  targetCashflowPerUnit: number;
  targetCoCPct: number;
  marketRefiRatePct: number;  // today's market refi rate, used by the refi scanner
}

export interface AppData {
  properties: Property[];
  loans: Loan[];
  tenants: Tenant[];
  renovations: RenovationProject[];
  contractors: Contractor[];
  transactions: Transaction[];
  docs: Doc[];
  timeline: TimelineEvent[];
  todos: TodoItem[];
  settings: Settings;
}
