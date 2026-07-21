/* ============================================================================
 * Properties — the portfolio register. Owned + pipeline, sortable at a glance.
 * ========================================================================== */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, dataSnapshot, uid } from "@/store/store";
import { propertyMetrics } from "@/engine/insights";
import { fmtCompact, fmtMoney, UW_DEFAULTS } from "@/engine/underwrite";
import { Badge, Cover, healthColor, gradeColor, Modal, toast } from "@/components/ui";
import {
  STAGE_LABELS, OWNED_STAGES, PROPERTY_TYPE_LABELS,
  type Property, type PropertyType,
} from "@/data/types";
import { todayISO } from "@/data/seed";

export function Properties() {
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const addProperty = useStore((s) => s.addProperty);
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

      {adding && (
        <AddPropertyModal
          onClose={() => setAdding(false)}
          onAdd={(p) => {
            addProperty(p);
            setAdding(false);
            toast(`${p.name} added to pipeline`);
            nav(`/properties/${p.id}`);
          }}
        />
      )}
    </div>
  );
}

function AddPropertyModal(props: { onClose: () => void; onAdd: (p: Property) => void }) {
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [ptype, setPtype] = useState<PropertyType>("fourplex");
  const [price, setPrice] = useState(500000);
  const [units, setUnits] = useState(4);
  const [rent, setRent] = useState(1500);
  const [rehab, setRehab] = useState(75000);

  const submit = () => {
    if (!name.trim()) return;
    props.onAdd({
      id: uid(),
      name: name.trim(),
      address: address.trim() || "Address TBD",
      city: city.trim() || "—",
      propertyType: ptype,
      stage: "lead",
      stageEnteredDate: todayISO(),
      photoHue: Math.floor((name.length * 47 + price) % 360),
      underwriting: {
        ...UW_DEFAULTS,
        price, units, rentPerUnit: rent, rehabBudget: rehab,
        arvMode: "income",
      },
      currentValue: price,
    });
  };

  return (
    <Modal title="Add property to pipeline" onClose={props.onClose}>
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
        <div className="field"><label>Asking / est. price</label>
          <input type="number" value={price} onChange={(e) => setPrice(+e.target.value)} /></div>
        <div className="field"><label>Units</label>
          <input type="number" min={1} value={units} onChange={(e) => setUnits(+e.target.value)} /></div>
        <div className="field"><label>Market rent / unit / mo</label>
          <input type="number" value={rent} onChange={(e) => setRent(+e.target.value)} /></div>
        <div className="field"><label>Rehab budget</label>
          <input type="number" value={rehab} onChange={(e) => setRehab(+e.target.value)} /></div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={props.onClose}>Cancel</button>
        <button className="btn" onClick={submit} disabled={!name.trim()}>Add as Lead</button>
      </div>
    </Modal>
  );
}
