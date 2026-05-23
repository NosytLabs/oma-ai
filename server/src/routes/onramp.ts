import { Hono } from "hono";
import { z } from "zod";
import crypto from "node:crypto";
import { addCredits } from "../credits/balance.js";
import { bearerAuth } from "../auth/middleware.js";
import { config } from "../config.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { validationError } from "../lib/validation.js";
import type { OmaEnv } from "../types.js";

export const onrampRoutes = new Hono<OmaEnv>();

const CREDITS_PER_USD = 100;
const ONRAMP_MIN_USD = 10;
const ONRAMP_MAX_USD = 1000;
const PROCESSING_FEE_PERCENT = 2.9;
const SESSION_TTL_MS = 86_400_000;

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

const sessionCache = new Map<string, PendingSession>();

setInterval(() => {
  const now = Date.now();
  for (const [key, session] of sessionCache) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessionCache.delete(key);
    }
  }
}, 300_000).unref();

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
  sessionCache.set(sessionId, pending);

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
  const session = sessionCache.get(sessionId);
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

onrampRoutes.post("/v1/onramp/webhook", async (c) => {
  const rawBody = await c.req.raw.text();
  const signature = c.req.header("X-Onramp-Signature") || "";

  const secret = config.ONRAMP_WEBHOOK_SECRET || config.JWT_SECRET;
  if (config.NODE_ENV === "production" && !config.ONRAMP_WEBHOOK_SECRET) {
    console.error("[ONRAMP] FATAL: ONRAMP_WEBHOOK_SECRET must be explicitly set in production");
    return c.json({ error: { message: "Onramp webhook not configured", type: "config_error" } }, 503);
  }
  if (!config.ONRAMP_WEBHOOK_SECRET) {
    console.warn("[ONRAMP] WARNING: Using JWT_SECRET as fallback for webhook HMAC. Set ONRAMP_WEBHOOK_SECRET in production to avoid secret reuse.");
  }
  const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (signature.length !== expectedSig.length) {
    return c.json({ error: { message: "Invalid signature", type: "authentication_error" } }, 401);
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expectedSig, "utf8"))) {
    return c.json({ error: { message: "Invalid signature", type: "authentication_error" } }, 401);
  }

  const body = JSON.parse(rawBody);
  if (!body.sessionId) {
    return c.json({ error: { message: "Missing sessionId", type: "validation" } }, 400);
  }

  const session = sessionCache.get(body.sessionId);
  if (!session) {
    return c.json({ error: { message: "Session not found", type: "not_found" } }, 404);
  }

  if (session.status !== "pending") {
    return c.json({ error: { message: "Session already processed", type: "duplicate" } }, 409);
  }

  session.status = "completed";
  await addCredits(session.userId, session.creditsCents);

  return c.json({ credits: session.creditsCents, status: "completed" });
});
