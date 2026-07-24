import { config } from "../config.js";
import type { ChatMessage, InferenceError } from "./types.js";
import { BaseInferenceProvider, type ProviderConfig } from "./base.js";
import { createProvider } from "./provider-factory.js";

const GONKA_TIMEOUT_MS = 60_000;
const GONKA_STREAM_TIMEOUT_MS = 120_000;
const GONKA_HEALTH_TIMEOUT_MS = 5_000;

/**
 * Gonka is a decentralized "provable inference" network. OMA reaches it
 * through a community broker — by default Gonka Labs OpenBroker
 * (api.openbroker.gonka.gg), which has 0% markup and passes network rates
 * through. Other community brokers (gate.joingonka.ai, inference.dahl.global,
 * gonka-api.org, proxy.gonka.gg) also work — override via GONKA_API_URL.
 * From OMA's perspective a broker is just an OpenAI-compatible endpoint:
 * base_url + Bearer key + /v1/chat/completions.
 *
 * WAF note: some brokers (e.g. dahl) sit behind Cloudflare with bot-check
 * (error 1010). We always send a browser-like User-Agent as a safety net.
 */
function gonkaHeaders(): Record<string, string> {
  const key = config.GONKA_API_KEY || config.OPENBROKER_API_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
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
  // OpenBroker (api.openbroker.gonka.gg) is a free community broker —
  // works without an API key. Only warn if explicitly configured but empty.
  // No-op: keyless access is the default free-tier path.
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
  // OpenBroker works keyless — no config gate needed.
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

