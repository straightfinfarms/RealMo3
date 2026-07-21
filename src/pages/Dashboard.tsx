/* ============================================================================
 * Dashboard — "What happened, what's happening, what needs attention,
 * what should I do next" — on one screen.
 * ========================================================================== */
import { useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useStore, dataSnapshot } from "@/store/store";
import { portfolioKpis, attentionFeed, propertyMetrics, scanRefis } from "@/engine/insights";
import { fmtCompact, fmtMoney, fmtPct, remainingBalance } from "@/engine/underwrite";
import { Kpi, Badge, Cover, healthColor } from "@/components/ui";
import { AreaChart, Donut } from "@/components/charts";
import { STAGE_LABELS, OWNED_STAGES } from "@/data/types";
import { todayISO } from "@/data/seed";

export function Dashboard() {
  const nav = useNavigate();
  // subscribe to everything that matters
  const properties = useStore((s) => s.properties);
  const loans = useStore((s) => s.loans);
  const tenants = useStore((s) => s.tenants);
  const todos = useStore((s) => s.todos);
  const toggleTodo = useStore((s) => s.toggleTodo);
  const investorName = useStore((s) => s.settings.investorName);

  const data = dataSnapshot();
  const today = todayISO();
  const k = useMemo(() => portfolioKpis(data), [properties, loans, tenants]);
  const attention = useMemo(() => attentionFeed(data, today), [properties, loans, tenants, todos]);
  const refisReady = useMemo(() => scanRefis(data).filter((r) => r.verdict === "ready"), [properties, loans]);

  // 12-month equity + cashflow history (modeled backwards from today's state:
  // amortization unwound on real loans + 3%/yr appreciation).
  const history = useMemo(() => {
    const months: string[] = [];
    const equity: number[] = [];
    const cashflow: number[] = [];
    const now = new Date();
    for (let i = 11; i >= 0; i--) {
      const dt = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push(dt.toLocaleString("en-US", { month: "short" }));
      let eq = 0;
      let cf = 0;
      for (const p of properties.filter((x) => !x.archived && OWNED_STAGES.includes(x.stage))) {
        const owned =
          !p.purchaseDate || new Date(p.purchaseDate) <= dt;
        if (!owned) continue;
        const value = p.currentValue / Math.pow(1.03, i / 12);
        // Unwind amortization on today's active loans (predecessor loans
        // aren't modeled, so treat current debt structure as continuous).
        const pLoans = loans.filter((l) => l.propertyId === p.id && l.active);
        const debt = pLoans.reduce((a, l) => {
          const monthsIn = Math.max(0, (dt.getTime() - new Date(l.startDate).getTime()) / (30.44 * 86400000));
          return a + remainingBalance(l.originalAmount, l.ratePct, l.termYears, monthsIn);
        }, 0);
        eq += value - debt;
        const m = propertyMetrics(p, data);
        cf += m.cashflowMo;
      }
      equity.push(Math.round(eq));
      cashflow.push(Math.round(cf));
    }
    return { months, equity, cashflow };
  }, [properties, loans]);

  const pipelineProps = properties.filter((p) => !p.archived && !OWNED_STAGES.includes(p.stage));
  const openTodos = todos.filter((t) => !t.done).slice(0, 6);

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">{greeting}, {investorName}</div>
          <div className="section-sub">
            {k.propertiesOwned} properties · {k.unitsOwned} units ·{" "}
            {attention.filter((a) => a.severity === "alert").length} alerts ·{" "}
            {refisReady.length} refi opportunit{refisReady.length === 1 ? "y" : "ies"} ready
          </div>
        </div>
        <div className="spacer">
          <Link to="/analyzer" className="btn ghost">∑ Analyze a deal</Link>
          <Link to="/pipeline" className="btn">⇶ Pipeline</Link>
        </div>
      </div>

      {/* KPI row 1 — the big four */}
      <div className="grid g4">
        <Kpi label="Portfolio Value" value={fmtCompact(k.portfolioValue)}
          delta={`${k.propertiesOwned} owned + ${k.pipelineCount} in pipeline`} />
        <Kpi label="Total Equity" value={fmtCompact(k.totalEquity)}
          delta={`LTV ${fmtPct(k.ltvPct, 0)}`} deltaTone={k.ltvPct > 80 ? "down" : "up"} />
        <Kpi label="Cash Flow / mo" value={fmtMoney(k.cashflowMo)}
          delta={k.cashflowMo >= 0 ? "▲ positive" : "▼ negative"}
          deltaTone={k.cashflowMo >= 0 ? "up" : "down"} />
        <Kpi label="Occupancy" value={fmtPct(k.occupancyPct, 0)}
          delta={`avg DSCR ${isFinite(k.avgDscr) ? k.avgDscr.toFixed(2) + "x" : "∞"}`}
          deltaTone={k.occupancyPct >= 90 ? "up" : "down"} />
      </div>

      <div style={{ height: 14 }} />

      {/* KPI row 2 */}
      <div className="grid g4">
        <Kpi label="Monthly Income" value={fmtMoney(k.incomeMo)} />
        <Kpi label="Monthly Expenses" value={fmtMoney(k.expensesMo)} />
        <Kpi label="Total Debt" value={fmtCompact(k.totalDebt)} />
        <Kpi label="Cash Invested" value={fmtCompact(k.cashInvested)}
          delta="net of refi proceeds" />
      </div>

      <div style={{ height: 14 }} />

      <div className="grid" style={{ gridTemplateColumns: "1.6fr 1fr" }}>
        {/* equity & cash flow trend */}
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Equity growth — trailing 12 months</div>
              <div className="card-sub">Modeled from loan amortization + 3%/yr appreciation</div>
            </div>
          </div>
          <AreaChart
            money
            labels={history.months}
            series={[{ label: "Total equity", values: history.equity, color: "var(--accent)" }]}
          />
        </div>

        {/* needs attention */}
        <div className="card" style={{ display: "flex", flexDirection: "column" }}>
          <div className="card-head">
            <div className="card-title">⚡ Needs attention</div>
            <span className="spacer" />
            <Badge color={attention.some((a) => a.severity === "alert") ? "red" : "green"}>
              {attention.length} items
            </Badge>
          </div>
          <div style={{ overflowY: "auto", maxHeight: 300, margin: "0 -6px" }}>
            {attention.length === 0 && (
              <div className="empty">
                <div className="empty-icon">✓</div>
                <div>All clear</div>
              </div>
            )}
            {attention.slice(0, 8).map((a, i) => (
              <div key={i} className="attention-item" onClick={() => nav(a.link)}>
                <div className="attention-icon">{a.icon}</div>
                <div>
                  <div className="attention-title">{a.title}</div>
                  <div className="attention-sub">{a.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="grid g3">
        {/* capital allocation */}
        <div className="card">
          <div className="card-head"><div className="card-title">Capital structure</div></div>
          <Donut
            centerLabel="Portfolio"
            centerValue={fmtCompact(k.portfolioValue)}
            slices={[
              { label: "Equity", value: k.totalEquity, color: "var(--green)" },
              { label: "Debt", value: k.totalDebt, color: "var(--accent)" },
            ]}
          />
        </div>

        {/* pipeline snapshot */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Pipeline</div>
            <span className="spacer" />
            <Link to="/pipeline" style={{ fontSize: 12 }}>View all →</Link>
          </div>
          {pipelineProps.length === 0 && (
            <div className="empty"><div className="empty-icon">⇶</div><div>No active deals</div></div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pipelineProps.map((p) => (
              <Link key={p.id} to={`/properties/${p.id}`}
                style={{ display: "flex", alignItems: "center", gap: 10, color: "inherit" }}>
                <Cover hue={p.photoHue} name={p.name} size={32} radius={8} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {p.name}
                  </div>
                  <div className="faint" style={{ fontSize: 11 }}>{fmtCompact(p.underwriting.price)}</div>
                </div>
                <span style={{ marginLeft: "auto" }}>
                  <Badge color="blue">{STAGE_LABELS[p.stage]}</Badge>
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* tasks */}
        <div className="card">
          <div className="card-head">
            <div className="card-title">Upcoming tasks</div>
            <span className="spacer" />
            <span className="faint" style={{ fontSize: 11.5 }}>{todos.filter((t) => !t.done).length} open</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
            {openTodos.map((t) => {
              const overdue = t.dueDate && t.dueDate < today;
              const prop = properties.find((p) => p.id === t.propertyId);
              return (
                <label key={t.id} style={{ display: "flex", gap: 9, alignItems: "flex-start", cursor: "pointer", fontSize: 12.5 }}>
                  <input type="checkbox" checked={t.done} onChange={() => toggleTodo(t.id)}
                    style={{ marginTop: 3, accentColor: "var(--accent)" }} />
                  <span>
                    <span style={{ fontWeight: 550 }}>{t.title}</span>
                    <span className="faint" style={{ display: "block", fontSize: 11 }}>
                      {prop ? prop.name + " · " : ""}
                      {t.dueDate && (
                        <span className={overdue ? "neg" : ""}>
                          {overdue ? "overdue — " : "due "}{t.dueDate}
                        </span>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
            {openTodos.length === 0 && <div className="faint">Nothing due. Go find a deal.</div>}
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      {/* property health strip */}
      <div className="card">
        <div className="card-head">
          <div className="card-title">Portfolio health</div>
          <span className="spacer" />
          <Link to="/properties" style={{ fontSize: 12 }}>All properties →</Link>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Property</th><th>Stage</th><th className="num">Value</th>
              <th className="num">Equity</th><th className="num">CF/mo</th>
              <th className="num">DSCR</th><th className="num">Occ.</th><th>Health</th>
            </tr>
          </thead>
          <tbody>
            {properties.filter((p) => !p.archived && OWNED_STAGES.includes(p.stage)).map((p) => {
              const m = propertyMetrics(p, data);
              return (
                <tr key={p.id} className="clickable" onClick={() => nav(`/properties/${p.id}`)}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <Cover hue={p.photoHue} name={p.name} size={26} radius={7} />
                      <span className="strong">{p.name}</span>
                    </div>
                  </td>
                  <td><Badge color="gray">{STAGE_LABELS[p.stage]}</Badge></td>
                  <td className="num">{fmtCompact(m.currentValue)}</td>
                  <td className="num">{fmtCompact(m.equity)}</td>
                  <td className={`num ${m.cashflowMo < 0 ? "neg" : "pos"}`}>{fmtMoney(m.cashflowMo)}</td>
                  <td className="num">{isFinite(m.dscr) ? m.dscr.toFixed(2) + "x" : "—"}</td>
                  <td className="num">{Math.round(m.occupancyPct)}%</td>
                  <td>
                    <Badge color={healthColor(m.health)} dot>
                      {m.health === "good" ? "Healthy" : m.health === "watch" ? "Watch" : "Alert"}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
