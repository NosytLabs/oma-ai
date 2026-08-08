/**
 * Inference model catalog — curated best-in-class models.
 *
 * 22 curated chat models: 20 Venice + 2 OMA-AI/OpenBroker free models.
 * Prices below are *wholesale base* for Venice (25% markup applied at
 * billing — see billing-service.ts). OMA-AI prices are user-facing
 * (margin built-in, markupPercent = 0).
 *
 * OpenBroker (api.openbroker.oma-ai.gg) live catalog (verified 2026-08-04):
 //   gemini-3.1-pro-preview, gemini-3-pro-preview, gemini-3-flash-preview, gpt-4.1, gpt-4o
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
  omaAiId?: string;
  surplusId?: string;
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

  // ── Mid ───────────────────────────────────────────────────────────────


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

];

// ── OMA-AI (Gonka/Zyloo) Resale - Branded as OMA-AI ────────────────
const ZYLOO_MODELS: ModelDef[] = [
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
    id: "gemini-3-pro-preview",
    provider: "oma-ai",
    omaAiId: "gemini-3-pro-preview",
    inputPricePer1M: 1.7,
    outputPricePer1M: 9.0,
    markupPercent: 0,
    displayName: "Gemini 3 Pro",
    category: "premium",
    maxTokens: 16384,
    contextWindow: 128_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    capabilities: ["chat", "reasoning", "tools"],
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
    inputPricePer1M: 1.5,
    outputPricePer1M: 7.5,
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
    inputPricePer1M: 0.8,
    outputPricePer1M: 4.0,
    markupPercent: 0,
    displayName: "GPT-4o",
    category: "premium",
    maxTokens: 8192,
    contextWindow: 128_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    capabilities: ["chat", "fast", "tools"],
  },
];

function defaultCatalog(): ModelDef[] {
  return [...VENICE_MODELS, ...ZYLOO_MODELS];
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
