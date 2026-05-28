import { ALL_PROVIDERS, type Provider } from "../inference/provider-selector.js";

export { ALL_PROVIDERS };
export type { Provider };

export function validateModelWeights(modelWeightsStr: string | undefined): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!modelWeightsStr) return { valid: true, errors: [] };

  const modelEntries = modelWeightsStr.split(";");
  for (let i = 0; i < modelEntries.length; i++) {
    const entry = modelEntries[i].trim();
    if (!entry) continue;

    const parts = entry.split("=");
    if (parts.length !== 2) {
      errors.push(`Entry ${i + 1}: expected "model=provider:weight,...", got "${entry}"`);
      continue;
    }

    const [modelId, weightsStr] = parts.map(s => s.trim());
    if (!modelId) {
      errors.push(`Entry ${i + 1}: model name cannot be empty`);
    }

    if (!weightsStr) {
      errors.push(`Entry ${i + 1}: weights cannot be empty for model "${modelId}"`);
      continue;
    }

    const weightEntries = weightsStr.split(",");
    let totalWeight = 0;
    for (const we of weightEntries) {
      const [provider, weight] = we.split(":").map(s => s.trim());
      if (!provider || !weight) {
        errors.push(`Entry ${i + 1}: invalid weight format "${we}" for model "${modelId}"`);
        continue;
      }
      if (!ALL_PROVIDERS.includes(provider as Provider)) {
        errors.push(`Entry ${i + 1}: unknown provider "${provider}" for model "${modelId}". Valid: ${ALL_PROVIDERS.join(", ")}`);
      }
      const w = parseInt(weight, 10);
      if (isNaN(w) || w < 0 || w > 100) {
        errors.push(`Entry ${i + 1}: weight "${weight}" must be 0-100 for provider "${provider}" in model "${modelId}"`);
      }
      totalWeight += w;
    }

    if (totalWeight > 0 && totalWeight !== 100) {
      errors.push(`Entry ${i + 1}: weights sum to ${totalWeight}% (should be 100 or omit 0% providers) for model "${modelId}"`);
    }
  }

  return { valid: errors.length === 0, errors };
}

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