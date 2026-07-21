/* ============================================================================
 * Analytics — rankings, allocation, performance. Best and worst, and why.
 * ========================================================================== */
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useStore, dataSnapshot } from "@/store/store";
import { propertyMetrics } from "@/engine/insights";
import { fmtCompact, fmtMoney, fmtPct } from "@/engine/underwrite";
import { RankBars, Donut } from "@/components/charts";
import { Badge, Cover, gradeColor } from "@/components/ui";
import { OWNED_STAGES, PROPERTY_TYPE_LABELS } from "@/data/types";

export function Analytics() {
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const loans = useStore((s) => s.loans);
  const tenants = useStore((s) => s.tenants);
  const data = dataSnapshot();

  const owned = useMemo(
    () =>
      properties
        .filter((p) => !p.archived && OWNED_STAGES.includes(p.stage))
        .map((p) => ({ p, m: propertyMetrics(p, data) })),
    [properties, loans, tenants],
  );

  const byCashflow = [...owned].sort((a, b) => b.m.cashflowMo - a.m.cashflowMo);
  const byCoc = [...owned]
    .filter(({ m }) => isFinite(m.cocPct))
    .sort((a, b) => b.m.cocPct - a.m.cocPct);
  const best = byCashflow[0];
  const worst = byCashflow[byCashflow.length - 1];

  const typeAlloc = useMemo(() => {
    const map = new Map<string, number>();
    for (const { p, m } of owned) {
      const label = PROPERTY_TYPE_LABELS[p.propertyType];
      map.set(label, (map.get(label) ?? 0) + m.equity);
    }
    const colors = ["var(--accent)", "var(--green)", "var(--purple)", "var(--yellow)", "var(--cyan)", "var(--red)"];
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [owned]);

  const cityAlloc = useMemo(() => {
    const map = new Map<string, number>();
    for (const { p, m } of owned) map.set(p.city, (map.get(p.city) ?? 0) + m.equity);
    const colors = ["var(--green)", "var(--accent)", "var(--purple)", "var(--yellow)", "var(--cyan)"];
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([label, value], i) => ({ label, value, color: colors[i % colors.length] }));
  }, [owned]);

  if (owned.length === 0) {
    return (
      <div className="card empty">
        <div className="empty-icon">◔</div>
        <div>No owned properties yet — analytics unlock once deals close.</div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Portfolio Analytics</div>
          <div className="section-sub">Which assets earn their place — and which don't</div>
        </div>
      </div>

      {/* best / worst callouts */}
      <div className="grid g2">
        {best && (
          <div className="card" style={{ borderLeft: "3px solid var(--green)" }}>
            <div className="card-head">
              <div className="card-title">🏆 Best performer</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}
              onClick={() => nav(`/properties/${best.p.id}`)}>
              <Cover hue={best.p.photoHue} name={best.p.name} size={44} radius={12} />
              <div>
                <div className="strong" style={{ fontSize: 14 }}>{best.p.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmtMoney(best.m.cashflowMo)}/mo · DSCR {isFinite(best.m.dscr) ? best.m.dscr.toFixed(2) + "x" : "∞"} ·
                  CoC {isFinite(best.m.cocPct) ? fmtPct(best.m.cocPct) : "∞"}
                </div>
              </div>
            </div>
          </div>
        )}
        {worst && worst !== best && (
          <div className="card" style={{ borderLeft: "3px solid var(--red)" }}>
            <div className="card-head">
              <div className="card-title">⚠ Weakest performer</div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", cursor: "pointer" }}
              onClick={() => nav(`/properties/${worst.p.id}`)}>
              <Cover hue={worst.p.photoHue} name={worst.p.name} size={44} radius={12} />
              <div>
                <div className="strong" style={{ fontSize: 14 }}>{worst.p.name}</div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {fmtMoney(worst.m.cashflowMo)}/mo
                  {worst.m.healthReasons.length > 0 && ` · ${worst.m.healthReasons[0]}`}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><div className="card-title">Cash flow ranking</div></div>
          <RankBars
            items={byCashflow.map(({ p, m }) => ({
              label: p.name, value: m.cashflowMo, display: fmtMoney(m.cashflowMo) + "/mo",
            }))}
          />
        </div>
        <div className="card">
          <div className="card-head">
            <div className="card-title">Cash-on-cash ranking</div>
            <span className="spacer" />
            <span className="faint" style={{ fontSize: 11 }}>on cash still in each deal</span>
          </div>
          <RankBars
            items={byCoc.map(({ p, m }) => ({
              label: p.name, value: m.cocPct, display: fmtPct(m.cocPct), tone: "good" as const,
            }))}
          />
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="grid g2">
        <div className="card">
          <div className="card-head"><div className="card-title">Equity by asset type</div></div>
          <Donut slices={typeAlloc} centerLabel="Equity" centerValue={fmtCompact(typeAlloc.reduce((a, s) => a + s.value, 0))} />
        </div>
        <div className="card">
          <div className="card-head"><div className="card-title">Equity by market</div></div>
          <Donut slices={cityAlloc} centerLabel="Equity" centerValue={fmtCompact(cityAlloc.reduce((a, s) => a + s.value, 0))} />
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card" style={{ padding: 6 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Property</th><th className="num">Value</th><th className="num">Equity</th>
              <th className="num">CF/mo</th><th className="num">CoC</th><th className="num">DSCR</th>
              <th className="num">LTV</th><th className="num">Cash in deal</th><th className="num">Score</th>
            </tr>
          </thead>
          <tbody>
            {byCashflow.map(({ p, m }) => (
              <tr key={p.id} className="clickable" onClick={() => nav(`/properties/${p.id}`)}>
                <td>
                  <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                    <Cover hue={p.photoHue} name={p.name} size={26} radius={7} />
                    <span className="strong">{p.name}</span>
                  </div>
                </td>
                <td className="num">{fmtCompact(m.currentValue)}</td>
                <td className="num">{fmtCompact(m.equity)}</td>
                <td className={`num ${m.cashflowMo < 0 ? "neg" : "pos"}`}>{fmtMoney(m.cashflowMo)}</td>
                <td className="num">{isFinite(m.cocPct) ? fmtPct(m.cocPct) : "∞"}</td>
                <td className="num">{isFinite(m.dscr) ? m.dscr.toFixed(2) + "x" : "—"}</td>
                <td className="num">{fmtPct(m.ltvPct, 0)}</td>
                <td className="num">{fmtCompact(m.cashInvested)}</td>
                <td className="num"><Badge color={gradeColor(m.score)}>{m.score}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
