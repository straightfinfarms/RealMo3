/* ============================================================================
 * server/db.ts — SQLite persistence layer.
 *
 * Real relational tables (inspect with `sqlite3 server/brrrr.db`), one row per
 * entity, JSON columns only for genuinely embedded structures (a property's
 * underwriting inputs, a renovation's budget lines/tasks). The schema mirrors
 * src/data/types.ts 1:1 and ports directly to Postgres (BLUEPRINT §5).
 * ========================================================================== */
import Database from "better-sqlite3";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.BRRRR_DB ?? path.join(dir, "brrrr.db");

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  property_type TEXT NOT NULL,
  stage TEXT NOT NULL,
  stage_entered_date TEXT NOT NULL,
  year_built INTEGER,
  sqft INTEGER,
  photo_hue INTEGER NOT NULL DEFAULT 210,
  current_value REAL NOT NULL DEFAULT 0,
  purchase_date TEXT,
  actual_rehab_spent REAL,
  notes TEXT,
  archived INTEGER NOT NULL DEFAULT 0,
  underwriting TEXT NOT NULL DEFAULT '{}'   -- JSON: Underwriting inputs
);

CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  lender TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'acquisition',
  original_amount REAL NOT NULL DEFAULT 0,
  current_balance REAL NOT NULL DEFAULT 0,
  rate_pct REAL NOT NULL DEFAULT 0,
  term_years REAL NOT NULL DEFAULT 30,
  start_date TEXT NOT NULL DEFAULT '',
  monthly_payment REAL NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS tenants (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  unit_label TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  rent REAL NOT NULL DEFAULT 0,
  lease_start TEXT NOT NULL DEFAULT '',
  lease_end TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'current',
  balance_owed REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS renovations (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planning',
  start_date TEXT NOT NULL DEFAULT '',
  target_end_date TEXT NOT NULL DEFAULT '',
  scenario TEXT NOT NULL DEFAULT 'standard',
  budget_lines TEXT NOT NULL DEFAULT '[]',  -- JSON: BudgetLine[]
  tasks TEXT NOT NULL DEFAULT '[]'          -- JSON: RenoTask[]
);

CREATE TABLE IF NOT EXISTS contractors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  trade TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  rating REAL NOT NULL DEFAULT 0,
  insurance_on_file INTEGER NOT NULL DEFAULT 0,
  license_on_file INTEGER NOT NULL DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'misc_expense',
  description TEXT NOT NULL DEFAULT '',
  amount REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS docs (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'other',
  added_date TEXT NOT NULL DEFAULT '',
  note TEXT,
  ai_summary TEXT
);

CREATE TABLE IF NOT EXISTS timeline (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  date TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  body TEXT,
  kind TEXT NOT NULL DEFAULT 'note'
);

CREATE TABLE IF NOT EXISTS todos (
  id TEXT PRIMARY KEY,
  property_id TEXT REFERENCES properties(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '',
  done INTEGER NOT NULL DEFAULT 0,
  due_date TEXT,
  stage TEXT
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data TEXT NOT NULL DEFAULT '{}'           -- JSON: Settings (never the API key)
);

CREATE INDEX IF NOT EXISTS idx_loans_property ON loans(property_id);
CREATE INDEX IF NOT EXISTS idx_tenants_property ON tenants(property_id);
CREATE INDEX IF NOT EXISTS idx_txns_property ON transactions(property_id);
CREATE INDEX IF NOT EXISTS idx_txns_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_timeline_property ON timeline(property_id);
`);

/* ---------- snapshot assembly (GET /api/state) ---------- */

const j = <T>(s: string, fallback: T): T => {
  try { return JSON.parse(s) as T; } catch { return fallback; }
};
const bool = (v: unknown): boolean => v === 1 || v === true;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

export function assembleState(): Row | null {
  const props = db.prepare("SELECT * FROM properties").all() as Row[];
  const settingsRow = db.prepare("SELECT data FROM settings WHERE id = 1").get() as Row | undefined;
  if (props.length === 0 && !settingsRow) return null; // empty DB → let client seed

  return {
    properties: props.map((r) => ({
      id: r.id, name: r.name, address: r.address, city: r.city,
      propertyType: r.property_type, stage: r.stage,
      stageEnteredDate: r.stage_entered_date,
      yearBuilt: r.year_built ?? undefined, sqft: r.sqft ?? undefined,
      photoHue: r.photo_hue, currentValue: r.current_value,
      purchaseDate: r.purchase_date ?? undefined,
      actualRehabSpent: r.actual_rehab_spent ?? undefined,
      notes: r.notes ?? undefined,
      archived: bool(r.archived) || undefined,
      underwriting: j(r.underwriting, {}),
    })),
    loans: (db.prepare("SELECT * FROM loans").all() as Row[]).map((r) => ({
      id: r.id, propertyId: r.property_id, lender: r.lender, kind: r.kind,
      originalAmount: r.original_amount, currentBalance: r.current_balance,
      ratePct: r.rate_pct, termYears: r.term_years, startDate: r.start_date,
      monthlyPayment: r.monthly_payment, active: bool(r.active),
    })),
    tenants: (db.prepare("SELECT * FROM tenants").all() as Row[]).map((r) => ({
      id: r.id, propertyId: r.property_id, unitLabel: r.unit_label, name: r.name,
      email: r.email, phone: r.phone, rent: r.rent,
      leaseStart: r.lease_start, leaseEnd: r.lease_end,
      status: r.status, balanceOwed: r.balance_owed,
    })),
    renovations: (db.prepare("SELECT * FROM renovations").all() as Row[]).map((r) => ({
      id: r.id, propertyId: r.property_id, name: r.name, status: r.status,
      startDate: r.start_date, targetEndDate: r.target_end_date,
      scenario: r.scenario,
      budgetLines: j(r.budget_lines, []), tasks: j(r.tasks, []),
    })),
    contractors: (db.prepare("SELECT * FROM contractors").all() as Row[]).map((r) => ({
      id: r.id, name: r.name, trade: r.trade, phone: r.phone, email: r.email,
      rating: r.rating, insuranceOnFile: bool(r.insurance_on_file),
      licenseOnFile: bool(r.license_on_file), notes: r.notes ?? undefined,
    })),
    transactions: (db.prepare("SELECT * FROM transactions").all() as Row[]).map((r) => ({
      id: r.id, propertyId: r.property_id, date: r.date,
      category: r.category, description: r.description, amount: r.amount,
    })),
    docs: (db.prepare("SELECT * FROM docs").all() as Row[]).map((r) => ({
      id: r.id, propertyId: r.property_id, name: r.name, kind: r.kind,
      addedDate: r.added_date, note: r.note ?? undefined,
      aiSummary: r.ai_summary ?? undefined,
    })),
    timeline: (db.prepare("SELECT * FROM timeline").all() as Row[]).map((r) => ({
      id: r.id, propertyId: r.property_id, date: r.date, title: r.title,
      body: r.body ?? undefined, kind: r.kind,
    })),
    todos: (db.prepare("SELECT * FROM todos").all() as Row[]).map((r) => ({
      id: r.id, propertyId: r.property_id, title: r.title, done: bool(r.done),
      dueDate: r.due_date ?? undefined, stage: r.stage ?? undefined,
    })),
    settings: j(settingsRow?.data ?? "{}", {}),
  };
}

/* ---------- snapshot decomposition (PUT /api/state) ---------- */

export const writeState = db.transaction((s: Row) => {
  // Order matters for FK cascade — children first on wipe, parents first on insert.
  for (const t of ["timeline", "todos", "docs", "transactions", "renovations", "tenants", "loans", "properties"]) {
    db.prepare(`DELETE FROM ${t}`).run();
  }

  const ip = db.prepare(`INSERT INTO properties
    (id, name, address, city, property_type, stage, stage_entered_date, year_built,
     sqft, photo_hue, current_value, purchase_date, actual_rehab_spent, notes, archived, underwriting)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const p of s.properties ?? []) {
    ip.run(p.id, p.name, p.address ?? "", p.city ?? "", p.propertyType, p.stage,
      p.stageEnteredDate, p.yearBuilt ?? null, p.sqft ?? null, p.photoHue ?? 210,
      p.currentValue ?? 0, p.purchaseDate ?? null, p.actualRehabSpent ?? null,
      p.notes ?? null, p.archived ? 1 : 0, JSON.stringify(p.underwriting ?? {}));
  }

  const il = db.prepare(`INSERT INTO loans
    (id, property_id, lender, kind, original_amount, current_balance, rate_pct,
     term_years, start_date, monthly_payment, active) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const l of s.loans ?? []) {
    il.run(l.id, l.propertyId, l.lender ?? "", l.kind ?? "acquisition",
      l.originalAmount ?? 0, l.currentBalance ?? 0, l.ratePct ?? 0,
      l.termYears ?? 30, l.startDate ?? "", l.monthlyPayment ?? 0, l.active ? 1 : 0);
  }

  const it = db.prepare(`INSERT INTO tenants
    (id, property_id, unit_label, name, email, phone, rent, lease_start, lease_end,
     status, balance_owed) VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  for (const t of s.tenants ?? []) {
    it.run(t.id, t.propertyId, t.unitLabel ?? "", t.name ?? "", t.email ?? "",
      t.phone ?? "", t.rent ?? 0, t.leaseStart ?? "", t.leaseEnd ?? "",
      t.status ?? "current", t.balanceOwed ?? 0);
  }

  const ir = db.prepare(`INSERT INTO renovations
    (id, property_id, name, status, start_date, target_end_date, scenario,
     budget_lines, tasks) VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const r of s.renovations ?? []) {
    ir.run(r.id, r.propertyId, r.name ?? "", r.status ?? "planning",
      r.startDate ?? "", r.targetEndDate ?? "", r.scenario ?? "standard",
      JSON.stringify(r.budgetLines ?? []), JSON.stringify(r.tasks ?? []));
  }

  db.prepare("DELETE FROM contractors").run();
  const ic = db.prepare(`INSERT INTO contractors
    (id, name, trade, phone, email, rating, insurance_on_file, license_on_file, notes)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  for (const c of s.contractors ?? []) {
    ic.run(c.id, c.name ?? "", c.trade ?? "", c.phone ?? "", c.email ?? "",
      c.rating ?? 0, c.insuranceOnFile ? 1 : 0, c.licenseOnFile ? 1 : 0, c.notes ?? null);
  }

  const ix = db.prepare(`INSERT INTO transactions
    (id, property_id, date, category, description, amount) VALUES (?,?,?,?,?,?)`);
  for (const x of s.transactions ?? []) {
    ix.run(x.id, x.propertyId ?? null, x.date ?? "", x.category ?? "misc_expense",
      x.description ?? "", x.amount ?? 0);
  }

  const idoc = db.prepare(`INSERT INTO docs
    (id, property_id, name, kind, added_date, note, ai_summary) VALUES (?,?,?,?,?,?,?)`);
  for (const d of s.docs ?? []) {
    idoc.run(d.id, d.propertyId ?? null, d.name ?? "", d.kind ?? "other",
      d.addedDate ?? "", d.note ?? null, d.aiSummary ?? null);
  }

  const ie = db.prepare(`INSERT INTO timeline
    (id, property_id, date, title, body, kind) VALUES (?,?,?,?,?,?)`);
  for (const e of s.timeline ?? []) {
    ie.run(e.id, e.propertyId, e.date ?? "", e.title ?? "", e.body ?? null, e.kind ?? "note");
  }

  const itd = db.prepare(`INSERT INTO todos
    (id, property_id, title, done, due_date, stage) VALUES (?,?,?,?,?,?)`);
  for (const t of s.todos ?? []) {
    itd.run(t.id, t.propertyId ?? null, t.title ?? "", t.done ? 1 : 0,
      t.dueDate ?? null, t.stage ?? null);
  }

  // Settings — persist everything EXCEPT the API key (keys stay out of the DB;
  // the server's own key lives in .env).
  const { apiKey: _apiKey, ...safeSettings } = s.settings ?? {};
  db.prepare(`INSERT INTO settings (id, data) VALUES (1, ?)
    ON CONFLICT(id) DO UPDATE SET data = excluded.data`)
    .run(JSON.stringify(safeSettings));
});
