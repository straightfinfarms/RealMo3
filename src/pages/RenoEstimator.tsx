/* ============================================================================
 * RenoEstimator — the guided renovation workflow:
 *
 *   1. Setup      — property, sqft/units, quality tier, contingency
 *   2. Select     — pick cost elements; industry-average costs prefilled
 *                   (editable), quantities suggested from the property
 *   3. Review     — budget rollup, generated Scope of Work, vendor matches
 *   → Create      — RenovationProject with phased work plan + matched
 *                   contractors, scope saved to Documents, budget synced to
 *                   the property's underwriting rehab budget.
 * ========================================================================== */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, uid } from "@/store/store";
import {
  COST_CATALOG, PHASES, PHASE_WEIGHT, TIER_LABELS, tierCost,
  type CostItem, type Tier, type Phase,
} from "@/data/costCatalog";
import { fmtMoney, fmtCompact } from "@/engine/underwrite";
import { Badge, toast } from "@/components/ui";
import { todayISO } from "@/data/seed";
import type { BudgetLine, RenoTask } from "@/data/types";

interface Selection {
  qty: number;
  unitCost: number; // editable; prefilled from tier
}

export function RenoEstimator() {
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const contractors = useStore((s) => s.contractors);
  const addRenovation = useStore((s) => s.addRenovation);
  const addDoc = useStore((s) => s.addDoc);
  const updateProperty = useStore((s) => s.updateProperty);

  const [step, setStep] = useState(1);
  const [propertyId, setPropertyId] = useState("");
  const [sqft, setSqft] = useState(2500);
  const [units, setUnits] = useState(2);
  const [tier, setTier] = useState<Tier>("standard");
  const [contingencyPct, setContingencyPct] = useState(12);
  const [durationWeeks, setDurationWeeks] = useState(10);
  const [selected, setSelected] = useState<Record<string, Selection>>({});
  const [scopeText, setScopeText] = useState("");

  const property = properties.find((p) => p.id === propertyId);
  const ctx = { sqft, units };

  const pickProperty = (id: string) => {
    setPropertyId(id);
    const p = properties.find((x) => x.id === id);
    if (p) {
      if (p.sqft) setSqft(p.sqft);
      setUnits(p.underwriting.units);
    }
  };

  const toggle = (item: CostItem) => {
    setSelected((s) => {
      if (s[item.id]) {
        const { [item.id]: _, ...rest } = s;
        return rest;
      }
      return { ...s, [item.id]: { qty: item.defaultQty(ctx), unitCost: tierCost(item, tier) } };
    });
  };

  const retier = (t: Tier) => {
    setTier(t);
    // re-price selected items that haven't been manually edited… simplest
    // honest behavior: re-price everything to the new tier.
    setSelected((s) => {
      const next: Record<string, Selection> = {};
      for (const [id, sel] of Object.entries(s)) {
        const item = COST_CATALOG.find((i) => i.id === id)!;
        next[id] = { ...sel, unitCost: tierCost(item, t) };
      }
      return next;
    });
  };

  const rows = useMemo(
    () =>
      COST_CATALOG.filter((i) => selected[i.id]).map((i) => ({
        item: i,
        sel: selected[i.id],
        total: selected[i.id].qty * selected[i.id].unitCost,
      })),
    [selected],
  );
  const subtotal = rows.reduce((a, r) => a + r.total, 0);
  const contingency = (subtotal * contingencyPct) / 100;
  const total = subtotal + contingency;
  const perSqftCost = sqft > 0 ? total / sqft : 0;
  const intensity =
    perSqftCost < 25 ? "Light cosmetic" : perSqftCost < 50 ? "Medium rehab" : "Heavy / gut";

  /** Vendors matched by trade for the selected work. */
  const vendorMatches = useMemo(() => {
    const trades = [...new Set(rows.map((r) => r.item.trade))];
    return trades.map((trade) => ({
      trade,
      contractor: contractors.find(
        (c) =>
          c.trade.toLowerCase().includes(trade.toLowerCase()) ||
          trade.toLowerCase().includes(c.trade.toLowerCase()),
      ),
    }));
  }, [rows, contractors]);

  const generateScope = (): string => {
    const byPhase = PHASES.map((phase) => ({
      phase,
      items: rows.filter((r) => r.item.phase === phase),
    })).filter((g) => g.items.length);
    const lines: string[] = [
      `SCOPE OF WORK — ${property?.name ?? "Renovation"} (${TIER_LABELS[tier]} spec)`,
      `${units} unit(s) · ${sqft.toLocaleString()} sqft · target ${durationWeeks} weeks`,
      ``,
    ];
    for (const g of byPhase) {
      lines.push(`## ${g.phase}`);
      for (const r of g.items) {
        const qty =
          r.item.unit === "project" ? "" :
          ` — ${r.sel.qty} ${r.item.unit === "sqft" ? "sqft" : r.item.unit === "unit" ? "unit(s)" : "×"}`;
        lines.push(`- ${r.item.label}${qty} @ ${fmtMoney(r.sel.unitCost)} = ${fmtMoney(r.total)}${r.item.note ? `  (${r.item.note})` : ""}`);
      }
      lines.push("");
    }
    lines.push(`Subtotal: ${fmtMoney(subtotal)}`);
    lines.push(`Contingency ${contingencyPct}%: ${fmtMoney(contingency)}`);
    lines.push(`TOTAL BUDGET: ${fmtMoney(total)}  (${fmtMoney(perSqftCost)}/sqft — ${intensity})`);
    return lines.join("\n");
  };

  const createProject = () => {
    if (!property) return;
    const today = todayISO();

    // budget lines grouped by category
    const byCat = new Map<string, number>();
    for (const r of rows) byCat.set(r.item.category, (byCat.get(r.item.category) ?? 0) + r.total);
    const budgetLines: BudgetLine[] = [...byCat.entries()].map(([category, budgeted]) => ({
      id: uid(), category, budgeted: Math.round(budgeted), spent: 0,
    }));
    budgetLines.push({ id: uid(), category: `Contingency (${contingencyPct}%)`, budgeted: Math.round(contingency), spent: 0 });

    // phased work plan with due dates + vendor matching
    const activePhases = PHASES.filter((ph) => rows.some((r) => r.item.phase === ph));
    const totalWeight = activePhases.reduce((a, ph) => a + PHASE_WEIGHT[ph], 0);
    let dayCursor = 0;
    const tasks: RenoTask[] = [];
    for (const ph of activePhases) {
      const phaseDays = Math.max(3, Math.round((PHASE_WEIGHT[ph] / totalWeight) * durationWeeks * 7));
      dayCursor += phaseDays;
      const due = new Date(Date.now() + dayCursor * 86400000).toISOString().slice(0, 10);
      const phaseItems = rows.filter((r) => r.item.phase === ph);
      const trades = [...new Set(phaseItems.map((r) => r.item.trade))];
      for (const trade of trades) {
        const items = phaseItems.filter((r) => r.item.trade === trade);
        const vendor = vendorMatches.find((v) => v.trade === trade)?.contractor;
        tasks.push({
          id: uid(),
          title: `${ph}: ${items.map((r) => r.item.label).join(", ")}`,
          status: "todo",
          contractorId: vendor?.id,
          dueDate: due,
          cost: Math.round(items.reduce((a, r) => a + r.total, 0)),
        });
      }
    }

    const projectId = uid();
    addRenovation({
      id: projectId, propertyId: property.id,
      name: `${property.name} — ${TIER_LABELS[tier]} renovation`,
      status: "planning",
      startDate: today,
      targetEndDate: new Date(Date.now() + durationWeeks * 7 * 86400000).toISOString().slice(0, 10),
      budgetLines, tasks,
      scenario: tier === "premium" ? "luxury" : tier,
    });

    // scope of work → Documents
    addDoc({
      id: uid(), propertyId: property.id,
      name: `Scope of Work — ${property.name} (${TIER_LABELS[tier]})`,
      kind: "other", addedDate: today,
      aiSummary: (scopeText || generateScope()).slice(0, 4000),
    });

    // sync the property's underwriting rehab budget to the estimate
    updateProperty(property.id, {
      underwriting: { ...property.underwriting, rehabBudget: Math.round(total) },
    });

    toast(`Renovation project created — ${fmtCompact(total)} budget, ${tasks.length} tasks`);
    nav("/renovation");
  };

  /* ---------------- render ---------------- */
  const grouped = useMemo(() => {
    const cats = [...new Set(COST_CATALOG.map((i) => i.category))];
    return cats.map((c) => ({ category: c, items: COST_CATALOG.filter((i) => i.category === c) }));
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Renovation Estimator</div>
          <div className="section-sub">
            Cost elements → budget → scope of work → work plan → vendors
          </div>
        </div>
        <div className="spacer">
          {[1, 2, 3].map((s) => (
            <span key={s} className={`badge ${step === s ? "blue" : "gray"}`}>
              {s}. {s === 1 ? "Setup" : s === 2 ? "Select costs" : "Review & create"}
            </span>
          ))}
        </div>
      </div>

      {/* ============ STEP 1 — SETUP ============ */}
      {step === 1 && (
        <div className="card" style={{ maxWidth: 640 }}>
          <div className="card-head">
            <div>
              <div className="card-title">Which property, what spec?</div>
              <div className="card-sub">Suggested quantities and pricing are derived from these</div>
            </div>
          </div>
          <div className="grid g2">
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Property</label>
              <select value={propertyId} onChange={(e) => pickProperty(e.target.value)}>
                <option value="">Select a property…</option>
                {properties.filter((p) => !p.archived).map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {p.address}</option>
                ))}
              </select>
            </div>
            <div className="field"><label>Total sqft</label>
              <input type="number" value={sqft} onChange={(e) => setSqft(+e.target.value)} /></div>
            <div className="field"><label>Units</label>
              <input type="number" min={1} value={units} onChange={(e) => setUnits(+e.target.value)} /></div>
            <div className="field"><label>Contingency %</label>
              <input type="number" value={contingencyPct} onChange={(e) => setContingencyPct(+e.target.value)} /></div>
            <div className="field"><label>Target duration (weeks)</label>
              <input type="number" value={durationWeeks} onChange={(e) => setDurationWeeks(+e.target.value)} /></div>
          </div>
          <div className="form-section">Quality tier — sets the default $ for every element</div>
          <div style={{ display: "flex", gap: 8 }}>
            {(Object.keys(TIER_LABELS) as Tier[]).map((t) => (
              <button key={t} className={`btn ${tier === t ? "" : "ghost"}`} onClick={() => retier(t)}>
                {TIER_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="card-sub" style={{ marginTop: 12 }}>
            Rule of thumb: light cosmetic ≈ $15–25/sqft · medium ≈ $25–50 · gut ≈ $60–100+.
            Older buildings deserve a bigger contingency.
          </p>
          <div className="modal-actions">
            <button className="btn" disabled={!propertyId} onClick={() => setStep(2)}>
              Next: select cost elements →
            </button>
          </div>
        </div>
      )}

      {/* ============ STEP 2 — SELECT ============ */}
      {step === 2 && (
        <div className="grid" style={{ gridTemplateColumns: "1.8fr 1fr", alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {grouped.map((g) => (
              <div className="card" key={g.category}>
                <div className="card-title" style={{ marginBottom: 10 }}>{g.category}</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {g.items.map((item) => {
                    const sel = selected[item.id];
                    return (
                      <div key={item.id}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "7px 10px",
                          borderRadius: 8, background: sel ? "var(--accent-soft)" : "transparent",
                          transition: "background 120ms",
                        }}>
                        <input type="checkbox" checked={!!sel} onChange={() => toggle(item)}
                          style={{ accentColor: "var(--accent)" }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600 }}>{item.label}</div>
                          <div className="faint" style={{ fontSize: 10.5 }}>
                            {fmtMoney(item.low)}–{fmtMoney(item.high)} / {item.unit}
                            {item.note ? ` · ${item.note}` : ""}
                          </div>
                        </div>
                        {sel && (
                          <span style={{ display: "flex", gap: 6, alignItems: "center" }}
                            onClick={(e) => e.stopPropagation()}>
                            <input type="number" value={sel.qty} title="Quantity"
                              onChange={(e) => setSelected((s) => ({ ...s, [item.id]: { ...sel, qty: +e.target.value } }))}
                              style={{ width: 68, background: "var(--surface-2)", border: "1px solid var(--border)",
                                borderRadius: 6, padding: "3px 7px", color: "var(--text)", fontSize: 12 }} />
                            <span className="faint" style={{ fontSize: 10 }}>×</span>
                            <input type="number" value={sel.unitCost} title="Unit cost (editable)"
                              onChange={(e) => setSelected((s) => ({ ...s, [item.id]: { ...sel, unitCost: +e.target.value } }))}
                              style={{ width: 82, background: "var(--surface-2)", border: "1px solid var(--border)",
                                borderRadius: 6, padding: "3px 7px", color: "var(--text)", fontSize: 12 }} />
                            <b style={{ fontSize: 12, minWidth: 72, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {fmtMoney(sel.qty * sel.unitCost)}
                            </b>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* running total sidebar */}
          <div className="card" style={{ position: "sticky", top: 0 }}>
            <div className="card-title">Running budget</div>
            <div style={{ fontSize: 26, fontWeight: 800, margin: "8px 0 2px", fontVariantNumeric: "tabular-nums" }}>
              {fmtCompact(total)}
            </div>
            <div className="faint" style={{ fontSize: 11.5 }}>
              {rows.length} elements · {fmtMoney(perSqftCost)}/sqft
            </div>
            <div style={{ marginTop: 6 }}>
              <Badge color={perSqftCost < 25 ? "green" : perSqftCost < 50 ? "yellow" : "red"}>{intensity}</Badge>
              <Badge color="gray">{TIER_LABELS[tier]} tier</Badge>
            </div>
            <table className="tbl" style={{ marginTop: 12 }}>
              <tbody>
                <tr><td className="muted">Subtotal</td><td className="num strong">{fmtMoney(subtotal)}</td></tr>
                <tr><td className="muted">Contingency {contingencyPct}%</td><td className="num strong">{fmtMoney(contingency)}</td></tr>
                <tr><td className="strong">Total</td><td className="num strong">{fmtMoney(total)}</td></tr>
              </tbody>
            </table>
            <div className="modal-actions" style={{ justifyContent: "space-between" }}>
              <button className="btn ghost" onClick={() => setStep(1)}>← Back</button>
              <button className="btn" disabled={rows.length === 0}
                onClick={() => { setScopeText(generateScope()); setStep(3); }}>
                Review →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ STEP 3 — REVIEW & CREATE ============ */}
      {step === 3 && (
        <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr", alignItems: "start" }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Scope of Work</div>
                <div className="card-sub">Generated from your selections — edit freely before creating; saved to Documents</div>
              </div>
            </div>
            <textarea
              value={scopeText}
              onChange={(e) => setScopeText(e.target.value)}
              rows={24}
              style={{
                width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 10, padding: 14, color: "var(--text)", fontSize: 12,
                fontFamily: "var(--font-mono)", lineHeight: 1.6, resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div className="card">
              <div className="card-title" style={{ marginBottom: 8 }}>Budget → work plan</div>
              <table className="tbl">
                <tbody>
                  <tr><td className="muted">Total budget</td><td className="num strong">{fmtMoney(total)}</td></tr>
                  <tr><td className="muted">Intensity</td><td className="num">{fmtMoney(perSqftCost)}/sqft · {intensity}</td></tr>
                  <tr><td className="muted">Duration</td><td className="num">{durationWeeks} weeks</td></tr>
                  <tr><td className="muted">Phases</td>
                    <td className="num">{PHASES.filter((ph) => rows.some((r) => r.item.phase === ph)).length}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-title" style={{ marginBottom: 8 }}>Vendor matches</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {vendorMatches.map((v) => (
                  <div key={v.trade} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5 }}>
                    <span className="muted" style={{ minWidth: 130 }}>{v.trade}</span>
                    {v.contractor ? (
                      <>
                        <b>{v.contractor.name}</b>
                        <span className="faint">{"★".repeat(Math.round(v.contractor.rating))}</span>
                        {!v.contractor.insuranceOnFile && <Badge color="yellow">no insurance on file</Badge>}
                      </>
                    ) : (
                      <Badge color="red">no vendor — find one</Badge>
                    )}
                  </div>
                ))}
              </div>
              <p className="card-sub" style={{ marginTop: 10 }}>
                Matched vendors are pre-assigned to their phase tasks. Unmatched trades become
                unassigned tasks — add contractors in Renovation OS.
              </p>
            </div>

            <div className="card">
              <div className="modal-actions" style={{ justifyContent: "space-between", marginTop: 0 }}>
                <button className="btn ghost" onClick={() => setStep(2)}>← Back</button>
                <button className="btn" onClick={createProject}>
                  ✓ Create project — {fmtCompact(total)}
                </button>
              </div>
              <p className="card-sub" style={{ marginTop: 10 }}>
                Creates the phased work plan in Renovation OS, files the scope under Documents,
                and updates {property?.name}'s underwriting rehab budget to {fmtCompact(total)}.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
