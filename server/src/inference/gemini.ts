import { config } from "../config.js";
import type { ChatMessage, MessageContent } from "./types.js";
import { BaseInferenceProvider, type ProviderConfig } from "./base.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

const GEMINI_TIMEOUT_MS = 30_000;
const GEMINI_STREAM_TIMEOUT_MS = 120_000;
const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const MODEL_MAP: Record<string, string> = {
  "gemini-2.5-pro": "gemini-2.5-pro",
  "gemini-2.5-flash": "gemini-2.5-flash",
  "gemini-2.5-flash-thinking": "gemini-2.5-pro",
  "gemini-2.5-pro-thinking": "gemini-2.5-pro",
};

function getModelId(omaModel: string): string {
  return MODEL_MAP[omaModel] ?? omaModel;
}

function contentToText(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content
    .filter((p): p is { type: string; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("\n");
}

export interface GeminiRequestBody {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  tools?: Array<{ type: string; function?: { name: string; description?: string; parameters?: unknown } }>;
  [key: string]: unknown;
}

export function toGeminiRequest(body: GeminiRequestBody): Record<string, unknown> {
  const systemParts: string[] = [];
  const contents: Array<{ role: string; parts: Array<{ text: string }> }> = [];

  for (const m of body.messages) {
    if (m.role === "system") {
      systemParts.push(contentToText(m.content));
      continue;
    }
    if (m.role === "tool") continue;
    const role = m.role === "assistant" ? "model" : "user";
    contents.push({ role, parts: [{ text: contentToText(m.content) }] });
  }

  const req: Record<string, unknown> = { contents };
  if (systemParts.length) {
    req.systemInstruction = { parts: [{ text: systemParts.join("\n") }] };
  }

  const generationConfig: Record<string, unknown> = {};
  if (body.temperature !== undefined) generationConfig.temperature = body.temperature;
  if (body.max_tokens !== undefined) generationConfig.maxOutputTokens = body.max_tokens;
  if (body.top_p !== undefined) generationConfig.topP = body.top_p;
  if (Object.keys(generationConfig).length) req.generationConfig = generationConfig;

  if (body.tools?.length) {
    const declarations = body.tools
      .filter((t) => t.type === "function" && t.function)
      .map((t) => ({
        name: t.function!.name,
        description: t.function!.description,
        parameters: t.function!.parameters,
      }));
    if (declarations.length) {
      req.tools = [{ functionDeclarations: declarations }];
    }
  }

  return req;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; functionCall?: { name: string; args?: unknown } }> };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

export function toOpenAIResponse(geminiResp: GeminiResponse, model: string): Record<string, unknown> {
  const candidate = geminiResp.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  const functionCalls = parts.filter((p) => p.functionCall);
  const tool_calls = functionCalls.length
    ? functionCalls.map((p, i) => ({
        id: `call_${i}_${Date.now()}`,
        type: "function",
        function: {
          name: p.functionCall!.name,
          arguments: JSON.stringify(p.functionCall!.args ?? {}),
        },
      }))
    : undefined;

  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: text || null,
          ...(tool_calls ? { tool_calls } : {}),
        },
        finish_reason: (candidate?.finishReason ?? "stop").toLowerCase(),
      },
    ],
    usage: geminiResp.usageMetadata
      ? {
          prompt_tokens: geminiResp.usageMetadata.promptTokenCount ?? 0,
          completion_tokens: geminiResp.usageMetadata.candidatesTokenCount ?? 0,
          total_tokens: geminiResp.usageMetadata.totalTokenCount ?? 0,
        }
      : undefined,
  };
}

export function geminiChunkToOpenAI(chunk: GeminiResponse, model: string): Record<string, unknown> | null {
  const candidate = chunk.candidates?.[0];
  if (!candidate) return null;
  const parts = candidate.content?.parts ?? [];
  const text = parts.map((p) => p.text ?? "").join("");
  return {
    id: `chatcmpl-${Date.now()}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [
      {
        index: 0,
        delta: { content: text, role: "assistant" },
        finish_reason: candidate.finishReason === "STOP" ? "stop" : null,
      },
    ],
  };
}

function checkGeminiConfig(): void {
  if (!config.GEMINI_API_KEY) {
    throw Object.assign(new Error("Gemini API key not configured"), { status: 503 });
  }
}

export function mapGeminiError(status: number, body: string): never {
  let type = "gemini_api_error";
  if (status === 400) type = "invalid_request";
  else if (status === 401 || status === 403) type = "invalid_key";
  else if (status === 429) type = "rate_limit";
  else if (status >= 500) type = "server_error";

  let message = `Gemini error ${status}`;
  try {
    const parsed = JSON.parse(body);
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    if (body) message = body.slice(0, 500);
  }
  throw Object.assign(new Error(message), { status, type });
}

class GeminiProvider extends BaseInferenceProvider {
  protected readonly config: ProviderConfig = {
    name: "gemini",
    chatCompletionPath: "/chat/completions",
    completionPath: "/chat/completions",
    healthPath: "/health",
    defaultTimeoutMs: GEMINI_TIMEOUT_MS,
    streamTimeoutMs: GEMINI_STREAM_TIMEOUT_MS,
    getUrl: (path) => `${GEMINI_BASE}${path}`,
    getHeaders: () => ({ "Content-Type": "application/json" }),
    mapError: mapGeminiError,
    checkConfig: checkGeminiConfig,
    reportHealth: true,
  };

  protected get spanName(): string {
    return "llm.provider.gemini";
  }

  public async chatCompletion(body: {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    [key: string]: unknown;
  }, requestSignal?: AbortSignal): Promise<Response> {
    const tracer = trace.getTracer(this.tracerName);
    return tracer.startActiveSpan(this.spanName, { kind: SpanKind.CLIENT }, async (span) => {
      try {
        this.config.checkConfig();
        span.setAttribute("llm.provider", "gemini");
        span.setAttribute("llm.model", body.model);

        const geminiReq = toGeminiRequest(body as GeminiRequestBody);
        const modelId = getModelId(body.model);
        const url = `${GEMINI_BASE}/${modelId}:generateContent?key=${config.GEMINI_API_KEY}`;
        const upstreamSignal = requestSignal
          ? AbortSignal.any([requestSignal, AbortSignal.timeout(GEMINI_TIMEOUT_MS)])
          : AbortSignal.timeout(GEMINI_TIMEOUT_MS);

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiReq),
          signal: upstreamSignal,
        });
        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          mapGeminiError(resp.status, text);
        }

        const geminiResp = (await resp.json()) as GeminiResponse;
        const openaiResp = toOpenAIResponse(geminiResp, body.model);
        span.setStatus({ code: SpanStatusCode.OK });
        return new Response(JSON.stringify(openaiResp), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        if ((err as { status?: number }).status === undefined) {
          span.recordException(err instanceof Error ? err : new Error(String(err)));
        }
        throw err;
      } finally {
        span.end();
      }
    });
  }

  public async streamChatCompletion(body: {
    model: string;
    messages: ChatMessage[];
    stream?: boolean;
    [key: string]: unknown;
  }): Promise<Response> {
    const tracer = trace.getTracer(this.tracerName);
    return tracer.startActiveSpan(`${this.spanName}.stream`, { kind: SpanKind.CLIENT }, async (span) => {
      try {
        this.config.checkConfig();
        span.setAttribute("llm.provider", "gemini");
        span.setAttribute("llm.model", body.model);

        const geminiReq = toGeminiRequest(body as GeminiRequestBody);
        const modelId = getModelId(body.model);
        const url = `${GEMINI_BASE}/${modelId}:streamGenerateContent?alt=sse&key=${config.GEMINI_API_KEY}`;

        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(geminiReq),
          signal: AbortSignal.timeout(GEMINI_STREAM_TIMEOUT_MS),
        });
        span.setAttribute("http.status_code", resp.status);

        if (!resp.ok) {
          const text = await resp.text().catch(() => "");
          mapGeminiError(resp.status, text);
        }

        if (!resp.body) throw new Error("Gemini stream missing body");

        const model = body.model;
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        const encoder = new TextEncoder();
        let buffer = "";

        const stream = new ReadableStream({
          async pull(controller) {
            try {
              const { value, done } = await reader.read();
              if (done) {
                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                controller.close();
                return;
              }
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() ?? "";
              for (const line of lines) {
                if (!line.startsWith("data: ")) continue;
                const data = line.slice(6).trim();
                if (!data) continue;
                try {
                  const chunk = JSON.parse(data) as GeminiResponse;
                  const openai = geminiChunkToOpenAI(chunk, model);
                  if (openai) controller.enqueue(encoder.encode(`data: ${JSON.stringify(openai)}\n\n`));
                } catch {
                  // ignore malformed SSE lines
                }
              }
            } catch (err) {
              controller.error(err);
            }
          },
        });

        span.setStatus({ code: SpanStatusCode.OK });
        return new Response(stream, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        });
      } catch (err) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : "Unknown error",
        });
        throw err;
      } finally {
        span.end();
      }
    });
  }
}

const provider = new GeminiProvider();

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}, signal?: AbortSignal): Promise<Response> {
  return provider.chatCompletion(body, signal);
}

export function streamChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  return provider.streamChatCompletion(body);
}

export { chatCompletion as geminiChatCompletion };
