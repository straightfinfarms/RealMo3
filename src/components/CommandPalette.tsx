/* ============================================================================
 * CommandPalette.tsx — ⌘K. Navigate anywhere, jump to any property, toggle
 * theme, open the copilot. Minimal clicks — the Superhuman way.
 * ========================================================================== */
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useStore } from "@/store/store";
import { STAGE_LABELS } from "@/data/types";

interface Cmd {
  id: string;
  icon: string;
  label: string;
  hint?: string;
  run: () => void;
}

export function CommandPalette(props: {
  onClose: () => void;
  toggleTheme: () => void;
  toggleCopilot: () => void;
}) {
  const nav = useNavigate();
  const properties = useStore((s) => s.properties);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const cmds = useMemo<Cmd[]>(() => {
    const go = (path: string) => () => { nav(path); props.onClose(); };
    const base: Cmd[] = [
      { id: "dash", icon: "◧", label: "Go to Dashboard", hint: "G D", run: go("/") },
      { id: "pipe", icon: "⇶", label: "Go to Pipeline", hint: "G P", run: go("/pipeline") },
      { id: "props", icon: "⌂", label: "Go to Properties", run: go("/properties") },
      { id: "anlz", icon: "∑", label: "Go to Deal Analyzer", hint: "G A", run: go("/analyzer") },
      { id: "reno", icon: "🛠", label: "Go to Renovation", run: go("/renovation") },
      { id: "fin", icon: "$", label: "Go to Financials", run: go("/financials") },
      { id: "refi", icon: "↻", label: "Go to Refinance", run: go("/refinance") },
      { id: "ten", icon: "👥", label: "Go to Tenants", run: go("/tenants") },
      { id: "ana", icon: "◔", label: "Go to Analytics", run: go("/analytics") },
      { id: "docs", icon: "▤", label: "Go to Documents", run: go("/documents") },
      { id: "set", icon: "⚙", label: "Go to Settings", run: go("/settings") },
      {
        id: "theme", icon: "◐", label: "Toggle dark / light theme", hint: "⌘⇧L",
        run: () => { props.toggleTheme(); props.onClose(); },
      },
      {
        id: "copilot", icon: "✦", label: "Toggle AI Copilot", hint: "⌘J",
        run: () => { props.toggleCopilot(); props.onClose(); },
      },
    ];
    const props_: Cmd[] = properties
      .filter((p) => !p.archived)
      .map((p) => ({
        id: "p-" + p.id,
        icon: "⌂",
        label: `${p.name} — ${p.address}`,
        hint: STAGE_LABELS[p.stage],
        run: go(`/properties/${p.id}`),
      }));
    return [...base, ...props_];
  }, [properties, nav, props]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return cmds;
    return cmds.filter((c) => c.label.toLowerCase().includes(needle));
  }, [q, cmds]);

  useEffect(() => setSel(0), [q]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(filtered.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); filtered[sel]?.run(); }
    else if (e.key === "Escape") props.onClose();
  };

  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && props.onClose()}>
      <div className="palette">
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command or search properties…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKey}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-empty">No matches</div>}
          {filtered.map((c, i) => (
            <button
              key={c.id}
              className={`palette-item ${i === sel ? "sel" : ""}`}
              onMouseEnter={() => setSel(i)}
              onClick={c.run}
            >
              <span className="ico">{c.icon}</span>
              <span>{c.label}</span>
              {c.hint && <span className="hint">{c.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
