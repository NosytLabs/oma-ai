/**
 * Inference model catalog — curated best-in-class models.
 *
 * 18 curated chat models: 12 Venice + 6 OMA-AI (resale).
 * Prices below are *wholesale base* for Venice (25% markup applied at
 * billing — see billing-service.ts). OMA-AI prices are user-facing
 * (margin built-in, markupPercent = 0).
 *
 * OMA-AI resale has two upstreams (both branded "oma-ai" to users):
 *   - Zyloo (api.zyloo.io): gemini-3.1-pro-preview, gemini-3-flash-preview,
 *     gpt-4.1, gpt-4o — verified live 2026-08-08.
 *   - OpenBroker (api.openbroker.gonka.gg): MiniMaxAI/MiniMax-M2.7,
 *     moonshotai/Kimi-K2.6 — verified live 2026-08-08. GET /v1/models is a
 *     status stub, not a model list — probe via chat.
 *
 * NOTE: `gemini-3-flash-preview` is owned by the OMA-AI provider — it is
 * the app's default free website-chat model (see app/src/lib/model-utils.ts).
 * Never add a Venice entry under the same id or it will shadow the free
 * route and break anonymous website chat (401 on free model).
 *
 * Add a new provider by extending `resolveProvider()` in proxy.ts and
 * adding matching entries here.
 */
import { logger } from "../lib/logger.js";

export interface ModelDef {
  id: string;
  provider: string;
  inputPricePer1M: number;
  outputPricePer1M: number;
  markupPercent: number;
  displayName: string;
  category: "budget" | "mid" | "premium" | "frontier";
  maxTokens: number;
  contextWindow?: number;
  maxOutputTokens?: number;
  supportsStreaming: boolean;
  capabilities: string[];
  veniceId?: string;
  omaAiId?: string;
  /** Which resale upstream backs an "oma-ai" model. Defaults to "zyloo". */
  upstream?: "zyloo" | "openbroker";
}

let _catalog: ModelDef[] | null = null;

// ---------------------------------------------------------------------------
// Curated catalog — best models per tier.
//
// Venice pricing source: live GET api.venice.ai/api/v1/models (2026-08-04)
// OMA-AI/OpenBroker: free-tier user prices; context 128k product cap
// (upstream does not publish per-model limits on the broker API).
//
// Prices stored here are *upstream base* (what OMA pays Venice/OMA-AI).
// billing-service.ts applies markupPercent at checkout:
//   user_cost = base * (1 + markupPercent/100)
//
// For Venice models markupPercent = 25 (OMA's platform margin).
// For OMA-AI models markupPercent = 0 (margin already in the low price).
// ---------------------------------------------------------------------------

const VENICE_MODELS: ModelDef[] = [
  // ── Frontier ──────────────────────────────────────────────────────────

  {
    id: "openai-gpt-56-sol",
    provider: "venice",
    inputPricePer1M: 6.25,
    outputPricePer1M: 37.5,
    markupPercent: 25,
    displayName: "GPT-5.6 Sol",
    category: "frontier",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },

  // ── Premium ───────────────────────────────────────────────────────────


  {
    id: "kimi-k3",
    provider: "venice",
    inputPricePer1M: 3.75,
    outputPricePer1M: 18.75,
    markupPercent: 25,
    displayName: "Kimi K3",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },


  {
    id: "zai-org-glm-5-2",
    provider: "venice",
    inputPricePer1M: 1.4,
    outputPricePer1M: 4.4,
    markupPercent: 25,
    displayName: "GLM 5.2",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
  {
    id: "deepseek-v4-pro",
    provider: "venice",
    inputPricePer1M: 1.65,
    outputPricePer1M: 3.301,
    markupPercent: 25,
    displayName: "DeepSeek V4 Pro",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
  {
    id: "qwen-3-8-max",
    provider: "venice",
    inputPricePer1M: 2.5,
    outputPricePer1M: 7.5,
    markupPercent: 25,
    displayName: "Qwen 3.8 Max",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },

  // ── Mid ───────────────────────────────────────────────────────────────

  {
    id: "llama-3.3-70b",
    provider: "venice",
    inputPricePer1M: 0.7,
    outputPricePer1M: 2.8,
    markupPercent: 25,
    displayName: "Llama 3.3 70B",
    category: "mid",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "tools"],
  },
  {
    id: "zai-org-glm-5-1",
    provider: "venice",
    inputPricePer1M: 1.54,
    outputPricePer1M: 4.84,
    markupPercent: 25,
    displayName: "GLM 5.1",
    category: "mid",
    maxTokens: 16384,
    contextWindow: 200_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
  {
    id: "qwen-3-7-plus",
    provider: "venice",
    inputPricePer1M: 0.5,
    outputPricePer1M: 2.0,
    markupPercent: 25,
    displayName: "Qwen 3.7 Plus",
    category: "mid",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
  {
    id: "hermes-3-llama-3.1-405b",
    provider: "venice",
    inputPricePer1M: 1.1,
    outputPricePer1M: 3.0,
    markupPercent: 25,
    displayName: "Hermes 3 405B",
    category: "mid",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "uncensored"],
  },

  // ── Budget ────────────────────────────────────────────────────────────


  {
    id: "xiaomi-mimo-v2-5",
    provider: "venice",
    inputPricePer1M: 0.14,
    outputPricePer1M: 0.28,
    markupPercent: 25,
    displayName: "Xiaomi MiMo V2.5",
    category: "budget",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "fast"],
  },
  {
    id: "deepseek-v4-flash-0731",
    provider: "venice",
    inputPricePer1M: 0.175,
    outputPricePer1M: 0.35,
    markupPercent: 25,
    displayName: "DeepSeek V4 Flash",
    category: "budget",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "fast"],
  },
  {
    id: "mistral-small-2603",
    provider: "venice",
    inputPricePer1M: 0.1875,
    outputPricePer1M: 0.75,
    markupPercent: 25,
    displayName: "Mistral Small 4",
    category: "budget",
    maxTokens: 16384,
    contextWindow: 256_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "tools", "fast"],
  },

];

// ── OMA-AI Resale — branded "oma-ai", backed by Zyloo + OpenBroker ──
const OMA_AI_MODELS: ModelDef[] = [
  // ── Zyloo upstream (api.zyloo.io) ─────────────────────────────────
  {
    id: "gemini-3.1-pro-preview",
    provider: "oma-ai",
    omaAiId: "gemini-3.1-pro-preview",
    inputPricePer1M: 1.0,
    outputPricePer1M: 5.0,
    markupPercent: 0,
    displayName: "Gemini 3.1 Pro",
    category: "frontier",
    maxTokens: 16384,
    contextWindow: 128_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
  {
    id: "gemini-3-flash-preview",
    provider: "oma-ai",
    omaAiId: "gemini-3-flash-preview",
    inputPricePer1M: 0.2,
    outputPricePer1M: 1.5,
    markupPercent: 0,
    displayName: "Gemini 3 Flash",
    category: "mid",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "fast", "tools"],
  },
  {
    id: "gpt-4.1",
    provider: "oma-ai",
    omaAiId: "gpt-4.1",
    inputPricePer1M: 2.0,
    outputPricePer1M: 8.0,
    markupPercent: 0,
    displayName: "GPT-4.1",
    category: "frontier",
    maxTokens: 16384,
    contextWindow: 128_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
  {
    id: "gpt-4o",
    provider: "oma-ai",
    omaAiId: "gpt-4o",
    inputPricePer1M: 2.5,
    outputPricePer1M: 10.0,
    markupPercent: 0,
    displayName: "GPT-4o",
    category: "premium",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "fast", "tools"],
  },

  // ── OpenBroker upstream (api.openbroker.gonka.gg) ─────────────────

  {
    id: "kimi-k2-6",
    provider: "oma-ai",
    upstream: "openbroker",
    omaAiId: "moonshotai/Kimi-K2.6",
    inputPricePer1M: 0.6,
    outputPricePer1M: 2.5,
    markupPercent: 0,
    displayName: "Kimi K2.6",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 128_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
  {
    id: "minimax-m2-7",
    provider: "oma-ai",
    upstream: "openbroker",
    omaAiId: "MiniMaxAI/MiniMax-M2.7",
    inputPricePer1M: 0.3,
    outputPricePer1M: 1.2,
    markupPercent: 0,
    displayName: "MiniMax M2.7",
    category: "budget",
    maxTokens: 16384,
    contextWindow: 128_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
];

function defaultCatalog(): ModelDef[] {
  return [...VENICE_MODELS, ...OMA_AI_MODELS];
}

export async function ensureCatalogLoaded(): Promise<void> {
  if (_catalog) return;
  _catalog = defaultCatalog();
  logger.info({ count: _catalog.length }, "[models] loaded curated catalog");
}

export function listAllModels(): ModelDef[] {
  if (!_catalog) {
    _catalog = defaultCatalog();
  }
  return _catalog;
}

export function getModelById(id: string): ModelDef | undefined {
  return listAllModels().find((m) => m.id === id);
}

/**
 * User-facing per-1M prices — what the customer is actually billed.
 * catalog base * (1 + markupPercent/100). Use these in any surface that
 * shows prices to users (/v1/models, docs, cost estimates) so displayed
 * prices always match billing.
 */
export function userFacingPrices(m: ModelDef): {
  inputPer1M: number;
  outputPer1M: number;
} {
  const factor = 1 + m.markupPercent / 100;
  return {
    inputPer1M: m.inputPricePer1M * factor,
    outputPer1M: m.outputPricePer1M * factor,
  };
}
