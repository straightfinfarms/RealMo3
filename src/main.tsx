import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/app.css";

// Apply theme before first paint to avoid flash.
try {
  const persisted = localStorage.getItem("brrrr-os-v3");
  const theme = persisted ? JSON.parse(persisted)?.state?.settings?.theme : null;
  document.documentElement.dataset.theme = theme === "light" ? "light" : "dark";
} catch {
  document.documentElement.dataset.theme = "dark";
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
