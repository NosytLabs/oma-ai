import { getModel, calculateCost, estimateTokens, ensureCatalogLoaded } from './models.js';
import type { ModelPricing } from './types.js';
import { config } from '../config.js';

export { estimateTokens };

/**
 * Resolve the effective markup % for a model.
 *
 * Precedence (highest → lowest):
 *   1. models.json `markupPercent` if > 0 (explicit per-model override)
 *   2. Tiered strategy from OMA_TIERED_MARKUP keyed by ModelDef.category
 *      (budget=40, mid=30, premium=22, frontier=15 — higher on cheap models
 *      where buyers are price-sensitive but the absolute $ delta is tiny,
 *      lower on frontier where buyers are inelastic to sticker but will
 *      churn on steep markup)
 *   3. OMA_MARKUP_PCT env (global fallback)
 */
function resolveMarkup(modelDef: { markupPercent?: number; category?: string } | null): number {
  if (modelDef?.markupPercent && modelDef.markupPercent > 0) {
    return modelDef.markupPercent;
  }
  if (config.OMA_TIERED_MARKUP && modelDef?.category) {
    const tiers = parseTieredMarkup(config.OMA_TIERED_MARKUP);
    const tierVal = tiers[modelDef.category as keyof typeof tiers];
    if (tierVal !== undefined) return tierVal;
  }
  return config.OMA_MARKUP_PCT;
}

function parseTieredMarkup(raw: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const [k, v] = part.split("=");
    if (k && v !== undefined) {
      const n = Number(v.trim());
      if (!Number.isNaN(n)) out[k.trim()] = n;
    }
  }
  return out;
}

export interface CostCalculation {
  costCents: string;
  markupCents: string;
  totalCents: string;
}

export async function getModelPricing(modelId: string): Promise<ModelPricing> {
  await ensureCatalogLoaded();
  const modelDef = await getModel(modelId);
  if (modelDef) {
    return {
      inputPer1k: modelDef.inputPricePer1M / 1000,
      outputPer1k: modelDef.outputPricePer1M / 1000,
      provider: modelDef.primaryProvider,
      // Fix B5: precedence is catalog value > tiered strategy > OMA_MARKUP_PCT env default.
      // Operators can tune per-tier margins in OMA_TIERED_MARKUP without editing models.json.
      markup: resolveMarkup(modelDef),
    };
  }

  // ponytail: default 150% markup was too aggressive — loses price-sensitive
  // customers. Read from config so operators can tune without code changes.
  return { inputPer1k: 0.001, outputPer1k: 0.002, provider: "venice", markup: config.OMA_MARKUP_PCT };
}

export async function estimateCost(
  modelId: string,
  inputTokens: number,
  estimatedOutputTokens: number,
  discountPercent: number = 0
): Promise<string> {
  const pricing = await getModelPricing(modelId);
  const inputPerToken = pricing.inputPer1k / 1000;
  const outputPerToken = pricing.outputPer1k / 1000;
  const markupMultiplier = 1 + pricing.markup / 100;
  const discountMultiplier = 1 - discountPercent / 100;
  const estimatedCostUsd = ((inputTokens * inputPerToken) + (estimatedOutputTokens * outputPerToken)) * markupMultiplier * discountMultiplier;
  return String(Math.max(1, Math.ceil(estimatedCostUsd * 100)));
}

export async function calculateActualCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  discountPercent: number = 0
): Promise<CostCalculation> {
  const model = await getModel(modelId);
  if (model) {
    return await calculateCost(model.id, inputTokens, outputTokens, discountPercent);
  }

  const pricing = await getModelPricing(modelId);
  const inputPerToken = pricing.inputPer1k / 1000;
  const outputPerToken = pricing.outputPer1k / 1000;
  const baseUsd = (inputTokens * inputPerToken) + (outputTokens * outputPerToken);
  // Fix B2: markup must be computed pre-discount (matches the catalog path in
  // models.ts:calculateCost). The old `costUsd - baseUsd` approach made the
  // markup shrink with discount — even going negative at high discounts —
  // which broke the cost breakdown shown to users and reported to recordUsage.
  const markupUsd = baseUsd * (pricing.markup / 100);
  const grossTotal = baseUsd + markupUsd;
  const discount = grossTotal * (discountPercent / 100);
  const costUsd = grossTotal - discount;
  return {
    costCents: String(Math.max(1, Math.ceil(baseUsd * 100))),
    markupCents: String(Math.ceil(markupUsd * 100)),
    totalCents: String(Math.max(1, Math.ceil(costUsd * 100))),
  };
}

export async function getEstimatedOutputTokens(modelId: string): Promise<number> {
  const model = await getModel(modelId);
  return model ? Math.floor(model.maxTokens / 4) : 1024;
}