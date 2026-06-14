/**
 * OpenAI Chat Completions ↔ Anthropic Messages format conversion.
 *
 * Pure functions, no I/O. Used by server/src/inference/claude.ts to translate
 * OMA's OpenAI-shaped requests into the Anthropic Messages shape, and to
 * translate Anthropic responses (non-streaming JSON + streaming SSE events)
 * back into OpenAI's shape so the rest of OMA's pipeline is unaware of the
 * upstream difference.
 *
 * Reference: https://docs.anthropic.com/en/api/messages
 */
import type { ChatMessage, MessageContent } from "./types.js";

// ─── OpenAI shapes (subset we care about) ──────────────────────────────────────

export interface OpenAITool {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface OpenAIRequest {
  model: string;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: OpenAITool[];
  tool_choice?: unknown;
  stop?: string | string[];
  [key: string]: unknown;
}

export interface OpenAIResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: "assistant";
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: "function";
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface OpenAIChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: "assistant";
      content?: string | null;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }>;
    };
    finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
  }>;
}

// ─── Anthropic shapes (subset we care about) ───────────────────────────────────

export interface ClaudeTextBlock {
  type: "text";
  text: string;
}

export interface ClaudeImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    data: string;
  };
}

export interface ClaudeToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ClaudeToolResultBlock {
  type: "tool_result";
  tool_use_id: string;
  content: string | Array<ClaudeTextBlock | ClaudeImageBlock>;
  is_error?: boolean;
}

export type ClaudeContentBlock =
  | ClaudeTextBlock
  | ClaudeImageBlock
  | ClaudeToolUseBlock
  | ClaudeToolResultBlock;

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export interface ClaudeTool {
  name: string;
  description?: string;
  input_schema: {
    type: "object";
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface ClaudeRequest {
  model: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  system?: string;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: ClaudeTool[];
  tool_choice?: { type: "auto" | "any" | "tool"; name?: string };
  stop_sequences?: string[];
}

export interface ClaudeResponse {
  id: string;
  type: "message";
  role: "assistant";
  content: ClaudeContentBlock[];
  model: string;
  stop_reason: "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

// ─── Request: OpenAI → Claude ─────────────────────────────────────────────────

/** Default max_tokens if the OpenAI request omits it. Anthropic requires it. */
const DEFAULT_MAX_TOKENS = 4096;

export function openAIToClaudeRequest(req: OpenAIRequest): ClaudeRequest {
  const { system, messages } = extractSystemAndMessages(req.messages);
  const claudeMessages: ClaudeMessage[] = messages
    .map(convertMessage)
    .filter((m): m is ClaudeMessage => m !== null);

  const claudeReq: ClaudeRequest = {
    model: req.model,
    messages: claudeMessages,
    max_tokens: typeof req.max_tokens === "number" ? req.max_tokens : DEFAULT_MAX_TOKENS,
  };

  if (system) claudeReq.system = system;
  if (typeof req.temperature === "number") claudeReq.temperature = req.temperature;
  if (typeof req.top_p === "number") claudeReq.top_p = req.top_p;
  if (req.stream) claudeReq.stream = true;
  if (Array.isArray(req.tools) && req.tools.length > 0) {
    claudeReq.tools = req.tools.map(convertTool);
  }
  if (Array.isArray(req.stop)) claudeReq.stop_sequences = req.stop;
  else if (typeof req.stop === "string") claudeReq.stop_sequences = [req.stop];

  return claudeReq;
}

function extractSystemAndMessages(messages: ChatMessage[]): {
  system: string | undefined;
  messages: ChatMessage[];
} {
  const systemParts: string[] = [];
  const remaining: ChatMessage[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      if (typeof m.content === "string") systemParts.push(m.content);
      else if (Array.isArray(m.content)) {
        const text = m.content
          .map((p) => (p && typeof p === "object" && "text" in p && typeof p.text === "string" ? p.text : ""))
          .join("");
        if (text) systemParts.push(text);
      }
    } else {
      remaining.push(m);
    }
  }
  return { system: systemParts.length > 0 ? systemParts.join("\n\n") : undefined, messages: remaining };
}

function convertMessage(m: ChatMessage): ClaudeMessage | null {
  if (m.role === "user") {
    return { role: "user", content: convertUserContent(m.content) };
  }
  if (m.role === "assistant") {
    return { role: "assistant", content: convertAssistantContent(m.content) };
  }
  if (m.role === "tool") {
    // OpenAI tool result messages are flattened into a user message with a
    // tool_result content block, paired by tool_call_id.
    const toolCallId = (m as { tool_call_id?: string }).tool_call_id;
    const content = typeof m.content === "string" ? m.content : "";
    if (!toolCallId) {
      // Defensive: malformed tool message — drop it. Anthropic would 400.
      return null;
    }
    return {
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolCallId, content }],
    };
  }
  return null;
}

function convertUserContent(content: MessageContent): string | ClaudeContentBlock[] {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const blocks: ClaudeContentBlock[] = [];
  for (const part of content) {
    if (!part || typeof part !== "object") continue;
    if ("text" in part && typeof part.text === "string") {
      blocks.push({ type: "text", text: part.text });
    } else if ("image_url" in part && part.image_url && typeof part.image_url === "object") {
      const url = part.image_url.url;
      if (typeof url === "string" && url.startsWith("data:")) {
        const m = url.match(/^data:(image\/(?:jpeg|png|gif|webp));base64,(.+)$/);
        if (m) {
          blocks.push({
            type: "image",
            source: { type: "base64", media_type: m[1] as ClaudeImageBlock["source"]["media_type"], data: m[2] },
          });
        }
      }
      // External URLs (http(s)://...) are not supported by Anthropic's image
      // block — drop them rather than send a malformed request. The OpenAI
      // client is expected to inline base64 for vision.
    }
  }
  return blocks.length > 0 ? blocks : "";
}

function convertAssistantContent(content: MessageContent): string | ClaudeContentBlock[] {
  // OpenAI assistant messages can include both text content AND parallel
  // tool_calls. Anthropic represents this as a single message with multiple
  // content blocks. Stitch them together.
  const blocks: ClaudeContentBlock[] = [];
  if (typeof content === "string") {
    if (content) blocks.push({ type: "text", text: content });
  } else if (Array.isArray(content)) {
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      if ("text" in part && typeof part.text === "string" && part.text) {
        blocks.push({ type: "text", text: part.text });
      }
    }
  }
  const toolCalls = (content as { tool_calls?: unknown[] } | null);
  // Note: when ChatMessage.content is an array, parallel tool_calls live in
  // a separate field on the assistant message object (OpenAI wire format).
  // Our internal ChatMessage type doesn't expose that field, so callers
  // needing assistant tool_calls should put them in a synthetic content array
  // (handled below) or the upstream `messages` payload keeps the raw shape
  // (we fall back to inspecting unknown props on the message).
  const maybeToolCalls = (m: MessageContent): unknown[] | undefined => {
    if (Array.isArray(m)) {
      const tcField = (m as unknown as { tool_calls?: unknown[] }).tool_calls;
      if (Array.isArray(tcField)) return tcField;
    }
    return undefined;
  };
  const tcs = toolCalls && maybeToolCalls(content);
  if (Array.isArray(tcs)) {
    for (const tc of tcs) {
      const block = convertToolCallToBlock(tc);
      if (block) blocks.push(block);
    }
  }
  return blocks.length > 0 ? blocks : "";
}

function convertToolCallToBlock(tc: unknown): ClaudeToolUseBlock | null {
  if (!tc || typeof tc !== "object") return null;
  const t = tc as { id?: unknown; function?: { name?: unknown; arguments?: unknown } };
  if (typeof t.id !== "string" || !t.function || typeof t.function.name !== "string") return null;
  let input: Record<string, unknown> = {};
  if (typeof t.function.arguments === "string" && t.function.arguments.length > 0) {
    try {
      const parsed = JSON.parse(t.function.arguments);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        input = parsed as Record<string, unknown>;
      }
    } catch {
      // Malformed JSON — pass empty object; Anthropic will return a tool_use
      // error which we surface as a 400 upstream.
    }
  }
  return { type: "tool_use", id: t.id, name: t.function.name, input };
}

function convertTool(t: OpenAITool): ClaudeTool {
  const out: ClaudeTool = {
    name: t.function.name,
    input_schema: (t.function.parameters as ClaudeTool["input_schema"]) ?? { type: "object" },
  };
  if (t.function.description) out.description = t.function.description;
  return out;
}

// ─── Response: Claude → OpenAI ─────────────────────────────────────────────────

export function claudeToOpenAIResponse(resp: ClaudeResponse, requestedModel: string): OpenAIResponse {
  let textContent = "";
  const toolCalls: NonNullable<OpenAIResponse["choices"][0]["message"]["tool_calls"]> = [];
  for (const block of resp.content) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        },
      });
    }
  }
  const message: OpenAIResponse["choices"][0]["message"] = {
    role: "assistant",
    content: textContent || (toolCalls.length > 0 ? null : ""),
  };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  return {
    id: resp.id,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: resp.model || requestedModel,
    choices: [
      {
        index: 0,
        message,
        finish_reason: mapStopReason(resp.stop_reason),
      },
    ],
    usage: {
      prompt_tokens: resp.usage.input_tokens ?? 0,
      completion_tokens: resp.usage.output_tokens ?? 0,
      total_tokens: (resp.usage.input_tokens ?? 0) + (resp.usage.output_tokens ?? 0),
    },
  };
}

function mapStopReason(s: ClaudeResponse["stop_reason"]): OpenAIResponse["choices"][0]["finish_reason"] {
  if (s === "end_turn" || s === "stop_sequence") return "stop";
  if (s === "max_tokens") return "length";
  if (s === "tool_use") return "tool_calls";
  return null;
}

// ─── Streaming: Claude SSE event → OpenAI chunk ────────────────────────────────

/** Streaming state carried across SSE events for a single assistant message. */
export interface ClaudeStreamState {
  messageId: string;
  model: string;
  created: number;
  /** Tracks whether we've sent the initial role delta. */
  sentRole: boolean;
  /** Per-content-block partial-json buffer for tool_use input streams. */
  toolInputBuffers: Map<number, { id: string; name: string; args: string }>;
  /** Tracks the index of the next tool call to emit in the OpenAI stream. */
  toolCallIndex: number;
}

export function newClaudeStreamState(model: string, created: number = Math.floor(Date.now() / 1000)): ClaudeStreamState {
  return {
    messageId: `chatcmpl-${randomId()}`,
    model,
    created,
    sentRole: false,
    toolInputBuffers: new Map(),
    toolCallIndex: 0,
  };
}

/**
 * Convert a single Anthropic streaming event to 0+ OpenAI chunks.
 * Returns the chunks that should be emitted for this event.
 */
export function claudeStreamEventToOpenAIChunks(
  event: unknown,
  state: ClaudeStreamState,
): OpenAIChunk[] {
  if (!event || typeof event !== "object") return [];
  const e = event as { type?: string; [key: string]: unknown };
  const chunks: OpenAIChunk[] = [];

  switch (e.type) {
    case "message_start": {
      const msg = (e as { message?: { id?: string; model?: string } }).message;
      if (msg?.id) state.messageId = msg.id;
      if (msg?.model) state.model = msg.model;
      // First chunk: emit the role delta (OpenAI streams always start with role=assistant).
      chunks.push(makeChunk(state, { role: "assistant" }));
      state.sentRole = true;
      return chunks;
    }
    case "content_block_start": {
      const block = (e as { content_block?: ClaudeContentBlock }).content_block;
      const index = (e as { index?: number }).index ?? 0;
      if (block?.type === "tool_use" && block.id && block.name) {
        // OpenAI tool_calls are emitted as deltas with type=function and a
        // streamed `arguments` string. We push the id+name on the first delta
        // and accumulate arguments via content_block_delta events below.
        state.toolInputBuffers.set(index, { id: block.id, name: block.name, args: "" });
        const toolCallIndex = state.toolCallIndex++;
        chunks.push(
          makeChunk(state, {
            tool_calls: [
              {
                index: toolCallIndex,
                id: block.id,
                type: "function",
                function: { name: block.name, arguments: "" },
              },
            ],
          }),
        );
      }
      return chunks;
    }
    case "content_block_delta": {
      const index = (e as { index?: number }).index ?? 0;
      const delta = (e as { delta?: { type?: string; text?: string; partial_json?: string } }).delta;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        chunks.push(makeChunk(state, { content: delta.text }));
      } else if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string") {
        const buf = state.toolInputBuffers.get(index);
        if (buf) {
          buf.args += delta.partial_json;
          const toolCallIndex = Array.from(state.toolInputBuffers.keys()).indexOf(index);
          chunks.push(
            makeChunk(state, {
              tool_calls: [{ index: toolCallIndex, function: { arguments: delta.partial_json } }],
            }),
          );
        }
      }
      return chunks;
    }
    case "message_delta": {
      const delta = (e as { delta?: { stop_reason?: ClaudeResponse["stop_reason"] } }).delta;
      if (delta?.stop_reason) {
        chunks.push(makeChunk(state, {}, mapStopReason(delta.stop_reason)));
      }
      return chunks;
    }
    case "message_stop": {
      // Emit a final chunk with finish_reason="stop" if message_delta didn't
      // already set one (defensive: e.g. empty messages).
      chunks.push(makeChunk(state, {}, "stop"));
      return chunks;
    }
    case "ping":
    case "content_block_stop":
    default:
      return [];
  }
}

function makeChunk(
  state: ClaudeStreamState,
  delta: { role?: "assistant"; content?: string | null; tool_calls?: OpenAIChunk["choices"][0]["delta"]["tool_calls"] } = {},
  finish_reason: OpenAIChunk["choices"][0]["finish_reason"] = null,
): OpenAIChunk {
  return {
    id: state.messageId,
    object: "chat.completion.chunk",
    created: state.created,
    model: state.model,
    choices: [{ index: 0, delta, finish_reason }],
  };
}

/** Serialize an OpenAI chunk to the SSE wire format (`data: {...}\n\n`). */
export function openAIChunkToSSE(chunk: OpenAIChunk): string {
  return `data: ${JSON.stringify(chunk)}\n\n`;
}

/** The terminal SSE chunk signaling end-of-stream. */
export const DONE_SSE_CHUNK = "data: [DONE]\n\n";

function randomId(): string {
  // 24 hex chars is what OpenAI uses for chatcmpl- ids. Avoid pulling crypto
  // for this — Math.random is fine for an opaque correlation id.
  let s = "";
  for (let i = 0; i < 24; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
