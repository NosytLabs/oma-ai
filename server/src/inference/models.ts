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
      // Market rate: ~$0.23/1M input (Deepinfra). Venice is privacy-focused premium.
      // Our price: $0.35/$0.35 per 1M — competitive for private inference
      inputPricePer1M: 0.35,
      outputPricePer1M: 0.35,
      markupPercent: 0, // Price already includes margin
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
      // Market rate: Claude Sonnet 5 is $2/$10 per 1M. Venice premium for privacy.
      // Our price: $2.50/$12 per 1M — competitive for private Claude access
      inputPricePer1M: 2.50,
      outputPricePer1M: 12,
      markupPercent: 0, // Price already includes margin
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
      // 2026-07-30: bumped from $0.005/$0.02. Gonka wholesale is ~$0.0003
      // / $0.0012 per 1M (epoch-priced, GNK-denominated), so $0.015/$0.06 is
      // still ~50x wholesale and well under OpenAI's M2.7 ($0.30/$1.20) and
      // OpenRouter's gonka listing (~$0.017/$0.072). Sub-cent price-floor
      // bug: any call under ~7K output tokens rounded to 0 cents; new floor
      // produces visible ledger movement even on small chat calls.
      inputPricePer1M: 0.015,
      outputPricePer1M: 0.06,
      markupPercent: 0,
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
      // 2026-07-30: bumped from $0.008/$0.032. Same wholesale as M2.7; we
      // position Kimi as a stronger reasoning model with a modest premium
      // (~1.6x M2.7). Still ~30x cheaper than OpenRouter's
      // moonshotai/Kimi-K2 line ($1.20/M in).
      inputPricePer1M: 0.024,
      outputPricePer1M: 0.096,
      markupPercent: 0,
      displayName: "Kimi K2.6 (Gonka)",
      category: "mid",
      maxTokens: 8000,
      contextWindow: 128000,
      maxOutputTokens: 8192,
      supportsStreaming: true,
      capabilities: ["chat", "tools"],
    },
    // NOTE: GLM-5.2-FP8 (zai-org/GLM-5.2-FP8) is on the Gonka /v1/models
    // registry but the actual OpenBroker returns "unsupported model" on a
    // chat call (verified 2026-07-30 — returns 400 with the supported
    // list containing only MiniMax-M2.7 and Kimi-K2.6). Likely a
    // governance-approved model awaiting devshard routing. Once a chat
    // call to zai-org/GLM-5.2-FP8 succeeds, add it back here with the
    // same markup pattern as M2.7/K2.6. Until then, keep it out of the
    // catalog to avoid surfacing a 502/500 on the website.
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


