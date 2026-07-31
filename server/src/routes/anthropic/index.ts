/**
 * Anthropic-compatible Messages API — /v1/messages
 *
 * Translates Anthropic Messages API format to OpenAI format internally,
 * reuses the shared provider proxy (Venice/Gonka), and translates
 * responses back to Anthropic format (both streaming and non-streaming).
 */
import { Hono } from "hono";
import { z } from "zod";
import type { OmaEnv } from "../../types.js";
import { sessionOrBearerAuth } from "../../auth/middleware.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { getModelById, listAllModels } from "../../inference/models.js";
import { getModelPricing } from "../../inference/billing-service.js";
import {
  callProvider,
  parseNonStreamingResponse,
  ProviderError,
  estimateTokens,
  flattenMessageContent,
} from "../../inference/proxy.js";
import { logger } from "../../lib/logger.js";

/** Anthropic Messages API request schema */
const anthropicSchema = z.object({
  model: z.string(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.union([
          z.string(),
          z.array(
            z.object({
              type: z.literal("text"),
              text: z.string(),
            }),
          ),
        ]),
      }),
    )
    .min(1),
  system: z.union([z.string(), z.array(z.object({ type: z.literal("text"), text: z.string() }))]).optional(),
  max_tokens: z.number().int().positive(),
  temperature: z.number().min(0).max(1).optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional().default(false),
  tools: z.array(z.any()).optional(),
  tool_choice: z.any().optional(),
});

/** Convert Anthropic messages + system prompt → OpenAI messages array */
function toOpenAIMessages(
  messages: Array<{ role: "user" | "assistant"; content: string | Array<{ type: "text"; text: string }> }>,
  system?: string | Array<{ type: "text"; text: string }>,
): Array<{ role: string; content: string | unknown[]; name?: string }> {
  const result: Array<{ role: string; content: string | unknown[]; name?: string }> = [];

  if (system) {
    const sysText = typeof system === "string" ? system : system.map((s) => s.text).join("\n");
    result.push({ role: "system", content: sysText });
  }

  for (const msg of messages) {
    const content = typeof msg.content === "string" ? msg.content : msg.content.map((c) => c.text).join("");
    result.push({ role: msg.role, content });
  }

  return result;
}

/** Convert OpenAI non-streaming response → Anthropic message */
function toAnthropicMessage(
  data: unknown,
  modelId: string,
  requestId: string,
): Record<string, unknown> {
  const openaiData = data as {
    choices?: Array<{
      message?: { content?: string | unknown[]; tool_calls?: unknown[] };
      finish_reason?: string;
    }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };

  const choice = openaiData.choices?.[0];
  const content = choice?.message?.content ?? "";
  const text = typeof content === "string" ? content : flattenMessageContent(content);
  const usage = openaiData.usage;

  const contentBlocks: Array<{ type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: unknown }> = [];
  if (text) {
    contentBlocks.push({ type: "text", text });
  }

  if (choice?.message?.tool_calls) {
    for (const tc of choice.message.tool_calls) {
      const tcTyped = tc as { id?: string; function?: { name?: string; arguments?: string } };
      contentBlocks.push({
        type: "tool_use",
        id: tcTyped.id ?? `toolu_${crypto.randomUUID()}`,
        name: tcTyped.function?.name ?? "unknown",
        input: JSON.parse(tcTyped.function?.arguments ?? "{}"),
      });
    }
  }

  return {
    id: requestId,
    type: "message",
    role: "assistant",
    model: modelId,
    content: contentBlocks,
    stop_reason: choice?.finish_reason === "length" ? "max_tokens" : choice?.finish_reason ?? "end_turn",
    stop_sequence: null,
    usage: {
      input_tokens: usage?.prompt_tokens ?? 0,
      output_tokens: usage?.completion_tokens ?? 0,
    },
  };
}

/**
 * Wrap upstream OpenAI SSE stream → Anthropic SSE events.
 * Emits: message_start, content_block_start, content_block_delta (text_delta),
 * content_block_stop, message_delta (stop_reason), message_stop
 */
function createAnthropicStream(
  upstreamResp: Response,
  modelId: string,
  requestId: string,
): ReadableStream<Uint8Array> {
  if (!upstreamResp.body) {
    throw new ProviderError("Upstream stream empty", 502);
  }
  const reader = upstreamResp.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let messageStarted = false;
  let contentBlockStarted = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (messageStarted && contentBlockStarted) {
            // Emit content_block_stop
            controller.enqueue(
              encoder.encode(
                `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
              ),
            );
          }
          if (messageStarted) {
            // Emit message_delta with stop_reason
            controller.enqueue(
              encoder.encode(
                `event: message_delta\ndata: ${JSON.stringify({
                  type: "message_delta",
                  delta: { stop_reason: "end_turn", stop_sequence: null },
                  usage: { output_tokens: 0 },
                })}\n\n`,
              ),
            );
            // Emit message_stop
            controller.enqueue(encoder.encode(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`));
          }
          controller.close();
          return;
        }

        const text = decoder.decode(value, { stream: true });
        for (const line of text.split("\n")) {
          if (!line.startsWith("data:")) continue;
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") continue;

          let obj: {
  choices?: Array<{ delta?: { content?: string; reasoning_content?: string; tool_calls?: unknown[] }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
          try {
            obj = JSON.parse(payload);
          } catch {
            continue;
          }

          const choice = obj.choices?.[0];
          const delta = choice?.delta;

          // message_start (first content)
          if (!messageStarted && (delta?.content || delta?.reasoning_content)) {
            controller.enqueue(
              encoder.encode(
                `event: message_start\ndata: ${JSON.stringify({
                  type: "message_start",
                  message: {
                    id: requestId,
                    type: "message",
                    role: "assistant",
                    model: modelId,
                    content: [],
                    stop_reason: null,
                    stop_sequence: null,
                    usage: { input_tokens: obj.usage?.prompt_tokens ? { input_tokens: obj.usage.prompt_tokens, output_tokens: 0 } : { input_tokens: 0, output_tokens: 0 } },
                  },
                })}\n\n`,
              ),
            );
            messageStarted = true;
          }

          // content_block_start (first text delta)
          if (!contentBlockStarted && (delta?.content || delta?.reasoning_content)) {
            controller.enqueue(
              encoder.encode(
                `event: content_block_start\ndata: ${JSON.stringify({
                  type: "content_block_start",
                  index: 0,
                  content_block: { type: "text", text: "" },
                })}\n\n`,
              ),
            );
            contentBlockStarted = true;
          }

          // Text deltas (content or reasoning_content)
          const textDelta = delta?.content ?? delta?.reasoning_content;
          if (typeof textDelta === "string" && textDelta.length > 0) {
            controller.enqueue(
              encoder.encode(
                `event: content_block_delta\ndata: ${JSON.stringify({
                  type: "content_block_delta",
                  index: 0,
                  delta: { type: "text_delta", text: textDelta },
                })}\n\n`,
              ),
            );
          }

          // finish_reason → content_block_stop + message_delta + message_stop
          if (choice?.finish_reason) {
            if (contentBlockStarted) {
              controller.enqueue(
                encoder.encode(
                  `event: content_block_stop\ndata: ${JSON.stringify({ type: "content_block_stop", index: 0 })}\n\n`,
                ),
              );
              contentBlockStarted = false;
            }
            const stopReasonMap: Record<string, string> = {
              stop: "end_turn",
              length: "max_tokens",
              tool_calls: "tool_use",
              content_filter: "stop_sequence",
            };
            controller.enqueue(
              encoder.encode(
                `event: message_delta\ndata: ${JSON.stringify({
                  type: "message_delta",
                  delta: { stop_reason: stopReasonMap[choice.finish_reason] ?? "end_turn", stop_sequence: null },
                  usage: { output_tokens: obj.usage?.completion_tokens ?? 0 },
                })}\n\n`,
              ),
            );
            controller.enqueue(encoder.encode(`event: message_stop\ndata: ${JSON.stringify({ type: "message_stop" })}\n\n`));
            messageStarted = false; // reset for potential next message (unlikely in single call)
          }
        }
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    },
  });
}

export const anthropicRoutes = new Hono<OmaEnv>();

/** POST /v1/messages — Anthropic Messages API */
anthropicRoutes.post(
  "/v1/messages",
  rateLimit({ windowMs: 60_000, maxRequests: 60 }),
  sessionOrBearerAuth,
  async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = anthropicSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          type: "error",
          error: {
            type: "invalid_request_error",
            message: "Invalid request",
            details: parsed.error.flatten(),
          },
        },
        400,
      );
    }

    const { model, messages, system, max_tokens, temperature, top_p, stream, tools, tool_choice } = parsed.data;
    const modelDef = getModelById(model);
    if (!modelDef) {
      return c.json(
        {
          type: "error",
          error: { type: "not_found_error", message: `Model ${model} not found` },
        },
        404,
      );
    }

    const userId = c.get("userId");
    const pricing = getModelPricing(model);
    const requestId = `msg_${crypto.randomUUID()}`;

    const openAIMessages = toOpenAIMessages(messages, system);
    const promptText = openAIMessages.map((m) => flattenMessageContent(m.content as string | unknown[])).join("\n");
    const promptTokens = estimateTokens(promptText);

    try {
      const upstreamResp = await callProvider({
        modelId: model,
        messages: openAIMessages,
        stream,
        max_tokens,
        temperature,
        top_p,
        tools,
        tool_choice,
        userId,
        requestId,
      });

      if (stream) {
        c.header("Content-Type", "text/event-stream");
        c.header("Cache-Control", "no-cache, no-transform");
        c.header("X-Accel-Buffering", "no");
        const anthropicStream = createAnthropicStream(upstreamResp, model, requestId);
        return c.body(anthropicStream, 200);
      }

      const { data } = await parseNonStreamingResponse(upstreamResp, {
        userId,
        model,
        provider: modelDef.provider as "venice" | "gonka",
        promptTokens,
        pricing,
        requestId,
      });

      const anthropicMsg = toAnthropicMessage(data, model, requestId);
      return c.json(anthropicMsg);
    } catch (err) {
      if (err instanceof ProviderError) {
        const status = err.status >= 500 ? 502 : err.status;
        return c.json(
          {
            type: "error",
            error: { type: err.status >= 500 ? "api_error" : "invalid_request_error", message: err.message },
          },
          status as 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503,
        );
      }
      logger.error({ err, model }, "[anthropic] unexpected error");
      return c.json(
        { type: "error", error: { type: "api_error", message: "Internal server error" } },
        500,
      );
    }
  },
);

/** GET /v1/models — Anthropic-shaped model list */
anthropicRoutes.get("/v1/models", sessionOrBearerAuth, async (c) => {
  const models = listAllModels();
  const data = models.map((m) => ({
    id: m.id,
    display_name: m.displayName,
    created_at: new Date().toISOString(),
    type: "model",
  }));
  return c.json({ data, has_more: false, first_id: data[0]?.id ?? null, last_id: data[data.length - 1]?.id ?? null });
});

export { toOpenAIMessages, toAnthropicMessage };