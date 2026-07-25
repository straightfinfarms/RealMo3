/* ============================================================================
 * PropertyDetail — everything about one property in one place:
 * overview, live metrics, underwriting, financials, tenants, renovation,
 * documents, timeline, tasks. "Everything lives here."
 * ========================================================================== */
import { useMemo, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useStore, dataSnapshot, uid } from "@/store/store";
import { propertyMetrics, renoHealth } from "@/engine/insights";
import {
  underwrite, scoreDeal, pricepoints, fmtCompact, fmtMoney, fmtPct,
} from "@/engine/underwrite";
import { Badge, Cover, ScoreDial, Bar, gradeColor, healthColor, Empty, Modal, toast } from "@/components/ui";
import {
  STAGES, STAGE_LABELS, OWNED_STAGES, PROPERTY_TYPE_LABELS,
  type Property, type Loan, type PropertyType,
} from "@/data/types";
import { todayISO } from "@/data/seed";

type Tab = "overview" | "underwriting" | "money" | "tenants" | "docs" | "timeline";

export function PropertyDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const moveStage = useStore((s) => s.moveStage);
  const todos = useStore((s) => s.todos);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const addTodo = useStore((s) => s.addTodo);
  const addTimeline = useStore((s) => s.addTimeline);
  const updateProperty = useStore((s) => s.updateProperty);
  const updateLoan = useStore((s) => s.updateLoan);
  const [tab, setTab] = useState<Tab>("overview");
  const [newTask, setNewTask] = useState("");
  const [newNote, setNewNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);

  const p = properties.find((x) => x.id === id);
  const data = dataSnapshot();

  const computed = useMemo(() => {
    if (!p) return null;
    const m = propertyMetrics(p, data);
    const uw = underwrite(p.underwriting);
    const score = scoreDeal(uw);
    const pp = pricepoints(p.underwriting, {
      cashflowPerUnit: data.settings.targetCashflowPerUnit,
      cocPct: data.settings.targetCoCPct,
    });
    return { m, uw, score, pp };
  }, [p, properties, data.loans, data.tenants]);

  if (!p || !computed) {
    return <Empty icon="⌂" title="Property not found" sub="It may have been archived." />;
  }
  const { m, uw, score, pp } = computed;

  const loans = data.loans.filter((l) => l.propertyId === p.id && l.active);
  const tenants = data.tenants.filter((t) => t.propertyId === p.id);
  const docs = data.docs.filter((d) => d.propertyId === p.id);
  const events = data.timeline.filter((e) => e.propertyId === p.id);
  const txns = data.transactions
    .filter((t) => t.propertyId === p.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const renos = data.renovations.filter((r) => r.propertyId === p.id);
  const propTodos = todos.filter((t) => t.propertyId === p.id);
  const stageIdx = STAGES.indexOf(p.stage);
  const owned = OWNED_STAGES.includes(p.stage);

  const advance = (dir: -1 | 1) => {
    const next = STAGES[stageIdx + dir];
    if (!next) return;
    moveStage(p.id, next);
    toast(`${p.name} → ${STAGE_LABELS[next]}`);
  };

  return (
    <div>
      {/* header */}
      <div className="page-head">
        <Cover hue={p.photoHue} name={p.name} size={52} radius={14} />
        <div>
          <div className="section-title" style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {p.name}
            <Badge color={owned ? "purple" : "blue"}>{STAGE_LABELS[p.stage]}</Badge>
            <Badge color={healthColor(m.health)} dot>
              {m.health === "good" ? "Healthy" : m.health === "watch" ? "Watch" : "Alert"}
            </Badge>
          </div>
          <div className="section-sub">
            {p.address}, {p.city} · {uw.units} unit{uw.units > 1 ? "s" : ""}
            {p.yearBuilt ? ` · built ${p.yearBuilt}` : ""}{p.sqft ? ` · ${p.sqft.toLocaleString()} sqft` : ""}
          </div>
        </div>
        <div className="spacer">
          <button className="btn ghost sm" onClick={() => setEditing(true)}>✎ Edit</button>
          <button className="btn ghost sm" disabled={stageIdx === 0} onClick={() => advance(-1)}>◀ {stageIdx > 0 ? STAGE_LABELS[STAGES[stageIdx - 1]] : ""}</button>
          <button className="btn sm" disabled={stageIdx === STAGES.length - 1} onClick={() => advance(1)}>
            {stageIdx < STAGES.length - 1 ? STAGE_LABELS[STAGES[stageIdx + 1]] : ""} ▶
          </button>
        </div>
      </div>

      {/* stage progress */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16 }}>
        {STAGES.map((s, i) => (
          <div key={s} title={STAGE_LABELS[s]} style={{
            flex: 1, height: 4, borderRadius: 4,
            background: i <= stageIdx ? "var(--accent)" : "var(--surface-3)",
          }} />
        ))}
      </div>

      {/* KPI strip */}
      <div className="grid g4">
        <div className="card kpi">
          <div className="kpi-label">Current value</div>
          <div className="kpi-value">{fmtCompact(p.currentValue)}</div>
          <div className="kpi-delta flat">ARV {fmtCompact(uw.arv)}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Equity</div>
          <div className="kpi-value">{fmtCompact(m.equity)}</div>
          <div className="kpi-delta flat">debt {fmtCompact(m.debt)} · LTV {fmtPct(m.ltvPct, 0)}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Cash flow / mo</div>
          <div className="kpi-value" style={{ color: m.cashflowMo < 0 ? "var(--red)" : "var(--green)" }}>
            {owned ? fmtMoney(m.cashflowMo) : fmtMoney(uw.cfMonthly)}
          </div>
          <div className="kpi-delta flat">{owned ? "actual" : "pro-forma"} · DSCR {isFinite(m.dscr) ? m.dscr.toFixed(2) + "x" : "—"}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Cash invested</div>
          <div className="kpi-value">{fmtCompact(m.cashInvested)}</div>
          <div className="kpi-delta flat">CoC {isFinite(m.cocPct) ? fmtPct(m.cocPct) : "∞ (all out)"}</div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="tabs">
        {(
          [
            ["overview", "Overview"],
            ["underwriting", "Underwriting"],
            ["money", `Financials (${txns.length})`],
            ["tenants", `Tenants (${tenants.length})`],
            ["docs", `Documents (${docs.length})`],
            ["timeline", `Timeline (${events.length})`],
          ] as [Tab, string][]
        ).map(([t, label]) => (
          <button key={t} className={`tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}>
            {label}
          </button>
        ))}
      </div>

      {/* ============ OVERVIEW ============ */}
      {tab === "overview" && (
        <div className="grid" style={{ gridTemplateColumns: "1.5fr 1fr" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="card-head"><div className="card-title">BRRRR score</div></div>
              <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
                <ScoreDial score={score.total} grade={score.grade} />
                <div style={{ flex: 1, minWidth: 220 }}>
                  <Badge color={score.recommendation.tone === "buy" ? "green" : score.recommendation.tone === "ok" ? "blue" : score.recommendation.tone === "warn" ? "yellow" : "red"}>
                    {score.recommendation.verb}
                  </Badge>
                  <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
                    {score.recommendation.note}
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
                {score.criteria.map((c) => (
                  <div key={c.key}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                      <span className="muted">{c.label} <span className="faint">· {c.weight}%</span></span>
                      <b>{c.display}</b>
                    </div>
                    <Bar pct={c.score} tone={c.score >= 70 ? "green" : c.score >= 40 ? "yellow" : "red"} />
                  </div>
                ))}
              </div>
            </div>

            {renos.length > 0 && (
              <div className="card">
                <div className="card-head">
                  <div className="card-title">Renovation</div>
                  <span className="spacer" />
                  <Link to="/renovation" style={{ fontSize: 12 }}>Open Renovation OS →</Link>
                </div>
                {renos.map((r) => {
                  const h = renoHealth(r, todayISO());
                  return (
                    <div key={r.id}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 4 }}>
                        <span className="strong">{r.name}</span>
                        <span className="muted">{fmtCompact(h.spent)} / {fmtCompact(h.budgeted)}</span>
                      </div>
                      <Bar pct={(h.spent / Math.max(1, h.budgeted)) * 100}
                        tone={h.overBudgetPct > 0 ? "red" : h.spent / Math.max(1, h.budgeted) > 0.85 ? "yellow" : "green"} />
                      {h.flags.length > 0 && (
                        <div style={{ marginTop: 8, display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {h.flags.map((f, i) => <Badge key={i} color="red">{f}</Badge>)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {p.notes && (
              <div className="card">
                <div className="card-head"><div className="card-title">Notes</div></div>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>{p.notes}</div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="card-head"><div className="card-title">Tasks</div></div>
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {propTodos.filter((t) => !t.done).map((t) => (
                  <label key={t.id} style={{ display: "flex", gap: 8, fontSize: 12.5, cursor: "pointer" }}>
                    <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)}
                      style={{ accentColor: "var(--accent)" }} />
                    <span>{t.title}
                      {t.dueDate && <span className={`faint ${t.dueDate < todayISO() ? "neg" : ""}`} style={{ fontSize: 11 }}> · {t.dueDate}</span>}
                    </span>
                  </label>
                ))}
                {propTodos.filter((t) => !t.done).length === 0 && (
                  <div className="faint" style={{ fontSize: 12 }}>No open tasks.</div>
                )}
                <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                  <input
                    placeholder="Add task…" value={newTask}
                    onChange={(e) => setNewTask(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newTask.trim()) {
                        addTodo({ id: uid(), propertyId: p.id, title: newTask.trim(), done: false });
                        setNewTask("");
                      }
                    }}
                    style={{
                      flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                      borderRadius: 6, padding: "5px 10px", color: "var(--text)", fontSize: 12, outline: "none",
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="card">
              <div className="card-head"><div className="card-title">Loans</div></div>
              {loans.length === 0 && <div className="faint" style={{ fontSize: 12 }}>No active loans.</div>}
              {loans.map((l) => (
                <div key={l.id} style={{ fontSize: 12.5, marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="strong">{l.lender}</span>
                    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <b>{fmtCompact(l.currentBalance)}</b>
                      <button className="btn subtle sm" title="Edit loan" onClick={() => setEditingLoan(l)}>✎</button>
                    </span>
                  </div>
                  <div className="faint" style={{ fontSize: 11.5 }}>
                    {l.kind} · {fmtPct(l.ratePct)} · {fmtMoney(l.monthlyPayment)}/mo
                  </div>
                </div>
              ))}
            </div>

            <div className="card">
              <div className="card-head"><div className="card-title">Quick note</div></div>
              <textarea
                rows={2} placeholder="Log a call, decision, observation…" value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                style={{
                  width: "100%", background: "var(--surface-2)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12.5,
                  outline: "none", resize: "vertical", fontFamily: "inherit",
                }}
              />
              <div style={{ marginTop: 8, textAlign: "right" }}>
                <button className="btn sm" disabled={!newNote.trim()} onClick={() => {
                  addTimeline({
                    id: uid(), propertyId: p.id, date: todayISO(),
                    title: newNote.trim().slice(0, 60), body: newNote.trim(), kind: "note",
                  });
                  setNewNote("");
                  toast("Note added to timeline");
                }}>Add to timeline</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ UNDERWRITING ============ */}
      {tab === "underwriting" && (
        <div className="grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
          <div className="card">
            <div className="card-head">
              <div>
                <div className="card-title">Pro-forma (stabilized, post-refi)</div>
                <div className="card-sub">Rents, expenses & financing assumptions</div>
              </div>
              <span className="spacer" />
              <Link to={`/analyzer/${p.id}`} className="btn ghost sm">✎ Edit inputs</Link>
            </div>
            <table className="tbl">
              <tbody>
                {[
                  ["Gross scheduled income", fmtMoney(uw.gsiAnnual) + "/yr"],
                  ["Vacancy loss", "-" + fmtMoney(uw.vacancyLoss) + "/yr"],
                  ["Effective gross income", fmtMoney(uw.egi) + "/yr"],
                  ["Operating expenses", "-" + fmtMoney(uw.opex) + `/yr (${Math.round(uw.expenseRatio * 100)}%)`],
                  ["NOI", fmtMoney(uw.noi) + "/yr"],
                  ["ARV", fmtCompact(uw.arv) + (p.underwriting.arvMode === "income" ? ` (NOI ÷ ${fmtPct(p.underwriting.marketCapPct, 2)})` : " (manual)")],
                  ["Refi loan @ " + fmtPct(p.underwriting.refiLtvPct, 0) + " LTV", fmtCompact(uw.refiLoan)],
                  ["Debt service", "-" + fmtMoney(uw.refiPmt) + "/mo"],
                  ["Cash flow", fmtMoney(uw.cfMonthly) + "/mo · " + fmtMoney(uw.cfPerUnitMo) + "/unit"],
                ].map(([l, v], i) => (
                  <tr key={i}>
                    <td className="muted">{l}</td>
                    <td className="num strong">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="card">
              <div className="card-head"><div className="card-title">The BRRRR math</div></div>
              <table className="tbl">
                <tbody>
                  {[
                    ["Total cash invested", fmtCompact(uw.totalCashInvested)],
                    ["Cash-out at refi", fmtCompact(uw.cashOut)],
                    ["Capital recovered", fmtPct(uw.capitalRecoveredPct, 0)],
                    ["Cash left in deal", fmtCompact(Math.max(0, uw.cashLeftInDeal))],
                    ["Equity created", fmtCompact(uw.equityCreated)],
                    ["Equity after refi", fmtCompact(uw.equityAtRefi)],
                    ["Cash-on-cash", isFinite(uw.cocPct) ? fmtPct(uw.cocPct) : "∞ (all capital out)"],
                    ["5-yr IRR (est.)", isFinite(uw.fiveYearIrrPct) ? fmtPct(uw.fiveYearIrrPct) : "—"],
                  ].map(([l, v], i) => (
                    <tr key={i}><td className="muted">{l}</td><td className="num strong">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Purchase pricepoints</div>
                  <div className="card-sub">What to pay to hit each goal (current price: {fmtCompact(p.underwriting.price)})</div>
                </div>
              </div>
              <table className="tbl">
                <tbody>
                  {[
                    ["Full capital recovery", pp.recoveryPrice, "the true BRRRR target"],
                    [`${data.settings.targetCoCPct}% cash-on-cash`, pp.cocPrice, "return on cash left in"],
                    [`${fmtMoney(data.settings.targetCashflowPerUnit)}/unit cash flow`, pp.cfPrice, "your CF target"],
                    ["70% rule MAO", pp.mao70, "0.70 × ARV − rehab"],
                  ].map(([label, price, sub], i) => (
                    <tr key={i}>
                      <td>
                        <div className="strong">{label as string}</div>
                        <div className="faint" style={{ fontSize: 11 }}>{sub as string}</div>
                      </td>
                      <td className="num">
                        <b className={typeof price === "number" && price >= p.underwriting.price ? "pos" : "neg"}>
                          {typeof price === "number" ? fmtCompact(price) : "not reachable"}
                        </b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============ FINANCIALS ============ */}
      {tab === "money" && (
        <div className="card" style={{ padding: 6 }}>
          {txns.length === 0 ? (
            <Empty icon="$" title="No transactions yet" />
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Date</th><th>Category</th><th>Description</th><th className="num">Amount</th></tr>
              </thead>
              <tbody>
                {txns.map((t) => (
                  <tr key={t.id}>
                    <td className="muted mono">{t.date}</td>
                    <td><Badge color={t.amount >= 0 ? "green" : "gray"}>{t.category.replace(/_/g, " ")}</Badge></td>
                    <td>{t.description}</td>
                    <td className={`num strong ${t.amount < 0 ? "neg" : "pos"}`}>{fmtMoney(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ============ TENANTS ============ */}
      {tab === "tenants" && (
        <div className="card" style={{ padding: 6 }}>
          {tenants.length === 0 ? (
            <Empty icon="👥" title="No tenants" sub={owned ? "List the units to fill them." : "Not owned yet."} />
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Unit</th><th>Tenant</th><th className="num">Rent</th><th>Lease</th><th>Status</th><th className="num">Balance</th></tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr key={t.id}>
                    <td className="strong">{t.unitLabel}</td>
                    <td>
                      <div>{t.name}</div>
                      <div className="faint" style={{ fontSize: 11 }}>{t.email}</div>
                    </td>
                    <td className="num strong">{fmtMoney(t.rent)}</td>
                    <td className="muted mono" style={{ fontSize: 11.5 }}>{t.leaseStart} → {t.leaseEnd}</td>
                    <td>
                      <Badge color={t.status === "current" ? "green" : t.status === "vacant" ? "gray" : t.status === "late" ? "yellow" : "red"} dot>
                        {t.status}
                      </Badge>
                    </td>
                    <td className={`num ${t.balanceOwed > 0 ? "neg strong" : "muted"}`}>
                      {t.balanceOwed > 0 ? fmtMoney(t.balanceOwed) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ============ DOCS ============ */}
      {tab === "docs" && (
        <div className="grid g2">
          {docs.length === 0 && <Empty icon="▤" title="No documents" />}
          {docs.map((d) => (
            <div className="card" key={d.id}>
              <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <div style={{ fontSize: 20 }}>
                  {d.kind === "photo" ? "🖼" : d.kind === "invoice" ? "🧾" : d.kind === "permit" ? "📋" : "📄"}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="strong" style={{ fontSize: 13 }}>{d.name}</div>
                  <div className="faint" style={{ fontSize: 11 }}>{d.kind.replace(/_/g, " ")} · {d.addedDate}</div>
                  {d.aiSummary && (
                    <div style={{
                      marginTop: 8, fontSize: 12, color: "var(--text-2)", lineHeight: 1.5,
                      background: "var(--surface-2)", borderRadius: 8, padding: "8px 10px",
                      borderLeft: "2px solid var(--purple)",
                    }}>
                      <span style={{ color: "var(--purple)", fontWeight: 650, fontSize: 10.5 }}>✦ AI SUMMARY · </span>
                      {d.aiSummary}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============ TIMELINE ============ */}
      {tab === "timeline" && (
        <div className="card">
          {events.length === 0 ? (
            <Empty icon="◷" title="No events yet" />
          ) : (
            <div className="timeline">
              {events.map((e) => (
                <div className="tl-item" key={e.id}>
                  <div className="tl-date">{e.date}</div>
                  <div className="tl-title">{e.title}</div>
                  {e.body && <div className="tl-body">{e.body}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditPropertyModal
          property={p}
          onClose={() => setEditing(false)}
          onSave={(patch) => {
            updateProperty(p.id, patch);
            setEditing(false);
            toast("Property updated");
          }}
          onDelete={() => {
            useStore.getState().deleteProperty(p.id);
            toast(`${p.name} deleted`);
            nav("/properties");
          }}
        />
      )}

      {editingLoan && (
        <LoanEditModal
          loan={editingLoan}
          onClose={() => setEditingLoan(null)}
          onSave={(patch) => {
            updateLoan(editingLoan.id, patch);
            setEditingLoan(null);
            toast("Loan updated");
          }}
        />
      )}
    </div>
  );
}

/* ---------- edit property (all non-calculated fields) ---------- */
function EditPropertyModal(props: {
  property: Property;
  onClose: () => void;
  onSave: (patch: Partial<Property>) => void;
  onDelete: () => void;
}) {
  const p = props.property;
  const [f, setF] = useState({
    name: p.name, address: p.address, city: p.city,
    propertyType: p.propertyType,
    yearBuilt: p.yearBuilt ?? 0, sqft: p.sqft ?? 0,
    currentValue: p.currentValue,
    purchaseDate: p.purchaseDate ?? "",
    actualRehabSpent: p.actualRehabSpent ?? 0,
    notes: p.notes ?? "",
  });
  const set = (k: keyof typeof f, v: string | number) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Modal title={`Edit ${p.name}`} onClose={props.onClose}>
      <div className="grid g2">
        <div className="field"><label>Name</label>
          <input value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="field"><label>Type</label>
          <select value={f.propertyType} onChange={(e) => set("propertyType", e.target.value)}>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="field"><label>Address</label>
          <input value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
        <div className="field"><label>City</label>
          <input value={f.city} onChange={(e) => set("city", e.target.value)} /></div>
        <div className="field"><label>Current value (est.)</label>
          <input type="number" value={f.currentValue} onChange={(e) => set("currentValue", +e.target.value)} /></div>
        <div className="field"><label>Purchase date</label>
          <input type="date" value={f.purchaseDate} onChange={(e) => set("purchaseDate", e.target.value)} /></div>
        <div className="field"><label>Year built</label>
          <input type="number" value={f.yearBuilt || ""} onChange={(e) => set("yearBuilt", +e.target.value)} /></div>
        <div className="field"><label>Sqft</label>
          <input type="number" value={f.sqft || ""} onChange={(e) => set("sqft", +e.target.value)} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Actual rehab spent</label>
          <input type="number" value={f.actualRehabSpent || ""} onChange={(e) => set("actualRehabSpent", +e.target.value)} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}><label>Notes</label>
          <textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></div>
      </div>
      <p className="card-sub" style={{ marginTop: 10 }}>
        Rents, expenses, financing assumptions live in the Underwriting inputs — edit those in the
        Deal Analyzer (“Load from property”, then “Save changes back”).
      </p>
      <div className="modal-actions" style={{ justifyContent: "space-between" }}>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm(`Delete ${p.name}? This removes its loans, tenants, transactions, documents and history. This cannot be undone.`)) {
              props.onDelete();
            }
          }}
        >Delete property…</button>
        <span style={{ display: "flex", gap: 8 }}>
          <button className="btn ghost" onClick={props.onClose}>Cancel</button>
          <button className="btn" disabled={!f.name.trim()} onClick={() =>
            props.onSave({
              name: f.name.trim(), address: f.address, city: f.city,
              propertyType: f.propertyType as PropertyType,
              yearBuilt: f.yearBuilt || undefined, sqft: f.sqft || undefined,
              currentValue: f.currentValue,
              purchaseDate: f.purchaseDate || undefined,
              actualRehabSpent: f.actualRehabSpent || undefined,
              notes: f.notes || undefined,
            })
          }>Save changes</button>
        </span>
      </div>
    </Modal>
  );
}

/* ---------- edit loan ---------- */
function LoanEditModal(props: {
  loan: Loan;
  onClose: () => void;
  onSave: (patch: Partial<Loan>) => void;
}) {
  const l = props.loan;
  const [f, setF] = useState({
    lender: l.lender, kind: l.kind, currentBalance: l.currentBalance,
    ratePct: l.ratePct, termYears: l.termYears, monthlyPayment: l.monthlyPayment,
    active: l.active,
  });
  const set = (k: keyof typeof f, v: string | number | boolean) => setF((s) => ({ ...s, [k]: v }));

  return (
    <Modal title={`Edit loan — ${l.lender}`} onClose={props.onClose}>
      <div className="grid g2">
        <div className="field"><label>Lender</label>
          <input value={f.lender} onChange={(e) => set("lender", e.target.value)} /></div>
        <div className="field"><label>Kind</label>
          <select value={f.kind} onChange={(e) => set("kind", e.target.value)}>
            <option value="acquisition">Acquisition</option>
            <option value="refinance">Refinance</option>
            <option value="heloc">HELOC</option>
            <option value="private">Private</option>
          </select></div>
        <div className="field"><label>Current balance</label>
          <input type="number" value={f.currentBalance} onChange={(e) => set("currentBalance", +e.target.value)} /></div>
        <div className="field"><label>Rate %</label>
          <input type="number" step={0.05} value={f.ratePct} onChange={(e) => set("ratePct", +e.target.value)} /></div>
        <div className="field"><label>Amortization (yrs)</label>
          <input type="number" value={f.termYears} onChange={(e) => set("termYears", +e.target.value)} /></div>
        <div className="field"><label>Monthly payment</label>
          <input type="number" value={f.monthlyPayment} onChange={(e) => set("monthlyPayment", +e.target.value)} /></div>
        <div className="field" style={{ gridColumn: "1 / -1" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
            <input type="checkbox" checked={f.active} onChange={(e) => set("active", e.target.checked)}
              style={{ accentColor: "var(--accent)", width: "auto" }} />
            Active (uncheck when paid off / replaced by a refinance)
          </label>
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={props.onClose}>Cancel</button>
        <button className="btn" onClick={() => props.onSave({ ...f, kind: f.kind as Loan["kind"] })}>Save loan</button>
      </div>
    </Modal>
  );
}
