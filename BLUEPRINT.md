# BRRRR OS — Product Blueprint

**The AI-native operating system for real estate investors.**
*"What if Palantir built software for real estate investors?"*

This document is the product blueprint for BRRRR OS. The repository contains the
**working v3 application** (local-first, React + TypeScript) which implements the
core of this vision today; the blueprint describes both what is built and the path
to the full multi-tenant SaaS.

---

## 1. Executive vision & strategy

**Problem.** A BRRRR investor with 1–100 doors runs their business across 10–15
disconnected tools (Zillow, Excel, DealCheck, Monday, QuickBooks, Baselane,
Google Drive, ChatGPT…). Every tool holds a partial picture; nothing reasons
across the whole. The investor is the integration layer — and the bottleneck.

**Product.** One operating system where every entity of the investing business —
deal, property, loan, renovation, tenant, dollar, document — lives in one graph,
and an AI copilot reasons over that graph on every page.

**Strategy.**
1. **Wedge:** the BRRRR pipeline + underwriting engine (built). Deal analysis is
   the highest-frequency, highest-anxiety moment; win it and the property record
   follows naturally through the pipeline into operations.
2. **Expand:** operations (renovation, tenants, financials) make the OS the daily
   driver; the refinance engine closes the loop and recycles capital — and users.
3. **Moat:** the portfolio graph. Once history, documents and finances live here,
   the AI's answers are un-replicable by any point tool.

**North star:** *time-to-confident-decision* — minutes from "found a deal" to a
defensible buy/pass, and from "should I refinance?" to a lender-ready package.

**Positioning:** Salesforce + Monday + Bloomberg Terminal for small/medium REIs.
Not a calculator (DealCheck), not a landlord app (RentRedi), not accounting
(Baselane) — the system that subsumes them.

## 2. Information architecture

```
BRRRR OS
├── Command
│   ├── Dashboard          — portfolio KPIs, attention feed, tasks, trends
│   ├── Pipeline           — BRRRR kanban: Lead → … → Completed (10 stages)
│   └── Deal Analyzer      — live underwriting, score, pricepoints, sensitivity
├── Portfolio
│   ├── Properties         — register → Property Detail (the hub record):
│   │     Overview · Underwriting · Financials · Tenants · Documents · Timeline
│   ├── Renovation OS      — budgets, work plans, contractors, risk detections
│   └── Tenants            — rent roll, statuses, arrears, lease expiry radar
├── Capital
│   ├── Financials         — ledger, 30-day P&L, expense breakdown
│   ├── Refinance Engine   — continuous cash-out scanner ("Repeat")
│   └── Analytics          — rankings, allocation, best/worst performers
├── Library
│   └── Documents          — registry + AI summaries (→ full doc intelligence)
├── Settings               — copilot, targets, theme, data export/import
└── Everywhere
    ├── ⌘K Command palette — navigate, search properties, actions
    └── ✦ AI Copilot       — docked panel, page-context aware, tool-grounded
```

Every page answers: *What happened? What is happening? What needs attention?
What should I do next?*

## 3. Personas & journeys

| Persona | Doors | Jobs to be done |
|---|---|---|
| **Solo BRRRR operator** (primary) | 1–15 | Underwrite fast, run one reno at a time, know when to refi |
| **Scaling operator** | 15–100 | Pipeline discipline, delegate to VA/PM, portfolio-level capital planning |
| **STR hybrid** | 3–30 | Seasonal income modeling, occupancy vs rate, refi seasoning |
| **Contractor / PM** (secondary seat) | — | See scope, upload progress, submit invoices |

**Core journey (implemented end-to-end in v3):** wholesaler email → *Add
property* (Lead) → Analyzer: score 69/B-, recovery price $538K → negotiate, move
to Under Contract → stage tasks (inspection, financing) → Renovation OS budget +
work plan → detections catch roof overrun → Ready to Rent → tenants placed →
Refinance Engine flags "$45K at 75% LTV, DSCR holds 1.21x" → Completed → capital
recycled → Repeat.

## 4. Feature inventory (module × status)

| Module | v3 (built) | v1 SaaS | v2 |
|---|---|---|---|
| Dashboard | KPIs, attention feed, equity trend, tasks, health table | live market feeds | portfolio simulations |
| Pipeline | 10-stage kanban, 1-click stage moves, timeline logging | stage automations, approvals | team assignments |
| Deal Finder | — (manual add) | MLS/listings ingestion, saved criteria, geo alerts | off-market/auction/FSBO, AI sourcing agent |
| Analyzer | full engine: score, pricepoints, rate sensitivity, 5-yr IRR | comp pulls, AI rent estimates | photo-based rehab estimator |
| Property hub | 6-tab record: everything lives here | photos, maps/street view | permits, utilities, insurance APIs |
| Renovation OS | budgets, tasks, contractor registry, detections (overrun, scope creep, schedule risk, missing insurance) | contractor portal, invoices, change orders | AI scope generator (Budget/Standard/Luxury), fraud detection |
| Tenants | rent roll, statuses, arrears, expiry radar | applications, screening, rent collection (Stripe/Plaid) | leases, maintenance requests, renewals |
| Financials | ledger, P&L, category breakdown | bank sync (Plaid), statements, Schedule E export | full accounting, QuickBooks/Xero sync |
| Refinance | continuous scanner, verdicts, Δ payment | rate feeds, lender marketplace, appraisal est. | auto lender packages |
| Analytics | rankings, allocation donuts, best/worst | cohort/vintage analysis | benchmarking vs market |
| Documents | registry + AI summaries, search | upload, OCR, extraction, RAG Q&A | auto-filing from email |
| Copilot | Claude + 12 tools over live data, page-aware, can write tasks/notes | server-side, streaming, memory | autonomous agents (below) |

## 5. Data model

Implemented in [src/data/types.ts](src/data/types.ts) — the local store and the
production Postgres schema share these shapes by design.

```
Org (tenant) ─< User (role) 
Org ─< Property ─── Underwriting (1:1 embedded)
         ├──< Loan
         ├──< Tenant (unit, lease, status, balance)
         ├──< RenovationProject ─< BudgetLine, RenoTask >── Contractor
         ├──< Transaction (category, signed amount)
         ├──< Doc (kind, ai_summary, extracted_json)
         ├──< TimelineEvent (append-only audit/activity)
         └──< TodoItem (optionally stage-gated)
```

Key decisions:
- **Underwriting is embedded, versioned per property** — what-ifs are ephemeral
  copies; the engine is pure (`underwrite(inputs) → result`), so any actor (UI,
  copilot, agent) prices identically.
- **TimelineEvent is append-only** — doubles as audit log and activity feed.
- **Transactions are signed** (+inflow/−outflow) with a closed category enum that
  maps 1:1 to Schedule E / T776 lines.
- Production adds: `org_id` on every row (RLS), `valuations` (time series),
  `documents.embedding` (pgvector), `events` outbox table.

## 6. API & service boundaries (production)

Modular monolith first (NestJS/Fastify), split only when load demands:

| Service | Owns | Notes |
|---|---|---|
| `core-api` | properties, pipeline, tasks, tenants, loans | REST + tRPC; RLS by org |
| `finance` | transactions, statements, Plaid sync | event consumers for derived KPIs |
| `underwriting` | pure engine as a lib + `/analyze` endpoint | same TS code as the client — isomorphic |
| `doc-intel` | upload → OCR → extract → embed → index | queue-driven (BullMQ → SQS) |
| `ai-gateway` | copilot sessions, tool dispatch, agent runs | the ONLY holder of LLM keys; per-org budget metering |
| `market-data` | listings, comps, rates ingestion | third-party adapters behind one interface |
| `notify` | email/SMS/push (Twilio, Resend) | event consumers |

Events (outbox → queue): `property.stage_changed`, `budget.line_updated`,
`txn.created`, `doc.ingested`, `refi.opportunity_found`, `lease.expiring` —
consumed by notify, analytics rollups, and agent triggers.

## 7. AI architecture

**Principle: the model reasons; deterministic code calculates.** Claude never
invents a number — every figure comes from a tool backed by the same engine the
UI renders. Implemented in [src/ai/tools.ts](src/ai/tools.ts) and
[src/ai/claude.ts](src/ai/claude.ts).

**Copilot loop (built):** system prompt (investor profile + targets + today +
current page) → Claude with 12 tools → local tool execution → loop until final
text (max 8 iterations).

Tools: `get_portfolio_summary`, `list_properties`, `get_property`,
`analyze_deal` (what-ifs + pricepoints), `scan_refinance_opportunities`,
`get_renovation_status`, `get_transactions`, `get_tenants`,
`get_attention_items`, `get_contractors`, and two writes: `create_task`,
`add_note`.

**Key handling:** v3 is browser-direct (`anthropic-dangerous-direct-browser-access`,
key only in localStorage — appropriate for a personal local-first tool).
Production: server-side proxy in `ai-gateway`, org-scoped budgets, model routing
(Haiku for extraction/classification, Sonnet for copilot, Opus for deep analysis).

**Deterministic intelligence layer** ([src/engine/insights.ts](src/engine/insights.ts)):
health checks, refi scanner, renovation detections, attention feed — cheap,
explainable, always-on. The LLM narrates and reasons over it; it never replaces it.

**Agents (v1.5+):** scheduled/event-triggered runs of the same tool loop with a
mission prompt and a budget — Deal Agent (score new listings vs criteria), Market
Agent (rates/comps drift), Renovation Agent (weekly overrun digest), Refi Agent
(watch for "ready" verdicts), Tenant Agent (arrears follow-ups). All agent output
lands as attention items + tasks — humans approve actions above a risk threshold.

**Doc intelligence (v1):** upload → OCR (vision model) → structured extraction
(Haiku, JSON schema per doc kind) → embeddings (pgvector) → RAG tool
(`search_documents`) added to the copilot belt.

## 8. Frontend architecture & design system

- **Stack:** Vite + React 18 + TypeScript (strict), zustand (+persist),
  react-router. No chart library — hand-rolled theme-aware SVG charts
  ([src/components/charts.tsx](src/components/charts.tsx)) for full control at
  ~0 bundle cost. Production build: **95 KB gzip**.
- **Design system** ([src/styles/tokens.css](src/styles/tokens.css)): every
  color/radius/motion value is a token; dark (default) and light themes are two
  token sets — zero per-component theme code. Component classes (`.card`,
  `.kpi`, `.badge`, `.tbl`, `.kanban`…) over utility soup.
- **Primitives** ([src/components/ui.tsx](src/components/ui.tsx)): Kpi, Badge,
  ScoreDial, Bar, Cover (generated property art), Modal, Empty, toast bus.
- **Interaction grammar:** ⌘K palette, ⌘J copilot, ⌘⇧L theme; one-click stage
  moves; inline add for tasks/notes/spend. Minimal clicks, keyboard-first.
- **State rule:** pages subscribe to the store and derive via pure engine calls
  in `useMemo` — no derived data is ever stored.

## 9. Backend & infrastructure (production)

Postgres (RLS multi-tenancy) + Redis (cache/queues) + S3 (docs) + pgvector
(embeddings; dedicated vector DB only if scale demands) + OpenSearch (documents
& listings search, added when needed). Monolith on Fargate/Fly → split per §6.
Kafka only at clear scale; SQS/BullMQ until then.

## 10. Security & permissions

- Tenant isolation: Postgres RLS on `org_id`, enforced at the connection level.
- Roles: Owner / Manager / Analyst / Contractor (portal: assigned projects only)
  / Read-only (lender/partner share links, expiring).
- SOC 2 path: append-only TimelineEvent audit trail (built), SSO/SAML, MFA,
  encryption at rest + in transit, backup/DR runbooks, access reviews.
- AI safety: server-side keys, prompt-injection isolation for document-derived
  text (untrusted content never becomes instructions), tool allow-lists per
  role, spend budgets per org.

## 11. Multi-tenant SaaS & 12. Mobile

Single-DB RLS tenancy; org-scoped object storage prefixes; per-org AI budget
metering. Mobile (v1): React Native / Expo companion for capture (photos,
voice notes, contractor check-ins, GPS walkthroughs) + push notifications from
the attention feed. Offline queue with append-only sync — same store shapes.

## 13. Analytics & KPI framework

Product: activation = first deal analyzed; habit = weekly attention-feed opens;
value = deals moved to Completed, capital recycled through refis.
Investor-facing (the KPIs the app itself computes): portfolio value, equity,
LTV, cash flow, occupancy, DSCR, capital recovered %, CoC, 5-yr IRR.

## 14. Monetization

| Tier | Price | For |
|---|---|---|
| Analyzer | $0 | unlimited underwriting, 3 properties — the wedge |
| Operator | $49/mo | full OS, 25 properties, copilot (fair-use pooled AI) |
| Portfolio | $149/mo | 100 properties, agents, doc intelligence, contractor seats |
| Scale | $499+/mo | teams, SSO, API, white-glove onboarding |

Expansion revenue: tenant screening, rent collection (payment margin), lender
marketplace referral fees, appraisal/insurance ordering.

## 15. Roadmap

- **90 days (MVP SaaS):** port v3 store to Postgres API + auth/orgs; server-side
  copilot; doc upload + OCR summaries; Stripe billing. *v3 app = the spec.*
- **12 months (V1):** Plaid bank sync; listings ingestion + Deal Finder; rent
  collection; contractor portal; mobile capture app; first two agents (Refi,
  Renovation); SOC 2 Type I.
- **24 months (V2):** full agent fleet; AI scope-of-work generator from
  photos/video; lender marketplace; commercial/development modules; team +
  investor-reporting features; benchmarking.

## 16–20. Wireframes, backlog, stack rationale, CI/CD, code

- **16 Wireframes:** the running app *is* the hi-fi clickable prototype — every
  major screen is implemented and themed (run `npm run dev`).
- **17 Backlog:** §4's v1/v2 columns decompose into epics per module; each
  detection/tool/integration listed is a story with the engine already defining
  its acceptance criteria.
- **18 Stack rationale:** TypeScript end-to-end (isomorphic underwriting engine
  is the killer reason); Postgres+RLS (boring, correct multi-tenancy); Claude
  tool-use as the AI backbone (deterministic grounding); no chart/CSS framework
  (control, speed, 95 KB).
- **19 CI/CD:** GitHub Actions — typecheck, unit tests on the pure engine
  (pricepoint solver, scoring curves, IRR), Playwright smoke on the five core
  flows, preview deploys; observability via OTel traces + Sentry; AI-gateway
  eval suite replays golden copilot conversations against tool-result snapshots.
- **20 Code:** this repository — modular, documented, strict-mode, zero runtime
  deps beyond React/router/zustand.

---

*BRRRR OS v3 · underwriting engine lineage: RealMo v1 → v3. Cash flow is the key
metric. This is an underwriting aid, not financial advice.*
