/* ============================================================================
 * Settings — AI copilot config, investor targets, theme, data management.
 * ========================================================================== */
import { useEffect, useRef, useState } from "react";
import { useStore, dataSnapshot } from "@/store/store";
import { toast } from "@/components/ui";
import { Badge } from "@/components/ui";
import type { AppData } from "@/data/types";
import { checkBackend, getBackendStatus, onBackendStatus, type BackendStatus } from "@/store/persistence";

const MODELS = [
  { id: "claude-sonnet-5", label: "Claude Sonnet 5 — fast + smart (recommended)" },
  { id: "claude-opus-4-8", label: "Claude Opus 4.8 — deepest reasoning" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5 — fastest, cheapest" },
];

export function Settings() {
  const settings = useStore((s) => s.settings);
  const setSettings = useStore((s) => s.setSettings);
  const resetToSeed = useStore((s) => s.resetToSeed);
  const clearAll = useStore((s) => s.clearAll);
  const importData = useStore((s) => s.importData);
  const [showKey, setShowKey] = useState(false);
  const [backend, setBackend] = useState<BackendStatus>(getBackendStatus());
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void checkBackend();
    return onBackendStatus(setBackend);
  }, []);

  const exportData = () => {
    const blob = new Blob([JSON.stringify(dataSnapshot(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `brrrr-os-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Portfolio exported");
  };

  const onImportFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result)) as AppData;
        if (!Array.isArray(data.properties)) throw new Error("not a BRRRR OS export");
        importData(data);
        toast("Portfolio imported");
      } catch (e) {
        toast("Import failed — not a valid BRRRR OS export");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <div className="page-head">
        <div>
          <div className="section-title">Settings</div>
          <div className="section-sub">Copilot, targets, appearance and your data</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">⛁ Data backend</div>
            <div className="card-sub">
              Run <code className="mono">npm run server</code> to store everything in a real SQLite
              database instead of only this browser.
            </div>
          </div>
          <span className="spacer" />
          <Badge color={backend.connected ? "green" : "gray"} dot>
            {backend.connected ? "SQLite connected" : "Browser-only mode"}
          </Badge>
        </div>
        {backend.connected ? (
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
            Database: <code className="mono">{backend.dbPath}</code>
            <br />
            Every change is written to SQLite (source of truth) and mirrored to this browser
            as an offline cache. Server-side AI key:{" "}
            {backend.serverAiKey ? (
              <Badge color="green">configured — browser key not needed</Badge>
            ) : (
              <Badge color="yellow">not set — add ANTHROPIC_API_KEY to server/.env</Badge>
            )}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: "var(--text-2)", lineHeight: 1.6 }}>
            Data lives in this browser's localStorage (export below for backups). Start the
            backend with <code className="mono">npm run server</code> and reload to upgrade to SQLite.
          </div>
        )}
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">✦ AI Copilot</div>
            <div className="card-sub">
              {backend.connected && backend.serverAiKey
                ? "The backend proxies Claude with its own key (server/.env) — no browser key needed. A browser key below overrides it."
                : "Your key is stored only in this browser's localStorage and sent directly to Anthropic — no middleman server. Get a key at console.anthropic.com."}
            </div>
          </div>
        </div>
        <div className="field">
          <label>Anthropic API key</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              type={showKey ? "text" : "password"}
              placeholder="sk-ant-…"
              value={settings.apiKey}
              onChange={(e) => setSettings({ apiKey: e.target.value.trim() })}
              style={{ flex: 1 }}
            />
            <button className="btn ghost" onClick={() => setShowKey((v) => !v)}>
              {showKey ? "Hide" : "Show"}
            </button>
          </div>
        </div>
        <div className="field" style={{ marginTop: 12 }}>
          <label>Model</label>
          <select value={settings.model} onChange={(e) => setSettings({ model: e.target.value })}>
            {MODELS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Investor profile & targets</div>
            <div className="card-sub">Drive scoring, pricepoints and the refi scanner</div>
          </div>
        </div>
        <div className="grid g2">
          <div className="field">
            <label>Your name</label>
            <input value={settings.investorName}
              onChange={(e) => setSettings({ investorName: e.target.value })} />
          </div>
          <div className="field">
            <label>Market refi rate %</label>
            <input type="number" step={0.05} value={settings.marketRefiRatePct}
              onChange={(e) => setSettings({ marketRefiRatePct: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field">
            <label>Target cash flow / unit / mo ($)</label>
            <input type="number" value={settings.targetCashflowPerUnit}
              onChange={(e) => setSettings({ targetCashflowPerUnit: parseFloat(e.target.value) || 0 })} />
          </div>
          <div className="field">
            <label>Target cash-on-cash %</label>
            <input type="number" value={settings.targetCoCPct}
              onChange={(e) => setSettings({ targetCoCPct: parseFloat(e.target.value) || 0 })} />
          </div>
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="card-head"><div className="card-title">Appearance</div></div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["dark", "light"] as const).map((t) => (
            <button key={t}
              className={`btn ${settings.theme === t ? "" : "ghost"}`}
              onClick={() => setSettings({ theme: t })}>
              {t === "dark" ? "☾ Dark" : "☀ Light"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 14 }} />

      <div className="card">
        <div className="card-head">
          <div>
            <div className="card-title">Your data</div>
            <div className="card-sub">Everything lives in this browser. Export for backup, import to restore.</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn ghost" onClick={exportData}>⬇ Export JSON</button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>⬆ Import JSON</button>
          <button
            className="btn ghost"
            onClick={() => {
              if (confirm("Start fresh with an EMPTY portfolio? All demo/current data is removed (export first if unsure). Your API key and preferences are kept.")) {
                clearAll();
                toast("Fresh start — add your first property from the Properties page");
              }
            }}
          >
            ✨ Start fresh (my own portfolio)
          </button>
          <button
            className="btn danger"
            onClick={() => {
              if (confirm("Replace all data with the demo portfolio? Your API key and preferences are kept.")) {
                resetToSeed();
                toast("Reset to demo portfolio");
              }
            }}
          >
            Reset to demo data
          </button>
          <input
            ref={fileRef} type="file" accept="application/json" hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div style={{ height: 14 }} />
      <div className="faint" style={{ fontSize: 11.5, lineHeight: 1.6 }}>
        BRRRR OS v3 · local-first build · underwriting engine evolved from RealMo v1.
        This is an underwriting aid, not financial advice — verify rents, comps, taxes,
        insurance and lender terms before making offers.
      </div>
    </div>
  );
}
