/* ============================================================================
 * App.tsx — the shell. Sidebar + topbar + routed content + copilot panel.
 * ========================================================================== */
import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { useStore } from "@/store/store";
import { CommandPalette } from "@/components/CommandPalette";
import { CopilotPanel } from "@/components/CopilotPanel";
import { ToastHost } from "@/components/ui";
import { Dashboard } from "@/pages/Dashboard";
import { Pipeline } from "@/pages/Pipeline";
import { Properties } from "@/pages/Properties";
import { PropertyDetail } from "@/pages/PropertyDetail";
import { Analyzer } from "@/pages/Analyzer";
import { Renovation } from "@/pages/Renovation";
import { RenoEstimator } from "@/pages/RenoEstimator";
import { Financials } from "@/pages/Financials";
import { Refinance } from "@/pages/Refinance";
import { Tenants } from "@/pages/Tenants";
import { Analytics } from "@/pages/Analytics";
import { Documents } from "@/pages/Documents";
import { Settings } from "@/pages/Settings";
import { OWNED_STAGES } from "@/data/types";

const NAV = [
  { section: "Command", items: [
    { to: "/", icon: "◧", label: "Dashboard" },
    { to: "/pipeline", icon: "⇶", label: "Pipeline" },
    { to: "/analyzer", icon: "∑", label: "Deal Analyzer" },
  ]},
  { section: "Portfolio", items: [
    { to: "/properties", icon: "⌂", label: "Properties" },
    { to: "/renovation", icon: "🛠", label: "Renovation" },
    { to: "/estimator", icon: "∑", label: "Reno Estimator" },
    { to: "/tenants", icon: "👥", label: "Tenants" },
  ]},
  { section: "Capital", items: [
    { to: "/financials", icon: "$", label: "Financials" },
    { to: "/refinance", icon: "↻", label: "Refinance" },
    { to: "/analytics", icon: "◔", label: "Analytics" },
  ]},
  { section: "Library", items: [
    { to: "/documents", icon: "▤", label: "Documents" },
  ]},
];

const TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/pipeline": "BRRRR Pipeline",
  "/analyzer": "Deal Analyzer",
  "/properties": "Properties",
  "/renovation": "Renovation OS",
  "/estimator": "Renovation Estimator",
  "/tenants": "Tenants",
  "/financials": "Financials",
  "/refinance": "Refinance Engine",
  "/analytics": "Portfolio Analytics",
  "/documents": "Documents",
  "/settings": "Settings",
};

function Topbar(props: { openPalette: () => void; toggleTheme: () => void; toggleCopilot: () => void; copilotOpen: boolean }) {
  const location = useLocation();
  const properties = useStore((s) => s.properties);
  let title = TITLES[location.pathname];
  if (!title && location.pathname.startsWith("/properties/")) {
    const p = properties.find((x) => x.id === location.pathname.split("/")[2]);
    title = p ? p.name : "Property";
  }
  const theme = useStore((s) => s.settings.theme);
  return (
    <div className="topbar">
      <div className="topbar-title">
        {location.pathname.startsWith("/properties/") && (
          <span className="topbar-crumb">Properties / </span>
        )}
        {title ?? "BRRRR OS"}
      </div>
      <div className="topbar-actions">
        <button className="searchbtn" onClick={props.openPalette}>
          <span>⌕</span> Search or command… <span className="kbd">⌘K</span>
        </button>
        <button className="iconbtn" title="Toggle theme (⌘⇧L)" onClick={props.toggleTheme}>
          {theme === "dark" ? "☾" : "☀"}
        </button>
        <button
          className={`iconbtn ${props.copilotOpen ? "active" : ""}`}
          title="AI Copilot (⌘J)"
          onClick={props.toggleCopilot}
        >✦</button>
      </div>
    </div>
  );
}

function Shell() {
  const theme = useStore((s) => s.settings.theme);
  const setSettings = useStore((s) => s.setSettings);
  const properties = useStore((s) => s.properties);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(true);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const toggleTheme = () => setSettings({ theme: theme === "dark" ? "light" : "dark" });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === "l") {
        e.preventDefault();
        toggleTheme();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const active = properties.filter((p) => !p.archived);
  const ownedCount = active.filter((p) => OWNED_STAGES.includes(p.stage)).length;
  const pipelineCount = active.length - ownedCount;
  const counts: Record<string, number> = {
    "/properties": ownedCount,
    "/pipeline": pipelineCount,
  };

  return (
    <div className={`shell ${copilotOpen ? "with-copilot" : ""}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-logo">B</div>
          <div>
            <div className="brand-name">BRRRR OS</div>
            <div className="brand-sub">Investor Command Center</div>
          </div>
        </div>
        {NAV.map((sec) => (
          <div className="nav-section" key={sec.section}>
            <div className="nav-label">{sec.section}</div>
            {sec.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}
                end={it.to === "/"}
              >
                <span className="ico">{it.icon}</span>
                <span>{it.label}</span>
                {counts[it.to] != null && <span className="count">{counts[it.to]}</span>}
              </NavLink>
            ))}
          </div>
        ))}
        <div className="sidebar-footer">
          <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? "active" : ""}`}>
            <span className="ico">⚙</span>
            <span>Settings</span>
          </NavLink>
        </div>
      </aside>

      <div className="main">
        <Topbar
          openPalette={() => setPaletteOpen(true)}
          toggleTheme={toggleTheme}
          toggleCopilot={() => setCopilotOpen((v) => !v)}
          copilotOpen={copilotOpen}
        />
        <div className="content">
          <div className="content-inner">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/analyzer" element={<Analyzer />} />
              <Route path="/analyzer/:id" element={<Analyzer />} />
              <Route path="/properties" element={<Properties />} />
              <Route path="/properties/:id" element={<PropertyDetail />} />
              <Route path="/renovation" element={<Renovation />} />
              <Route path="/estimator" element={<RenoEstimator />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/financials" element={<Financials />} />
              <Route path="/refinance" element={<Refinance />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </div>
        </div>
      </div>

      {copilotOpen && <CopilotPanel onClose={() => setCopilotOpen(false)} />}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          toggleTheme={toggleTheme}
          toggleCopilot={() => setCopilotOpen((v) => !v)}
        />
      )}
      <ToastHost />
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Shell />
    </HashRouter>
  );
}
