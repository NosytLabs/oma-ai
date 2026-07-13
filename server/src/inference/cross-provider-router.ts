import type { ModelDef } from "./models.js";
import type { Provider } from "./provider-selector.js";

const PROVIDER_ID_FIELDS: ReadonlyArray<{ provider: Provider; field: keyof ModelDef }> = [
  { provider: "venice", field: "veniceId" },
  { provider: "surplus", field: "surplusId" },
  { provider: "gonka", field: "gonkaId" },
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
  surplus: { attempts: 0, failovers: 0 },
  gonka: { attempts: 0, failovers: 0 },
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

export async function getCandidateProviders(
  modelId: string,
  modelDef: ModelDef | null,
): Promise<{ primary: Provider; alternates: Provider[] }> {
  if (!modelDef) {
    // Mirror the legacy selectProvider inference for catalog-unknown models.
    // All unknown models now route through Venice.
    return { primary: "venice", alternates: [] };
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
