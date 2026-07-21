# BRRRR OS

**The AI-native operating system for real estate investors.**
Buy · Rehab · Rent · Refinance · Repeat — from one command center.

Third-generation build (RealMo v1 → BRRRR OS v3): a full portfolio operating
system with a Claude-powered copilot on every page, grounded in the same
cash-flow-first underwriting engine that powered RealMo.

![stack](https://img.shields.io/badge/stack-Vite%20·%20React%2018%20·%20TypeScript-blue)

## Run it

```bash
npm install
npm run dev        # → http://localhost:5183
npm run build      # production build (dist/, ~95 KB gzip)
```

The app boots with a realistic demo portfolio — 8 properties spread across the
BRRRR pipeline, with loans, tenants, an active renovation, transactions,
documents and tasks. All data is **local-first** (browser localStorage);
export/import JSON from Settings.

## Bring the Copilot online

Settings → AI Copilot → paste your Anthropic API key
(console.anthropic.com). The key is stored **only in your browser** and sent
directly to the Claude API. The copilot answers with tools that read the same
live data the UI renders — portfolio KPIs, underwriting, refi scanner,
renovations, tenants — and can create tasks and notes for you.

Try: *"Which property should I refinance?" · "What would cash flow look like if
rates drop 1%?" · "Where is the Queen St budget going over?"*

## The OS

| Module | What it does |
|---|---|
| **Dashboard** | Portfolio KPIs, equity trend, prioritized "needs attention" feed, tasks |
| **Pipeline** | 10-stage BRRRR kanban, one-click stage moves, auto-logged timeline |
| **Deal Analyzer** | Live underwriting: BRRRR score (cash-flow dominant), purchase pricepoints, rate sensitivity, 5-yr IRR |
| **Properties** | The hub record — underwriting, financials, tenants, docs, timeline per property |
| **Renovation OS** | Budgets vs spend, work plans, contractor compliance, automatic detections (overruns, scope creep, schedule risk) |
| **Tenants** | Rent roll, arrears exposure, lease-expiry radar |
| **Financials** | Ledger, 30-day P&L, expense breakdown |
| **Refinance Engine** | Continuous cash-out scanner — the "Repeat" |
| **Analytics** | Rankings, capital allocation, best/worst performers |
| **Documents** | Registry with AI summaries, cross-searchable |

Everywhere: **⌘K** command palette · **⌘J** copilot · **⌘⇧L** dark/light.

## Architecture

```
src/
  engine/underwrite.ts   pure BRRRR underwriting: pro-forma, score, pricepoints, IRR
  engine/insights.ts     deterministic intelligence: KPIs, health, refi scan, detections
  data/types.ts          domain model (mirrors the production DB schema)
  data/seed.ts           demo portfolio
  store/store.ts         zustand + localStorage persistence
  ai/tools.ts            the copilot's 12 tools (read + write) over the store
  ai/claude.ts           browser-direct Claude client with agentic tool loop
  components/            design system: ui primitives, SVG charts, palette, copilot
  pages/                 one file per module
  styles/tokens.css      the entire visual language (dark + light) as CSS tokens
```

The model reasons; deterministic code calculates — Claude never invents a
number. See **[BLUEPRINT.md](BLUEPRINT.md)** for the full product blueprint:
vision, IA, data model, AI/agent architecture, SaaS roadmap, monetization.

---

*Underwriting aid, not financial advice. Verify rents, comps, taxes, insurance
and lender terms before making offers.*
