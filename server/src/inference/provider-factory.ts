import { config } from "../config.js";
import { BaseInferenceProvider, type ProviderConfig, createErrorMapper } from "./base.js";

export interface ProviderEndpoints {
  chat: string;
  completion?: string;
  embeddings?: string;
  image?: string;
  audio?: string;
  video?: string;
  health?: string;
}

export interface ProviderFactoryConfig {
  name: "venice" | "surplus" | "gonka";
  apiKeyConfigPath?: string;
  baseUrl: string;
  endpoints: ProviderEndpoints;
  reportHealth?: boolean;
  defaultTimeoutMs?: number;
  streamTimeoutMs?: number;
  getHeaders?: () => Record<string, string>;
  errorMapper?: (status: number, body: string) => never;
}

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_STREAM_TIMEOUT_MS = 120_000;
const DEFAULT_HEALTH_CHECK_TIMEOUT_MS = 10_000;

function buildUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  return `${base}${path}`;
}

export function createProvider<T extends BaseInferenceProvider>(
  factoryConfig: ProviderFactoryConfig,
  ProviderClass: new (config: ProviderConfig) => T
): T {
  const {
    name,
    baseUrl,
    endpoints,
    reportHealth = true,
    defaultTimeoutMs = DEFAULT_TIMEOUT_MS,
    streamTimeoutMs = DEFAULT_STREAM_TIMEOUT_MS,
    getHeaders: customGetHeaders,
    errorMapper,
  } = factoryConfig;

  const mapError = errorMapper ?? createErrorMapper(name);

  const providerConfig: ProviderConfig = {
    name,
    chatCompletionPath: endpoints.chat,
    completionPath: endpoints.completion ?? "/v1/completions",
    healthPath: endpoints.health ?? "/health",
    defaultTimeoutMs,
    streamTimeoutMs,
    getUrl: (path: string) => buildUrl(baseUrl, path),
    getHeaders: customGetHeaders ?? (() => ({ "Content-Type": "application/json" })),
    mapError,
    checkConfig: () => {
      if (factoryConfig.apiKeyConfigPath) {
        const key = config[factoryConfig.apiKeyConfigPath as keyof typeof config] as string | undefined;
        if (!key) {
          throw Object.assign(new Error(`${name} API key not configured`), { status: 503 });
        }
      }
    },
    reportHealth,
  };

  return new ProviderClass(providerConfig);
}

export async function healthCheck(
  _provider: "venice" | "surplus" | "gonka",
  baseUrl: string,
  healthPath: string,
  timeoutMs: number = DEFAULT_HEALTH_CHECK_TIMEOUT_MS
): Promise<{ isUp: boolean; latencyMs: number }> {
  const url = buildUrl(baseUrl, healthPath);
  const start = Date.now();

  try {
    const resp = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latencyMs = Date.now() - start;
    return { isUp: resp.ok, latencyMs };
  } catch {
    return { isUp: false, latencyMs: Date.now() - start };
  }
}

export { createErrorMapper };