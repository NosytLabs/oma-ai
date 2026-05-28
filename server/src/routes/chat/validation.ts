import { z } from "zod";
import { config } from "../../config.js";
import { USDC_BASE } from "../../constants.js";

export const MAX_MESSAGE_CONTENT_BYTES = 100_000;
export const MAX_MESSAGES = 100;
export const MAX_TOTAL_BYTES = 1_000_000;
export const MAX_REQUEST_BODY_SIZE = 10_000_000;

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

export function createInsufficientCreditsPayReq(
  returnToUrl: string,
  amountCents: number = 1,
) {
  const now = Math.floor(Date.now() / 1000);
  const paymentURL = `https://pay.oma-ai.com/x402/deposit?network=base&asset=USDC&return_to=${encodeURIComponent(returnToUrl)}`;
  return {
    x402Version: "1" as const,
    scheme: "evm" as const,
    networkId: "base",
    asset: USDC_BASE,
    amount: (amountCents / 100).toFixed(2),
    payee:
      config.HOUDINI_ADDRESS_TO ||
      "0x0000000000000000000000000000000000000000",
    maxAmountRequired: (amountCents / 100).toFixed(2),
    validBefore: now + 3600,
    validAfter: now,
    "payment-URL": paymentURL,
  };
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
    const m = msg as { role?: unknown; content?: unknown };
    if (!m.role || !m.content) return false;

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
    content: z.union([z.string(), z.array(z.any())]),
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
  tools: z.array(z.any()).optional(),
  response_format: z.any().optional(),
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
