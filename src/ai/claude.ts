/* ============================================================================
 * claude.ts — browser-direct Claude API client with an agentic tool loop.
 *
 * The API key lives ONLY in this browser's localStorage (Settings). Requests
 * go straight from the browser to api.anthropic.com using the
 * anthropic-dangerous-direct-browser-access header — appropriate for a
 * local-first personal tool; the production SaaS proxies through a backend
 * (see BLUEPRINT.md §AI architecture).
 * ========================================================================== */
import { TOOL_DEFS, runTool } from "./tools";
import { dataSnapshot } from "@/store/store";
import { todayISO } from "@/data/seed";

const API_URL = "https://api.anthropic.com/v1/messages";

export interface ChatTurn {
  role: "user" | "assistant";
  content: unknown; // Anthropic content blocks or string
}

export interface CopilotEvent {
  type: "text" | "tool" | "done" | "error";
  text?: string;
  toolName?: string;
}

function systemPrompt(pageContext: string): string {
  const data = dataSnapshot();
  const s = data.settings;
  return [
    `You are the BRRRR OS Copilot — an elite real-estate investing analyst embedded in ${s.investorName}'s portfolio operating system.`,
    `Today is ${todayISO()}. The investor runs a BRRRR strategy (Buy, Rehab, Rent, Refinance, Repeat) in Southern Ontario. Cash flow is their #1 metric, capital recovery at refi is #2.`,
    ``,
    `You have tools that read the SAME live data the app displays: portfolio KPIs, properties, underwriting, refinance scanner, renovations, transactions, tenants, contractors. ALWAYS ground answers in tool results — never invent numbers. If a question needs data, call tools first.`,
    `You can also act: create_task and add_note write into the app. Confirm in your reply when you do.`,
    ``,
    `Targets: cash flow ≥ $${s.targetCashflowPerUnit}/unit/mo, cash-on-cash ≥ ${s.targetCoCPct}%, market refi rate ${s.marketRefiRatePct}%.`,
    `The user is currently on: ${pageContext}.`,
    ``,
    `Style: sharp, quantitative, direct — like a trusted analyst, not a chatbot. Lead with the answer, then the numbers that support it. Use short markdown (bold key figures, compact tables for comparisons). Flag risks honestly. When asked for advice, give a clear recommendation and the reasoning. You are an underwriting aid, not a licensed financial advisor — say so only if the user asks about regulated financial decisions beyond property analysis.`,
  ].join("\n");
}

interface ApiContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface ApiResponse {
  content: ApiContentBlock[];
  stop_reason: string;
  error?: { message: string };
}

async function callApi(
  apiKey: string,
  model: string,
  system: string,
  messages: ChatTurn[],
): Promise<ApiResponse> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
      tools: TOOL_DEFS,
      messages,
    }),
  });
  const json = (await res.json()) as ApiResponse;
  if (!res.ok) {
    throw new Error(json?.error?.message ?? `API error ${res.status}`);
  }
  return json;
}

/**
 * Run one copilot exchange: send history + new user message, loop while
 * Claude requests tools (executed locally), emit events for the UI.
 * Returns the updated history (including tool_use / tool_result turns).
 */
export async function runCopilot(
  history: ChatTurn[],
  userMessage: string,
  pageContext: string,
  onEvent: (e: CopilotEvent) => void,
): Promise<ChatTurn[]> {
  const { apiKey, model } = dataSnapshot().settings;
  if (!apiKey) {
    onEvent({
      type: "error",
      text: "No API key set. Add your Anthropic API key in Settings → AI Copilot to bring the copilot online.",
    });
    return history;
  }

  const system = systemPrompt(pageContext);
  const messages: ChatTurn[] = [...history, { role: "user", content: userMessage }];

  try {
    for (let iter = 0; iter < 8; iter++) {
      const resp = await callApi(apiKey, model, system, messages);
      messages.push({ role: "assistant", content: resp.content });

      const text = resp.content
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text)
        .join("\n");
      if (text) onEvent({ type: "text", text });

      const toolUses = resp.content.filter((b) => b.type === "tool_use");
      if (resp.stop_reason !== "tool_use" || toolUses.length === 0) break;

      const results = toolUses.map((tu) => {
        onEvent({ type: "tool", toolName: tu.name });
        let result: unknown;
        try {
          result = runTool(tu.name ?? "", tu.input ?? {});
        } catch (err) {
          result = { error: String(err) };
        }
        return {
          type: "tool_result",
          tool_use_id: tu.id,
          content: JSON.stringify(result).slice(0, 60000),
        };
      });
      messages.push({ role: "user", content: results });
    }
    onEvent({ type: "done" });
  } catch (err) {
    onEvent({
      type: "error",
      text:
        err instanceof Error
          ? err.message.includes("Failed to fetch")
            ? "Couldn't reach the Claude API — check your connection."
            : err.message
          : String(err),
    });
  }
  return messages;
}
