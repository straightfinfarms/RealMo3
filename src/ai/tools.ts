/* ============================================================================
 * tools.ts — the Copilot's tool belt.
 * Every tool executes locally against the store, so Claude's answers are
 * grounded in exactly the numbers the UI shows. Read tools cover the whole
 * domain; a couple of safe write tools (tasks, notes) let the copilot act.
 * ========================================================================== */
import { dataSnapshot, useStore, uid } from "@/store/store";
import {
  portfolioKpis, propertyMetrics, scanRefis, renoHealth, attentionFeed,
} from "@/engine/insights";
import { underwrite, scoreDeal, pricepoints } from "@/engine/underwrite";
import { todayISO } from "@/data/seed";
import type { Property } from "@/data/types";
import { COST_CATALOG } from "@/data/costCatalog";

export interface ToolDef {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

const round = (v: number): number | string =>
  isFinite(v) ? Math.round(v * 100) / 100 : "Infinity";

function findProperty(query: string): Property | undefined {
  const data = dataSnapshot();
  const q = query.toLowerCase();
  return (
    data.properties.find((p) => p.id === query) ??
    data.properties.find((p) => p.name.toLowerCase() === q) ??
    data.properties.find(
      (p) => p.name.toLowerCase().includes(q) || p.address.toLowerCase().includes(q),
    )
  );
}

export const TOOL_DEFS: ToolDef[] = [
  {
    name: "get_portfolio_summary",
    description:
      "Portfolio-level KPIs: value, equity, debt, LTV, monthly cash flow/income/expenses, occupancy, cash invested, units, pipeline. Use first for any portfolio-wide question.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_properties",
    description:
      "List all properties with stage, value, debt, equity, cash flow, DSCR, occupancy, health and BRRRR score. Optionally filter by pipeline stage.",
    input_schema: {
      type: "object",
      properties: {
        stage: {
          type: "string",
          description: "Optional stage filter, e.g. 'occupied', 'renovation', 'lead'",
        },
      },
    },
  },
  {
    name: "get_property",
    description:
      "Full detail for one property (find by name, address or id): underwriting pro-forma, BRRRR score, loans, tenants, renovation, recent transactions, timeline, notes.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string", description: "Property name, address or id" } },
      required: ["query"],
    },
  },
  {
    name: "analyze_deal",
    description:
      "Run BRRRR underwriting on arbitrary inputs (a hypothetical deal, or what-if overrides on an existing property). Returns full pro-forma, score, recommendation and purchase pricepoints. All money in dollars, rates in percent.",
    input_schema: {
      type: "object",
      properties: {
        base_property: { type: "string", description: "Optional: start from this property's underwriting" },
        overrides: {
          type: "object",
          description:
            "Underwriting fields to set: units, rentPerUnit, otherIncome, vacancyPct, taxesAnnual, insuranceAnnual, utilitiesAnnual, maintenancePct, managementPct, reservesPerUnit, expenseRatioPct, price, rehabBudget, downPct, purchaseRatePct, purchaseTermYears, closingPct, holdingMonths, arvMode ('income'|'manual'), arvManual, marketCapPct, refiLtvPct, refiRatePct, refiTermYears, refiClosingPct",
        },
      },
      required: ["overrides"],
    },
  },
  {
    name: "scan_refinance_opportunities",
    description:
      "Scan every owned property for cash-out refinance potential at today's market rate: max loan, cash-out available, new payment, verdict (ready/close/wait).",
    input_schema: {
      type: "object",
      properties: {
        target_ltv_pct: { type: "number", description: "Target LTV percent, default 75" },
      },
    },
  },
  {
    name: "get_renovation_status",
    description:
      "Status of all renovation projects: budget vs spent, overruns, task progress, days to target, blocked tasks, and AI-detected flags (overruns, scope creep, schedule risk).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_transactions",
    description: "Recent transactions (income and expenses), optionally for one property.",
    input_schema: {
      type: "object",
      properties: {
        property: { type: "string", description: "Optional property name/id filter" },
        limit: { type: "number", description: "Max rows, default 25" },
      },
    },
  },
  {
    name: "get_tenants",
    description:
      "Rent roll: every tenant with unit, rent, lease dates, status (current/late/notice/eviction) and balance owed.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_attention_items",
    description:
      "The prioritized 'needs attention' feed: property health alerts, renovation flags, refi opportunities, overdue tasks, expiring leases.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_contractors",
    description: "Contractor directory with trade, rating, insurance/license status and notes.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "get_renovation_cost_catalog",
    description:
      "The app's renovation cost-element catalog: ~30 standard rehab elements with rental-grade low/avg/high unit costs (2026 averages), grouped by category, phase and trade. Use to estimate renovation budgets conversationally, sanity-check contractor quotes, or draft a scope of work. For a full guided estimate, point the user to the Reno Estimator page.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "create_task",
    description:
      "Create a to-do for the investor. Use when the user asks you to remind them, track something, or when you recommend a concrete follow-up they accept.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        property: { type: "string", description: "Optional property name/id to attach it to" },
        due_date: { type: "string", description: "Optional ISO date YYYY-MM-DD" },
      },
      required: ["title"],
    },
  },
  {
    name: "add_note",
    description: "Add a timeline note to a property (e.g. a call summary or decision).",
    input_schema: {
      type: "object",
      properties: {
        property: { type: "string", description: "Property name/id" },
        title: { type: "string" },
        body: { type: "string" },
      },
      required: ["property", "title"],
    },
  },
];

/** Execute a tool call. Always returns a JSON-serializable result. */
export function runTool(name: string, input: Record<string, unknown>): unknown {
  const data = dataSnapshot();
  const today = todayISO();

  switch (name) {
    case "get_portfolio_summary": {
      const k = portfolioKpis(data);
      return Object.fromEntries(Object.entries(k).map(([key, v]) => [key, round(v as number)]));
    }

    case "list_properties": {
      let props = data.properties.filter((p) => !p.archived);
      if (typeof input.stage === "string" && input.stage) {
        props = props.filter((p) => p.stage === input.stage);
      }
      return props.map((p) => {
        const m = propertyMetrics(p, data);
        return {
          id: p.id, name: p.name, address: `${p.address}, ${p.city}`,
          type: p.propertyType, stage: p.stage, units: m.units,
          currentValue: m.currentValue, debt: round(m.debt), equity: round(m.equity),
          cashflowMo: round(m.cashflowMo), dscr: round(m.dscr),
          occupancyPct: round(m.occupancyPct), score: m.score, grade: m.gradeStr,
          health: m.health, healthReasons: m.healthReasons,
        };
      });
    }

    case "get_property": {
      const p = findProperty(String(input.query ?? ""));
      if (!p) return { error: `No property matching "${input.query}". Use list_properties to see names.` };
      const m = propertyMetrics(p, data);
      const uw = underwrite(p.underwriting);
      const score = scoreDeal(uw);
      return {
        property: {
          id: p.id, name: p.name, address: `${p.address}, ${p.city}`, type: p.propertyType,
          stage: p.stage, stageSince: p.stageEnteredDate, yearBuilt: p.yearBuilt, sqft: p.sqft,
          currentValue: p.currentValue, purchaseDate: p.purchaseDate,
          actualRehabSpent: p.actualRehabSpent, notes: p.notes,
        },
        liveMetrics: {
          equity: round(m.equity), debt: round(m.debt), ltvPct: round(m.ltvPct),
          cashflowMo: round(m.cashflowMo), noiAnnual: round(m.noiAnnual),
          dscr: round(m.dscr), occupancyPct: round(m.occupancyPct),
          cashInvested: round(m.cashInvested), cocPct: round(m.cocPct),
          health: m.health, healthReasons: m.healthReasons,
        },
        underwriting: {
          inputs: p.underwriting,
          arv: round(uw.arv), noi: round(uw.noi), totalCashInvested: round(uw.totalCashInvested),
          cashOutAtRefi: round(uw.cashOut), capitalRecoveredPct: round(uw.capitalRecoveredPct),
          cfPerUnitMo: round(uw.cfPerUnitMo), fiveYearIrrPct: round(uw.fiveYearIrrPct),
          score: score.total, grade: score.grade, recommendation: score.recommendation,
        },
        loans: data.loans.filter((l) => l.propertyId === p.id),
        tenants: data.tenants.filter((t) => t.propertyId === p.id),
        renovations: data.renovations
          .filter((r) => r.propertyId === p.id)
          .map((r) => renoHealth(r, today)),
        recentTransactions: data.transactions
          .filter((t) => t.propertyId === p.id)
          .slice(0, 12),
        timeline: data.timeline.filter((e) => e.propertyId === p.id).slice(0, 10),
        openTasks: data.todos.filter((t) => t.propertyId === p.id && !t.done),
      };
    }

    case "analyze_deal": {
      const base =
        typeof input.base_property === "string" && input.base_property
          ? findProperty(input.base_property)?.underwriting ?? {}
          : {};
      const overrides = (input.overrides ?? {}) as Record<string, unknown>;
      const merged = { ...base, ...overrides };
      const r = underwrite(merged);
      const s = scoreDeal(r);
      const pp = pricepoints(merged, {
        cashflowPerUnit: data.settings.targetCashflowPerUnit,
        cocPct: data.settings.targetCoCPct,
      });
      return {
        proForma: {
          noi: round(r.noi), arv: round(r.arv), egi: round(r.egi), opex: round(r.opex),
          totalCashInvested: round(r.totalCashInvested), cashOut: round(r.cashOut),
          capitalRecoveredPct: round(r.capitalRecoveredPct),
          cashLeftInDeal: round(r.cashLeftInDeal),
          cfMonthly: round(r.cfMonthly), cfPerUnitMo: round(r.cfPerUnitMo),
          cocPct: round(r.cocPct), dscr: round(r.dscr),
          capRatePurchase: round(r.capRatePurchase), rentToPricePct: round(r.rentToPricePct),
          equityCreated: round(r.equityCreated), fiveYearIrrPct: round(r.fiveYearIrrPct),
        },
        score: s.total, grade: s.grade, recommendation: s.recommendation,
        pricepoints: {
          arv: round(pp.arv), mao70Rule: round(pp.mao70),
          fullCapitalRecoveryPrice: pp.recoveryPrice ? round(pp.recoveryPrice) : null,
          targetCoCPrice: pp.cocPrice ? round(pp.cocPrice) : null,
          targetCashflowPrice: pp.cfPrice ? round(pp.cfPrice) : null,
        },
      };
    }

    case "scan_refinance_opportunities": {
      const ltv = typeof input.target_ltv_pct === "number" ? input.target_ltv_pct : 75;
      return {
        marketRatePct: data.settings.marketRefiRatePct,
        opportunities: scanRefis(data, ltv).map((r) => ({
          ...r,
          currentValue: round(r.currentValue), currentDebt: round(r.currentDebt),
          maxLoan: round(r.maxLoan), cashOut: round(r.cashOut),
          newPaymentMo: round(r.newPaymentMo), cashflowDeltaMo: round(r.cashflowDeltaMo),
        })),
      };
    }

    case "get_renovation_status": {
      return data.renovations.map((r) => {
        const h = renoHealth(r, today);
        const prop = data.properties.find((p) => p.id === r.propertyId);
        return {
          project: r.name, property: prop?.name, status: r.status, scenario: r.scenario,
          budgeted: round(h.budgeted), spent: round(h.spent),
          overBudgetPct: round(h.overBudgetPct), pctTasksDone: round(h.pctTasksDone),
          daysToTarget: h.daysToTarget, blockedTasks: h.blockedTasks, flags: h.flags,
          budgetLines: r.budgetLines,
          tasks: r.tasks.map((t) => ({
            ...t,
            contractor: data.contractors.find((c) => c.id === t.contractorId)?.name,
          })),
        };
      });
    }

    case "get_transactions": {
      let txns = data.transactions;
      if (typeof input.property === "string" && input.property) {
        const p = findProperty(input.property);
        if (!p) return { error: `No property matching "${input.property}"` };
        txns = txns.filter((t) => t.propertyId === p.id);
      }
      const limit = typeof input.limit === "number" ? input.limit : 25;
      return txns
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, limit)
        .map((t) => ({
          ...t,
          property: data.properties.find((p) => p.id === t.propertyId)?.name ?? "Portfolio",
        }));
    }

    case "get_tenants": {
      return data.tenants.map((t) => ({
        ...t,
        property: data.properties.find((p) => p.id === t.propertyId)?.name,
      }));
    }

    case "get_attention_items":
      return attentionFeed(data, today).map(({ icon, ...rest }) => rest);

    case "get_contractors":
      return data.contractors;

    case "get_renovation_cost_catalog":
      return COST_CATALOG.map(({ defaultQty, ...item }) => item);

    case "create_task": {
      const prop =
        typeof input.property === "string" && input.property
          ? findProperty(input.property)
          : undefined;
      const t = {
        id: uid(),
        propertyId: prop?.id ?? null,
        title: String(input.title ?? "Untitled task"),
        done: false,
        dueDate: typeof input.due_date === "string" ? input.due_date : undefined,
      };
      useStore.getState().addTodo(t);
      return { ok: true, created: t, attachedTo: prop?.name ?? "portfolio" };
    }

    case "add_note": {
      const prop = findProperty(String(input.property ?? ""));
      if (!prop) return { error: `No property matching "${input.property}"` };
      const e = {
        id: uid(), propertyId: prop.id, date: today,
        title: String(input.title ?? "Note"),
        body: typeof input.body === "string" ? input.body : undefined,
        kind: "note" as const,
      };
      useStore.getState().addTimeline(e);
      return { ok: true, created: e, property: prop.name };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
