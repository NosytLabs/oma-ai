import { ALL_PROVIDERS, type Provider } from "../inference/provider-selector.js";

export function parseProviderWeights(weightStr: string | undefined): Map<Provider, number> | null {
  if (!weightStr) return null;

  const weights = new Map<Provider, number>();
  const entries = weightStr.split(",");

  for (const entry of entries) {
    const [provider, weight] = entry.split(":").map(s => s.trim());
    if (provider && weight !== undefined) {
      const w = parseInt(weight, 10);
      if (!isNaN(w) && w >= 0 && ALL_PROVIDERS.includes(provider as Provider)) {
        weights.set(provider as Provider, w);
      }
    }
  }

  return weights.size > 0 ? weights : null;
}

export function parseModelWeights(modelWeightsStr: string | undefined): Map<string, Map<Provider, number>> {
  const result = new Map<string, Map<Provider, number>>();
  if (!modelWeightsStr) return result;

  const modelEntries = modelWeightsStr.split(";");
  for (const entry of modelEntries) {
    const parts = entry.split("=");
    if (parts.length !== 2) continue;

    const [modelId, weightsStr] = parts.map(s => s.trim());
    if (!modelId || !weightsStr) continue;

    const weights = parseProviderWeights(weightsStr);
    if (weights) {
      result.set(modelId, weights);
    }
  }

  return result;
}