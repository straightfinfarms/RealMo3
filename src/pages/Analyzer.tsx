/* ============================================================================
 * Analyzer — live BRRRR underwriting. Everything recalculates on keystroke.
 * Load any pipeline property, tweak, compare rate scenarios, save as a lead.
 * ========================================================================== */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore, uid } from "@/store/store";
import {
  underwrite, scoreDeal, pricepoints, UW_DEFAULTS,
  fmtCompact, fmtMoney, fmtPct,
} from "@/engine/underwrite";
import type { Underwriting } from "@/data/types";
import { ScoreDial, Bar, Badge, toast } from "@/components/ui";
import { todayISO } from "@/data/seed";

type NumKey = {
  [K in keyof Underwriting]: Underwriting[K] extends number ? K : never;
}[keyof Underwriting];

const SECTIONS: { title: string; fields: [NumKey, string][] }[] = [
  {
    title: "Property & income",
    fields: [
      ["units", "Units"], ["rentPerUnit", "Rent / unit / mo"],
      ["otherIncome", "Other income / mo"], ["vacancyPct", "Vacancy %"],
    ],
  },
  {
    title: "Operating expenses (annual)",
    fields: [
      ["taxesAnnual", "Property taxes"], ["insuranceAnnual", "Insurance"],
      ["utilitiesAnnual", "Utilities"], ["reservesPerUnit", "Reserves / unit / yr"],
      ["maintenancePct", "Maintenance %"], ["managementPct", "Management %"],
      ["expenseRatioPct", "Fallback exp. ratio %"],
    ],
  },
  {
    title: "Acquisition",
    fields: [
      ["price", "Purchase price"], ["rehabBudget", "Rehab budget"],
      ["downPct", "Down %"], ["purchaseRatePct", "Rate %"],
      ["purchaseTermYears", "Term (yrs)"], ["closingPct", "Closing %"],
      ["holdingMonths", "Holding (months)"],
    ],
  },
  {
    title: "ARV & refinance",
    fields: [
      ["marketCapPct", "Market cap %"], ["arvManual", "Manual ARV"],
      ["refiLtvPct", "Refi LTV %"], ["refiRatePct", "Refi rate %"],
      ["refiTermYears", "Refi term (yrs)"], ["refiClosingPct", "Refi closing %"],
    ],
  },
];

export function Analyzer() {
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const addProperty = useStore((s) => s.addProperty);
  const updateProperty = useStore((s) => s.updateProperty);
  const settings = useStore((s) => s.settings);
  const { id: routeId } = useParams();
  const [uwInputs, setUwInputs] = useState<Underwriting>({ ...UW_DEFAULTS });
  const [name, setName] = useState("New Prospect");
  const [loadedFrom, setLoadedFrom] = useState<string>("");

  // Deep link: /analyzer/:id preloads that property's underwriting.
  useEffect(() => {
    if (!routeId) return;
    const p = properties.find((x) => x.id === routeId);
    if (p) {
      setUwInputs({ ...p.underwriting });
      setName(p.name);
      setLoadedFrom(p.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  const r = useMemo(() => underwrite(uwInputs), [uwInputs]);
  const score = useMemo(() => scoreDeal(r), [r]);
  const pp = useMemo(
    () => pricepoints(uwInputs, {
      cashflowPerUnit: settings.targetCashflowPerUnit,
      cocPct: settings.targetCoCPct,
    }),
    [uwInputs, settings],
  );

  // Rate sensitivity: what happens to CF and cash-out if refi rates move
  const scenarios = useMemo(() => {
    return [-1, -0.5, 0, 0.5, 1].map((delta) => {
      const rr = underwrite({ ...uwInputs, refiRatePct: uwInputs.refiRatePct + delta });
      return { delta, cf: rr.cfMonthly, cfUnit: rr.cfPerUnitMo, dscr: rr.dscr };
    });
  }, [uwInputs]);

  const set = (k: NumKey, v: number) => setUwInputs((s) => ({ ...s, [k]: v }));

  const save = () => {
    const id = uid();
    addProperty({
      id, name, address: "Address TBD", city: "—",
      propertyType: uwInputs.units >= 5 ? "small_multifamily" : uwInputs.units === 4 ? "fourplex" : uwInputs.units === 3 ? "triplex" : uwInputs.units === 2 ? "duplex" : "single_family",
      stage: "lead", stageEnteredDate: todayISO(),
      photoHue: Math.floor(Math.random() * 360),
      underwriting: { ...uwInputs },
      currentValue: uwInputs.price,
      notes: `Underwritten in Analyzer — score ${score.total} (${score.grade}).`,
    });
    toast(`${name} saved to pipeline as Lead`);
    nav(`/properties/${id}`);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Deal Analyzer</div>
          <div className="section-sub">Live BRRRR underwriting — every keystroke recalculates the whole deal</div>
        </div>
        <div className="spacer">
          <select
            value={loadedFrom}
            onChange={(e) => {
              const p = properties.find((x) => x.id === e.target.value);
              if (p) {
                setUwInputs({ ...p.underwriting });
                setName(p.name + " (what-if)");
                setLoadedFrom(e.target.value);
              }
            }}
            style={{
              background: "var(--surface-2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "6px 10px", color: "var(--text)", fontSize: 12.5,
            }}
          >
            <option value="">Load from property…</option>
            {properties.filter((p) => !p.archived).map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          {loadedFrom && (
            <button
              className="btn ghost"
              onClick={() => {
                const src = properties.find((x) => x.id === loadedFrom);
                if (!src) return;
                updateProperty(loadedFrom, { underwriting: { ...uwInputs } });
                toast(`Underwriting saved back to ${src.name}`);
                nav(`/properties/${loadedFrom}`);
              }}
            >
              ✎ Save changes back
            </button>
          )}
          <button className="btn" onClick={save}>+ Save as new lead</button>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "minmax(300px, 1fr) 1.4fr" }}>
        {/* inputs */}
        <div className="card">
          <div className="field" style={{ marginBottom: 4 }}>
            <label>Deal name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="form-section">ARV method</div>
          <div style={{ display: "flex", gap: 6 }}>
            {(["income", "manual"] as const).map((m) => (
              <button
                key={m}
                className={`btn sm ${uwInputs.arvMode === m ? "" : "ghost"}`}
                onClick={() => setUwInputs((s) => ({ ...s, arvMode: m }))}
              >
                {m === "income" ? "Income (NOI ÷ cap)" : "Manual ARV"}
              </button>
            ))}
          </div>
          {SECTIONS.map((sec) => (
            <div key={sec.title}>
              <div className="form-section">{sec.title}</div>
              <div className="form-row">
                {sec.fields
                  .filter(([k]) => !(k === "arvManual" && uwInputs.arvMode !== "manual"))
                  .filter(([k]) => !(k === "marketCapPct" && uwInputs.arvMode !== "income"))
                  .map(([k, label]) => (
                    <div className="field" key={k}>
                      <label>{label}</label>
                      <input
                        type="number"
                        value={uwInputs[k]}
                        onChange={(e) => set(k, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* results */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="card">
            <div style={{ display: "flex", gap: 24, alignItems: "center", flexWrap: "wrap" }}>
              <ScoreDial score={score.total} grade={score.grade} size={92} />
              <div style={{ flex: 1, minWidth: 240 }}>
                <Badge color={score.recommendation.tone === "buy" ? "green" : score.recommendation.tone === "ok" ? "blue" : score.recommendation.tone === "warn" ? "yellow" : "red"}>
                  {score.recommendation.verb}
                </Badge>
                <div style={{ fontSize: 12.5, color: "var(--text-2)", marginTop: 8, lineHeight: 1.55 }}>
                  {score.recommendation.note}
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "auto auto", gap: "4px 18px", fontSize: 12 }}>
                <span className="muted">Cash flow</span><b className={r.cfPerUnitMo < 0 ? "neg" : "pos"}>{fmtMoney(r.cfPerUnitMo)}/unit/mo</b>
                <span className="muted">Cash-out</span><b>{fmtCompact(r.cashOut)}</b>
                <span className="muted">Capital back</span><b>{fmtPct(r.capitalRecoveredPct, 0)}</b>
                <span className="muted">DSCR</span><b>{isFinite(r.dscr) ? r.dscr.toFixed(2) + "x" : "∞"}</b>
              </div>
            </div>
            <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 7 }}>
              {score.criteria.map((c) => (
                <div key={c.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 2 }}>
                    <span className="muted">{c.label} <span className="faint">· {c.weight}%</span></span>
                    <b>{c.display}</b>
                  </div>
                  <Bar pct={c.score} tone={c.score >= 70 ? "green" : c.score >= 40 ? "yellow" : "red"} />
                </div>
              ))}
            </div>
          </div>

          <div className="grid g2">
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Pricepoints</div>
                  <div className="card-sub">vs. current price {fmtCompact(uwInputs.price)}</div>
                </div>
              </div>
              <table className="tbl">
                <tbody>
                  {[
                    ["Full capital recovery", pp.recoveryPrice],
                    [`${settings.targetCoCPct}% CoC target`, pp.cocPrice],
                    [`${fmtMoney(settings.targetCashflowPerUnit)}/unit CF target`, pp.cfPrice],
                    ["70% rule MAO", pp.mao70],
                  ].map(([label, price], i) => (
                    <tr key={i}>
                      <td className="muted" style={{ fontSize: 12 }}>{label as string}</td>
                      <td className="num">
                        <b className={typeof price === "number" && (price as number) >= uwInputs.price ? "pos" : "neg"}>
                          {typeof price === "number" ? fmtCompact(price as number) : "—"}
                        </b>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Rate sensitivity</div>
                  <div className="card-sub">Refi rate vs stabilized cash flow</div>
                </div>
              </div>
              <table className="tbl">
                <thead>
                  <tr><th>Refi rate</th><th className="num">CF/mo</th><th className="num">CF/unit</th><th className="num">DSCR</th></tr>
                </thead>
                <tbody>
                  {scenarios.map((s) => (
                    <tr key={s.delta} style={s.delta === 0 ? { background: "var(--surface-2)" } : undefined}>
                      <td className={s.delta === 0 ? "strong" : "muted"}>
                        {fmtPct(uwInputs.refiRatePct + s.delta, 1)}{s.delta === 0 ? " (now)" : ""}
                      </td>
                      <td className={`num ${s.cf < 0 ? "neg" : "pos"}`}>{fmtMoney(s.cf)}</td>
                      <td className="num">{fmtMoney(s.cfUnit)}</td>
                      <td className="num">{isFinite(s.dscr) ? s.dscr.toFixed(2) : "∞"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><div className="card-title">Deal anatomy</div></div>
            <div className="grid g4" style={{ gap: 10 }}>
              {[
                ["NOI", fmtMoney(r.noi) + "/yr"],
                ["ARV", fmtCompact(r.arv)],
                ["All-in basis", fmtCompact(r.allInBasis)],
                ["Equity created", fmtCompact(r.equityCreated)],
                ["Cash invested", fmtCompact(r.totalCashInvested)],
                ["Cash left in", fmtCompact(Math.max(0, r.cashLeftInDeal))],
                ["CoC", isFinite(r.cocPct) ? fmtPct(r.cocPct) : "∞"],
                ["5-yr IRR", isFinite(r.fiveYearIrrPct) ? fmtPct(r.fiveYearIrrPct) : "—"],
              ].map(([l, v], i) => (
                <div key={i} style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 12px" }}>
                  <div className="kpi-label" style={{ fontSize: 9.5 }}>{l}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 2 }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
