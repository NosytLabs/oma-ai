// ponytail: shared inference handler helpers
import crypto from "node:crypto";
import { deductCredits } from "../credits/index.js";
import { trackSpend } from "../middleware/spend-limit.js";
import { logger } from "../lib/logger.js";

/**
 * Generate a requestId, deduct credits, and return the requestId.
 * Covers the common pattern: costCents = totalCents - 1, markupCents = 1.
 */
export async function chargeAndTrack(
  userId: string,
  totalCents: number,
  model: string,
  provider: "venice" | "surplus" | "tinyfish" | "gonka",
  apiKeyId: string,
  inputTokens: number,
): Promise<string> {
  const requestId = crypto.randomUUID();
  await deductCredits(
    userId,
    totalCents - 1,
    1,
    totalCents,
    model,
    provider,
    apiKeyId,
    inputTokens,
    0,
    requestId,
  );
  return requestId;
}

/**
 * Fire-and-forget API-key spend tracking.
 * Wraps the `if (apiKey) trackSpend(...)` pattern.
 *
 * trackSpend() catches and queues all failures internally (never rejects),
 * so the discarded Promise here is safe — no redundant catch needed (L6).
 */
export function trackApiKeySpend(
  keyHash: string | undefined,
  cents: number,
): void {
  if (keyHash) void trackSpend(keyHash, cents);
}

/**
 * Shared inference error handler — log + return JSON error response.
 * Works for any Hono context (typed loosely to avoid generic threading).
 * Preserves the original error message for client-facing 4xx errors
 * (insufficient_credits, model_not_allowed, invalid params) and only
 * sanitizes 5xx (the client can't act on internal errors, and leaking
 * stack details is a security smell).
 */
type HonoContextLike = {
  json(body: unknown, status?: number): Response;
};
export function inferenceErrorHandler(
  c: HonoContextLike,
  err: unknown,
  routeName: string,
): Response {
  const status = (err as { status?: number }).status ?? 500;
  const errType = (err as { type?: string }).type ?? "inference_error";
  const errCode = (err as { code?: string }).code;
  const isUserFacing = status >= 400 && status < 500;
  const rawMessage = err instanceof Error ? err.message : String(err);
  // Log full error (including stack) server-side, never echo it to the client on 5xx.
  logger.error({ err, status, routeName, type: "inference_error" }, `[chat] ${routeName} error: ${rawMessage}`);
  const responseBody: Record<string, unknown> = {
    error: {
      message: isUserFacing && rawMessage ? rawMessage : "An internal error occurred",
      type: errType,
    },
  };
  if (errCode) (responseBody.error as Record<string, unknown>).code = errCode;
  return c.json(responseBody, status);
}
