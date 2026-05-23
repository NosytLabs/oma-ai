import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { BaseInferenceProvider, createErrorMapper } from "./base.js";

const ANTSEED_TIMEOUT_MS = 30_000;
const ANTSEED_STREAM_TIMEOUT_MS = 120_000;

function antseedUrl(path: string): string {
  const base = config.ANTSEED_PROXY_URL?.replace(/\/+$/, "") ?? "";
  if (!base) throw Object.assign(new Error("AntSeed not configured"), { status: 503 });
  return `${base}${path}`;
}

const mapAntseedError = createErrorMapper("AntSeed");

class AntSeedProvider extends BaseInferenceProvider {
  protected readonly config = {
    name: "antseed",
    chatCompletionPath: "/v1/chat/completions",
    completionPath: "/v1/completions",
    healthPath: "/health",
    defaultTimeoutMs: ANTSEED_TIMEOUT_MS,
    streamTimeoutMs: ANTSEED_STREAM_TIMEOUT_MS,
    getUrl: antseedUrl,
    getHeaders: () => ({ "Content-Type": "application/json" }),
    mapError: mapAntseedError,
    checkConfig: () => {
      if (!config.ANTSEED_PROXY_URL) {
        throw Object.assign(new Error("AntSeed not configured"), { status: 503 });
      }
    },
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.antseed";
  }
}

const provider = new AntSeedProvider();

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.chatCompletion(body);
}

export async function completion(body: {
  model: string;
  prompt?: string | Array<string>;
  input?: string | Array<string>;
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.completion(body);
}

export function streamChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.streamChatCompletion(body);
}

export async function antseedHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs: number;
}> {
  if (!config.ANTSEED_PROXY_URL) {
    return { isUp: false, latencyMs: -1 };
  }

  const start = Date.now();

  try {
    const resp = await fetch(antseedUrl("/health"), {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    return { isUp: resp.ok, latencyMs };
  } catch {
    return { isUp: false, latencyMs: Date.now() - start };
  }
}

export { chatCompletion as antseedChatCompletion };