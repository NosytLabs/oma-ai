import { Hono } from "hono";
import { z } from "zod";
import crypto from "node:crypto";
import { addCredits } from "../credits/index.js";
import { bearerAuth } from "../auth/middleware.js";
import { config } from "../config.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../lib/validation.js";
import type { OmaEnv } from "../types.js";
import { QuoteCache } from "../lib/quote-cache.js";
import { addToDlq } from "../lib/dlq.js";
import { logger } from "../lib/logger.js";

export const onrampRoutes = new Hono<OmaEnv>();

// M5: hardcoded business constants moved to config.ts (env-tunable)
const CREDITS_PER_USD = config.CREDITS_PER_USD;
const ONRAMP_MIN_USD = config.ONRAMP_MIN_USD;
const ONRAMP_MAX_USD = config.ONRAMP_MAX_USD;
const PROCESSING_FEE_PERCENT = config.ONRAMP_PROCESSING_FEE_PERCENT;
const SESSION_TTL_MS = config.ONRAMP_QUOTE_CACHE_TTL_MS;

const quoteCache = new QuoteCache({
  ttlMs: SESSION_TTL_MS,
  lockTtlMs: 30_000,
});

const quoteSchema = z.object({
  amountUsd: z.number().min(ONRAMP_MIN_USD).max(ONRAMP_MAX_USD),
});

const sessionSchema = z.object({
  amountUsd: z.number().min(ONRAMP_MIN_USD).max(ONRAMP_MAX_USD),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

interface PendingSession {
  id: string;
  userId: string;
  amountUsd: number;
  creditsCents: number;
  fiatFeeCents: number;
  status: "pending" | "completed" | "expired";
  createdAt: number;
}

onrampRoutes.post("/v1/onramp/quote", rateLimit({ windowMs: 60_000, maxRequests: 20 }), async (c) => {
  const parsed = quoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amountUsd } = parsed.data;

  const fiatFee = amountUsd * (PROCESSING_FEE_PERCENT / 100);
  const netUsd = amountUsd - fiatFee;
  const creditsCents = Math.round(netUsd * CREDITS_PER_USD);

  return c.json({
    amountUsd,
    processingFeeUsd: Math.round(fiatFee * 100) / 100,
    netUsd: Math.round(netUsd * 100) / 100,
    credits: creditsCents,
    rate: CREDITS_PER_USD,
  });
});

onrampRoutes.post("/v1/onramp/session", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = sessionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amountUsd } = parsed.data;

  const fiatFee = amountUsd * (PROCESSING_FEE_PERCENT / 100);
  const netUsd = amountUsd - fiatFee;
  const creditsCents = Math.round(netUsd * CREDITS_PER_USD);

  const sessionId = crypto.randomUUID();
  const pending: PendingSession = {
    id: sessionId,
    userId,
    amountUsd,
    creditsCents,
    fiatFeeCents: Math.round(fiatFee * 100),
    status: "pending",
    createdAt: Date.now(),
  };
  await quoteCache.set(pending);

  return c.json({
    sessionId,
    amountUsd,
    credits: creditsCents,
    status: "pending",
  });
});

onrampRoutes.get("/v1/onramp/session/:id", bearerAuth, async (c) => {
  const sessionId = c.req.param("id");
  if (!sessionId) {
    return c.json({ error: { message: "Missing session id", type: "invalid_request_error" } }, 400);
  }
  const session = await quoteCache.get(sessionId);
  if (!session) {
    return c.json({ error: { message: "Session not found or expired", type: "not_found" } }, 404);
  }
  return c.json({
    sessionId: session.id,
    amountUsd: session.amountUsd,
    credits: session.creditsCents,
    status: session.status,
  });
});

onrampRoutes.post("/v1/onramp/webhook", rateLimit({ windowMs: 60_000, maxRequests: 30 }), async (c) => {
  const rawBody = await c.req.raw.text();
  const signature = c.req.header("X-Onramp-Signature") || "";

  if (!config.ONRAMP_WEBHOOK_SECRET) {
    logger.error("[ONRAMP] FATAL: ONRAMP_WEBHOOK_SECRET is not set. Webhook secrets must not fall back to JWT_SECRET.");
    return c.json({ error: { message: "Onramp webhook not configured", type: "config_error" } }, 503);
  }
  const secret = config.ONRAMP_WEBHOOK_SECRET;
  const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expectedSig.length) {
    return c.json({ error: { message: "Invalid signature", type: "authentication_error" } }, 401);
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expectedSig, "utf8"))) {
    return c.json({ error: { message: "Invalid signature", type: "authentication_error" } }, 401);
  }

    try {
    const body = JSON.parse(rawBody);
    if (!body.sessionId) {
      return c.json({ error: { message: "Missing sessionId", type: "validation" } }, 400);
    }

    const workerId = `webhook-${crypto.randomUUID().slice(0, 8)}`;
    const lockAcquired = await quoteCache.acquireLock(body.sessionId, workerId);
    if (!lockAcquired) {
      return c.json({ error: { message: "Session locked, concurrent processing", type: "conflict" } }, 409);
    }

    try {
      const session = await quoteCache.get(body.sessionId);
      if (!session) {
        return c.json({ error: { message: "Session not found", type: "not_found" } }, 404);
      }

      if (session.status !== "pending") {
        return c.json({ error: { message: "Session already processed", type: "duplicate" } }, 409);
      }

      await quoteCache.updateStatus(body.sessionId, "completed");
      await addCredits(session.userId, session.creditsCents);

      return c.json({ credits: session.creditsCents, status: "completed" });
    } finally {
      await quoteCache.releaseLock(body.sessionId, workerId);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await addToDlq("onramp", rawBody, message);
    return c.json({ error: { message, type: "webhook_error" } }, 500);
  }
});
