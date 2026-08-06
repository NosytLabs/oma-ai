/**
 * Inference model catalog — curated best-in-class models.
 *
 * 22 curated chat models: 20 Venice + 2 Gonka/OpenBroker free models.
 * Prices below are *wholesale base* for Venice (25% markup applied at
 * billing — see billing-service.ts). Gonka prices are user-facing
 * (margin built-in, markupPercent = 0).
 *
 * OpenBroker (api.openbroker.gonka.gg) live catalog (verified 2026-08-04):
 *   MiniMaxAI/MiniMax-M2.7, moonshotai/Kimi-K2.6 only.
 *   GET /v1/models is a status stub, not a model list — probe via chat.
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
  gonkaId?: string;
  surplusId?: string;
}

let _catalog: ModelDef[] | null = null;

// ---------------------------------------------------------------------------
// Curated catalog — best models per tier.
//
// Venice pricing source: live GET api.venice.ai/api/v1/models (2026-08-04)
// Gonka/OpenBroker: free-tier user prices; context 128k product cap
// (upstream does not publish per-model limits on the broker API).
//
// Prices stored here are *upstream base* (what OMA pays Venice/Gonka).
// billing-service.ts applies markupPercent at checkout:
//   user_cost = base * (1 + markupPercent/100)
//
// For Venice models markupPercent = 25 (OMA's platform margin).
// For Gonka models markupPercent = 0 (margin already in the low price).
// ---------------------------------------------------------------------------

const VENICE_MODELS: ModelDef[] = [
  // ── Frontier ──────────────────────────────────────────────────────────
  {
    id: "claude-opus-5",
    provider: "venice",
    inputPricePer1M: 6.0,
    outputPricePer1M: 30.0,
    markupPercent: 25,
    displayName: "Claude Opus 5",
    category: "frontier",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
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
    id: "claude-sonnet-5",
    provider: "venice",
    inputPricePer1M: 3.0,
    outputPricePer1M: 15.0,
    markupPercent: 25,
    displayName: "Claude Sonnet 5",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
  {
    id: "openai-gpt-54",
    provider: "venice",
    inputPricePer1M: 3.13,
    outputPricePer1M: 18.8,
    markupPercent: 25,
    displayName: "GPT-5.4",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
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
    id: "openai-gpt-52",
    provider: "venice",
    inputPricePer1M: 2.19,
    outputPricePer1M: 17.5,
    markupPercent: 25,
    displayName: "GPT-5.2",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 256_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
  {
    id: "grok-4-5",
    provider: "venice",
    inputPricePer1M: 2.27,
    outputPricePer1M: 6.8,
    markupPercent: 25,
    displayName: "Grok 4.5",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 500_000,
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

  // ── Mid ───────────────────────────────────────────────────────────────
  {
    id: "deepseek-v4-pro",
    provider: "venice",
    inputPricePer1M: 1.65,
    outputPricePer1M: 3.3,
    markupPercent: 25,
    displayName: "DeepSeek V4 Pro",
    category: "mid",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "coding", "tools"],
  },
  {
    id: "gemini-3-5-flash",
    provider: "venice",
    inputPricePer1M: 1.55,
    outputPricePer1M: 9.45,
    markupPercent: 25,
    displayName: "Gemini 3.5 Flash",
    category: "mid",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
  {
    id: "gemini-3-flash-preview",
    provider: "venice",
    inputPricePer1M: 0.7,
    outputPricePer1M: 3.75,
    markupPercent: 25,
    displayName: "Gemini 3 Flash",
    category: "mid",
    maxTokens: 8192,
    contextWindow: 256_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "fast", "tools"],
  },
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

  // ── Budget ────────────────────────────────────────────────────────────
  {
    id: "deepseek-v4-flash",
    provider: "venice",
    inputPricePer1M: 0.138,
    outputPricePer1M: 0.275,
    markupPercent: 25,
    displayName: "DeepSeek V4 Flash",
    category: "budget",
    maxTokens: 16384,
    contextWindow: 1_000_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "fast", "tools"],
  },
  {
    id: "mistral-small-2603",
    provider: "venice",
    inputPricePer1M: 0.1875,
    outputPricePer1M: 0.75,
    markupPercent: 25,
    displayName: "Mistral Small 4",
    category: "budget",
    maxTokens: 8192,
    contextWindow: 256_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "fast", "tools"],
  },
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
    id: "mercury-2",
    provider: "venice",
    inputPricePer1M: 0.3125,
    outputPricePer1M: 0.9375,
    markupPercent: 25,
    displayName: "Mercury 2",
    category: "budget",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "fast"],
  },
];

// ── Gonka (OpenBroker) ────────────────────────────────────────────────
// Prices are user-facing (margin built-in). markupPercent = 0.
// Live OpenBroker catalog (verified 2026-08-04): only
//   MiniMaxAI/MiniMax-M2.7, moonshotai/Kimi-K2.6
// (zai-org/GLM-5.2-FP8 removed upstream — do not re-add without re-probing.)
const GONKA_MODELS: ModelDef[] = [
  {
    id: "minimax-m2.7",
    provider: "gonka",
    gonkaId: "MiniMaxAI/MiniMax-M2.7",
    inputPricePer1M: 0.015,
    outputPricePer1M: 0.06,
    markupPercent: 0,
    displayName: "MiniMax M2.7",
    category: "budget",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
  {
    id: "kimi-k2.6",
    provider: "gonka",
    gonkaId: "moonshotai/Kimi-K2.6",
    inputPricePer1M: 0.024,
    outputPricePer1M: 0.096,
    markupPercent: 0,
    displayName: "Kimi K2.6",
    category: "mid",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
  },
];

function defaultCatalog(): ModelDef[] {
  return [...VENICE_MODELS, ...GONKA_MODELS];
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
