/* ============================================================================
 * store.ts — single app store (zustand), persisted to localStorage.
 * Local-first: the browser is the database. Export/import gives portability;
 * the production architecture swaps this layer for the API without touching
 * pages (see BLUEPRINT.md).
 * ========================================================================== */
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppData, Property, Stage, TodoItem, Transaction, Doc, TimelineEvent,
  RenovationProject, Tenant, Settings, RenoTask, BudgetLine, Loan,
} from "@/data/types";
import { STAGE_LABELS } from "@/data/types";
import { seedData, todayISO } from "@/data/seed";

export const uid = (): string =>
  Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

interface AppState extends AppData {
  hydratedFromSeed: boolean;

  // settings
  setSettings: (patch: Partial<Settings>) => void;

  // properties
  addProperty: (p: Property) => void;
  updateProperty: (id: string, patch: Partial<Property>) => void;
  moveStage: (id: string, stage: Stage) => void;
  archiveProperty: (id: string) => void;
  deleteProperty: (id: string) => void;

  // todos
  addTodo: (t: TodoItem) => void;
  toggleTodo: (id: string) => void;

  // money
  addTransaction: (t: Transaction) => void;

  // docs & timeline
  addDoc: (docItem: Doc) => void;
  addTimeline: (e: TimelineEvent) => void;

  // renovation
  updateRenoTask: (projectId: string, taskId: string, patch: Partial<RenoTask>) => void;
  updateBudgetLine: (projectId: string, lineId: string, patch: Partial<BudgetLine>) => void;
  addRenoTask: (projectId: string, task: RenoTask) => void;

  // tenants & loans
  updateTenant: (id: string, patch: Partial<Tenant>) => void;
  addTenant: (t: Tenant) => void;
  addLoan: (l: Loan) => void;
  updateLoan: (id: string, patch: Partial<Loan>) => void;

  // data management
  resetToSeed: () => void;
  clearAll: () => void;
  importData: (data: AppData) => void;
}

const seed = seedData();

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...seed,
      hydratedFromSeed: true,

      setSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

      addProperty: (p) =>
        set((s) => ({
          properties: [...s.properties, p],
          timeline: [
            {
              id: uid(), propertyId: p.id, date: todayISO(),
              title: `Added to pipeline as ${STAGE_LABELS[p.stage]}`, kind: "stage" as const,
            },
            ...s.timeline,
          ],
        })),

      updateProperty: (id, patch) =>
        set((s) => ({
          properties: s.properties.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        })),

      moveStage: (id, stage) =>
        set((s) => {
          const prop = s.properties.find((p) => p.id === id);
          if (!prop || prop.stage === stage) return {};
          return {
            properties: s.properties.map((p) =>
              p.id === id ? { ...p, stage, stageEnteredDate: todayISO() } : p,
            ),
            timeline: [
              {
                id: uid(), propertyId: id, date: todayISO(),
                title: `Moved to ${STAGE_LABELS[stage]}`,
                body: `From ${STAGE_LABELS[prop.stage]}`, kind: "stage" as const,
              },
              ...s.timeline,
            ],
          };
        }),

      archiveProperty: (id) =>
        set((s) => ({
          properties: s.properties.map((p) => (p.id === id ? { ...p, archived: true } : p)),
        })),

      /** Hard delete: removes the property and everything attached to it. */
      deleteProperty: (id) =>
        set((s) => ({
          properties: s.properties.filter((p) => p.id !== id),
          loans: s.loans.filter((l) => l.propertyId !== id),
          tenants: s.tenants.filter((t) => t.propertyId !== id),
          renovations: s.renovations.filter((r) => r.propertyId !== id),
          transactions: s.transactions.filter((t) => t.propertyId !== id),
          docs: s.docs.filter((d) => d.propertyId !== id),
          timeline: s.timeline.filter((e) => e.propertyId !== id),
          todos: s.todos.filter((t) => t.propertyId !== id),
        })),

      addTodo: (t) => set((s) => ({ todos: [t, ...s.todos] })),
      toggleTodo: (id) =>
        set((s) => ({
          todos: s.todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
        })),

      addTransaction: (t) => set((s) => ({ transactions: [t, ...s.transactions] })),

      addDoc: (docItem) => set((s) => ({ docs: [docItem, ...s.docs] })),
      addTimeline: (e) => set((s) => ({ timeline: [e, ...s.timeline] })),

      updateRenoTask: (projectId, taskId, patch) =>
        set((s) => ({
          renovations: s.renovations.map((r) =>
            r.id !== projectId
              ? r
              : { ...r, tasks: r.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) },
          ),
        })),

      updateBudgetLine: (projectId, lineId, patch) =>
        set((s) => ({
          renovations: s.renovations.map((r) =>
            r.id !== projectId
              ? r
              : {
                  ...r,
                  budgetLines: r.budgetLines.map((b) =>
                    b.id === lineId ? { ...b, ...patch } : b,
                  ),
                },
          ),
        })),

      addRenoTask: (projectId, task) =>
        set((s) => ({
          renovations: s.renovations.map((r) =>
            r.id !== projectId ? r : { ...r, tasks: [...r.tasks, task] },
          ),
        })),

      updateTenant: (id, patch) =>
        set((s) => ({
          tenants: s.tenants.map((t) => (t.id === id ? { ...t, ...patch } : t)),
        })),

      addTenant: (t) => set((s) => ({ tenants: [...s.tenants, t] })),
      addLoan: (l) => set((s) => ({ loans: [...s.loans, l] })),
      updateLoan: (id, patch) =>
        set((s) => ({
          loans: s.loans.map((l) => (l.id === id ? { ...l, ...patch } : l)),
        })),

      clearAll: () =>
        set((s) => ({
          properties: [], loans: [], tenants: [], renovations: [],
          contractors: [], transactions: [], docs: [], timeline: [], todos: [],
          settings: s.settings, // keep API key, theme, targets
        })),

      resetToSeed: () => {
        const fresh = seedData();
        // keep user's settings (API key, theme) across resets
        set({ ...fresh, settings: { ...fresh.settings, ...pickSettings(get().settings) } });
      },

      importData: (data) => set({ ...data }),
    }),
    {
      name: "brrrr-os-v3",
      version: 1,
    },
  ),
);

function pickSettings(s: Settings): Partial<Settings> {
  return { apiKey: s.apiKey, theme: s.theme, model: s.model, investorName: s.investorName };
}

/** Snapshot of pure data (no functions) — used by export and the AI tools. */
export function dataSnapshot(): AppData {
  const s = useStore.getState();
  return {
    properties: s.properties,
    loans: s.loans,
    tenants: s.tenants,
    renovations: s.renovations,
    contractors: s.contractors,
    transactions: s.transactions,
    docs: s.docs,
    timeline: s.timeline,
    todos: s.todos,
    settings: s.settings,
  };
}
