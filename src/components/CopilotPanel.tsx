/* ============================================================================
 * CopilotPanel.tsx — the JARVIS panel. Docked right, available on every page,
 * page-context aware, powered by Claude with local tools (ai/claude.ts).
 * ========================================================================== */
import { useEffect, useRef, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { runCopilot, type ChatTurn } from "@/ai/claude";
import { useStore } from "@/store/store";

interface ViewMsg {
  kind: "user" | "ai" | "tool" | "error";
  text: string;
}

/* ---------- minimal markdown → HTML (escape first; bold/code/lists/tables) */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function mdToHtml(src: string): string {
  const lines = esc(src).split("\n");
  const out: string[] = [];
  let inList = false, inOl = false, inTable = false;

  const closeAll = () => {
    if (inList) { out.push("</ul>"); inList = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
    if (inTable) { out.push("</table>"); inTable = false; }
  };

  const inline = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (/^\|.*\|$/.test(line.trim())) {
      const cells = line.trim().slice(1, -1).split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separator row
      if (!inTable) { closeAll(); out.push("<table>"); inTable = true;
        out.push("<tr>" + cells.map((c) => `<th>${inline(c)}</th>`).join("") + "</tr>");
      } else {
        out.push("<tr>" + cells.map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>");
      }
      continue;
    }
    if (inTable) { out.push("</table>"); inTable = false; }

    const h = /^(#{1,4})\s+(.*)/.exec(line);
    if (h) { closeAll(); out.push(`<p><strong>${inline(h[2])}</strong></p>`); continue; }

    const li = /^[-*]\s+(.*)/.exec(line);
    if (li) {
      if (!inList) { closeAll(); out.push("<ul>"); inList = true; }
      out.push(`<li>${inline(li[1])}</li>`);
      continue;
    }
    const ol = /^\d+\.\s+(.*)/.exec(line);
    if (ol) {
      if (!inOl) { closeAll(); out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    closeAll();
    if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  closeAll();
  return out.join("");
}

/* ---------- page-aware suggestion chips ---------- */
function suggestionsFor(path: string): string[] {
  if (path.startsWith("/pipeline"))
    return [
      "What should I focus on to move deals forward this week?",
      "Which pipeline deal has the best BRRRR score?",
      "Summarize the Norfolk Triplex deal and its conditions",
    ];
  if (path.startsWith("/properties/"))
    return [
      "How is this property performing vs my targets?",
      "What would cash flow look like if rates drop 1%?",
      "Add a note summarizing today's status",
    ];
  if (path.startsWith("/renovation"))
    return [
      "Which renovation is at risk and why?",
      "Where is the Queen St budget going over?",
      "What should I do about the blocked bathroom work?",
    ];
  if (path.startsWith("/refinance"))
    return [
      "Which property should I refinance first?",
      "How much total capital could I pull out this quarter?",
      "What happens to my cash flow if I refi Maple Fourplex at 70% LTV?",
    ];
  if (path.startsWith("/financials"))
    return [
      "How much cash have I invested across the portfolio?",
      "What were my biggest expenses this month?",
      "Which property has the worst expense ratio?",
    ];
  if (path.startsWith("/tenants"))
    return [
      "Who is behind on rent and what's the exposure?",
      "Which leases expire in the next 60 days?",
      "Draft a plan for the late tenant at Birch Duplex",
    ];
  if (path.startsWith("/analytics"))
    return [
      "Rank my properties best to worst and explain why",
      "Which property is underperforming?",
      "Where is my equity concentrated?",
    ];
  return [
    "What needs my attention today?",
    "Which property is underperforming?",
    "What should I buy next, based on my portfolio?",
    "Which property should I refinance?",
  ];
}

function pageContext(path: string): string {
  if (path === "/") return "the Dashboard (portfolio overview)";
  if (path.startsWith("/properties/")) return `a Property Detail page (property id: ${path.split("/")[2]})`;
  const name = path.split("/")[1];
  return `the ${name.charAt(0).toUpperCase() + name.slice(1)} page`;
}

export function CopilotPanel(props: { onClose: () => void }) {
  const location = useLocation();
  const apiKey = useStore((s) => s.settings.apiKey);
  const [msgs, setMsgs] = useState<ViewMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const historyRef = useRef<ChatTurn[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { kind: "user", text: q }]);
    setBusy(true);
    historyRef.current = await runCopilot(
      historyRef.current,
      q,
      pageContext(location.pathname),
      (e) => {
        if (e.type === "text" && e.text) setMsgs((m) => [...m, { kind: "ai", text: e.text! }]);
        if (e.type === "tool") setMsgs((m) => [...m, { kind: "tool", text: e.toolName ?? "" }]);
        if (e.type === "error" && e.text) setMsgs((m) => [...m, { kind: "error", text: e.text! }]);
      },
    );
    setBusy(false);
    taRef.current?.focus();
  };

  return (
    <aside className="copilot">
      <div className="copilot-head">
        <div className="copilot-title">
          <span className="copilot-spark">✦</span> Copilot
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 4 }}>
          <button
            className="iconbtn" title="New conversation"
            onClick={() => { historyRef.current = []; setMsgs([]); }}
          >⟳</button>
          <button className="iconbtn" title="Close (⌘J)" onClick={props.onClose}>✕</button>
        </div>
      </div>

      <div className="copilot-body" ref={bodyRef}>
        {msgs.length === 0 && (
          <>
            <div style={{ fontSize: 12.5, color: "var(--text-2)", lineHeight: 1.6 }}>
              Ask anything about your portfolio — I read the same live data the app
              shows: underwriting, cash flow, renovations, refis, tenants.
              {!apiKey && (
                <div style={{ marginTop: 10 }}>
                  <span className="badge yellow">Setup needed</span>{" "}
                  <span>
                    Add your Anthropic API key in{" "}
                    <Link to="/settings">Settings</Link> to bring me online.
                  </span>
                </div>
              )}
            </div>
            <div className="copilot-suggestions">
              {suggestionsFor(location.pathname).map((s, i) => (
                <button key={i} className="suggestion" onClick={() => send(s)}>{s}</button>
              ))}
            </div>
          </>
        )}

        {msgs.map((m, i) =>
          m.kind === "user" ? (
            <div key={i} className="msg msg-user">{m.text}</div>
          ) : m.kind === "tool" ? (
            <div key={i} className="msg-tool">⚙ {m.text}</div>
          ) : m.kind === "error" ? (
            <div key={i} className="msg msg-ai" style={{ color: "var(--red)" }}>{m.text}</div>
          ) : (
            <div key={i} className="msg msg-ai">
              <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(m.text) }} />
            </div>
          ),
        )}

        {busy && (
          <div className="thinking"><i /><i /><i /></div>
        )}
      </div>

      <div className="copilot-foot">
        <div className="copilot-input">
          <textarea
            ref={taRef}
            rows={1}
            placeholder="Ask your portfolio anything…"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(120, e.target.scrollHeight) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
          />
          <button
            className="copilot-send"
            disabled={busy || !input.trim()}
            onClick={() => void send(input)}
            title="Send"
          >↑</button>
        </div>
      </div>
    </aside>
  );
}
