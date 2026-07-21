/* ============================================================================
 * Refinance Engine — continuously scans every owned property for cash-out
 * potential at today's rates. The "Repeat" in BRRRR.
 * ========================================================================== */
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useStore, dataSnapshot } from "@/store/store";
import { scanRefis } from "@/engine/insights";
import { fmtCompact, fmtMoney, fmtPct } from "@/engine/underwrite";
import { Badge, Cover } from "@/components/ui";

export function Refinance() {
  const properties = useStore((s) => s.properties);
  const loans = useStore((s) => s.loans);
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const [ltv, setLtv] = useState(75);

  const data = dataSnapshot();
  const opps = useMemo(() => scanRefis(data, ltv), [properties, loans, ltv, settings.marketRefiRatePct]);
  const ready = opps.filter((o) => o.verdict === "ready");
  const totalAvailable = ready.reduce((a, o) => a + Math.max(0, o.cashOut), 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Refinance Engine</div>
          <div className="section-sub">
            The "Repeat" in BRRRR — every owned property scanned at today's market rate
          </div>
        </div>
        <div className="spacer" style={{ alignItems: "flex-end", gap: 14 }}>
          <div className="field" style={{ width: 110 }}>
            <label>Market rate %</label>
            <input
              type="number" step={0.05} value={settings.marketRefiRatePct}
              onChange={(e) => setSettings({ marketRefiRatePct: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div className="field" style={{ width: 100 }}>
            <label>Target LTV %</label>
            <input type="number" value={ltv} onChange={(e) => setLtv(parseFloat(e.target.value) || 0)} />
          </div>
        </div>
      </div>

      <div className="grid g3">
        <div className="card kpi">
          <div className="kpi-label">Ready to refinance</div>
          <div className="kpi-value">{ready.length} propert{ready.length === 1 ? "y" : "ies"}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Capital available now</div>
          <div className="kpi-value" style={{ color: "var(--green)" }}>{fmtCompact(totalAvailable)}</div>
          <div className="kpi-delta flat">tax-free cash-out across ready deals</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Assumptions</div>
          <div className="kpi-value" style={{ fontSize: 17 }}>{fmtPct(settings.marketRefiRatePct, 2)} · {ltv}% LTV</div>
          <div className="kpi-delta flat">30-yr am · 2% closing</div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {opps.map((o) => {
          const p = properties.find((x) => x.id === o.propertyId);
          return (
            <div className="card" key={o.propertyId}>
              <div style={{ display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
                {p && <Cover hue={p.photoHue} name={p.name} size={44} radius={12} />}
                <div style={{ minWidth: 180 }}>
                  <Link to={`/properties/${o.propertyId}`} style={{ color: "inherit" }}>
                    <div className="strong" style={{ fontSize: 14 }}>{o.name}</div>
                  </Link>
                  <div style={{ marginTop: 4 }}>
                    <Badge color={o.verdict === "ready" ? "green" : o.verdict === "close" ? "yellow" : "gray"} dot>
                      {o.verdict === "ready" ? "REFINANCE NOW" : o.verdict === "close" ? "GETTING CLOSE" : "WAIT"}
                    </Badge>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-2)", marginTop: 8, maxWidth: 380, lineHeight: 1.5 }}>
                    {o.note}
                  </div>
                </div>
                <div style={{
                  marginLeft: "auto", display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(105px, auto))", gap: "6px 22px",
                  fontSize: 12, textAlign: "right",
                }}>
                  <div><div className="kpi-label" style={{ fontSize: 9.5 }}>Value</div><b style={{ fontSize: 14 }}>{fmtCompact(o.currentValue)}</b></div>
                  <div><div className="kpi-label" style={{ fontSize: 9.5 }}>Debt</div><b style={{ fontSize: 14 }}>{fmtCompact(o.currentDebt)}</b></div>
                  <div><div className="kpi-label" style={{ fontSize: 9.5 }}>Max loan</div><b style={{ fontSize: 14 }}>{fmtCompact(o.maxLoan)}</b></div>
                  <div>
                    <div className="kpi-label" style={{ fontSize: 9.5 }}>Cash out</div>
                    <b style={{ fontSize: 14, color: o.cashOut > 0 ? "var(--green)" : "var(--red)" }}>
                      {fmtCompact(o.cashOut)}
                    </b>
                  </div>
                  <div>
                    <div className="kpi-label" style={{ fontSize: 9.5 }}>Δ payment</div>
                    <b style={{ fontSize: 14, color: o.cashflowDeltaMo >= 0 ? "var(--green)" : "var(--red)" }}>
                      {o.cashflowDeltaMo >= 0 ? "+" : ""}{fmtMoney(o.cashflowDeltaMo)}/mo
                    </b>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {opps.length === 0 && (
          <div className="card empty">
            <div className="empty-icon">↻</div>
            <div>No owned properties to scan yet.</div>
          </div>
        )}
      </div>
    </div>
  );
}
