/* ============================================================================
 * server/index.ts — BRRRR OS local backend.
 *
 *   GET  /api/health        — liveness + whether a server-side AI key is set
 *   GET  /api/state         — full portfolio snapshot (assembled from SQLite)
 *   PUT  /api/state         — persist snapshot (decomposed into real tables)
 *   GET  /api/:table        — inspect any entity table directly (read-only)
 *   POST /api/copilot       — Claude proxy: browser never needs the API key
 *
 * Run:  npm run server      (defaults to http://localhost:8787)
 * The Vite dev server proxies /api → :8787, so the app just works.
 * ========================================================================== */
import Fastify from "fastify";
import cors from "@fastify/cors";
import "dotenv/config";
import { assembleState, writeState, db, DB_PATH } from "./db.js";

const PORT = Number(process.env.PORT ?? 8787);
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY ?? "";

const app = Fastify({ logger: false });
await app.register(cors, { origin: true });

app.get("/api/health", async () => ({
  ok: true,
  db: DB_PATH,
  serverAiKey: Boolean(ANTHROPIC_KEY),
}));

app.get("/api/state", async (_req, reply) => {
  const state = assembleState();
  if (!state) return reply.code(204).send(); // empty DB — client seeds itself
  return state;
});

app.put("/api/state", async (req, reply) => {
  const body = req.body as Record<string, unknown> | null;
  if (!body || !Array.isArray(body.properties)) {
    return reply.code(400).send({ error: "expected a full AppData snapshot" });
  }
  writeState(body);
  return { ok: true };
});

/** Read-only table inspection — handy for debugging and future integrations. */
const TABLES = [
  "properties", "loans", "tenants", "renovations", "contractors",
  "transactions", "docs", "timeline", "todos",
] as const;
for (const t of TABLES) {
  app.get(`/api/${t}`, async () => db.prepare(`SELECT * FROM ${t}`).all());
}

/** Claude proxy — the browser sends messages/tools; the key stays in .env. */
app.post("/api/copilot", async (req, reply) => {
  if (!ANTHROPIC_KEY) {
    return reply.code(503).send({
      error: { message: "No ANTHROPIC_API_KEY set on the server — add it to server/.env, or set a browser key in Settings." },
    });
  }
  const body = req.body as Record<string, unknown>;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: body.model ?? "claude-sonnet-5",
      max_tokens: body.max_tokens ?? 2048,
      system: body.system,
      tools: body.tools,
      messages: body.messages,
    }),
  });
  const json = await res.json();
  return reply.code(res.status).send(json);
});

await app.listen({ port: PORT, host: "127.0.0.1" });
console.log(`\n  BRRRR OS backend → http://localhost:${PORT}`);
console.log(`  SQLite database  → ${DB_PATH}`);
console.log(`  Server AI key    → ${ANTHROPIC_KEY ? "configured ✓" : "not set (browser key or server/.env)"}\n`);
