/* ============================================================================
 * persistence.ts — storage adapter: SQLite backend when available,
 * localStorage always (as cache + offline fallback).
 *
 *   boot   → GET /api/state   (backend wins if it has data)
 *   write  → localStorage immediately + debounced PUT /api/state
 *
 * The deployed static site (GitHub Pages) has no /api — health fails fast and
 * the app runs pure local-first, exactly as before.
 * ========================================================================== */
import type { StateStorage } from "zustand/middleware";

export interface BackendStatus {
  connected: boolean;
  serverAiKey: boolean;
  dbPath?: string;
}

let status: BackendStatus = { connected: false, serverAiKey: false };
const listeners = new Set<(s: BackendStatus) => void>();

export const getBackendStatus = (): BackendStatus => status;
export function onBackendStatus(fn: (s: BackendStatus) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function setStatus(s: BackendStatus) {
  status = s;
  listeners.forEach((fn) => fn(s));
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 1200): Promise<Response> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctl.signal });
  } finally {
    clearTimeout(t);
  }
}

export async function checkBackend(): Promise<BackendStatus> {
  try {
    const res = await fetchWithTimeout("/api/health");
    if (res.ok) {
      const j = (await res.json()) as { serverAiKey?: boolean; db?: string };
      setStatus({ connected: true, serverAiKey: !!j.serverAiKey, dbPath: j.db });
    } else {
      setStatus({ connected: false, serverAiKey: false });
    }
  } catch {
    setStatus({ connected: false, serverAiKey: false });
  }
  return status;
}

/* ---------- debounced push to the backend ---------- */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let pendingValue: string | null = null;

function schedulePush() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    void (async () => {
      if (!status.connected || pendingValue == null) return;
      try {
        const parsed = JSON.parse(pendingValue) as { state?: Record<string, unknown> };
        if (!parsed.state) return;
        await fetchWithTimeout("/api/state", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(parsed.state),
        }, 5000);
      } catch {
        /* backend went away — localStorage still has everything */
        void checkBackend();
      }
    })();
  }, 800);
}

/** zustand persist storage: async getItem hydrates from the backend. */
export const hybridStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const local = localStorage.getItem(name);
    const health = await checkBackend();
    if (health.connected) {
      try {
        const res = await fetchWithTimeout("/api/state", {}, 3000);
        if (res.status === 200) {
          const state = (await res.json()) as Record<string, unknown>;
          // Preserve browser-only fields (API key never round-trips the DB).
          if (local) {
            try {
              const localState = (JSON.parse(local) as { state?: { settings?: { apiKey?: string; theme?: string } } }).state;
              const settings = (state.settings ?? {}) as Record<string, unknown>;
              if (localState?.settings?.apiKey) settings.apiKey = localState.settings.apiKey;
              state.settings = settings;
            } catch { /* ignore */ }
          }
          return JSON.stringify({ state, version: 1 });
        }
        // 204 — backend empty: fall through to local (first write seeds the DB)
      } catch { /* fall through */ }
    }
    return local;
  },

  setItem: (name: string, value: string): void => {
    localStorage.setItem(name, value);
    pendingValue = value;
    if (status.connected) schedulePush();
  },

  removeItem: (name: string): void => {
    localStorage.removeItem(name);
  },
};
