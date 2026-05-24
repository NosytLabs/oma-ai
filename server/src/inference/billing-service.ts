import { getModel, calculateCost, estimateTokens } from './models.js';
import type { ModelPricing } from './types.js';

export { estimateTokens };

export interface CostCalculation {
  costCents: string;
  markupCents: string;
  totalCents: string;
}

export function getModelPricing(modelId: string): ModelPricing {
  const modelDef = getModel(modelId);
  if (modelDef) {
    return {
      inputPer1k: modelDef.inputPricePer1M / 1000,
      outputPer1k: modelDef.outputPricePer1M / 1000,
      provider: modelDef.primaryProvider,
      markup: modelDef.markupPercent,
    };
  }

  if (modelId.startsWith("litellm/")) {
    return { inputPer1k: 0.0015, outputPer1k: 0.002, provider: "litellm", markup: 5 };
  }
  if (modelId.startsWith("openrouter/")) {
    return { inputPer1k: 0.0015, outputPer1k: 0.002, provider: "openrouter", markup: 5 };
  }
  if (modelId.startsWith("together/")) {
    return { inputPer1k: 0.001, outputPer1k: 0.002, provider: "together", markup: 5 };
  }
  if (modelId.startsWith("deepinfra/")) {
    return { inputPer1k: 0.001, outputPer1k: 0.002, provider: "deepinfra", markup: 5 };
  }

  return { inputPer1k: 0.001, outputPer1k: 0.002, provider: "venice", markup: 150 };
}

export function estimateCost(
  modelId: string,
  inputTokens: number,
  estimatedOutputTokens: number,
  discountPercent: number = 0
): string {
  const pricing = getModelPricing(modelId);
  const inputPerToken = pricing.inputPer1k / 1000;
  const outputPerToken = pricing.outputPer1k / 1000;
  const markupMultiplier = 1 + pricing.markup / 100;
  const discountMultiplier = 1 - discountPercent / 100;
  const estimatedCostUsd = ((inputTokens * inputPerToken) + (estimatedOutputTokens * outputPerToken)) * markupMultiplier * discountMultiplier;
  return String(Math.max(1, Math.ceil(estimatedCostUsd * 100)));
}

export function calculateActualCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  discountPercent: number = 0
): CostCalculation {
  const model = getModel(modelId);
  if (model) {
    return calculateCost(model.id, inputTokens, outputTokens, discountPercent);
  }

  const pricing = getModelPricing(modelId);
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

export function calculateStreamingCost(
  modelId: string,
  inputTokens: number,
  outputTokens: number,
  discountPercent: number = 0
): CostCalculation {
  return calculateActualCost(modelId, inputTokens, outputTokens, discountPercent);
}

export function getEstimatedOutputTokens(modelId: string): number {
  const model = getModel(modelId);
  return model ? Math.floor(model.maxTokens / 4) : 1024;
}