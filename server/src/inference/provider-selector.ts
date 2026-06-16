import { getModel } from "./models.js";
import type { ModelDef } from "./models.js";
import { isProviderAvailable } from "./provider-health.js";
import { parseProviderWeights, parseModelWeights } from "../lib/router-utils.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export type Provider = "venice" | "antseed" | "litellm" | "openrouter" | "together" | "deepinfra" | "surplus" | "morpheus" | "claude" | "gemini";

// ponytail: Surplus x402 signer is broken (EIP-712 scheme wrong; see surplus.ts:303-311).
// Only allow routing to surplus when the wallet key is set AND we're in development.
// Disable in all other environments until the EIP-3009 / Permit2 signer lands.
const SURPLUS_ENABLED = !!config.SURPLUS_WALLET_PRIVATE_KEY && config.NODE_ENV === "development";

export const ALL_PROVIDERS: Provider[] = SURPLUS_ENABLED
  ? ["venice", "antseed", "litellm", "openrouter", "together", "deepinfra", "surplus", "morpheus", "claude", "gemini"]
  : ["venice", "antseed", "litellm", "openrouter", "together", "deepinfra", "morpheus", "claude", "gemini"];

// ponytail: OPENSOURCE_PREFIXES was a dead loop — every miss fell through to
// `return "antseed"` below. Removed. If a future provider wants to claim
// open-source-prefix routing, add a guarded branch above the default.
function inferProviderFromModel(model: string): Provider {
  if (model.startsWith("openrouter/") || model.startsWith("openai/")) return "openrouter";
  if (model.startsWith("litellm/")) return "litellm";
  if (model.startsWith("together/")) return "together";
  if (model.startsWith("deepinfra/")) return "deepinfra";
  if (model.startsWith("morpheus/") || model.startsWith("mor/")) return "morpheus";
  if (model.startsWith("claude-")) return "claude";
  if (model.startsWith("gemini-")) return "gemini";
  return "antseed";
}

export interface ModelWeightConfig {
  weights: Map<Provider, number>;
  modelId: string;
}

function selectProviderWeighted(weights: Map<Provider, number>, available: Provider[]): Provider | null {
  const activeProviders = available.filter(p => weights.get(p) && weights.get(p)! > 0);
  if (activeProviders.length === 0) return null;
  const totalWeight = activeProviders.reduce((sum, p) => sum + (weights.get(p) || 0), 0);
  let cumulative = 0;
  const random = Math.random() * totalWeight;
  for (const provider of activeProviders) {
    cumulative += weights.get(provider) || 0;
    if (random <= cumulative) return provider;
  }
  return activeProviders[activeProviders.length - 1];
}

export function getModelIdForProvider(modelDef: ModelDef | null, provider: Provider, model: string): string {
  if (!modelDef) {
    if (model.startsWith("litellm/")) return model.replace("litellm/", "");
    return model;
  }
  const idMap: Record<string, string> = {
    venice: modelDef.veniceId ?? modelDef.id,
    antseed: modelDef.antseedId ?? modelDef.id,
    litellm: modelDef.litellmId ?? modelDef.id,
    openrouter: modelDef.openrouterId ?? modelDef.id,
    together: modelDef.togetherId ?? modelDef.id,
    deepinfra: modelDef.deepinfraId ?? modelDef.id,
    surplus: modelDef.surplusId ?? modelDef.id,
    morpheus: modelDef.morpheusId ?? modelDef.id,
    claude: modelDef.claudeId ?? modelDef.id,
    gemini: modelDef.geminiId ?? modelDef.id,
  };
  return idMap[provider] ?? modelDef.id;
}

function canUseProvider(modelDef: ModelDef | null, p: Provider): boolean {
  return !modelDef || modelDef.provider === "both" || modelDef.provider === "all" || modelDef.provider === p;
}

const availableCache: { providers: Provider[]; timestamp: number } = { providers: [], timestamp: 0 };
const AVAILABLE_CACHE_TTL_MS = 60_000;

async function getAvailableProviders(): Promise<Provider[]> {
  if (Date.now() - availableCache.timestamp < AVAILABLE_CACHE_TTL_MS) {
    return availableCache.providers;
  }
  const results = await Promise.all(ALL_PROVIDERS.map(async p => ({ provider: p, available: await isProviderAvailable(p) })));
  const providers = results.filter(r => r.available).map(r => r.provider);
  availableCache.providers = providers;
  availableCache.timestamp = Date.now();
  return providers;
}

async function selectFromWeights(weights: Map<Provider, number>, modelDef: ModelDef | null, model: string): Promise<{ provider: Provider; providerModelId: string } | null> {
  const availableProviders = await getAvailableProviders();
  const selected = selectProviderWeighted(weights, availableProviders);
  if (!selected || !canUseProvider(modelDef, selected)) return null;
  return { provider: selected, providerModelId: getModelIdForProvider(modelDef, selected, model) };
}

function logAndReturn(model: string, result: { provider: Provider; providerModelId: string }, source: string): { provider: Provider; providerModelId: string } {
  logger.info({ model, provider: result.provider, source, type: 'provider_selection' });
  return result;
}

export async function selectProvider(model: string): Promise<{ provider: Provider; providerModelId: string }> {
  const modelDef = await getModel(model);
  const preferred = modelDef ? modelDef.primaryProvider : inferProviderFromModel(model);
  const providerModelId = getModelIdForProvider(modelDef, preferred, model);
  const modelWeights = parseModelWeights(config.MODEL_WEIGHTS);
  const globalWeights = parseProviderWeights(config.PROVIDER_WEIGHTS);

  if (modelWeights.has(model)) {
    const result = await selectFromWeights(modelWeights.get(model)!, modelDef, model);
    if (result) return logAndReturn(model, result, "model_weights");
  }

  if (globalWeights) {
    const result = await selectFromWeights(globalWeights, modelDef, model);
    if (result) return logAndReturn(model, result, "global_weights");
  }

  if ((preferred !== "surplus" || SURPLUS_ENABLED) && await isProviderAvailable(preferred)) {
    return logAndReturn(model, { provider: preferred, providerModelId }, "primary");
  }

  const fallbackProviders = ALL_PROVIDERS.filter(p => p !== preferred && canUseProvider(modelDef, p));
  const fallbackResults = await Promise.all(
    fallbackProviders.map(async p => ({ provider: p, available: await isProviderAvailable(p) }))
  );
  
  const firstAvailable = fallbackResults.find(r => r.available);
  if (firstAvailable) {
    return logAndReturn(model, { 
      provider: firstAvailable.provider, 
      providerModelId: getModelIdForProvider(modelDef, firstAvailable.provider, model) 
    }, "fallback");
  }

  logger.error({ model, type: 'no_provider_available' }, "[router] No available provider for model");
  throw Object.assign(new Error("All inference providers are currently unavailable. Please try again later."), { status: 503 });
}
