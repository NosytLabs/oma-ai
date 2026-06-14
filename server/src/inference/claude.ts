import { config } from "../config.js";
import type { ChatMessage, MessageContent } from "./types.js";
import { trace, SpanKind, SpanStatusCode } from "@opentelemetry/api";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_API_VERSION = "2023-06-01";
const CLAUDE_TIMEOUT_MS = 30_000;
const CLAUDE_STREAM_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_TOKENS = 4096;

const CLAUDE_MODELS = new Set([
  "claude-3-5-sonnet-latest",
  "claude-3-5-haiku-latest",
  "claude-3-opus-latest",
  "claude-sonnet-4",
  "claude-opus-4",
]);

export function isClaudeModel(model: string): boolean {
  return CLAUDE_MODELS.has(model) || model.startsWith("claude-");
}

interface AnthropicToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}
interface AnthropicTextBlock { type: "text"; text: string }
type AnthropicContentBlock = AnthropicTextBlock | AnthropicToolUseBlock | { type: "tool_result"; tool_use_id: string; content: string };

interface AnthropicMessage {
  role: "user" | "assistant";
  content: string | AnthropicContentBlock[];
}

interface OpenAIToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

function checkConfig(): void {
  if (!config.ANTHROPIC_API_KEY) {
    throw Object.assign(new Error("Anthropic API key not configured"), { status: 503 });
  }
}

function claudeHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-api-key": config.ANTHROPIC_API_KEY ?? "",
    "anthropic-version": CLAUDE_API_VERSION,
  };
}

function mapClaudeError(status: number, body: string): never {
  let type: string;
  if (status === 401 || status === 403) type = "invalid_key";
  else if (status === 429) type = "rate_limit";
  else if (status === 529) type = "overloaded";
  else if (status >= 500) type = "server_error";
  else type = "anthropic_api_error";

  let message = `Anthropic error ${status}`;
  try {
    const parsed = JSON.parse(body);
    if (parsed.error?.message) message = parsed.error.message;
  } catch {
    if (body) message = body.slice(0, 500);
  }
  throw Object.assign(new Error(message), { status, type });
}

function contentToString(content: MessageContent): string {
  if (typeof content === "string") return content;
  return content.map(p => p.text ?? "").join("");
}

export function translateRequest(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  tools?: Array<{ type: string; function: { name: string; description?: string; parameters?: unknown } }>;
  [key: string]: unknown;
}): Record<string, unknown> {
  const systemParts: string[] = [];
  const messages: AnthropicMessage[] = [];

  for (const m of body.messages) {
    if (m.role === "system") {
      systemParts.push(contentToString(m.content));
      continue;
    }
    if (m.role === "tool") {
      const toolUseId = (m as unknown as { tool_call_id?: string }).tool_call_id ?? "";
      const block: AnthropicContentBlock = {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: contentToString(m.content),
      };
      const last = messages[messages.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        messages.push({ role: "user", content: [block] });
      }
      continue;
    }
    if (m.role === "assistant") {
      const toolCalls = (m as unknown as { tool_calls?: OpenAIToolCall[] }).tool_calls;
      if (toolCalls?.length) {
        const blocks: AnthropicContentBlock[] = [];
        const text = contentToString(m.content);
        if (text) blocks.push({ type: "text", text });
        for (const tc of toolCalls) {
          let input: Record<string, unknown> = {};
          try { input = JSON.parse(tc.function.arguments || "{}"); } catch { /* leave empty */ }
          blocks.push({ type: "tool_use", id: tc.id, name: tc.function.name, input });
        }
        messages.push({ role: "assistant", content: blocks });
        continue;
      }
      messages.push({ role: "assistant", content: contentToString(m.content) });
      continue;
    }
    messages.push({ role: "user", content: contentToString(m.content) });
  }

  const result: Record<string, unknown> = {
    model: body.model,
    messages,
    max_tokens: body.max_tokens ?? DEFAULT_MAX_TOKENS,
  };
  if (systemParts.length) result.system = systemParts.join("\n");
  if (body.stream) result.stream = true;
  if (body.temperature !== undefined) result.temperature = body.temperature;
  if (body.top_p !== undefined) result.top_p = body.top_p;
  if (body.tools?.length) {
    result.tools = body.tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters ?? { type: "object", properties: {} },
    }));
  }
  return result;
}

const FINISH_REASON_MAP: Record<string, string> = {
  end_turn: "stop",
  max_tokens: "length",
  tool_use: "tool_calls",
  stop_sequence: "stop",
};

export function translateResponse(anthropic: {
  id: string;
  model: string;
  content: AnthropicContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
}): Record<string, unknown> {
  let text = "";
  const toolCalls: OpenAIToolCall[] = [];
  for (const block of anthropic.content) {
    if (block.type === "text") text += block.text;
    else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: { name: block.name, arguments: JSON.stringify(block.input ?? {}) },
      });
    }
  }
  const message: Record<string, unknown> = { role: "assistant", content: text || null };
  if (toolCalls.length) message.tool_calls = toolCalls;

  return {
    id: anthropic.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: anthropic.model,
    choices: [{
      index: 0,
      message,
      finish_reason: FINISH_REASON_MAP[anthropic.stop_reason ?? "end_turn"] ?? "stop",
    }],
    usage: {
      prompt_tokens: anthropic.usage?.input_tokens ?? 0,
      completion_tokens: anthropic.usage?.output_tokens ?? 0,
      total_tokens: (anthropic.usage?.input_tokens ?? 0) + (anthropic.usage?.output_tokens ?? 0),
    },
  };
}

export function translateStreamEvent(event: { type: string; index?: number; delta?: Record<string, unknown>; message?: { id?: string; model?: string } }): Record<string, unknown> | null {
  const baseChunk = (delta: Record<string, unknown>, finish?: string) => ({
    id: event.message?.id ?? "",
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: event.message?.model ?? "",
    choices: [{ index: 0, delta, finish_reason: finish ?? null }],
  });

  if (event.type === "message_start") return baseChunk({ role: "assistant", content: "" });
  if (event.type === "content_block_delta") {
    const d = event.delta as { type?: string; text?: string; partial_json?: string } | undefined;
    if (d?.type === "text_delta") return baseChunk({ content: d.text ?? "" });
    if (d?.type === "input_json_delta") {
      return baseChunk({ tool_calls: [{ index: event.index ?? 0, function: { arguments: d.partial_json ?? "" } }] });
    }
    return null;
  }
  if (event.type === "message_delta") {
    const d = event.delta as { stop_reason?: string } | undefined;
    return baseChunk({}, FINISH_REASON_MAP[d?.stop_reason ?? "end_turn"] ?? "stop");
  }
  return null;
}

export async function chatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  stream?: boolean;
  [key: string]: unknown;
}): Promise<Response> {
  const tracer = trace.getTracer("oma-server");
  return tracer.startActiveSpan("llm.provider.claude", { kind: SpanKind.CLIENT }, async (span) => {
    try {
      checkConfig();
      span.setAttribute("llm.provider", "claude");
      span.setAttribute("llm.model", body.model);
      span.setAttribute("http.method", "POST");
      span.setAttribute("http.url", CLAUDE_API_URL);

      const timeout = body.stream ? CLAUDE_STREAM_TIMEOUT_MS : CLAUDE_TIMEOUT_MS;
      const anthropicBody = translateRequest(body as Parameters<typeof translateRequest>[0]);

      let resp: Response;
      try {
        resp = await fetch(CLAUDE_API_URL, {
          method: "POST",
          headers: claudeHeaders(),
          body: JSON.stringify(anthropicBody),
          signal: AbortSignal.timeout(timeout),
        });
      } catch (err) {
        span.setAttribute("error", true);
        const message = err instanceof Error ? err.message : String(err);
        throw Object.assign(new Error(`claude connection failed: ${message}`), { status: 502 });
      }

      span.setAttribute("http.status_code", resp.status);

      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        span.setAttribute("error", true);
        mapClaudeError(resp.status, text);
      }

      if (!body.stream) {
        const json = await resp.json();
        const translated = translateResponse(json);
        span.setStatus({ code: SpanStatusCode.OK });
        return new Response(JSON.stringify(translated), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      span.setStatus({ code: SpanStatusCode.OK });
      return resp;
    } catch (err) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: err instanceof Error ? err.message : "Unknown" });
      span.recordException(err instanceof Error ? err : new Error(String(err)));
      throw err;
    } finally {
      span.end();
    }
  });
}

export function streamChatCompletion(body: {
  model: string;
  messages: ChatMessage[];
  [key: string]: unknown;
}): Promise<Response> {
  return chatCompletion({ ...body, stream: true });
}

export { chatCompletion as claudeChatCompletion };
