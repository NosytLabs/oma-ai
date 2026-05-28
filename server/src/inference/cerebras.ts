import { config } from "../config.js";
import type { ChatMessage } from "./types.js";

const CEREBRAS_TIMEOUT_MS = 30_000;
const CEREBRAS_BASE_URL = "https://api.cerebras.ai/v1";

function cerebrasHeaders(): Record<string, string> {
  if (!config.CEREBRAS_API_KEY) {
    throw Object.assign(new Error("Cerebras API key not configured"), { status: 503 });
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.CEREBRAS_API_KEY}`,
  };
}

export async function cerebrasChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  const endpoint = `${CEREBRAS_BASE_URL}/chat/completions`;

  const requestBody = {
    model: body.model,
    messages: body.messages,
    stream: body.stream ?? false,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CEREBRAS_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: cerebrasHeaders(),
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      throw Object.assign(new Error(`Cerebras error: ${response.status} - ${error}`), { status: 502 });
    }

    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw Object.assign(new Error(`Cerebras request failed: ${(err as Error).message}`), { status: 502 });
  }
}

export async function cerebrasHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    if (!config.CEREBRAS_API_KEY) {
      return { isUp: false, error: "Cerebras API key not configured" };
    }
    const response = await fetch(`${CEREBRAS_BASE_URL}/models`, {
      headers: cerebrasHeaders(),
    });
    return {
      isUp: response.ok,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return { isUp: false, latencyMs: Date.now() - start, error: String(err) };
  }
}