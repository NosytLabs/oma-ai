import { getModel, calculateCost, estimateTokens, ensureCatalogLoaded } from './models.js';
import type { ModelPricing } from './types.js';
import { config } from '../config.js';

export { estimateTokens };

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
      markup: modelDef.markupPercent,
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
  const markupMultiplier = 1 + pricing.markup / 100;
  const discountMultiplier = 1 - discountPercent / 100;
  const costUsd = ((inputTokens * inputPerToken) + (outputTokens * outputPerToken)) * markupMultiplier * discountMultiplier;
  const baseUsd = (inputTokens * inputPerToken) + (outputTokens * outputPerToken);
  const markupUsd = costUsd - baseUsd;
  return {
    costCents: String(Math.max(1, Math.ceil(baseUsd * 100))),
    markupCents: String(Math.ceil(markupUsd * 100)),
    totalCents: String(Math.max(1, Math.ceil(costUsd * 100))),
  };
}

export async function calculateStreamingCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  discountPercent: number = 0
): Promise<CostCalculation> {
  return calculateActualCost(modelId, inputTokens, outputTokens, discountPercent);
}

export async function getEstimatedOutputTokens(modelId: string): Promise<number> {
  const model = await getModel(modelId);
  return model ? Math.floor(model.maxTokens / 4) : 1024;
}