import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { BaseInferenceProvider, createErrorMapper, healthCheck, withRetry } from "./base.js";

const TOGETHER_TIMEOUT_MS = 30_000;
const TOGETHER_STREAM_TIMEOUT_MS = 120_000;

function togetherUrl(path: string): string {
  const base = config.TOGETHER_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function togetherHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.TOGETHER_API_KEY}`,
  };
}

const mapTogetherError = createErrorMapper("Together AI");

class TogetherProvider extends BaseInferenceProvider {
  protected readonly config = {
    name: "together",
    chatCompletionPath: "/v1/chat/completions",
    completionPath: "/v1/completions",
    healthPath: "/v1/models",
    defaultTimeoutMs: TOGETHER_TIMEOUT_MS,
    streamTimeoutMs: TOGETHER_STREAM_TIMEOUT_MS,
    getUrl: togetherUrl,
    getHeaders: togetherHeaders,
    mapError: mapTogetherError,
    checkConfig: () => {
      if (!config.TOGETHER_API_KEY) {
        throw Object.assign(new Error("Together AI API key not configured"), { status: 503 });
      }
    },
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.together";
  }
}

const provider = new TogetherProvider();

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return withRetry(() => provider.chatCompletion(body), {
    onRetry: (attempt, delay, err) => {
      console.warn(`Together AI request failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
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
      console.warn(`Together AI completion failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
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

export async function togetherHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs: number;
}> {
  return healthCheck({
    getUrl: () => togetherUrl("/v1/models"),
    getHeaders: togetherHeaders,
    keyConfigured: !!config.TOGETHER_API_KEY,
  });
}

export { chatCompletion as togetherChatCompletion };