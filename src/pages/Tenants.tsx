/* ============================================================================
 * Tenants — the rent roll: every lease, status, exposure, expiry radar.
 * ========================================================================== */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useStore } from "@/store/store";
import { fmtMoney } from "@/engine/underwrite";
import { Badge, Cover, toast } from "@/components/ui";
import { todayISO } from "@/data/seed";
import type { Tenant } from "@/data/types";

const STATUS_COLORS: Record<Tenant["status"], "green" | "yellow" | "red" | "gray" | "purple"> = {
  current: "green", late: "yellow", notice: "purple", vacant: "gray", eviction: "red",
};

export function Tenants() {
  const tenants = useStore((s) => s.tenants);
  const properties = useStore((s) => s.properties);
  const updateTenant = useStore((s) => s.updateTenant);
  const today = todayISO();

  const stats = useMemo(() => {
    const active = tenants.filter((t) => t.status !== "vacant");
    const rentRoll = active.reduce((a, t) => a + t.rent, 0);
    const exposure = tenants.reduce((a, t) => a + t.balanceOwed, 0);
    const expiring = active.filter((t) => {
      const days = (new Date(t.leaseEnd).getTime() - new Date(today).getTime()) / 86400000;
      return days > 0 && days < 60;
    });
    return { count: active.length, rentRoll, exposure, expiring };
  }, [tenants, today]);

  const cycleStatus = (t: Tenant) => {
    const order: Tenant["status"][] = ["current", "late", "notice", "eviction", "vacant"];
    const next = order[(order.indexOf(t.status) + 1) % order.length];
    updateTenant(t.id, { status: next });
    toast(`${t.name} → ${next}`);
  };

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="section-title">Tenants</div>
          <div className="section-sub">Rent roll, statuses and lease expiry radar</div>
        </div>
      </div>

      <div className="grid g4">
        <div className="card kpi">
          <div className="kpi-label">Active leases</div>
          <div className="kpi-value">{stats.count}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Monthly rent roll</div>
          <div className="kpi-value pos">{fmtMoney(stats.rentRoll)}</div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Arrears exposure</div>
          <div className="kpi-value" style={{ color: stats.exposure > 0 ? "var(--red)" : undefined }}>
            {fmtMoney(stats.exposure)}
          </div>
          <div className="kpi-delta flat">
            {tenants.filter((t) => t.balanceOwed > 0).length} tenant(s) owing
          </div>
        </div>
        <div className="card kpi">
          <div className="kpi-label">Leases expiring · 60d</div>
          <div className="kpi-value" style={{ color: stats.expiring.length ? "var(--yellow)" : undefined }}>
            {stats.expiring.length}
          </div>
          <div className="kpi-delta flat">start renewal conversations</div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card" style={{ padding: 6 }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Property / Unit</th><th>Tenant</th><th className="num">Rent</th>
              <th>Lease</th><th>Status</th><th className="num">Balance</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((t) => {
              const p = properties.find((x) => x.id === t.propertyId);
              const days = (new Date(t.leaseEnd).getTime() - new Date(today).getTime()) / 86400000;
              const expSoon = days > 0 && days < 60 && t.status !== "vacant";
              return (
                <tr key={t.id}>
                  <td>
                    <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                      {p && <Cover hue={p.photoHue} name={p.name} size={26} radius={7} />}
                      <div>
                        {p && <Link to={`/properties/${p.id}`} style={{ color: "inherit" }}>
                          <div className="strong" style={{ fontSize: 12 }}>{p.name}</div>
                        </Link>}
                        <div className="faint" style={{ fontSize: 11 }}>{t.unitLabel}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div>{t.name}</div>
                    <div className="faint" style={{ fontSize: 11 }}>{t.phone}</div>
                  </td>
                  <td className="num strong">{fmtMoney(t.rent)}</td>
                  <td className="mono muted" style={{ fontSize: 11.5 }}>
                    {t.leaseStart} → {t.leaseEnd}
                    {expSoon && <div><Badge color="yellow">expires in {Math.round(days)}d</Badge></div>}
                  </td>
                  <td>
                    <button onClick={() => cycleStatus(t)} title="Click to change status">
                      <Badge color={STATUS_COLORS[t.status]} dot>{t.status}</Badge>
                    </button>
                  </td>
                  <td className={`num ${t.balanceOwed > 0 ? "neg strong" : "muted"}`}>
                    {t.balanceOwed > 0 ? fmtMoney(t.balanceOwed) : "—"}
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
