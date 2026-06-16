import type { ModelDef } from "./models.js";
import type { Provider } from "./provider-selector.js";

const PROVIDER_ID_FIELDS: ReadonlyArray<{ provider: Provider; field: keyof ModelDef }> = [
  { provider: "venice", field: "veniceId" },
  { provider: "antseed", field: "antseedId" },
  { provider: "litellm", field: "litellmId" },
  { provider: "openrouter", field: "openrouterId" },
  { provider: "together", field: "togetherId" },
  { provider: "deepinfra", field: "deepinfraId" },
  { provider: "surplus", field: "surplusId" },
  { provider: "morpheus", field: "morpheusId" },
  { provider: "claude", field: "claudeId" },
  { provider: "gemini", field: "geminiId" },
];

const ALIAS_MAP: Record<string, string> = {
  llama: "llama-3.3-70b",
  auto: "deepseek-v3.2",
};

export interface FailoverEvent {
  modelId: string;
  fromProvider: Provider;
  toProvider: Provider;
  latencyMs: number;
}

export interface RouterProviderStat {
  attempts: number;
  failovers: number;
}

export interface RouterStats {
  totalRequests: number;
  failoverCount: number;
  byProvider: Record<Provider, RouterProviderStat>;
}

const STATS_BY_PROVIDER: Record<Provider, RouterProviderStat> = {
  venice: { attempts: 0, failovers: 0 },
  antseed: { attempts: 0, failovers: 0 },
  litellm: { attempts: 0, failovers: 0 },
  openrouter: { attempts: 0, failovers: 0 },
  together: { attempts: 0, failovers: 0 },
  deepinfra: { attempts: 0, failovers: 0 },
  surplus: { attempts: 0, failovers: 0 },
  morpheus: { attempts: 0, failovers: 0 },
  claude: { attempts: 0, failovers: 0 },
  gemini: { attempts: 0, failovers: 0 },
};

let totalRequests = 0;
let failoverCount = 0;

export async function findProvidersForModel(
  _modelId: string,
  modelDef: ModelDef | null,
): Promise<Provider[]> {
  if (!modelDef) return [];
  const out: Provider[] = [];
  for (const { provider, field } of PROVIDER_ID_FIELDS) {
    const v = modelDef[field];
    if (typeof v === "string" && v.length > 0) {
      out.push(provider);
    }
  }
  return out;
}

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

export async function getCandidateProviders(
  modelId: string,
  modelDef: ModelDef | null,
): Promise<{ primary: Provider; alternates: Provider[] }> {
  if (!modelDef) {
    // Ponytail: mirror the legacy selectProvider inference for catalog-unknown
    // models so prefix-routed callers (openrouter/x, litellm/x, etc.) still
    // land on the right provider and unknowns still default to antseed.
    return { primary: inferProviderFromModel(modelId), alternates: [] };
  }
  const all = await findProvidersForModel(modelId, modelDef);
  const primary = modelDef.primaryProvider;
  const alternates = all.filter((p) => p !== primary);
  return { primary, alternates };
}

export async function resolveModelAlias(modelId: string): Promise<string> {
  if (Object.prototype.hasOwnProperty.call(ALIAS_MAP, modelId)) {
    return ALIAS_MAP[modelId];
  }
  return modelId;
}

export function recordFailover(event: FailoverEvent): void {
  totalRequests += 1;
  failoverCount += 1;
  if (!STATS_BY_PROVIDER[event.fromProvider]) {
    STATS_BY_PROVIDER[event.fromProvider] = { attempts: 0, failovers: 0 };
  }
  if (!STATS_BY_PROVIDER[event.toProvider]) {
    STATS_BY_PROVIDER[event.toProvider] = { attempts: 0, failovers: 0 };
  }
  STATS_BY_PROVIDER[event.fromProvider].attempts += 1;
  STATS_BY_PROVIDER[event.fromProvider].failovers += 1;
  STATS_BY_PROVIDER[event.toProvider].attempts += 1;
}

export function getRouterStats(): RouterStats {
  const byProvider: Record<string, RouterProviderStat> = {};
  for (const k of Object.keys(STATS_BY_PROVIDER) as Provider[]) {
    byProvider[k] = { ...STATS_BY_PROVIDER[k] };
  }
  return {
    totalRequests,
    failoverCount,
    byProvider: byProvider as Record<Provider, RouterProviderStat>,
  };
}

export function __resetRouterStatsForTests(): void {
  totalRequests = 0;
  failoverCount = 0;
  for (const k of Object.keys(STATS_BY_PROVIDER) as Provider[]) {
    STATS_BY_PROVIDER[k] = { attempts: 0, failovers: 0 };
  }
}

export { type Provider };
