/* ============================================================================
 * ui.tsx — shared primitives: KPI tiles, badges, score dial, modal, toasts.
 * ========================================================================== */
import { type ReactNode, useEffect, useState } from "react";

/* ---------- KPI tile ---------- */
export function Kpi(props: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: "up" | "down" | "flat";
}) {
  return (
    <div className="card kpi">
      <div className="kpi-label">{props.label}</div>
      <div className="kpi-value">{props.value}</div>
      {props.delta && (
        <div className={`kpi-delta ${props.deltaTone ?? "flat"}`}>{props.delta}</div>
      )}
    </div>
  );
}

/* ---------- badge ---------- */
export type BadgeColor = "green" | "yellow" | "red" | "blue" | "purple" | "cyan" | "gray";

export function Badge(props: { color: BadgeColor; children: ReactNode; dot?: boolean }) {
  return (
    <span className={`badge ${props.color}`}>
      {props.dot && <i className="dot" />}
      {props.children}
    </span>
  );
}

export function gradeColor(score: number): BadgeColor {
  if (score >= 78) return "green";
  if (score >= 52) return "yellow";
  return "red";
}

export function healthColor(h: "good" | "watch" | "alert"): BadgeColor {
  return h === "good" ? "green" : h === "watch" ? "yellow" : "red";
}

/* ---------- score dial (SVG ring) ---------- */
export function ScoreDial(props: { score: number; grade: string; size?: number }) {
  const size = props.size ?? 84;
  const stroke = 8;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, props.score)) / 100;
  const color =
    props.score >= 78 ? "var(--green)" : props.score >= 52 ? "var(--yellow)" : "var(--red)";
  return (
    <div className="dial-wrap">
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke="var(--surface-3)" strokeWidth={stroke}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          style={{ transition: "stroke-dasharray 300ms var(--ease)" }}
        />
      </svg>
      <div>
        <div className="dial-num" style={{ color }}>{Math.round(props.score)}</div>
        <div className="dial-grade">Grade {props.grade}</div>
      </div>
    </div>
  );
}

/* ---------- progress bar ---------- */
export function Bar(props: { pct: number; tone?: "green" | "yellow" | "red" | "" }) {
  return (
    <div className={`bar ${props.tone ?? ""}`}>
      <i style={{ width: `${Math.max(0, Math.min(100, props.pct))}%` }} />
    </div>
  );
}

/* ---------- property cover art (generated, no photos needed) ---------- */
export function Cover(props: { hue: number; name: string; size?: number; radius?: number }) {
  const s = props.size ?? 38;
  return (
    <div
      style={{
        width: s, height: s, borderRadius: props.radius ?? 10, flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${props.hue} 65% 52%), hsl(${(props.hue + 40) % 360} 60% 38%))`,
        display: "grid", placeItems: "center",
        color: "#fff", fontWeight: 750, fontSize: s * 0.38,
        letterSpacing: "-0.02em",
      }}
    >
      {props.name.slice(0, 1)}
    </div>
  );
}

/* ---------- modal ---------- */
export function Modal(props: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [props.onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="modal">
        <div className="modal-title">{props.title}</div>
        {props.children}
      </div>
    </div>
  );
}

/* ---------- empty state ---------- */
export function Empty(props: { icon: string; title: string; sub?: string }) {
  return (
    <div className="empty">
      <div className="empty-icon">{props.icon}</div>
      <div style={{ fontWeight: 650, color: "var(--text-2)" }}>{props.title}</div>
      {props.sub && <div style={{ fontSize: 12, marginTop: 4 }}>{props.sub}</div>}
    </div>
  );
}

/* ---------- toasts (module-level bus, zero deps) ---------- */
type ToastMsg = { id: number; text: string };
let toastListeners: ((t: ToastMsg) => void)[] = [];
let toastSeq = 0;

export function toast(text: string): void {
  const t = { id: ++toastSeq, text };
  toastListeners.forEach((fn) => fn(t));
}

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  useEffect(() => {
    const fn = (t: ToastMsg) => {
      setToasts((prev) => [...prev, t]);
      setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== t.id)), 3200);
    };
    toastListeners.push(fn);
    return () => {
      toastListeners = toastListeners.filter((x) => x !== fn);
    };
  }, []);
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className="toast">{t.text}</div>
      ))}
    </div>
  );
}
