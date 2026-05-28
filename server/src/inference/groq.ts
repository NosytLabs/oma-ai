import { config } from "../config.js";
import type { ChatMessage } from "./types.js";

const GROQ_TIMEOUT_MS = 30_000;
const GROQ_BASE_URL = "https://api.groq.com/openai/v1";

const MAPPED_MODELS: Record<string, string> = {
  "llama-3.3-70b": "llama-3.3-70b-versatile",
  "llama-3.1-8b-instant": "llama-3.1-8b-instant",
  "mixtral-8x7b": "mixtral-8x7b-32768",
};

function mapModel(model: string): string {
  return MAPPED_MODELS[model] ?? model;
}

function groqHeaders(): Record<string, string> {
  if (!config.GROQ_API_KEY) {
    throw Object.assign(new Error("Groq API key not configured"), { status: 503 });
  }
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${config.GROQ_API_KEY}`,
  };
}

export async function groqChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  const modelId = mapModel(body.model);
  const endpoint = `${GROQ_BASE_URL}/chat/completions`;

  const requestBody = {
    model: modelId,
    messages: body.messages,
    stream: body.stream ?? false,
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), GROQ_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: groqHeaders(),
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      throw Object.assign(new Error(`Groq error: ${response.status} - ${error}`), { status: 502 });
    }

    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw Object.assign(new Error(`Groq request failed: ${(err as Error).message}`), { status: 502 });
  }
}

export async function groqHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    if (!config.GROQ_API_KEY) {
      return { isUp: false, error: "Groq API key not configured" };
    }
    const response = await fetch(`${GROQ_BASE_URL}/models`, {
      headers: groqHeaders(),
    });
    return {
      isUp: response.ok,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return { isUp: false, latencyMs: Date.now() - start, error: String(err) };
  }
}