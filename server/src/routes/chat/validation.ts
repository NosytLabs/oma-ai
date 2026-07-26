import { z } from "zod";

const MAX_MESSAGE_CONTENT_BYTES = 100_000;
const MAX_MESSAGES = 100;
const MAX_TOTAL_BYTES = 1_000_000;
const MAX_REQUEST_BODY_SIZE = 10_000_000;

export function checkRequestBodySizeLimit(
  c: import("hono").Context,
): boolean {
  const contentLength = c.req.header("content-length");
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size) && size > MAX_REQUEST_BODY_SIZE) {
      return false;
    }
  }
  return true;
}

export function validateMessageContent(content: unknown): boolean {
  if (typeof content === "string") {
    return (
      new TextEncoder().encode(content).length <= MAX_MESSAGE_CONTENT_BYTES
    );
  }
  if (Array.isArray(content)) {
    return content.every((part) => {
      if (
        part &&
        typeof part === "object" &&
        "type" in part &&
        "text" in (part as object)
      ) {
        if (typeof (part as { text?: unknown }).text === "string") {
          return (
            new TextEncoder().encode((part as { text: string }).text).length <=
            MAX_MESSAGE_CONTENT_BYTES
          );
        }
      }
      return true;
    });
  }
  return true;
}

export function validateMessages(messages: unknown): boolean {
  if (!Array.isArray(messages)) return false;
  if (messages.length === 0 || messages.length > MAX_MESSAGES) return false;

  let totalBytes = 0;
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") return false;
    const m = msg as { role?: unknown; content?: unknown; tool_calls?: unknown };
    if (!m.role) return false;
    // Assistant messages with tool_calls have content: null — that's valid.
    // Tool messages have content but no tool_calls. Both are fine.
    if (m.content === undefined && !m.tool_calls) return false;

    if (typeof m.content === "string") {
      totalBytes += new TextEncoder().encode(m.content).length;
    } else if (Array.isArray(m.content)) {
      for (const part of m.content) {
        if (part && typeof part === "object" && "text" in part) {
          if (typeof (part as { text?: unknown }).text === "string") {
            totalBytes += new TextEncoder().encode(
              (part as { text: string }).text,
            ).length;
          }
        }
      }
    }

    if (totalBytes > MAX_TOTAL_BYTES) return false;
  }

  return messages.every((m) =>
    validateMessageContent((m as { content?: unknown }).content),
  );
}

export const messageSchema = z
  .object({
    role: z.enum(["system", "user", "assistant", "tool"]),
    content: z.union([z.string(), z.array(z.any())]).nullable().optional(),
    // Multi-turn tool calling: assistant messages carry tool_calls, tool
    // messages carry tool_call_id. Without these, Zod strips them and
    // the provider never sees the tool results.
    tool_calls: z.array(z.any()).optional(),
    tool_call_id: z.string().optional(),
    name: z.string().optional(),
    // Legacy function calling (OpenAI compat)
    function_call: z.any().optional(),
  })
  .refine(validateMessageContent, {
    message: `Message content exceeds maximum size of ${MAX_MESSAGE_CONTENT_BYTES} bytes`,
  });

export const chatCompletionSchema = z.object({
  model: z.string().min(1).max(100),
  messages: z
    .array(messageSchema)
    .min(1)
    .max(MAX_MESSAGES)
    .refine(validateMessages, {
      message: `Total message content exceeds maximum size of ${MAX_TOTAL_BYTES} bytes or more than ${MAX_MESSAGES} messages`,
    }),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  stream: z.boolean().optional(),
  // OpenAI stream_options passthrough (Zod strips unknown keys, so this must
  // be declared or clients can never request the final usage chunk).
  stream_options: z
    .object({ include_usage: z.boolean().optional() })
    .optional(),
  tools: z.array(z.any()).optional(),
  tool_choice: z.union([z.enum(["none", "auto", "required"]), z.any()]).optional(),
  parallel_tool_calls: z.boolean().optional(),
  response_format: z.any().optional(),
  // Standard OpenAI-compatible sampling params — previously stripped by Zod
  top_p: z.number().min(0).max(1).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  seed: z.number().int().optional(),
  n: z.number().int().positive().max(10).optional(),
  logit_bias: z.record(z.number()).optional(),
  user: z.string().max(500).optional(),
});

export const completionSchema = z.object({
  model: z.string().min(1).max(100),
  prompt: z.union([z.string(), z.array(z.string())]),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  n: z.number().int().positive().max(10).optional(),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  stream: z.boolean().optional(),
  logprobs: z.number().int().optional(),
  echo: z.boolean().optional(),
  presence_penalty: z.number().min(-2).max(2).optional(),
  frequency_penalty: z.number().min(-2).max(2).optional(),
  best_of: z.number().int().positive().optional(),
});

export const embeddingsSchema = z.object({
  model: z.string().min(1).max(100),
  input: z.union([z.string().max(50000), z.array(z.string().max(50000))]),
});
