/* ============================================================================
 * Renovation OS — budgets, tasks, contractors, and AI-style detections
 * (overruns, scope creep, schedule risk, blocked work, missing insurance).
 * ========================================================================== */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore, uid } from "@/store/store";
import { renoHealth } from "@/engine/insights";
import { fmtCompact, fmtMoney } from "@/engine/underwrite";
import { Badge, Bar, Empty, toast } from "@/components/ui";
import type { RenoTaskStatus } from "@/data/types";
import { todayISO } from "@/data/seed";

const STATUS_META: Record<RenoTaskStatus, { label: string; color: "gray" | "blue" | "red" | "green" }> = {
  todo: { label: "To do", color: "gray" },
  in_progress: { label: "In progress", color: "blue" },
  blocked: { label: "Blocked", color: "red" },
  done: { label: "Done", color: "green" },
};

export function Renovation() {
  const nav = useNavigate();
  const renovations = useStore((s) => s.renovations);
  const properties = useStore((s) => s.properties);
  const contractors = useStore((s) => s.contractors);
  const updateRenoTask = useStore((s) => s.updateRenoTask);
  const updateBudgetLine = useStore((s) => s.updateBudgetLine);
  const addRenoTask = useStore((s) => s.addRenoTask);
  const [selId, setSelId] = useState(renovations[0]?.id ?? "");
  const [newTask, setNewTask] = useState("");
  const today = todayISO();

  const proj = renovations.find((r) => r.id === selId) ?? renovations[0];

  if (!proj) {
    return (
      <div className="card empty">
        <div className="empty-icon">🛠</div>
        <div style={{ fontWeight: 650, color: "var(--text-2)" }}>No renovation projects</div>
        <div style={{ fontSize: 12, margin: "6px 0 14px" }}>
          Estimate costs element-by-element, generate a scope of work, and spin up a phased work plan.
        </div>
        <button className="btn" onClick={() => nav("/estimator")}>∑ New renovation estimate</button>
      </div>
    );
  }

  const h = renoHealth(proj, today);
  const prop = properties.find((p) => p.id === proj.propertyId);
  const budgeted = h.budgeted, spent = h.spent;
  const uninsured = contractors.filter((c) => !c.insuranceOnFile);

  const cycleStatus = (taskId: string, cur: RenoTaskStatus) => {
    const order: RenoTaskStatus[] = ["todo", "in_progress", "blocked", "done"];
    const next = order[(order.indexOf(cur) + 1) % order.length];
    updateRenoTask(proj.id, taskId, { status: next });
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Renovation OS</div>
          <div className="section-sub">Budget, schedule, crews — with automatic risk detection</div>
        </div>
        <div className="spacer">
          <button className="btn" onClick={() => nav("/estimator")}>∑ New estimate</button>
          <select
            value={proj.id}
            onChange={(e) => setSelId(e.target.value)}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 12.5,
            }}
          >
            {renovations.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
      </div>

      {/* project header */}
      <div className="grid g4">
        <div className="card kpi">
          <div className="kpi-label">Budget</div>
          <div className="kpi-value">{fmtCompact(budgeted)}</div>
          <div className="kpi-delta flat">{proj.scenario} scenario</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Spent</div>
          <div className="kpi-value" style={{ color: h.overBudgetPct > 0 ? "var(--red)" : undefined }}>
            {fmtCompact(spent)}
          </div>
          <div className={`kpi-delta ${h.overBudgetPct > 0 ? "down" : "up"}`}>
            {h.overBudgetPct > 0
              ? `${h.overBudgetPct.toFixed(0)}% over budget`
              : `${Math.round((spent / Math.max(1, budgeted)) * 100)}% consumed`}
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Tasks complete</div>
          <div className="kpi-value">{Math.round(h.pctTasksDone)}%</div>
          <div className="kpi-delta flat">{proj.tasks.filter((t) => t.status === "done").length} of {proj.tasks.length}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Target date</div>
          <div className="kpi-value" style={{ fontSize: 17, color: h.daysToTarget < 0 ? "var(--red)" : undefined }}>
            {proj.targetEndDate}
          </div>
          <div className={`kpi-delta ${h.daysToTarget < 0 ? "down" : "flat"}`}>
            {h.daysToTarget < 0 ? `${-h.daysToTarget} days late` : `${h.daysToTarget} days left`}
          </div>
        </div>
      </div>

      {/* AI detections */}
      {(h.flags.length > 0 || uninsured.length > 0) && (
        <>
          <div style={{ height: 14 }} />
          <div className="card" style={{ borderColor: "var(--red)", borderLeftWidth: 3 }}>
            <div className="card-head">
              <div className="card-title">⚠ Detections</div>
              <span className="spacer" />
              <span className="faint" style={{ fontSize: 11 }}>computed continuously from budget, schedule and vendor data</span>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {h.flags.map((f, i) => <Badge key={i} color="red">{f}</Badge>)}
              {uninsured.map((c) => (
                <Badge key={c.id} color="yellow">Insurance missing: {c.name}</Badge>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={{ height: 14 }} />

      <div className="grid" style={{ gridTemplateColumns: "1fr 1.3fr" }}>
        {/* budget */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Budget lines</div>
            <span className="spacer" />
            {prop && <Link to={`/properties/${prop.id}`} style={{ fontSize: 12 }}>{prop.name} →</Link>}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {proj.budgetLines.map((b) => {
              const pct = b.budgeted > 0 ? (b.spent / b.budgeted) * 100 : 0;
              const over = b.spent > b.budgeted;
              return (
                <div key={b.id}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 3 }}>
                    <span style={{ fontWeight: 550 }}>
                      {b.category}
                      {b.note && <span className="faint"> · {b.note}</span>}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      <b className={over ? "neg" : ""}>{fmtCompact(b.spent)}</b>
                      <span className="faint"> / {fmtCompact(b.budgeted)}</span>
                    </span>
                  </div>
                  <Bar pct={pct} tone={over ? "red" : pct > 85 ? "yellow" : "green"} />
                  <div style={{ marginTop: 4, textAlign: "right" }}>
                    <button
                      className="btn subtle sm"
                      onClick={() => {
                        const v = prompt(`Update spent for "${b.category}" (currently ${fmtMoney(b.spent)}):`, String(b.spent));
                        if (v != null && !isNaN(+v)) {
                          updateBudgetLine(proj.id, b.id, { spent: +v });
                          toast(`${b.category} updated`);
                        }
                      }}
                    >log spend</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* tasks */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Work plan</div>
            <span className="spacer" />
            <span className="faint" style={{ fontSize: 11.5 }}>click status to cycle</span>
          </div>
          <table className="tbl">
            <thead>
              <tr><th>Task</th><th>Crew</th><th>Due</th><th>Status</th></tr>
            </thead>
            <tbody>
              {proj.tasks.map((t) => {
                const c = contractors.find((x) => x.id === t.contractorId);
                const meta = STATUS_META[t.status];
                const overdue = t.dueDate && t.dueDate < today && t.status !== "done";
                return (
                  <tr key={t.id}>
                    <td className={t.status === "done" ? "faint" : "strong"}
                      style={t.status === "done" ? { textDecoration: "line-through" } : undefined}>
                      {t.title}
                    </td>
                    <td className="muted">{c?.name ?? "—"}</td>
                    <td className={`mono ${overdue ? "neg strong" : "muted"}`} style={{ fontSize: 11.5 }}>
                      {t.dueDate ?? "—"}
                    </td>
                    <td>
                      <button onClick={() => cycleStatus(t.id, t.status)} title="Click to change">
                        <Badge color={meta.color} dot>{meta.label}</Badge>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
            <input
              placeholder="Add task…" value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTask.trim()) {
                  addRenoTask(proj.id, { id: uid(), title: newTask.trim(), status: "todo" });
                  setNewTask("");
                }
              }}
              style={{
                flex: 1, background: "var(--surface-2)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "6px 10px", color: "var(--text)", fontSize: 12.5, outline: "none",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      {/* contractors */}
      <div className="card">
        <div className="card-head"><div className="card-title">Contractor directory</div></div>
        <table className="tbl">
          <thead>
            <tr><th>Contractor</th><th>Trade</th><th>Contact</th><th className="num">Rating</th><th>Compliance</th><th>Notes</th></tr>
          </thead>
          <tbody>
            {contractors.map((c) => (
              <tr key={c.id}>
                <td className="strong">{c.name}</td>
                <td className="muted">{c.trade}</td>
                <td className="muted" style={{ fontSize: 11.5 }}>{c.phone}<br />{c.email}</td>
                <td className="num">{"★".repeat(Math.round(c.rating))}<span className="faint">{c.rating.toFixed(1)}</span></td>
                <td>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Badge color={c.insuranceOnFile ? "green" : "red"}>{c.insuranceOnFile ? "Insured" : "No insurance"}</Badge>
                    <Badge color={c.licenseOnFile ? "green" : "yellow"}>{c.licenseOnFile ? "Licensed" : "No license"}</Badge>
                  </div>
                </td>
                <td className="muted" style={{ fontSize: 11.5, maxWidth: 220 }}>{c.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
