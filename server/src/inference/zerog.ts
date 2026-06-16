import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { BaseInferenceProvider, createErrorMapper, withRetry } from "./base.js";
import { logger } from "../lib/logger.js";

const ZEROG_TIMEOUT_MS = 30_000;
const ZEROG_STREAM_TIMEOUT_MS = 120_000;
const ZEROG_BASE_URL = "https://router-api.0g.ai";

function zerogUrl(path: string): string {
  const base = ZEROG_BASE_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function zerogHeaders(): Record<string, string> {
  const key = config.ZERO_G_API_KEY;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (key) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}

const mapZerogError = createErrorMapper("Zerog");

class ZerogProvider extends BaseInferenceProvider {
  protected readonly config = {
    name: "zerog",
    chatCompletionPath: "/v1/chat/completions",
    completionPath: "/v1/completions",
    healthPath: "/v1/models",
    defaultTimeoutMs: ZEROG_TIMEOUT_MS,
    streamTimeoutMs: ZEROG_STREAM_TIMEOUT_MS,
    getUrl: zerogUrl,
    getHeaders: zerogHeaders,
    mapError: mapZerogError,
    checkConfig: () => {
      if (!config.ZERO_G_API_KEY) {
        throw Object.assign(new Error("0g.ai API key not configured"), { status: 503 });
      }
    },
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.zerog";
  }
}

const provider = new ZerogProvider();

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}, signal?: AbortSignal): Promise<Response> {
  return withRetry(() => provider.chatCompletion(body, signal), {
    onRetry: (attempt, delay, err) => {
      logger.warn(`0g.ai request failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
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
      logger.warn(`0g.ai completion failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
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

export { chatCompletion as zerogChatCompletion };
