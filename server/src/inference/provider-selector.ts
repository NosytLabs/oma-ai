import { getModel } from "./models.js";
import type { ModelDef } from "./models.js";
import { isProviderAvailable } from "./provider-health.js";
import { parseProviderWeights, parseModelWeights } from "../lib/router-utils.js";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";

export type Provider = "venice" | "surplus" | "gonka";

// ponytail: Surplus x402 signer is broken (EIP-712 scheme wrong; see surplus.ts:303-311).
// Only allow routing to surplus when the wallet key is set AND we're in development.
// Disable in all other environments until the EIP-3009 / Permit2 signer lands.
const SURPLUS_ENABLED = !!config.SURPLUS_WALLET_PRIVATE_KEY && config.NODE_ENV === "development";
export { SURPLUS_ENABLED };

// Gonka routes through OpenBroker (api.openbroker.gonka.gg) — free community
// broker with 0% markup. Always enabled; works with or without an API key
// (no enable flag needed — availability is gated by isProviderAvailable()).

/** Detect placeholder / truncated API keys that will always 401. */
function isPlaceholderKey(key: string | undefined): boolean {
  if (!key) return true;
  if (key.length < 20) return true;
  if (key.includes("...") || key.includes("placeholder") || key.includes("changeme")) return true;
  return false;
}

export const VENICE_CONFIGURED = !isPlaceholderKey(config.VENICE_API_KEY);

if (!VENICE_CONFIGURED) {
  logger.warn(
    "[startup] VENICE_API_KEY is missing or looks like a placeholder — Venice routing disabled. " +
    "87 venice-hosted models will return 503 until a real key is set. " +
    "Gonka models (MiniMax-M2.7, Kimi-K2.6) remain available.",
  );
}

export const ALL_PROVIDERS: Provider[] = [
  "gonka",
  "venice",
  ...(SURPLUS_ENABLED ? (["surplus"] as Provider[]) : []),
];

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

export function getModelIdForProvider(modelDef: ModelDef | null, provider: Provider, model: string): string | null {
  if (!modelDef) {
    return null;
  }
  const idMap: Record<string, string | undefined> = {
    venice: modelDef.veniceId ?? modelDef.id,
    surplus: modelDef.surplusId ?? modelDef.id,
    gonka: modelDef.gonkaId, // null when unset — caller must check, do NOT default to model.id
  };
  const resolved = idMap[provider];
  if (!resolved) return null;
  return resolved;
}

export function hasProviderMapping(modelDef: ModelDef | null, provider: Provider): boolean {
  if (!modelDef) return false;
  const idMap: Record<string, string | undefined> = {
    venice: modelDef.veniceId ?? modelDef.id,
    surplus: modelDef.surplusId ?? modelDef.id,
    gonka: modelDef.gonkaId,
  };
  return Boolean(idMap[provider]);
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
  const providerModelId = getModelIdForProvider(modelDef, selected, model);
  if (!providerModelId) return null;
  return { provider: selected, providerModelId };
}

function logAndReturn(model: string, result: { provider: Provider; providerModelId: string }, source: string): { provider: Provider; providerModelId: string } {
  logger.info({ model, provider: result.provider, source, type: 'provider_selection' });
  return result;
}

export async function selectProvider(model: string): Promise<{ provider: Provider; providerModelId: string }> {
  const modelDef = await getModel(model);
  const preferred = modelDef?.primaryProvider ?? "gonka";
  const preferredModelId = getModelIdForProvider(modelDef, preferred, model);
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

  if (preferredModelId && (preferred !== "surplus" || SURPLUS_ENABLED) && await isProviderAvailable(preferred)) {
    return logAndReturn(model, { provider: preferred, providerModelId: preferredModelId }, "primary");
  }

  const fallbackProviders = ALL_PROVIDERS.filter(p => p !== preferred && canUseProvider(modelDef, p));
  const fallbackResults = await Promise.all(
    fallbackProviders.map(async p => {
      const mapping = getModelIdForProvider(modelDef, p, model);
      const available = Boolean(mapping) && await isProviderAvailable(p);
      return { provider: p, mapping, available };
    })
  );

  const firstAvailable = fallbackResults.find(r => r.available && r.mapping);
  if (firstAvailable && firstAvailable.mapping) {
    return logAndReturn(model, {
      provider: firstAvailable.provider,
      providerModelId: firstAvailable.mapping,
    }, "fallback");
  }

  logger.error({ model, type: 'no_provider_available' }, "[router] No available provider for model");
  throw Object.assign(new Error("All inference providers are currently unavailable. Please try again later."), { status: 503 });
}
