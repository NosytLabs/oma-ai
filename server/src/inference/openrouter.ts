import { config } from "../config.js";
import type { ChatMessage } from "./types.js";
import { BaseInferenceProvider, createErrorMapper, healthCheck } from "./base.js";

const OPENROUTER_TIMEOUT_MS = 30_000;
const OPENROUTER_STREAM_TIMEOUT_MS = 120_000;

function openrouterUrl(path: string): string {
  const base = config.OPENROUTER_API_URL.replace(/\/+$/, "");
  return `${base}${path}`;
}

function openrouterHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
  };
  if (config.OPENROUTER_REFERRER) {
    headers["X-Title"] = config.OPENROUTER_REFERRER;
  }
  return headers;
}

const mapOpenrouterError = createErrorMapper("OpenRouter");

class OpenRouterProvider extends BaseInferenceProvider {
  protected readonly config = {
    name: "openrouter",
    chatCompletionPath: "/v1/chat/completions",
    completionPath: "/v1/completions",
    healthPath: "/v1/models",
    defaultTimeoutMs: OPENROUTER_TIMEOUT_MS,
    streamTimeoutMs: OPENROUTER_STREAM_TIMEOUT_MS,
    getUrl: openrouterUrl,
    getHeaders: openrouterHeaders,
    mapError: mapOpenrouterError,
    checkConfig: () => {
      if (!config.OPENROUTER_API_KEY) {
        throw Object.assign(new Error("OpenRouter API key not configured"), { status: 503 });
      }
    },
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.openrouter";
  }
}

const provider = new OpenRouterProvider();

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

export async function openrouterHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs: number;
}> {
  return healthCheck({
    getUrl: () => openrouterUrl("/v1/models"),
    getHeaders: openrouterHeaders,
    keyConfigured: !!config.OPENROUTER_API_KEY,
  });
}

export interface BYOKKey {
  id: string;
  provider: string;
  name: string;
  createdAt: string;
}

export async function createBYOKKey(
  provider: string,
  key: string,
  name: string
): Promise<BYOKKey> {
  const resp = await fetch(openrouterUrl("/v1/byok"), {
    method: "POST",
    headers: openrouterHeaders(),
    body: JSON.stringify({ provider, key, name }),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`Failed to create BYOK key: ${text.slice(0, 500)}`),
      { status: resp.status }
    );
  }

  return resp.json();
}

export async function listBYOKKeys(): Promise<BYOKKey[]> {
  const resp = await fetch(openrouterUrl("/v1/byok"), {
    method: "GET",
    headers: openrouterHeaders(),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`Failed to list BYOK keys: ${text.slice(0, 500)}`),
      { status: resp.status }
    );
  }

  return resp.json();
}

export async function deleteBYOKKey(keyId: string): Promise<void> {
  const resp = await fetch(openrouterUrl(`/v1/byok/${keyId}`), {
    method: "DELETE",
    headers: openrouterHeaders(),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw Object.assign(
      new Error(`Failed to delete BYOK key: ${text.slice(0, 500)}`),
      { status: resp.status }
    );
  }
}

export async function addVeniceAsBYOK(
  veniceApiKey: string
): Promise<{ success: boolean; byokKey?: BYOKKey; error?: string }> {
  try {
    const existingKeys = await listBYOKKeys().catch(() => []);
    const veniceKey = existingKeys.find((k) => k.provider === "venice");

    if (veniceKey) {
      console.log("[openrouter] Venice BYOK key already exists:", veniceKey.id);
      return { success: true, byokKey: veniceKey };
    }

    const newKey = await createBYOKKey("venice", veniceApiKey, "Venice AI (BYOK)");
    console.log("[openrouter] Created Venice BYOK key:", newKey.id);
    return { success: true, byokKey: newKey };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[openrouter] Failed to add Venice BYOK key:", message);
    return { success: false, error: message };
  }
}

export async function configureBYOKOrdering(
  allowFallbacks: boolean = true,
  preferredOrder: string[] = ["venice", "openrouter"]
): Promise<{ success: boolean; error?: string }> {
  try {
    const orderingConfig = {
      provider: {
        allow_fallbacks: allowFallbacks,
        order: preferredOrder,
      },
    };

    const resp = await fetch(openrouterUrl("/v1/byok/ordering"), {
      method: "POST",
      headers: {
        ...openrouterHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderingConfig),
    });

    if (!resp.ok) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Failed to configure BYOK ordering: ${text.slice(0, 500)}`);
    }

    console.log("[openrouter] BYOK ordering configured:", JSON.stringify(orderingConfig));
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[openrouter] Failed to configure BYOK ordering:", message);
    return { success: false, error: message };
  }
}

export { chatCompletion as openrouterChatCompletion };