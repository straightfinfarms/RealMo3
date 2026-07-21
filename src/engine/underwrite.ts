/* ============================================================================
 * underwrite.ts — BRRRR underwriting engine (v3).
 * Evolved from RealMo v1's finance.js. Pure functions, no DOM, no store.
 *
 * BRRRR = Buy, Rehab, Rent, Refinance, Repeat. Buy below value, force
 * appreciation with a rehab, stabilize rents, cash-out refinance to pull
 * capital back out, repeat. CASH FLOW remains the key metric — everything
 * else is secondary.
 * ========================================================================== */
import type { Underwriting } from "@/data/types";

export const UW_DEFAULTS: Underwriting = {
  units: 4,
  rentPerUnit: 1250,
  otherIncome: 0,
  vacancyPct: 6,
  taxesAnnual: 0,
  insuranceAnnual: 0,
  utilitiesAnnual: 0,
  maintenancePct: 8,
  managementPct: 8,
  reservesPerUnit: 300,
  expenseRatioPct: 45,
  price: 250000,
  rehabBudget: 50000,
  downPct: 25,
  purchaseRatePct: 8.5,
  purchaseTermYears: 30,
  closingPct: 3,
  holdingMonths: 6,
  arvMode: "income",
  arvManual: 420000,
  marketCapPct: 7.25,
  refiLtvPct: 75,
  refiRatePct: 7.25,
  refiTermYears: 30,
  refiClosingPct: 2,
};

export interface UnderwriteResult {
  inputs: Underwriting;
  units: number;
  // income
  grossRentMo: number;
  gsiAnnual: number;
  vacancyLoss: number;
  egi: number;
  opex: number;
  expenseRatio: number;
  noi: number;
  // value
  arv: number;
  // acquisition
  downPayment: number;
  purchaseLoan: number;
  closingCosts: number;
  purchasePmt: number;
  holdingCosts: number;
  totalCashInvested: number;
  cfPurchaseAnnual: number;
  // refinance
  refiLoan: number;
  refiClosing: number;
  refiPmt: number;
  cashOut: number;
  cashRecovered: number;
  cashLeftInDeal: number;
  capitalRecoveredPct: number;
  // stabilized returns
  cfAnnual: number;
  cfMonthly: number;
  cfPerUnitMo: number;
  capRatePurchase: number;
  capRateArv: number;
  cocPct: number;             // Infinity when all capital recovered
  dscr: number;               // Infinity when no debt
  rentToPricePct: number;
  grm: number;
  equityAtRefi: number;
  equityCreated: number;      // ARV - all-in basis
  allInBasis: number;
  ltvAfterRefi: number;
  totalProfitIfSold: number;
  fiveYearIrrPct: number;     // simple 5-yr IRR w/ 3% appreciation + sale
}

const n = (v: number | undefined | null, d = 0): number =>
  typeof v === "number" && isFinite(v) ? v : d;

/** Standard amortizing payment. annualRatePct in %, term in years. */
export function monthlyPayment(loan: number, annualRatePct: number, termYears: number): number {
  loan = n(loan);
  const r = n(annualRatePct) / 100 / 12;
  const months = n(termYears) * 12;
  if (loan <= 0 || months <= 0) return 0;
  if (r === 0) return loan / months;
  return (loan * r) / (1 - Math.pow(1 + r, -months));
}

/** Remaining balance on an amortizing loan after `monthsElapsed`. */
export function remainingBalance(loan: number, annualRatePct: number, termYears: number, monthsElapsed: number): number {
  const r = n(annualRatePct) / 100 / 12;
  const total = n(termYears) * 12;
  const m = Math.min(Math.max(0, monthsElapsed), total);
  if (loan <= 0) return 0;
  if (r === 0) return loan * (1 - m / total);
  const pmt = monthlyPayment(loan, annualRatePct, termYears);
  return loan * Math.pow(1 + r, m) - pmt * ((Math.pow(1 + r, m) - 1) / r);
}

/** Simple IRR via bisection over annual cash flow vector. */
export function irr(cashflows: number[]): number {
  const npv = (rate: number) =>
    cashflows.reduce((acc, cf, t) => acc + cf / Math.pow(1 + rate, t), 0);
  let lo = -0.95, hi = 5;
  if (npv(lo) * npv(hi) > 0) return NaN;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (npv(mid) > 0) lo = mid; else hi = mid;
  }
  return ((lo + hi) / 2) * 100;
}

/** Core underwriting: full BRRRR pro-forma from inputs. */
export function underwrite(raw: Partial<Underwriting>): UnderwriteResult {
  const i: Underwriting = { ...UW_DEFAULTS, ...raw };
  const units = Math.max(1, n(i.units, 1));

  // ---- income ----
  const grossRentMo = n(i.rentPerUnit) * units + n(i.otherIncome);
  const gsiAnnual = grossRentMo * 12;
  const vacancyLoss = (gsiAnnual * n(i.vacancyPct)) / 100;
  const egi = gsiAnnual - vacancyLoss;

  // ---- operating expenses ----
  const itemized =
    n(i.taxesAnnual) + n(i.insuranceAnnual) + n(i.utilitiesAnnual) +
    n(i.reservesPerUnit) * units +
    (egi * n(i.maintenancePct)) / 100 + (egi * n(i.managementPct)) / 100;
  const usedItemized = n(i.taxesAnnual) + n(i.insuranceAnnual) + n(i.utilitiesAnnual) > 0;
  const opex = usedItemized ? itemized : (egi * n(i.expenseRatioPct)) / 100;
  const noi = egi - opex;
  const expenseRatio = egi > 0 ? opex / egi : 0;

  // ---- ARV ----
  const cap = n(i.marketCapPct) / 100;
  const arv = i.arvMode === "manual" ? n(i.arvManual) : cap > 0 ? noi / cap : 0;

  // ---- acquisition financing ----
  const downPayment = (n(i.price) * n(i.downPct)) / 100;
  const purchaseLoan = n(i.price) - downPayment;
  const closingCosts = (n(i.price) * n(i.closingPct)) / 100;
  const purchasePmt = monthlyPayment(purchaseLoan, i.purchaseRatePct, i.purchaseTermYears);
  const holdingCosts = purchasePmt * n(i.holdingMonths);
  const totalCashInvested = downPayment + closingCosts + n(i.rehabBudget) + holdingCosts;
  const cfPurchaseAnnual = noi - purchasePmt * 12;

  // ---- cash-out refinance (short seasoning: payoff ≈ original balance) ----
  const refiLoan = (arv * n(i.refiLtvPct)) / 100;
  const refiClosing = (refiLoan * n(i.refiClosingPct)) / 100;
  const cashOut = refiLoan - purchaseLoan - refiClosing;
  const refiPmt = monthlyPayment(refiLoan, i.refiRatePct, i.refiTermYears);
  const cfAnnual = noi - refiPmt * 12;
  const cfMonthly = cfAnnual / 12;
  const cfPerUnitMo = cfMonthly / units;

  const cashRecovered = Math.max(0, cashOut);
  const cashLeftInDeal = totalCashInvested - cashRecovered;
  const capitalRecoveredPct = totalCashInvested > 0 ? (cashRecovered / totalCashInvested) * 100 : 0;

  // ---- return metrics ----
  const capRatePurchase = n(i.price) > 0 ? (noi / n(i.price)) * 100 : 0;
  const capRateArv = arv > 0 ? (noi / arv) * 100 : 0;
  const cocPct = cashLeftInDeal <= 0 ? Infinity : (cfAnnual / cashLeftInDeal) * 100;
  const dscr = refiPmt > 0 ? noi / (refiPmt * 12) : Infinity;
  const rentToPricePct = n(i.price) > 0 ? (grossRentMo / n(i.price)) * 100 : 0;
  const grm = gsiAnnual > 0 ? n(i.price) / gsiAnnual : 0;
  const equityAtRefi = arv - refiLoan;
  const allInBasis = n(i.price) + n(i.rehabBudget) + closingCosts + holdingCosts;
  const equityCreated = arv - allInBasis;
  const ltvAfterRefi = arv > 0 ? (refiLoan / arv) * 100 : 0;
  const totalProfitIfSold = arv - allInBasis;

  // ---- simple 5-year IRR: refi at t=0.5yr folded into year-1 flow, 3%
  // appreciation, sell at end of year 5 net of 6% costs & loan payoff ----
  const apprec = 0.03;
  const flows: number[] = [-totalCashInvested];
  for (let y = 1; y <= 5; y++) {
    let f = cfAnnual;
    if (y === 1) f += cashRecovered;
    if (y === 5) {
      const salePrice = arv * Math.pow(1 + apprec, 5);
      const payoff = remainingBalance(refiLoan, i.refiRatePct, i.refiTermYears, 54);
      f += salePrice * 0.94 - payoff;
    }
    flows.push(f);
  }
  const fiveYearIrrPct = irr(flows);

  return {
    inputs: i, units,
    grossRentMo, gsiAnnual, vacancyLoss, egi, opex, expenseRatio, noi,
    arv,
    downPayment, purchaseLoan, closingCosts, purchasePmt, holdingCosts,
    totalCashInvested, cfPurchaseAnnual,
    refiLoan, refiClosing, refiPmt, cashOut, cashRecovered, cashLeftInDeal,
    capitalRecoveredPct,
    cfAnnual, cfMonthly, cfPerUnitMo,
    capRatePurchase, capRateArv, cocPct, dscr, rentToPricePct, grm,
    equityAtRefi, equityCreated, allInBasis, ltvAfterRefi, totalProfitIfSold,
    fiveYearIrrPct,
  };
}

/* ----------------------------------------------------------------------------
 * BRRRR SCORE — 0..100, weighted, CASH FLOW dominant. Same tuned curves as
 * v1 (they were validated against real deals) with identical weights.
 * ------------------------------------------------------------------------- */
export interface Criterion {
  key: string;
  label: string;
  weight: number;
  value: number;
  display: string;
  score: number; // 0..100
}

export interface DealScore {
  total: number;
  grade: string;
  criteria: Criterion[];
  recommendation: { verb: string; tone: "buy" | "ok" | "warn" | "pass"; note: string };
}

const lerp = (x: number, lo: number, hi: number): number =>
  x <= lo ? 0 : x >= hi ? 100 : ((x - lo) / (hi - lo)) * 100;

export function grade(s: number): string {
  if (s >= 90) return "A+"; if (s >= 85) return "A"; if (s >= 80) return "A-";
  if (s >= 75) return "B+"; if (s >= 70) return "B"; if (s >= 65) return "B-";
  if (s >= 60) return "C+"; if (s >= 55) return "C"; if (s >= 50) return "C-";
  if (s >= 40) return "D"; return "F";
}

export function scoreDeal(r: UnderwriteResult): DealScore {
  const criteria: Criterion[] = [
    {
      key: "cashflow", label: "Cash flow / unit / mo", weight: 35,
      value: r.cfPerUnitMo, display: fmtMoney(r.cfPerUnitMo) + "/unit",
      score: r.cfPerUnitMo <= 0 ? Math.max(0, 20 + r.cfPerUnitMo / 5) : lerp(r.cfPerUnitMo, 0, 200),
    },
    {
      key: "recovery", label: "Capital recovered", weight: 20,
      value: r.capitalRecoveredPct, display: Math.round(r.capitalRecoveredPct) + "%",
      score: lerp(r.capitalRecoveredPct, 40, 100),
    },
    {
      key: "coc", label: "Cash-on-cash return", weight: 15,
      value: r.cocPct,
      display: isFinite(r.cocPct) ? r.cocPct.toFixed(1) + "%" : "∞ (all cash out)",
      score: !isFinite(r.cocPct) ? 100 : r.cocPct < 0 ? 0 : lerp(r.cocPct, 4, 20),
    },
    {
      key: "dscr", label: "DSCR", weight: 12,
      value: r.dscr, display: isFinite(r.dscr) ? r.dscr.toFixed(2) + "x" : "∞",
      score: !isFinite(r.dscr) ? 100 : lerp(r.dscr, 1.0, 1.5),
    },
    {
      key: "cap", label: "Cap rate", weight: 10,
      value: r.capRatePurchase, display: r.capRatePurchase.toFixed(2) + "%",
      score: lerp(r.capRatePurchase, 4, 9),
    },
    {
      key: "rent", label: "Rent-to-price", weight: 8,
      value: r.rentToPricePct, display: r.rentToPricePct.toFixed(2) + "%",
      score: lerp(r.rentToPricePct, 0.6, 1.3),
    },
  ];

  let total = criteria.reduce((acc, c) => acc + (c.score * c.weight) / 100, 0);
  total = Math.max(0, Math.min(100, Math.round(total)));

  const cf = r.cfPerUnitMo;
  const rec = r.capitalRecoveredPct;
  let recommendation: DealScore["recommendation"];
  if (total >= 78 && cf > 0) {
    recommendation = {
      verb: "STRONG BUY", tone: "buy",
      note: `Cash flows ${fmtMoney(cf)}/unit and recovers ${Math.round(rec)}% of capital. A textbook BRRRR.`,
    };
  } else if (total >= 66 && cf > 0) {
    recommendation = {
      verb: "BUY / NEGOTIATE", tone: "ok",
      note: "Solid cash flow. Push price toward the pricepoints to lift capital recovery and CoC.",
    };
  } else if (total >= 52) {
    recommendation = {
      verb: "MARGINAL", tone: "warn",
      note: cf <= 0
        ? "Cash flow is thin or negative — the deal only works at a lower basis."
        : "Workable but tight. Re-trade the price or trim rehab before committing.",
    };
  } else {
    recommendation = {
      verb: "PASS", tone: "pass",
      note: cf <= 0
        ? "Negative cash flow at this price. Walk unless the seller moves substantially."
        : "Returns don't justify the risk at this basis.",
    };
  }

  return { total, grade: grade(total), criteria, recommendation };
}

/* ----------------------------------------------------------------------------
 * PRICEPOINTS — purchase prices that hit specific goals, solved numerically
 * against a fresh underwrite() each step so every dependent cost stays
 * internally consistent.
 * ------------------------------------------------------------------------- */
export interface Pricepoints {
  arv: number;
  mao70: number;              // 70% rule MAO
  recoveryPrice: number | null;  // full capital recovery
  cocPrice: number | null;       // hits target CoC
  cfPrice: number | null;        // hits target CF/unit
}

function solvePrice(
  base: Underwriting,
  metric: (r: UnderwriteResult) => number,
  target: number,
): number | null {
  let lo = 1000;
  let hi = Math.max(base.price * 2, 100000);
  let best: number | null = null;
  for (let it = 0; it < 60; it++) {
    const mid = (lo + hi) / 2;
    const r = underwrite({ ...base, price: mid });
    if (metric(r) >= target) { best = mid; lo = mid; } else { hi = mid; }
  }
  return best;
}

export function pricepoints(
  raw: Partial<Underwriting>,
  targets: { cashflowPerUnit: number; cocPct: number },
): Pricepoints {
  const i: Underwriting = { ...UW_DEFAULTS, ...raw };
  const r = underwrite(i);
  return {
    arv: r.arv,
    mao70: 0.7 * r.arv - i.rehabBudget,
    recoveryPrice: solvePrice(i, (x) => x.capitalRecoveredPct, 100),
    cocPrice: solvePrice(i, (x) => (isFinite(x.cocPct) ? x.cocPct : 999), targets.cocPct),
    cfPrice: solvePrice(i, (x) => x.cfPerUnitMo, targets.cashflowPerUnit),
  };
}

/* ---------- shared formatting ---------- */
export function fmtMoney(v: number, cents = false): string {
  if (!isFinite(v)) return "—";
  const r = Math.round(v * (cents ? 100 : 1)) / (cents ? 100 : 1);
  return (r < 0 ? "-$" : "$") + Math.abs(r).toLocaleString("en-US", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  });
}

export function fmtCompact(v: number): string {
  if (!isFinite(v)) return "—";
  const a = Math.abs(v);
  const sign = v < 0 ? "-$" : "$";
  if (a >= 1e6) return sign + (a / 1e6).toFixed(a >= 1e7 ? 1 : 2) + "M";
  if (a >= 1e3) return sign + (a / 1e3).toFixed(a >= 1e5 ? 0 : 1) + "K";
  return sign + Math.round(a);
}

export function fmtPct(v: number, dp = 1): string {
  return isFinite(v) ? v.toFixed(dp) + "%" : "∞";
}
