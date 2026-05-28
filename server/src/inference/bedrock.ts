import { config } from "../config.js";
import type { ChatMessage } from "./types.js";

const BEDROCK_TIMEOUT_MS = 30_000;

const BEDROCK_MODELS: Record<string, string> = {
  "claude-3-5-sonnet": "anthropic.claude-3-5-sonnet-20241022-v2:0",
  "claude-3-5-haiku": "anthropic.claude-3-5-haiku-20241022-v1:0",
  "llama-3-1-8b-instruct": "meta.llama3-1-8b-instruct-v1:0",
  "llama-3-1-70b-instruct": "meta.llama3-1-70b-instruct-v1:0",
  "llama-3-1-405b-instruct": "meta.llama3-1-405b-instruct-v1:0",
};

const BEDROCK_REGIONS: Record<string, string> = {
  "us-east-1": "us-east-1",
  "us-west-2": "us-west-2",
  "eu-west-1": "eu-west-1",
  "ap-southeast-1": "ap-southeast-1",
};

function getBedrockRegion(): string {
  return BEDROCK_REGIONS[config.BEDROCK_REGION ?? "us-east-1"] ?? "us-east-1";
}

function getBedrockEndpoint(model: string): string {
  const region = getBedrockRegion();
  const modelId = BEDROCK_MODELS[model] ?? model;
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke`;
}

function getBedrockStreamEndpoint(model: string): string {
  const region = getBedrockRegion();
  const modelId = BEDROCK_MODELS[model] ?? model;
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${modelId}/invoke-with-response-stream`;
}

function isClaudeModel(model: string): boolean {
  return model.includes("claude") || model.includes("anthropic");
}

function transformRequest(body: { model: string; messages: ChatMessage[]; stream?: boolean }): Record<string, unknown> {
  if (isClaudeModel(body.model)) {
    return {
      anthropic_version: "bedrock-2023-05-31",
      messages: body.messages.map(m => ({
        role: m.role,
        content: typeof m.content === "string" ? m.content : m.content,
      })),
      max_tokens: 4096,
    };
  }

  return {
    prompt: body.messages.map(m => `${m.role}: ${m.content}`).join("\n"),
    max_tokens: 4096,
  };
}

export async function bedrockChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  if (!config.BEDROCK_ACCESS_KEY_ID || !config.BEDROCK_SECRET_ACCESS_KEY) {
    throw Object.assign(new Error("AWS Bedrock not configured"), { status: 503 });
  }

  const endpoint = body.stream
    ? getBedrockStreamEndpoint(body.model)
    : getBedrockEndpoint(body.model);

  const transformed = transformRequest(body);
  const requestBody = JSON.stringify(transformed);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), BEDROCK_TIMEOUT_MS);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.BEDROCK_ACCESS_KEY_ID}:${config.BEDROCK_SECRET_ACCESS_KEY}`,
      },
      body: requestBody,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const error = await response.text();
      throw Object.assign(new Error(`Bedrock error: ${response.status} - ${error}`), { status: 502 });
    }

    return response;
  } catch (err) {
    clearTimeout(timeout);
    throw Object.assign(new Error(`Bedrock request failed: ${(err as Error).message}`), { status: 502 });
  }
}

export async function bedrockHealthCheck(): Promise<{
  isUp: boolean;
  latencyMs?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    if (!config.BEDROCK_ACCESS_KEY_ID || !config.BEDROCK_SECRET_ACCESS_KEY) {
      return { isUp: false, error: "AWS Bedrock not configured" };
    }
    const region = getBedrockRegion();
    const response = await fetch(`https://bedrock.${region}.amazonaws.com/`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return {
      isUp: response.ok,
      latencyMs: Date.now() - start,
    };
  } catch (err) {
    return { isUp: false, latencyMs: Date.now() - start, error: String(err) };
  }
}