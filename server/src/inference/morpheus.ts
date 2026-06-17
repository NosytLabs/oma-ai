/**
 * Morpheus (mor.org) inference provider.
 *
 * Morpheus is a decentralized, TEE-backed (Trusted Execution Environment)
 * inference network. It exposes an OpenAI-compatible API at
 * `https://api.mor.org/api/v1` with dozens of models including GLM 5, Kimi K2.5,
 * Qwen3 Coder, Gemma 4, Arcee Trinity, and llama-3-70b. Hardware attestation
 * is performed on the provider side; no prompt/response logging occurs.
 *
 * API: https://api.mor.org/api/v1
 * Docs: https://apidocs.mor.org/
 * Signup: https://app.mor.org/
 *
 * Integration follows the deepinfra.ts / together.ts / openrouter.ts pattern
 * (OpenAI-compatible, simple Bearer auth). The provider is opt-in: when
 * `MORPHEUS_API_KEY` is unset the `checkConfig` hook throws a 503, which
 * the router treats identically to every other optional provider.
 */
import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { BaseInferenceProvider, createErrorMapper, withRetry } from "./base.js";
import { logger } from "../lib/logger.js";

const MORPHEUS_TIMEOUT_MS = 60_000;
const MORPHEUS_STREAM_TIMEOUT_MS = 120_000;
const MORPHEUS_MODELS_TIMEOUT_MS = 10_000;

function morpheusUrl(path: string): string {
  const base = config.MORPHEUS_BASE_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function morpheusHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.MORPHEUS_API_KEY}`,
  };
}

const mapMorpheusError = createErrorMapper("Morpheus");

class MorpheusProvider extends BaseInferenceProvider {
  protected readonly config = {
    name: "morpheus",
    chatCompletionPath: "/chat/completions",
    completionPath: "/completions",
    healthPath: "/models",
    defaultTimeoutMs: MORPHEUS_TIMEOUT_MS,
    streamTimeoutMs: MORPHEUS_STREAM_TIMEOUT_MS,
    getUrl: morpheusUrl,
    getHeaders: morpheusHeaders,
    mapError: mapMorpheusError,
    checkConfig: () => {
      if (!config.MORPHEUS_API_KEY) {
        throw Object.assign(new Error("Morpheus API key not configured"), { status: 503 });
      }
    },
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.morpheus";
  }
}

const provider = new MorpheusProvider();

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}, signal?: AbortSignal): Promise<Response> {
  return withRetry(() => provider.chatCompletion(body, signal), {
    onRetry: (attempt, delay, err) => {
      logger.warn({ attempt, delayMs: Math.round(delay), err: err.message }, "Morpheus request failed, retrying");
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
      logger.warn({ attempt, delayMs: Math.round(delay), err: err.message }, "Morpheus completion failed, retrying");
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

export async function morpheusModels(): Promise<unknown[]> {
  if (!config.MORPHEUS_API_KEY) {
    throw Object.assign(new Error("Morpheus API key not configured"), { status: 503 });
  }

  const resp = await fetch(morpheusUrl("/models"), {
    headers: { Authorization: `Bearer ${config.MORPHEUS_API_KEY}` },
    signal: AbortSignal.timeout(MORPHEUS_MODELS_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`Morpheus models error ${resp.status}: ${text.slice(0, 500)}`),
      { status: resp.status }
    );
  }

  const data = await resp.json();
  return (data as { data?: unknown[] }).data ?? (data as unknown[]);
}

export async function healthCheck(): Promise<{ isUp: boolean; latencyMs: number }> {
  if (!config.MORPHEUS_API_KEY) {
    return { isUp: false, latencyMs: -1 };
  }
  const start = Date.now();
  try {
    const resp = await fetch(morpheusUrl("/models"), {
      method: "GET",
      headers: morpheusHeaders(),
      signal: AbortSignal.timeout(MORPHEUS_MODELS_TIMEOUT_MS),
    });
    return { isUp: resp.ok, latencyMs: Date.now() - start };
  } catch {
    return { isUp: false, latencyMs: Date.now() - start };
  }
}

export { chatCompletion as morpheusChatCompletion };
