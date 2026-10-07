import { ProviderError } from "./provider-route.js";

type Limits = { id: string; maxTokens: number; maxOutputTokens?: number; contextWindow?: number; disabledReason?: string };

/** Input tokens are an estimate; the provider remains the exact tokenizer authority. */
export function resolveOutputBudget(model: Limits, requested: number | undefined, promptTokens: number): number {
  if (model.disabledReason) throw new ProviderError(model.disabledReason, 503);
  const outputCap = model.maxOutputTokens ?? model.maxTokens;
  if (requested !== undefined && requested > outputCap) {
    throw new ProviderError(`max_tokens exceeds the ${outputCap} output-token limit for ${model.id}.`, 400);
  }
  const remaining = (model.contextWindow ?? Infinity) - promptTokens;
  const output = requested ?? Math.min(model.maxTokens, outputCap, remaining);
  if (remaining <= 0 || output > remaining) {
    throw new ProviderError(`Estimated input plus output exceeds the ${model.contextWindow}-token context window for ${model.id}. Shorten the conversation or reduce max_tokens.`, 400);
  }
  return output;
}
