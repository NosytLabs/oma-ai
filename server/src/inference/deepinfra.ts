import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { BaseInferenceProvider, createErrorMapper, withRetry } from "./base.js";

const DEEPINFRA_TIMEOUT_MS = 60_000;
const DEEPINFRA_STREAM_TIMEOUT_MS = 120_000;

function deepinfraUrl(path: string): string {
  const base = config.DEEPINFRA_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function deepinfraHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.DEEPINFRA_API_KEY}`,
  };
}

const mapDeepinfraError = createErrorMapper("DeepInfra");

class DeepInfraProvider extends BaseInferenceProvider {
  protected readonly config = {
    name: "deepinfra",
    chatCompletionPath: "/chat/completions",
    completionPath: "/completions",
    healthPath: "/models",
    defaultTimeoutMs: DEEPINFRA_TIMEOUT_MS,
    streamTimeoutMs: DEEPINFRA_STREAM_TIMEOUT_MS,
    getUrl: deepinfraUrl,
    getHeaders: deepinfraHeaders,
    mapError: mapDeepinfraError,
    checkConfig: () => {
      if (!config.DEEPINFRA_API_KEY) {
        throw Object.assign(new Error("DeepInfra API key not configured"), { status: 503 });
      }
    },
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.deepinfra";
  }
}

const provider = new DeepInfraProvider();

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}, signal?: AbortSignal): Promise<Response> {
  return withRetry(() => provider.chatCompletion(body, signal), {
    onRetry: (attempt, delay, err) => {
      console.warn(`DeepInfra request failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
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
      console.warn(`DeepInfra completion failed, attempt ${attempt}, retrying in ${Math.round(delay)}ms: ${err.message}`);
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

export { chatCompletion as deepinfraChatCompletion };
