/**
 * Inference model catalog — minimal in-memory registry.
 *
 * Holds the small set of models OMA-AI ships with by default. Add a
 * new provider (Venice / Gonka / Surplus / …) by extending
 * `server/src/routes/chat/index.ts::resolveProvider()` and adding a
 * matching entry here.
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

function defaultCatalog(): ModelDef[] {
  return [
    {
      id: "llama-3.3-70b",
      provider: "venice",
      inputPricePer1M: 0.45,
      outputPricePer1M: 0.45,
      markupPercent: 25,
      displayName: "Llama 3.3 70B",
      category: "mid",
      maxTokens: 2000,
      contextWindow: 131072,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      capabilities: ["chat"],
    },
    {
      id: "claude-sonnet-4-5",
      provider: "venice",
      inputPricePer1M: 3.13,
      outputPricePer1M: 15,
      markupPercent: 25,
      displayName: "Claude Sonnet 4.5",
      category: "premium",
      maxTokens: 4000,
      contextWindow: 200000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      capabilities: ["chat", "tools"],
    },
    {
      id: "minimax-m2.7",
      provider: "gonka",
      gonkaId: "MiniMaxAI/MiniMax-M2.7",
      inputPricePer1M: 0.30,
      outputPricePer1M: 1.20,
      markupPercent: 30,
      displayName: "MiniMax M2.7 (Gonka)",
      category: "budget",
      maxTokens: 8000,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      capabilities: ["chat", "tools"],
    },
    {
      id: "kimi-k2.6",
      provider: "gonka",
      gonkaId: "moonshotai/Kimi-K2.6",
      inputPricePer1M: 0.15,
      outputPricePer1M: 0.60,
      markupPercent: 30,
      displayName: "Kimi K2.6 (Gonka)",
      category: "budget",
      maxTokens: 8000,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      capabilities: ["chat", "tools"],
    },
  ];
}

export async function ensureCatalogLoaded(): Promise<void> {
  if (_catalog) return;
  _catalog = defaultCatalog();
  logger.info({ count: _catalog.length }, "[models] loaded default catalog");
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


