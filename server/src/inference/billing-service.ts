/**
 * Billing helper — pass-through pricing lookup against the model catalog.
 *
 * The chat route calls `getModelPricing(modelId)` before deducting
 * credits from `creditBalances`. Markup is applied at deduction time
 * in `recordUsage`.
 */
import { getModelById } from "./models.js";

export interface ModelPricing {
  inputPer1M: number;
  outputPer1M: number;
  markup: number;
}

export function getModelPricing(modelId: string): ModelPricing {
  const m = getModelById(modelId);
  if (!m) {
    return { inputPer1M: 0, outputPer1M: 0, markup: 25 };
  }
  return {
    inputPer1M: m.inputPricePer1M,
    outputPer1M: m.outputPricePer1M,
    markup: m.markupPercent,
  };
}
