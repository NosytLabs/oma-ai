/**
 * Minimal billing service stub.
 * Real implementation comes in a follow-up; for now returns pass-through
 * pricing so the chat routes can work.
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
