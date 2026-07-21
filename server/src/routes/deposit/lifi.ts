import { Hono } from "hono";
import { z } from "zod";
import { config } from "../../config.js";
import { processLifiDeposit } from "../../credits/deposit.js";
import { sessionAuth } from "../../auth/middleware.js";
import { auditLog } from "../../middleware/audit.js";
import { logger } from "../../lib/logger.js";
import { db } from "../../db/client.js";
import { deposits } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { getQuoteForSwap, getRouteStatus, checkPossibleRoutes, getSupportedChains } from "../../credits/lifi-client.js";
import type { OmaEnv } from "../../types.js";
import { validationError } from "../../lib/validation.js";
import { addToDlq } from "../../lib/dlq.js";
import { verifyHmacSha256Hex } from "../../lib/hmac.js";

const lifiDepositSchema = z.object({
  amount: z.number().positive().max(1000000).min(config.MIN_DEPOSIT_USD, `Minimum deposit is $${config.MIN_DEPOSIT_USD}`),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  fromChain: z.string().min(1),
  fromToken: z.string().min(1),
  toToken: z.string().optional(),
});

const lifiQuoteSchema = z.object({
  fromChain: z.string().min(1),
  fromToken: z.string().min(1),
  fromAmount: z.string().min(1),
});

export const lifiRoutes = new Hono<OmaEnv>();

lifiRoutes.post("/v1/deposit/lifi", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = lifiDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amount, txHash, fromChain, fromToken, toToken } = parsed.data;

  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  if (existing.length > 0) return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);

  try {
    const routeStatus = await getRouteStatus(txHash, fromChain, "base");
    if (!routeStatus || routeStatus.status !== "DONE") {
      return c.json({ error: { message: "Route transaction has not completed", type: "verification_error", routeStatus: routeStatus?.status } }, 400);
    }

    // SECURITY: Validate that the user-claimed amount matches the on-chain received amount.
    // LiFi's status endpoint returns toAmount (destination USDC received). Use that as
    // the source of truth instead of the user-supplied body amount, which could be inflated.
    const onChainAmountUsd = Number(routeStatus.toAmount) / 1e6; // USDC has 6 decimals
    if (!Number.isFinite(onChainAmountUsd) || onChainAmountUsd <= 0) {
      // If LiFi doesn't report toAmount, use the user-claimed amount but log a warning.
      // This is a degraded security posture — operators should monitor for abuse.
      logger.warn({ txHash, fromChain, claimedAmount: amount, toAmount: routeStatus.toAmount }, "LiFi deposit: toAmount missing or invalid, falling back to claimed amount");
    }
    const verifiedAmount = (Number.isFinite(onChainAmountUsd) && onChainAmountUsd > 0)
      ? onChainAmountUsd
      : amount;

    // If on-chain amount is available, verify it roughly matches the claim (1% tolerance for fees/slippage)
    if (Number.isFinite(onChainAmountUsd) && onChainAmountUsd > 0) {
      if (onChainAmountUsd < amount * 0.99) {
        return c.json({
          error: {
            message: `Amount mismatch: claimed $${amount}, on-chain received is $${onChainAmountUsd.toFixed(2)}`,
            type: "amount_mismatch",
            claimedAmount: amount,
            onChainAmount: onChainAmountUsd,
          },
        }, 400);
      }
    }

    const result = await processLifiDeposit(userId, verifiedAmount, txHash, fromChain, fromToken, toToken);

    const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || undefined;
    const userAgent = c.req.header("user-agent") || undefined;

    await auditLog({
      userId,
      action: "DEPOSIT_CREATED",
      resource: "deposits",
      resourceId: result.depositId,
      metadata: { amount, txHash, fromChain, fromToken, toToken, method: "lifi_swap" },
      ipAddress,
      userAgent,
    });

    return c.json({ credits: result.creditsCents, depositId: result.depositId, method: "lifi" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});

lifiRoutes.post("/v1/deposit/lifi/quote", sessionAuth, async (c) => {
  const parsed = lifiQuoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { fromChain, fromToken, fromAmount } = parsed.data;
  try {
    const quote = await getQuoteForSwap(fromChain, fromToken, fromAmount);
    return c.json({
      id: quote.id,
      fromAmount: quote.fromAmount,
      toAmount: quote.estimatedAmount,
      toToken: quote.toToken?.symbol ?? "USDC",
      toChain: quote.toChain?.key ?? "base",
      steps: quote.steps,
      estimatedDuration: quote.estimatedDuration,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Quote failed: ${message}`, type: "quote_error" } }, 502);
  }
});

lifiRoutes.post("/v1/deposit/lifi/check-routes", async (c) => {
  const parsed = lifiQuoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { fromChain, fromToken, fromAmount } = parsed.data;
  try {
    const routes = await checkPossibleRoutes(fromChain, fromToken, fromAmount);
    return c.json({ possible: routes });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Route check failed: ${message}`, type: "route_error" } }, 502);
  }
});

lifiRoutes.get("/v1/deposit/lifi/chains", async (c) => {
  try {
    const allChains = await getSupportedChains();
    const chains = allChains.filter((ch) => ch.enabled).map((ch) => ch.key);
    return c.json({ chains });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "error" } }, 500);
  }
});

lifiRoutes.post("/v1/deposit/lifi/webhook", async (c) => {
  const rawBody = await c.req.raw.text();
  const signature = c.req.header("X-Lifi-Signature") || "";

  if (!config.LIFI_WEBHOOK_SECRET) {
    logger.error("[LI.FI] FATAL: LIFI_WEBHOOK_SECRET is not set. Webhook secrets must not fall back to JWT_SECRET.");
    return c.json({ error: { message: "LI.FI webhook not configured", type: "config_error" } }, 503);
  }
  const secret = config.LIFI_WEBHOOK_SECRET;
  if (!verifyHmacSha256Hex(secret, rawBody, signature)) {
    return c.json({ error: { message: "Invalid signature", type: "authentication_error" } }, 401);
  }

  try {
    const body = JSON.parse(rawBody);
    if (!body.txHash || !body.fromChain) {
      return c.json({ error: { message: "Missing txHash or fromChain", type: "validation" } }, 400);
    }

    // Verify the deposit on-chain before crediting
    const routeStatus = await getRouteStatus(body.txHash, body.fromChain, "base");
    if (!routeStatus || routeStatus.status !== "DONE") {
      return c.json({ error: { message: "Route transaction has not completed", type: "verification_error", routeStatus: routeStatus?.status } }, 400);
    }

    const onChainAmountUsd = Number(routeStatus.toAmount) / 1e6;
    if (!Number.isFinite(onChainAmountUsd) || onChainAmountUsd <= 0) {
      return c.json({ error: { message: "Invalid on-chain amount", type: "verification_error" } }, 400);
    }

    // Note: This webhook doesn't have userId - it would need to be resolved from the deposit record
    // or passed in the webhook payload. For now, we just acknowledge receipt.
    // Actual credit processing would happen via the user-initiated deposit endpoint.
    logger.info({ txHash: body.txHash, fromChain: body.fromChain, amountUsd: onChainAmountUsd }, "LI.FI webhook received and verified");

    return c.json({ status: "verified", amountUsd: onChainAmountUsd });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    await addToDlq("lifi", rawBody, message);
    return c.json({ error: { message, type: "webhook_error" } }, 500);
  }
});