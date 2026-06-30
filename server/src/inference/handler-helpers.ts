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
  provider: "venice" | "surplus" | "tinyfish",
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
 */
export function trackApiKeySpend(
  keyHash: string | undefined,
  cents: number,
): void {
  if (keyHash) trackSpend(keyHash, cents).catch(() => {});
}

/**
 * Shared inference error handler — log + return JSON error response.
 * Works for any Hono context (typed loosely to avoid generic threading).
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
  logger.error({ err }, `[chat] ${routeName} error:`);
  return c.json(
    { error: { message: "An internal error occurred", type: errType } },
    status,
  );
}
