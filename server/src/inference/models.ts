/**
 * Minimal model registry — stub for the OMA rebuild.
 * Real model catalog loading from models.json comes in a follow-up.
 */
import { logger } from "../lib/logger.js";
import { config } from "../config.js";

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

function stub(): ModelDef[] {
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
      inputPricePer1M: 0.30,
      outputPricePer1M: 1.20,
      markupPercent: 30,
      displayName: "MiniMax M2.7",
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
  _catalog = stub();
  logger.info({ count: _catalog.length }, "[models] loaded stub catalog");
}

export function listAllModels(): ModelDef[] {
  if (!_catalog) {
    _catalog = stub();
  }
  return _catalog;
}

export function getModelById(id: string): ModelDef | undefined {
  return listAllModels().find((m) => m.id === id);
}

void config;
