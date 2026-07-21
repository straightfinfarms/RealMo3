/* ============================================================================
 * insights.ts — the deterministic intelligence layer.
 * Computes portfolio KPIs, per-property health, refinance opportunities and
 * "needs attention" items from raw data. Feeds the Dashboard, the Refinance
 * module, AND the AI Copilot (Claude calls these via tools, so its answers
 * are grounded in the same numbers the UI shows).
 * ========================================================================== */
import type { AppData, Property, Loan, Tenant, RenovationProject } from "@/data/types";
import { OWNED_STAGES } from "@/data/types";
import { underwrite, scoreDeal, monthlyPayment, fmtMoney, fmtCompact, fmtPct } from "./underwrite";

/* ---------- per-property live metrics ---------- */
export interface PropertyMetrics {
  propertyId: string;
  name: string;
  stage: string;
  owned: boolean;
  units: number;
  currentValue: number;
  debt: number;
  equity: number;
  ltvPct: number;
  actualRentMo: number;       // from tenants (occupied units)
  scheduledRentMo: number;    // stabilized pro-forma
  occupancyPct: number;
  noiAnnual: number;
  debtServiceMo: number;
  cashflowMo: number;
  dscr: number;
  cocPct: number;
  cashInvested: number;
  score: number;
  gradeStr: string;
  health: "good" | "watch" | "alert";
  healthReasons: string[];
}

export function propertyMetrics(p: Property, data: AppData): PropertyMetrics {
  const owned = OWNED_STAGES.includes(p.stage);
  const loans = data.loans.filter((l) => l.propertyId === p.id && l.active);
  const tenants = data.tenants.filter((t) => t.propertyId === p.id);
  const debt = loans.reduce((a, l) => a + l.currentBalance, 0);
  const debtServiceMo = loans.reduce((a, l) => a + l.monthlyPayment, 0);

  const uw = underwrite(p.underwriting);
  const units = uw.units;

  const occupied = tenants.filter((t) => t.status !== "vacant");
  const actualRentMo = occupied.reduce((a, t) => a + t.rent, 0);
  const scheduledRentMo = uw.grossRentMo;
  const occupancyPct = units > 0 ? Math.min(100, (occupied.length / units) * 100) : 0;

  // NOI from actual rents when tenanted, pro-forma otherwise.
  const usingActual = owned && occupied.length > 0;
  const egiAnnual = usingActual ? actualRentMo * 12 * (1 - uw.inputs.vacancyPct / 100) : uw.egi;
  const noiAnnual = egiAnnual - uw.opex * (usingActual ? egiAnnual / Math.max(1, uw.egi) : 1);

  const cashflowMo = noiAnnual / 12 - debtServiceMo;
  const dscr = debtServiceMo > 0 ? noiAnnual / (debtServiceMo * 12) : Infinity;
  const equity = p.currentValue - debt;
  const ltvPct = p.currentValue > 0 ? (debt / p.currentValue) * 100 : 0;

  // cash invested: down + closing + rehab spent (actual if known) − refi proceeds
  const refiProceeds = data.transactions
    .filter((t) => t.propertyId === p.id && t.category === "refi_proceeds")
    .reduce((a, t) => a + t.amount, 0);
  const cashInvested = Math.max(
    0,
    uw.downPayment + uw.closingCosts + (p.actualRehabSpent ?? uw.inputs.rehabBudget) +
      uw.holdingCosts - refiProceeds,
  );
  const cocPct = cashInvested > 0 ? ((cashflowMo * 12) / cashInvested) * 100 : Infinity;

  const s = scoreDeal(uw);

  const healthReasons: string[] = [];
  if (owned) {
    if (cashflowMo < 0) healthReasons.push(`Negative cash flow (${fmtMoney(cashflowMo)}/mo)`);
    if (isFinite(dscr) && dscr < 1.2) healthReasons.push(`DSCR ${dscr.toFixed(2)}x below 1.2x`);
    if (p.stage === "occupied" && occupancyPct < 85) healthReasons.push(`Occupancy ${Math.round(occupancyPct)}%`);
    const late = tenants.filter((t) => t.status === "late" || t.status === "eviction");
    if (late.length) healthReasons.push(`${late.length} tenant(s) behind on rent`);
  }
  const health: PropertyMetrics["health"] =
    healthReasons.length >= 2 ? "alert" : healthReasons.length === 1 ? "watch" : "good";

  return {
    propertyId: p.id, name: p.name, stage: p.stage, owned, units,
    currentValue: p.currentValue, debt, equity, ltvPct,
    actualRentMo, scheduledRentMo, occupancyPct,
    noiAnnual, debtServiceMo, cashflowMo, dscr, cocPct, cashInvested,
    score: s.total, gradeStr: s.grade, health, healthReasons,
  };
}

/* ---------- portfolio rollup ---------- */
export interface PortfolioKpis {
  propertiesOwned: number;
  unitsOwned: number;
  portfolioValue: number;
  totalDebt: number;
  totalEquity: number;
  ltvPct: number;
  cashflowMo: number;
  incomeMo: number;
  expensesMo: number;
  occupancyPct: number;
  cashInvested: number;
  pipelineCount: number;
  pipelineValue: number;
  avgDscr: number;
}

export function portfolioKpis(data: AppData): PortfolioKpis {
  const all = data.properties.filter((p) => !p.archived).map((p) => propertyMetrics(p, data));
  const owned = all.filter((m) => m.owned);
  const pipeline = all.filter((m) => !m.owned);

  const portfolioValue = owned.reduce((a, m) => a + m.currentValue, 0);
  const totalDebt = owned.reduce((a, m) => a + m.debt, 0);
  const incomeMo = owned.reduce((a, m) => a + (m.actualRentMo || m.scheduledRentMo), 0);
  const cashflowMo = owned.reduce((a, m) => a + m.cashflowMo, 0);
  const debtSvc = owned.reduce((a, m) => a + m.debtServiceMo, 0);
  const noiMo = owned.reduce((a, m) => a + m.noiAnnual / 12, 0);
  const totalUnits = owned.reduce((a, m) => a + m.units, 0);
  // Occupancy only counts stages where tenancy is expected (not mid-rehab),
  // and skips STRs with no lease tenants (their "occupancy" is booking rate).
  const rentReady = owned.filter((m) => {
    const p = data.properties.find((x) => x.id === m.propertyId)!;
    if (!["occupied", "listed", "refinancing", "completed"].includes(p.stage)) return false;
    if (p.propertyType === "str" && !data.tenants.some((t) => t.propertyId === p.id)) return false;
    return true;
  });
  const rrUnits = rentReady.reduce((a, m) => a + m.units, 0);
  const occUnits = rentReady.reduce((a, m) => a + (m.occupancyPct / 100) * m.units, 0);
  const dscrs = owned.filter((m) => isFinite(m.dscr));

  return {
    propertiesOwned: owned.length,
    unitsOwned: totalUnits,
    portfolioValue,
    totalDebt,
    totalEquity: portfolioValue - totalDebt,
    ltvPct: portfolioValue > 0 ? (totalDebt / portfolioValue) * 100 : 0,
    cashflowMo,
    incomeMo,
    expensesMo: incomeMo - noiMo + debtSvc,
    occupancyPct: rrUnits > 0 ? (occUnits / rrUnits) * 100 : 0,
    cashInvested: owned.reduce((a, m) => a + m.cashInvested, 0),
    pipelineCount: pipeline.length,
    pipelineValue: pipeline.reduce((a, m) => a + m.currentValue, 0),
    avgDscr: dscrs.length ? dscrs.reduce((a, m) => a + m.dscr, 0) / dscrs.length : Infinity,
  };
}

/* ---------- refinance opportunity scanner ---------- */
export interface RefiOpportunity {
  propertyId: string;
  name: string;
  currentValue: number;
  currentDebt: number;
  currentPaymentMo: number;
  maxLoan: number;            // at target LTV
  cashOut: number;            // net of payoff & closing
  newPaymentMo: number;
  cashflowDeltaMo: number;
  verdict: "ready" | "close" | "wait";
  note: string;
}

export function scanRefis(data: AppData, targetLtvPct = 75): RefiOpportunity[] {
  const rate = data.settings.marketRefiRatePct;
  const out: RefiOpportunity[] = [];
  for (const p of data.properties.filter((x) => !x.archived)) {
    const m = propertyMetrics(p, data);
    if (!m.owned || p.stage === "refinancing") continue;
    const maxLoan = (p.currentValue * targetLtvPct) / 100;
    const closing = maxLoan * 0.02;
    const cashOut = maxLoan - m.debt - closing;
    if (maxLoan <= 0) continue;
    const newPaymentMo = monthlyPayment(maxLoan, rate, 30);
    const cashflowDeltaMo = m.debtServiceMo - newPaymentMo;
    const newDscr = newPaymentMo > 0 ? m.noiAnnual / (newPaymentMo * 12) : Infinity;

    let verdict: RefiOpportunity["verdict"];
    let note: string;
    if (cashOut > 25000 && newDscr >= 1.2) {
      verdict = "ready";
      note = `Pull ${fmtCompact(cashOut)} tax-free at ${fmtPct(targetLtvPct, 0)} LTV; DSCR stays ${newDscr.toFixed(2)}x.`;
    } else if (cashOut > 10000 && newDscr >= 1.1) {
      verdict = "close";
      note = `${fmtCompact(cashOut)} available but margin is thin (DSCR ${isFinite(newDscr) ? newDscr.toFixed(2) : "∞"}x). Watch rates or push value.`;
    } else {
      verdict = "wait";
      note = cashOut <= 10000
        ? "Not enough equity yet to justify refi costs."
        : "New debt service would strain cash flow at today's rates.";
    }
    out.push({
      propertyId: p.id, name: p.name,
      currentValue: p.currentValue, currentDebt: m.debt, currentPaymentMo: m.debtServiceMo,
      maxLoan, cashOut, newPaymentMo, cashflowDeltaMo, verdict, note,
    });
  }
  return out.sort((a, b) => b.cashOut - a.cashOut);
}

/* ---------- renovation health ---------- */
export interface RenoHealth {
  projectId: string;
  propertyId: string;
  name: string;
  budgeted: number;
  spent: number;
  overBudgetPct: number;      // + = over
  pctTasksDone: number;
  daysToTarget: number;       // negative = past target
  blockedTasks: number;
  flags: string[];            // AI-style detections
}

export function renoHealth(r: RenovationProject, today: string): RenoHealth {
  const budgeted = r.budgetLines.reduce((a, b) => a + b.budgeted, 0);
  const spent = r.budgetLines.reduce((a, b) => a + b.spent, 0);
  const overBudgetPct = budgeted > 0 ? ((spent - budgeted) / budgeted) * 100 : 0;
  const done = r.tasks.filter((t) => t.status === "done").length;
  const pctTasksDone = r.tasks.length ? (done / r.tasks.length) * 100 : 0;
  const daysToTarget = Math.round(
    (new Date(r.targetEndDate).getTime() - new Date(today).getTime()) / 86400000,
  );
  const blockedTasks = r.tasks.filter((t) => t.status === "blocked").length;

  const flags: string[] = [];
  if (r.status === "active") {
    if (overBudgetPct > 10) flags.push(`Budget overrun ${overBudgetPct.toFixed(0)}%`);
    else {
      // scope creep: heavy spend on lines that are individually over
      const overLines = r.budgetLines.filter((b) => b.budgeted > 0 && b.spent > b.budgeted * 1.25);
      if (overLines.length) flags.push(`Scope creep in ${overLines.map((b) => b.category).join(", ")}`);
    }
    if (daysToTarget < 0) flags.push(`${-daysToTarget} days past target completion`);
    else if (daysToTarget < 14 && pctTasksDone < 70) flags.push("Schedule risk: <2 weeks left, tasks lagging");
    if (blockedTasks) flags.push(`${blockedTasks} blocked task(s)`);
  }

  return {
    projectId: r.id, propertyId: r.propertyId, name: r.name,
    budgeted, spent, overBudgetPct, pctTasksDone, daysToTarget, blockedTasks, flags,
  };
}

/* ---------- "needs attention" feed ---------- */
export interface AttentionItem {
  icon: string;
  severity: "alert" | "watch" | "info";
  title: string;
  sub: string;
  link: string;               // app route
}

export function attentionFeed(data: AppData, today: string): AttentionItem[] {
  const items: AttentionItem[] = [];

  for (const p of data.properties.filter((x) => !x.archived)) {
    const m = propertyMetrics(p, data);
    for (const reason of m.healthReasons) {
      items.push({
        icon: m.health === "alert" ? "🔴" : "🟡",
        severity: m.health === "alert" ? "alert" : "watch",
        title: `${p.name}: ${reason}`,
        sub: "Open property to investigate",
        link: `/properties/${p.id}`,
      });
    }
  }

  for (const r of data.renovations.filter((x) => x.status === "active")) {
    const h = renoHealth(r, today);
    const prop = data.properties.find((p) => p.id === r.propertyId);
    for (const flag of h.flags) {
      items.push({
        icon: "🛠️",
        severity: flag.startsWith("Budget") || flag.includes("past target") ? "alert" : "watch",
        title: `${prop?.name ?? r.name}: ${flag}`,
        sub: `Renovation ${Math.round(h.pctTasksDone)}% complete · ${fmtCompact(h.spent)} of ${fmtCompact(h.budgeted)} spent`,
        link: `/renovation`,
      });
    }
  }

  const refis = scanRefis(data).filter((r) => r.verdict === "ready");
  for (const r of refis.slice(0, 3)) {
    items.push({
      icon: "💰",
      severity: "info",
      title: `Refinance opportunity: ${r.name}`,
      sub: r.note,
      link: `/refinance`,
    });
  }

  const overdue = data.todos.filter((t) => !t.done && t.dueDate && t.dueDate < today);
  for (const t of overdue.slice(0, 5)) {
    const prop = data.properties.find((p) => p.id === t.propertyId);
    items.push({
      icon: "⏰",
      severity: "watch",
      title: `Overdue: ${t.title}`,
      sub: prop ? prop.name : "Portfolio task",
      link: prop ? `/properties/${prop.id}` : "/",
    });
  }

  const leaseSoon = data.tenants.filter((t) => {
    if (t.status === "vacant") return false;
    const days = (new Date(t.leaseEnd).getTime() - new Date(today).getTime()) / 86400000;
    return days > 0 && days < 60;
  });
  for (const t of leaseSoon) {
    const prop = data.properties.find((p) => p.id === t.propertyId);
    items.push({
      icon: "📄",
      severity: "info",
      title: `Lease expiring: ${t.name} (${t.unitLabel})`,
      sub: `${prop?.name ?? ""} · ends ${t.leaseEnd} — start renewal conversation`,
      link: "/tenants",
    });
  }

  const sevRank = { alert: 0, watch: 1, info: 2 } as const;
  return items.sort((a, b) => sevRank[a.severity] - sevRank[b.severity]);
}
