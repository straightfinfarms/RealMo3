/* ============================================================================
 * Properties — the portfolio register. Owned + pipeline, sortable at a glance.
 * ========================================================================== */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, dataSnapshot, uid } from "@/store/store";
import { propertyMetrics } from "@/engine/insights";
import { fmtCompact, fmtMoney, monthlyPayment, UW_DEFAULTS } from "@/engine/underwrite";
import { Badge, Cover, healthColor, gradeColor, Modal, toast } from "@/components/ui";
import {
  STAGE_LABELS, OWNED_STAGES, PROPERTY_TYPE_LABELS,
  type Property, type PropertyType, type Stage,
} from "@/data/types";
import { todayISO } from "@/data/seed";

export function Properties() {
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const data = dataSnapshot();
  const [filter, setFilter] = useState<"all" | "owned" | "pipeline">("all");
  const [adding, setAdding] = useState(false);

  const rows = properties
    .filter((p) => !p.archived)
    .filter((p) =>
      filter === "all" ? true :
      filter === "owned" ? OWNED_STAGES.includes(p.stage) : !OWNED_STAGES.includes(p.stage),
    )
    .map((p) => ({ p, m: propertyMetrics(p, data) }))
    .sort((a, b) => b.m.currentValue - a.m.currentValue);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Properties</div>
          <div className="section-sub">Everything lives here — click through for the full picture</div>
        </div>
        <div className="spacer">
          <button className="btn" onClick={() => setAdding(true)}>+ Add property</button>
        </div>
      </div>

      <div className="tabs">
        {(["all", "owned", "pipeline"] as const).map((f) => (
          <button key={f} className={`tab ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
            {f === "all" ? `All (${properties.filter((p) => !p.archived).length})` :
             f === "owned" ? "Owned" : "Pipeline"}
          </button>
        ))}
      </div>

      {rows.length === 0 && (
        <div className="card empty">
          <div className="empty-icon">⌂</div>
          <div style={{ fontWeight: 650, color: "var(--text-2)" }}>No properties yet</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>
            Click <b>+ Add property</b> — add deals you're hunting <i>or</i> properties you already own.
          </div>
        </div>
      )}

      {rows.length > 0 && (
      <div className="card" style={{ padding: 6 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Property</th><th>Type</th><th>Stage</th>
              <th className="num">Value</th><th className="num">Debt</th>
              <th className="num">Equity</th><th className="num">CF/mo</th>
              <th className="num">Score</th><th>Health</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, m }) => (
              <tr key={p.id} className="clickable" onClick={() => nav(`/properties/${p.id}`)}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Cover hue={p.photoHue} name={p.name} size={30} radius={8} />
                    <div>
                      <div className="strong">{p.name}</div>
                      <div className="faint" style={{ fontSize: 11 }}>{p.address}, {p.city}</div>
                    </div>
                  </div>
                </td>
                <td className="muted">{PROPERTY_TYPE_LABELS[p.propertyType]}</td>
                <td><Badge color={OWNED_STAGES.includes(p.stage) ? "purple" : "blue"}>{STAGE_LABELS[p.stage]}</Badge></td>
                <td className="num">{fmtCompact(m.currentValue)}</td>
                <td className="num muted">{m.debt ? fmtCompact(m.debt) : "—"}</td>
                <td className="num">{fmtCompact(m.equity)}</td>
                <td className={`num ${m.cashflowMo < 0 ? "neg" : m.owned ? "pos" : "muted"}`}>
                  {m.owned ? fmtMoney(m.cashflowMo) : "—"}
                </td>
                <td className="num"><Badge color={gradeColor(m.score)}>{m.score}</Badge></td>
                <td>
                  <Badge color={healthColor(m.health)} dot>
                    {m.health === "good" ? "OK" : m.health === "watch" ? "Watch" : "Alert"}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}

      {adding && (
        <AddPropertyModal
          onClose={() => setAdding(false)}
          onDone={(id, message) => {
            setAdding(false);
            toast(message);
            nav(`/properties/${id}`);
          }}
        />
      )}
    </div>
  );
}

/** Add flow — covers both new deals (pipeline lead) AND properties you
 *  already own (initial portfolio setup: stage, purchase, loan, tenancy). */
function AddPropertyModal(props: {
  onClose: () => void;
  onDone: (id: string, message: string) => void;
}) {
  const addProperty = useStore((s) => s.addProperty);
  const addLoan = useStore((s) => s.addLoan);
  const addTenant = useStore((s) => s.addTenant);

  const [owned, setOwned] = useState(false);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [ptype, setPtype] = useState<PropertyType>("fourplex");
  const [price, setPrice] = useState(500000);
  const [units, setUnits] = useState(4);
  const [rent, setRent] = useState(1500);
  const [rehab, setRehab] = useState(75000);
  // owned-only
  const [stage, setStage] = useState<Stage>("occupied");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [currentValue, setCurrentValue] = useState(0);
  const [occupiedUnits, setOccupiedUnits] = useState(4);
  const [lender, setLender] = useState("");
  const [loanBalance, setLoanBalance] = useState(0);
  const [loanRate, setLoanRate] = useState(6.5);
  const [loanTerm, setLoanTerm] = useState(30);
  const [loanPayment, setLoanPayment] = useState(0);

  const estPayment = loanPayment || Math.round(monthlyPayment(loanBalance, loanRate, loanTerm));

  const submit = () => {
    if (!name.trim()) return;
    const id = uid();
    const value = owned ? currentValue || price : price;
    const today = todayISO();

    addProperty({
      id,
      name: name.trim(),
      address: address.trim() || "Address TBD",
      city: city.trim() || "—",
      propertyType: ptype,
      stage: owned ? stage : "lead",
      stageEnteredDate: today,
      photoHue: Math.floor((name.length * 47 + price) % 360),
      underwriting: {
        ...UW_DEFAULTS,
        price, units, rentPerUnit: rent, rehabBudget: rehab,
        // for an owned property, its value IS the (post-repair) value
        arvMode: owned ? "manual" : "income",
        arvManual: value,
        refiRatePct: owned ? loanRate || UW_DEFAULTS.refiRatePct : UW_DEFAULTS.refiRatePct,
      },
      currentValue: value,
      purchaseDate: owned ? purchaseDate || today : undefined,
      actualRehabSpent: owned ? rehab : undefined,
      notes: owned ? "Added during portfolio setup." : undefined,
    });

    if (owned && loanBalance > 0) {
      addLoan({
        id: uid(), propertyId: id,
        lender: lender.trim() || "My lender",
        kind: "acquisition",
        originalAmount: loanBalance, currentBalance: loanBalance,
        ratePct: loanRate, termYears: loanTerm,
        startDate: purchaseDate || today,
        monthlyPayment: estPayment,
        active: true,
      });
    }

    if (owned && occupiedUnits > 0) {
      const start = purchaseDate || today;
      const end = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
      for (let i = 1; i <= Math.min(occupiedUnits, units); i++) {
        addTenant({
          id: uid(), propertyId: id,
          unitLabel: units > 1 ? `Unit ${i}` : "Main",
          name: `Tenant — Unit ${i}`, email: "", phone: "",
          rent, leaseStart: start, leaseEnd: end,
          status: "current", balanceOwed: 0,
        });
      }
    }

    props.onDone(
      id,
      owned
        ? `${name.trim()} added to your portfolio (${STAGE_LABELS[owned ? stage : "lead"]})`
        : `${name.trim()} added to pipeline as Lead`,
    );
  };

  return (
    <Modal title="Add property" onClose={props.onClose}>
      {/* ownership toggle */}
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <button className={`btn ${!owned ? "" : "ghost"}`} onClick={() => setOwned(false)}>
          🔍 New deal (pipeline)
        </button>
        <button className={`btn ${owned ? "" : "ghost"}`} onClick={() => { setOwned(true); if (!currentValue) setCurrentValue(price); }}>
          🏠 I already own it
        </button>
      </div>

      <div className="grid g2">
        <div className="field"><label>Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Elm St Triplex" autoFocus /></div>
        <div className="field"><label>Type</label>
          <select value={ptype} onChange={(e) => setPtype(e.target.value as PropertyType)}>
            {Object.entries(PROPERTY_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select></div>
        <div className="field"><label>Address</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Elm St" /></div>
        <div className="field"><label>City</label>
          <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Hamilton, ON" /></div>
        <div className="field"><label>{owned ? "Purchase price" : "Asking / est. price"}</label>
          <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} /></div>
        <div className="field"><label>Units</label>
          <input type="number" min={1} value={units} onChange={(e) => setUnits(+e.target.value)} /></div>
        <div className="field"><label>{owned ? "Current rent / unit / mo" : "Market rent / unit / mo"}</label>
          <input type="number" value={rent} onChange={(e) => setRent(+e.target.value)} /></div>
        <div className="field"><label>{owned ? "Rehab spent" : "Rehab budget"}</label>
          <input type="number" value={rehab} onChange={(e) => setRehab(+e.target.value)} /></div>
      </div>

      {owned && (
        <>
          <div className="form-section">Ownership</div>
          <div className="grid g2">
            <div className="field"><label>Where is it in the cycle?</label>
              <select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
                {OWNED_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
              </select></div>
            <div className="field"><label>Purchase date</label>
              <input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} /></div>
            <div className="field"><label>Current value (est.)</label>
              <input type="number" value={currentValue || ""} placeholder={String(price)}
                onChange={(e) => setCurrentValue(+e.target.value)} /></div>
            <div className="field"><label>Occupied units</label>
              <input type="number" min={0} max={units} value={occupiedUnits}
                onChange={(e) => setOccupiedUnits(+e.target.value)} /></div>
          </div>

          <div className="form-section">Mortgage (leave balance 0 if owned free & clear)</div>
          <div className="grid g2">
            <div className="field"><label>Lender</label>
              <input value={lender} onChange={(e) => setLender(e.target.value)} placeholder="e.g. TD Bank" /></div>
            <div className="field"><label>Current balance</label>
              <input type="number" value={loanBalance || ""} onChange={(e) => setLoanBalance(+e.target.value)} /></div>
            <div className="field"><label>Rate %</label>
              <input type="number" step={0.05} value={loanRate} onChange={(e) => setLoanRate(+e.target.value)} /></div>
            <div className="field"><label>Amortization (yrs)</label>
              <input type="number" value={loanTerm} onChange={(e) => setLoanTerm(+e.target.value)} /></div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Monthly payment {loanBalance > 0 && !loanPayment ? `— estimated ${fmtMoney(estPayment)}` : ""}</label>
              <input type="number" value={loanPayment || ""} placeholder={loanBalance > 0 ? String(estPayment) : "0"}
                onChange={(e) => setLoanPayment(+e.target.value)} /></div>
          </div>
          {occupiedUnits > 0 && (
            <p className="card-sub" style={{ marginTop: 10 }}>
              {Math.min(occupiedUnits, units)} placeholder tenant{Math.min(occupiedUnits, units) > 1 ? "s" : ""} at {fmtMoney(rent)}/mo will be created — edit names and leases in the Tenants tab.
            </p>
          )}
        </>
      )}

      <div className="modal-actions">
        <button className="btn ghost" onClick={props.onClose}>Cancel</button>
        <button className="btn" onClick={submit} disabled={!name.trim()}>
          {owned ? "Add to portfolio" : "Add as Lead"}
        </button>
      </div>
    </Modal>
  );
}
