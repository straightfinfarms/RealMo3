/* ============================================================================
 * charts.tsx — hand-rolled SVG charts. No chart library: full control over
 * the aesthetic, tiny bundle, theme-aware via CSS variables.
 * ========================================================================== */
import { useMemo, useState } from "react";
import { fmtCompact } from "@/engine/underwrite";

/* ---------- area/line chart ---------- */
export function AreaChart(props: {
  series: { label: string; values: number[]; color: string }[];
  labels: string[];
  height?: number;
  money?: boolean;
}) {
  const H = props.height ?? 180;
  const W = 640; // viewBox width; scales to container
  const padL = 46, padR = 10, padT = 12, padB = 22;
  const [hover, setHover] = useState<number | null>(null);

  const all = props.series.flatMap((s) => s.values);
  const max = Math.max(...all, 1);
  const min = Math.min(...all, 0);
  const range = max - min || 1;
  const n = props.labels.length;

  const x = (i: number) => padL + (i / Math.max(1, n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (v - min) / range) * (H - padT - padB);

  const paths = useMemo(
    () =>
      props.series.map((s) => {
        const pts = s.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
        const line = "M" + pts.join(" L");
        const area = `${line} L${x(s.values.length - 1).toFixed(1)},${y(Math.max(0, min)).toFixed(1)} L${x(0).toFixed(1)},${y(Math.max(0, min)).toFixed(1)} Z`;
        return { line, area };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [props.series, props.labels],
  );

  const ticks = [min, min + range / 2, max];

  return (
    <div style={{ position: "relative" }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", display: "block" }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - rect.left) / rect.width) * W;
          const i = Math.round(((px - padL) / (W - padL - padR)) * (n - 1));
          setHover(Math.max(0, Math.min(n - 1, i)));
        }}
      >
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth="1" />
            <text x={padL - 6} y={y(t) + 3.5} textAnchor="end" fontSize="9.5" fill="var(--text-3)">
              {props.money ? fmtCompact(t) : Math.round(t)}
            </text>
          </g>
        ))}
        {props.series.map((s, si) => (
          <g key={si}>
            <path d={paths[si].area} fill={s.color} opacity="0.09" />
            <path d={paths[si].line} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
          </g>
        ))}
        {props.labels.map((l, i) =>
          i % Math.ceil(n / 8) === 0 ? (
            <text key={i} x={x(i)} y={H - 6} textAnchor="middle" fontSize="9.5" fill="var(--text-3)">
              {l}
            </text>
          ) : null,
        )}
        {hover != null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={padT} y2={H - padB} stroke="var(--border-strong)" strokeWidth="1" strokeDasharray="3 3" />
            {props.series.map((s, si) => (
              <circle key={si} cx={x(hover)} cy={y(s.values[hover])} r="3.5" fill={s.color} stroke="var(--surface)" strokeWidth="1.5" />
            ))}
          </g>
        )}
      </svg>
      {hover != null && (
        <div
          className="chart-tooltip"
          style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: "translateX(-50%)" }}
        >
          <div className="faint" style={{ fontSize: 10 }}>{props.labels[hover]}</div>
          {props.series.map((s, si) => (
            <div key={si} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <i style={{ width: 7, height: 7, borderRadius: 99, background: s.color, display: "inline-block" }} />
              {s.label}: <b>{props.money ? fmtCompact(s.values[hover]) : s.values[hover]}</b>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 14, marginTop: 6 }}>
        {props.series.map((s, i) => (
          <span key={i} style={{ fontSize: 11, color: "var(--text-2)", display: "flex", alignItems: "center", gap: 5 }}>
            <i style={{ width: 8, height: 8, borderRadius: 99, background: s.color, display: "inline-block" }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ---------- horizontal bar ranking ---------- */
export function RankBars(props: {
  items: { label: string; value: number; display: string; tone?: "good" | "bad" }[];
}) {
  const max = Math.max(...props.items.map((i) => Math.abs(i.value)), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {props.items.map((it, i) => (
        <div key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, marginBottom: 3 }}>
            <span style={{ fontWeight: 550 }}>{it.label}</span>
            <span className={it.value < 0 ? "neg" : "muted"} style={{ fontVariantNumeric: "tabular-nums" }}>
              {it.display}
            </span>
          </div>
          <div className="bar">
            <i
              style={{
                width: `${(Math.abs(it.value) / max) * 100}%`,
                background: it.tone === "bad" || it.value < 0 ? "var(--red)" : it.tone === "good" ? "var(--green)" : "var(--accent)",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---------- donut ---------- */
export function Donut(props: {
  slices: { label: string; value: number; color: string }[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const size = props.size ?? 150;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const total = props.slices.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
  let acc = 0;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
          {props.slices.map((s, i) => {
            const frac = Math.max(0, s.value) / total;
            const off = acc; acc += frac;
            return (
              <circle
                key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke={s.color} strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, c * frac - 2)} ${c}`}
                strokeDashoffset={-c * off}
              />
            );
          })}
        </svg>
        {props.centerValue && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 750, letterSpacing: "-0.02em" }}>{props.centerValue}</div>
              <div style={{ fontSize: 9.5, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                {props.centerLabel}
              </div>
            </div>
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        {props.slices.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5 }}>
            <i style={{ width: 8, height: 8, borderRadius: 3, background: s.color, display: "inline-block" }} />
            <span className="muted">{s.label}</span>
            <b style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums", paddingLeft: 12 }}>
              {fmtCompact(s.value)}
            </b>
          </div>
        ))}
      </div>
    </div>
  );
}
