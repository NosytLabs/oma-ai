import { config } from "../config.js";
import type { ChatMessage, InferenceError } from "./types.js";
import { BaseInferenceProvider, type ProviderConfig, createErrorMapper } from "./base.js";
import { createProvider } from "./provider-factory.js";
import { reportProviderResult } from "./provider-health.js";
import { logger } from "../lib/logger.js";

const GONKA_TIMEOUT_MS = 60_000;
const GONKA_STREAM_TIMEOUT_MS = 120_000;
const GONKA_HEALTH_TIMEOUT_MS = 5_000;

/**
 * Gonka is a decentralized "provable inference" network. OMA reaches it
 * through a community broker (inference.dahl.global is one of the listed
 * Gonka brokers). From OMA's perspective a broker is just an
 * OpenAI-compatible endpoint: base_url + Bearer key + /v1/chat/completions.
 *
 * WAF note: the dahl broker sits behind a Cloudflare rule (error 1010) that
 * blocks requests without a browser-like User-Agent. We always send one.
 */
function gonkaHeaders(): Record<string, string> {
  const key = config.GONKA_API_KEY;
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
}

const mapGonkaError = createGonkaErrorMapper();

function createGonkaErrorMapper(): (status: number, body: string) => never {
  return (status: number, body: string): never => {
    let message = `Gonka error ${status}`;
    let type = "gonka_api_error";
    let code = "gonka_api_error";
    let retryable = status >= 500;

    try {
      const parsed = JSON.parse(body);
      if (parsed.error?.message) message = parsed.error.message;
      if (parsed.error?.type) type = parsed.error.type;
    } catch {
      message = body.slice(0, 500) || message;
    }

    if (status === 401) {
      code = "gonka_unauthorized";
      type = "gonka_unauthorized";
      retryable = false;
    } else if (status === 402) {
      code = "gonka_payment_required";
      type = "gonka_payment_required";
      retryable = false;
    } else if (status === 403) {
      // Cloudflare 1010 (bot block) or broker access denied — not retryable.
      code = "gonka_forbidden";
      type = "gonka_forbidden";
      retryable = false;
    } else if (status === 429) {
      code = "gonka_rate_limited";
      type = "gonka_rate_limited";
      retryable = true;
    } else if (status >= 500) {
      code = "gonka_server_error";
      type = "gonka_server_error";
      retryable = status !== 501;
    } else if (status >= 400) {
      code = `gonka_client_error_${status}`;
      retryable = false;
    }

    throw Object.assign(new Error(message), { status, code, retryable, type }) as InferenceError;
  };
}

function checkGonkaConfig(): void {
  if (!config.GONKA_API_KEY) {
    throw Object.assign(new Error("Gonka API key not configured"), {
      status: 503,
      code: "gonka_config_missing",
      retryable: false,
      type: "gonka_config_missing",
    }) as InferenceError;
  }
}

class GonkaProvider extends BaseInferenceProvider {
  protected readonly config: ProviderConfig;

  constructor(providerConfig: ProviderConfig) {
    super();
    this.config = providerConfig;
  }

  protected get spanName(): string {
    return "llm.provider.gonka";
  }

  public async chatCompletion(
    body: { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown },
    signal?: AbortSignal,
  ): Promise<Response> {
    checkGonkaConfig();
    return this.chatCompletionInternal(body, undefined, signal);
  }
}

const provider = createProvider(
  {
    name: "gonka",
    apiKeyConfigPath: "GONKA_API_KEY",
    baseUrl: config.GONKA_API_URL,
    endpoints: {
      chat: "/v1/chat/completions",
      completion: "/v1/completions",
      health: "/v1/models",
    },
    reportHealth: false,
    defaultTimeoutMs: GONKA_TIMEOUT_MS,
    streamTimeoutMs: GONKA_STREAM_TIMEOUT_MS,
    getHeaders: gonkaHeaders,
    errorMapper: mapGonkaError,
  },
  GonkaProvider,
);

export async function chatCompletion(
  body: { model: string; messages: ChatMessage[]; stream?: boolean; [key: string]: unknown },
  signal?: AbortSignal,
): Promise<Response> {
  return provider.chatCompletion(body, signal);
}

export async function gonkaModels(): Promise<unknown[]> {
  if (!config.GONKA_API_KEY) {
    throw Object.assign(new Error("Gonka API key not configured"), {
      status: 503,
      code: "gonka_config_missing",
      retryable: false,
      type: "gonka_config_missing",
    }) as InferenceError;
  }
  const resp = await fetch(`${config.GONKA_API_URL.replace(/\/+$/, "")}/v1/models`, {
    headers: gonkaHeaders(),
    signal: AbortSignal.timeout(GONKA_HEALTH_TIMEOUT_MS),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    mapGonkaError(resp.status, text);
  }
  const data = await resp.json();
  return data.data ?? data;
}

