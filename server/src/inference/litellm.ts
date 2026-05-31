import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { BaseInferenceProvider, createErrorMapper, healthCheck, withRetry } from "./base.js";

const LITELLM_TIMEOUT_MS = 30_000;
const LITELLM_STREAM_TIMEOUT_MS = 120_000;

function litellmUrl(path: string): string {
  const base = config.LITELLM_PROXY_URL?.replace(/\/+$/, "") ?? "";
  if (!base) throw Object.assign(new Error("LiteLLM not configured"), { status: 503 });
  return `${base}${path}`;
}

function litellmHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.LITELLM_API_KEY) {
    headers["Authorization"] = `Bearer ${config.LITELLM_API_KEY}`;
  }
  return headers;
}

const mapLitellmError = createErrorMapper("LiteLLM");

class LiteLLMProvider extends BaseInferenceProvider {
  protected readonly config = {
    name: "litellm",
    chatCompletionPath: "/v1/chat/completions",
    completionPath: "/v1/completions",
    healthPath: "/health",
    defaultTimeoutMs: LITELLM_TIMEOUT_MS,
    streamTimeoutMs: LITELLM_STREAM_TIMEOUT_MS,
    getUrl: litellmUrl,
    getHeaders: litellmHeaders,
    mapError: mapLitellmError,
    checkConfig: () => {
      if (!config.LITELLM_PROXY_URL) {
        throw Object.assign(new Error("LiteLLM not configured"), { status: 503 });
      }
    },
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.litellm";
  }
}

const provider = new LiteLLMProvider();

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return withRetry(() => provider.chatCompletion(body), {
    onRetry: (attempt, delay, err) => {
      console.warn(`LiteLLM request failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
    },
  });
}

export async function completion(body: {
  model: string;
  prompt?: string | Array<string>;
  input?: string | Array<string>;
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return withRetry(() => provider.completion(body), {
    onRetry: (attempt, delay, err) => {
      console.warn(`LiteLLM completion failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
    },
  });
}

export function streamChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.streamChatCompletion(body);
}

export async function litellmHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs: number;
}> {
  return healthCheck({
    getUrl: () => litellmUrl("/health"),
    getHeaders: litellmHeaders,
    keyConfigured: !!config.LITELLM_PROXY_URL,
  });
}

export { chatCompletion as litellmChatCompletion };