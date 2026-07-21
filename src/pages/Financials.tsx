/* ============================================================================
 * Financials — transaction ledger + income statement, per property or
 * portfolio-wide. Add transactions inline.
 * ========================================================================== */
import { useMemo, useState } from "react";
import { useStore, uid } from "@/store/store";
import { fmtMoney, fmtCompact } from "@/engine/underwrite";
import { Badge, Modal, toast } from "@/components/ui";
import type { TxnCategory } from "@/data/types";
import { todayISO } from "@/data/seed";

const CATEGORIES: { value: TxnCategory; label: string; inflow: boolean }[] = [
  { value: "rent_income", label: "Rent income", inflow: true },
  { value: "other_income", label: "Other income", inflow: true },
  { value: "refi_proceeds", label: "Refi proceeds", inflow: true },
  { value: "mortgage", label: "Mortgage", inflow: false },
  { value: "taxes", label: "Property taxes", inflow: false },
  { value: "insurance", label: "Insurance", inflow: false },
  { value: "utilities", label: "Utilities", inflow: false },
  { value: "maintenance", label: "Maintenance", inflow: false },
  { value: "management", label: "Management", inflow: false },
  { value: "capex", label: "CapEx", inflow: false },
  { value: "rehab", label: "Rehab", inflow: false },
  { value: "closing_costs", label: "Closing costs", inflow: false },
  { value: "purchase", label: "Purchase", inflow: false },
  { value: "misc_expense", label: "Misc expense", inflow: false },
];

export function Financials() {
  const transactions = useStore((s) => s.transactions);
  const properties = useStore((s) => s.properties);
  const addTransaction = useStore((s) => s.addTransaction);
  const [propFilter, setPropFilter] = useState<string>("all");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(
    () =>
      transactions
        .filter((t) => propFilter === "all" || t.propertyId === propFilter)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [transactions, propFilter],
  );

  // trailing-30-day income statement
  const cutoff30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const recent = filtered.filter((t) => t.date >= cutoff30);
  const isOperating = (c: TxnCategory) =>
    !["purchase", "closing_costs", "rehab", "refi_proceeds", "capex"].includes(c);
  const income = recent.filter((t) => t.amount > 0 && isOperating(t.category)).reduce((a, t) => a + t.amount, 0);
  const expenses = recent.filter((t) => t.amount < 0 && isOperating(t.category)).reduce((a, t) => a + t.amount, 0);
  const capital = recent.filter((t) => !isOperating(t.category)).reduce((a, t) => a + t.amount, 0);

  // by-category rollup (trailing 30d, operating expenses only)
  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of recent.filter((x) => x.amount < 0 && isOperating(x.category))) {
      map.set(t.category, (map.get(t.category) ?? 0) + Math.abs(t.amount));
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [recent]);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Financials</div>
          <div className="section-sub">Every dollar in and out, by property or portfolio-wide</div>
        </div>
        <div className="spacer">
          <select
            value={propFilter} onChange={(e) => setPropFilter(e.target.value)}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 12.5,
            }}
          >
            <option value="all">All properties</option>
            {properties.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="btn" onClick={() => setAdding(true)}>+ Transaction</button>
        </div>
      </div>

      <div className="grid g4">
        <div className="card kpi">
          <div className="kpi-label">Operating income · 30d</div>
          <div className="kpi-value pos">{fmtMoney(income)}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Operating expenses · 30d</div>
          <div className="kpi-value neg">{fmtMoney(expenses)}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Net operating · 30d</div>
          <div className="kpi-value" style={{ color: income + expenses >= 0 ? "var(--green)" : "var(--red)" }}>
            {fmtMoney(income + expenses)}
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Capital activity · 30d</div>
          <div className="kpi-value">{fmtCompact(capital)}</div>
          <div className="kpi-delta flat">purchases, rehab, refis</div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="grid" style={{ gridTemplateColumns: "1.7fr 1fr" }}>
        <div className="card" style={{ padding: 6 }}>
          <table className="tbl">
            <thead>
              <tr><th>Date</th><th>Property</th><th>Category</th><th>Description</th><th className="num">Amount</th></tr>
            </thead>
            <tbody>
              {filtered.slice(0, 40).map((t) => (
                <tr key={t.id}>
                  <td className="muted mono" style={{ fontSize: 11.5 }}>{t.date}</td>
                  <td className="muted">{properties.find((p) => p.id === t.propertyId)?.name ?? "Portfolio"}</td>
                  <td><Badge color={t.amount >= 0 ? "green" : "gray"}>{t.category.replace(/_/g, " ")}</Badge></td>
                  <td style={{ fontSize: 12 }}>{t.description}</td>
                  <td className={`num strong ${t.amount < 0 ? "neg" : "pos"}`}>{fmtMoney(t.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ alignSelf: "flex-start" }}>
          <div className="card-head">
            <div className="card-title">Expense breakdown · 30d</div>
          </div>
          {byCat.length === 0 && <div className="faint">No operating expenses in the last 30 days.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {byCat.map(([cat, amt]) => {
              const max = byCat[0][1];
              return (
                <div key={cat}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
                    <span className="muted" style={{ textTransform: "capitalize" }}>{cat.replace(/_/g, " ")}</span>
                    <b>{fmtMoney(amt)}</b>
                  </div>
                  <div className="bar"><i style={{ width: `${(amt / max) * 100}%` }} /></div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {adding && (
        <AddTxnModal
          onClose={() => setAdding(false)}
          onAdd={(propertyId, date, category, description, amount) => {
            addTransaction({ id: uid(), propertyId, date, category, description, amount });
            setAdding(false);
            toast("Transaction recorded");
          }}
        />
      )}
    </div>
  );
}

function AddTxnModal(props: {
  onClose: () => void;
  onAdd: (propertyId: string | null, date: string, category: TxnCategory, description: string, amount: number) => void;
}) {
  const properties = useStore((s) => s.properties);
  const [propertyId, setPropertyId] = useState<string>("");
  const [date, setDate] = useState(todayISO());
  const [category, setCategory] = useState<TxnCategory>("rent_income");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState(0);

  const catMeta = CATEGORIES.find((c) => c.value === category);

  return (
    <Modal title="Record transaction" onClose={props.onClose}>
      <div className="grid g2">
        <div className="field"><label>Property</label>
          <select value={propertyId} onChange={(e) => setPropertyId(e.target.value)}>
            <option value="">Portfolio-level</option>
            {properties.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select></div>
        <div className="field"><label>Date</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="field"><label>Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as TxnCategory)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select></div>
        <div className="field"><label>Amount ($, positive number)</label>
          <input type="number" value={amount || ""} onChange={(e) => setAmount(Math.abs(+e.target.value))} /></div>
      </div>
      <div className="field" style={{ marginTop: 10 }}>
        <label>Description</label>
        <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. October rents" />
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={props.onClose}>Cancel</button>
        <button
          className="btn" disabled={!amount || !description.trim()}
          onClick={() =>
            props.onAdd(
              propertyId || null, date, category, description.trim(),
              catMeta?.inflow ? amount : -amount,
            )
          }
        >
          Record {catMeta?.inflow ? "inflow" : "outflow"} of {fmtMoney(amount)}
        </button>
      </div>
    </Modal>
  );
}
