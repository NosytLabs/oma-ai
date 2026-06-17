import { Hono } from "hono";
import { z } from "zod";
import { processHoudiniDeposit, completeHoudiniDepositWithTx, processPaymentLinkDeposit } from "../../credits/deposit.js";
import { houdiniClient, SwapType } from "../../credits/houdini-client.js";
import { sessionAuth } from "../../auth/middleware.js";
import { auditLog } from "../../middleware/audit.js";
import { db } from "../../db/client.js";
import { deposits } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../../config.js";
import type { OmaEnv } from "../../types.js";
import crypto from "crypto";
import { addToDlq } from "../../lib/dlq.js";
import type { Token } from "../../credits/houdini-client.js";
import { validationError } from "../../lib/validation.js";
import { logger } from "../../lib/logger.js";

const houdiniDepositSchema = z.object({
  fromCoin: z.string().min(1),
  amount: z.string().min(1),
  quoteId: z.string().optional(),
  swapType: z.enum(["private", "standard", "dex"]).optional(),
});

const houdiniQuoteSchema = z.object({
  fromToken: z.string().min(1),
  toToken: z.string().min(1),
  amount: z.string().min(1),
  swapType: z.enum(["private", "standard", "dex"]).optional(),
});

const houdiniExchangeSchema = z.object({
  quoteId: z.string().min(1),
  fromCoin: z.string().min(1),
  fromAmount: z.string().min(1),
  refundAddress: z.string().optional(),
});

const paymentLinkSchema = z.object({
  amount: z.number().positive(),
  token: z.string().min(1),
  chain: z.enum(["base", "ethereum", "bitcoin"]),
});

export const houdiniRoutes = new Hono<OmaEnv>();

houdiniRoutes.post("/v1/deposit/houdini", sessionAuth, async (c) => {
  const userId = c.get("userId");
  
  if (!houdiniClient.isConfigured()) {
    return c.json({ 
      error: { 
        message: "HoudiniSwap is not configured on this server. Direct crypto deposits are currently unavailable.", 
        type: "configuration_error" 
      } 
    }, 503);
  }
  
  const parsed = houdiniDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { fromCoin, amount, quoteId, swapType } = parsed.data;

  const allowedCoins = await houdiniClient.getTokens()
    .then((t) => t.map((x: Token) => x.symbol))
    .catch((err: unknown) => {
      logger.error({ err }, "[houdini] Failed to fetch allowed coins");
      return [];
    });
  if (allowedCoins.length > 0 && !(allowedCoins as string[]).includes(fromCoin)) {
    return c.json({ error: { message: `Unsupported coin: ${fromCoin}`, type: "invalid_request_error" } }, 400);
  }
  try {
    let exchangeQuoteId = quoteId;
    if (!exchangeQuoteId) {
      const quotes = await houdiniClient.getQuotes(fromCoin, "USDC", amount, swapType as SwapType | undefined);
      if (!quotes.length) {
        return c.json({ error: { message: "No swap route found for this coin/amount", type: "no_route" } }, 404);
      }
      exchangeQuoteId = quotes[0].id;
    }
    const order = await houdiniClient.createExchange(exchangeQuoteId!);
    const result = await processHoudiniDeposit(userId, exchangeQuoteId!, fromCoin, amount, order.id, order.depositAddress);
    return c.json({ depositAddress: result.depositAddress, depositId: result.depositId, orderId: order.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});

houdiniRoutes.post("/v1/deposit/houdini/webhook", async (c) => {
  const rawBody = await c.req.raw.text();
  const signature = c.req.header("X-Houdini-Signature") || "";
  const secret = config.HOUDINI_WEBHOOK_SECRET;
  
  if (!secret) {
    return c.json({ error: { message: "Webhook not configured", type: "config_error" } }, 503);
  }
  
  const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");
  if (signatureBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
    return c.json({ error: { message: "Invalid signature", type: "authentication_error" } }, 401);
  }

  try {
    const body = JSON.parse(rawBody);
    const isPaymentLink = body.type === "payment_link" || body.paymentLinkId;
    const depositId = body.depositId;
    // H12: houdiniId (the upstream order id) is the trust anchor. The
    // webhook body's `toAmount` is a hint and can be replayed. We must
    // re-fetch the order from HoudiniSwap and use its `toAmount` as
    // the source of truth, otherwise an attacker who somehow captures
    // a webhook (HMAC secret leak) could redirect the credits elsewhere.
    const houdiniOrderId = body.orderId || body.houdiniId;
    const txHash = body.txHash;

    if (!depositId || !txHash) return c.json({ error: { message: "Missing required fields", type: "validation" } }, 400);

    const [deposit] = await db.select({ userId: deposits.userId, type: deposits.type, houdiniId: deposits.houdiniId }).from(deposits).where(eq(deposits.id, depositId)).limit(1);
    if (!deposit) return c.json({ error: { message: "Deposit not found", type: "not_found" } }, 404);

    if (isPaymentLink || deposit.type === "payment_link") {
      const paymentStatus = body.status;
      if (paymentStatus && paymentStatus !== "completed") {
        return c.json({ status: paymentStatus, message: "Payment not completed yet" });
      }
      const paymentLinkId = body.paymentLinkId || body.depositId;
      // H12: re-fetch the payment link from HoudiniSwap rather than
      // trusting the webhook body's amount. Fall back to the body
      // only if the upstream is unavailable.
      let amountUsd = Number(body.amountUsd ?? body.toAmount);
      if (body.paymentLinkId) {
        try {
          const live = await houdiniClient.getPaymentLink(body.paymentLinkId);
          if (live && typeof live.amount === "string" && live.amount.length > 0) {
            amountUsd = Number(live.amount);
          }
        } catch (fetchErr) {
          logger.warn({ paymentLinkId: body.paymentLinkId, err: fetchErr }, "[houdini:webhook] payment-link re-fetch failed; falling back to webhook body");
        }
      }
      const result = await processPaymentLinkDeposit(depositId, paymentLinkId, amountUsd, txHash);
      return c.json({ credits: result.creditsCents, status: "completed" });
    }

    // H12: re-fetch the order from HoudiniSwap and use the live
    // `toAmount` as the credited amount. The webhook body's `toAmount`
    // is treated as a fallback for when the upstream is unreachable.
    const orderId = houdiniOrderId ?? deposit.houdiniId;
    let toAmount = body.toAmount;
    if (orderId) {
      try {
        const order = await houdiniClient.getOrder(orderId);
        if (order && order.toAmount) {
          toAmount = order.toAmount;
        }
      } catch (fetchErr) {
        logger.warn(
          { orderId, err: fetchErr },
          "[houdini:webhook] order re-fetch failed; falling back to webhook body toAmount",
        );
      }
    }
    if (!toAmount) {
      return c.json({ error: { message: "Missing toAmount (no upstream order, no webhook body)", type: "validation" } }, 400);
    }

    const result = await db.transaction(async (tx) => {
      const [lockedDeposit] = await tx.select().from(deposits).where(eq(deposits.id, depositId)).for("update");
      if (!lockedDeposit) throw new Error("Deposit not found");
      if (lockedDeposit.status !== "pending") throw new Error("Deposit is not pending");
      if (lockedDeposit.userId !== deposit.userId) throw new Error("Deposit ownership mismatch");
      return completeHoudiniDepositWithTx(tx, depositId, Number(toAmount), txHash, deposit.userId);
    });
    return c.json({ credits: result.creditsCents, status: "completed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not pending") || message.includes("not found") || message.includes("ownership mismatch")) {
      return c.json({ credits: 0, status: "completed", duplicate: true });
    }

    await addToDlq("houdini", rawBody, message);
    return c.json({ error: { message, type: "webhook_error" } }, 500);
  }
});

houdiniRoutes.post("/v1/deposit/houdini/quote", sessionAuth, async (c) => {
  if (!houdiniClient.isConfigured()) {
    return c.json({ 
      error: { 
        message: "HoudiniSwap is not configured on this server.", 
        type: "configuration_error" 
      } 
    }, 503);
  }
  
  const parsed = houdiniQuoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { fromToken, toToken, amount, swapType } = parsed.data;

  try {
    const quotes = await houdiniClient.getQuotes(fromToken, toToken, amount, swapType as SwapType | undefined);
    const mapped = quotes.map((q) => ({
      quoteId: q.id,
      fromToken: q.fromToken,
      toToken: q.toToken,
      fromAmount: q.amount,
      toAmount: q.estimatedAmount,
      rate: q.rate,
      estimatedTime: 0,
      swapType: q.swapType,
      slippage: 1,
    }));
    return c.json(mapped);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Quote failed: ${message}`, type: "quote_error" } }, 502);
  }
});

houdiniRoutes.get("/v1/deposit/houdini/tokens", async (c) => {
  if (!houdiniClient.isConfigured()) {
    return c.json({ 
      error: { 
        message: "HoudiniSwap is not configured on this server.", 
        type: "configuration_error" 
      } 
    }, 503);
  }
  
  const blockchain = c.req.query("blockchain");

  try {
    const tokens = await houdiniClient.getTokens(blockchain);
    return c.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to fetch tokens: ${message}`, type: "external_error" } }, 502);
  }
});

houdiniRoutes.get("/v1/deposit/houdini/chains", async (c) => {
  if (!houdiniClient.isConfigured()) {
    return c.json({ 
      error: { 
        message: "HoudiniSwap is not configured on this server.", 
        type: "configuration_error" 
      } 
    }, 503);
  }
  
  try {
    const chains = await houdiniClient.getChains();
    return c.json({ chains });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to fetch chains: ${message}`, type: "external_error" } }, 502);
  }
});

houdiniRoutes.post("/v1/deposit/houdini/exchange", sessionAuth, async (c) => {
  if (!houdiniClient.isConfigured()) {
    return c.json({ 
      error: { 
        message: "HoudiniSwap is not configured on this server.", 
        type: "configuration_error" 
      } 
    }, 503);
  }
  
  const userId = c.get("userId");
  const parsed = houdiniExchangeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { quoteId, fromCoin, fromAmount, refundAddress } = parsed.data;

  try {
    const order = await houdiniClient.createExchange(quoteId, undefined, refundAddress);
    const result = await processHoudiniDeposit(userId, quoteId, fromCoin, fromAmount, order.id, order.depositAddress);

    const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || undefined;
    const userAgent = c.req.header("user-agent") || undefined;

    await auditLog({
      userId,
      action: "DEPOSIT_CREATED",
      resource: "deposits",
      resourceId: result.depositId,
      metadata: { quoteId, fromCoin, fromAmount, orderId: order.id, method: "houdini_swap" },
      ipAddress,
      userAgent,
    });

    return c.json({
      depositId: result.depositId,
      depositAddress: order.depositAddress,
      orderId: order.id,
      fromAmount: order.fromAmount,
      toAmount: order.toAmount,
      status: mapHoudiniStatus(order.status),
      expiresAt: order.createdAt,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, fromCoin, fromAmount }, "[deposit:houdini] Exchange failed");
    return c.json({ error: { message: `Exchange failed: ${message}`, type: "exchange_error" } }, 502);
  }
});

houdiniRoutes.post("/v1/deposit/houdini/payment-link", sessionAuth, async (c) => {
  if (!houdiniClient.isConfigured()) {
    return c.json({ 
      error: { 
        message: "HoudiniSwap is not configured on this server. Payment links are currently unavailable.", 
        type: "configuration_error" 
      } 
    }, 503);
  }
  
  const userId = c.get("userId");
  const parsed = paymentLinkSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amount, token, chain } = parsed.data;

  try {
    const amountStr = String(amount);
    const paymentLink = await houdiniClient.createPaymentLink(amountStr, token, chain);
    const [deposit] = await db.insert(deposits).values({
      userId,
      type: "payment_link",
      status: "pending",
      amountUsd: String(amount),
      creditsIssued: "0",
      houdiniId: paymentLink.id,
    }).returning();

    return c.json({
      depositId: deposit.id,
      paymentLink: {
        id: paymentLink.id,
        url: paymentLink.url,
        amount: paymentLink.amount,
        token: paymentLink.token,
        chain: paymentLink.chain,
        expiresAt: paymentLink.expiresAt,
        status: paymentLink.status,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Payment link failed: ${message}`, type: "payment_link_error" } }, 502);
  }
});

export function mapHoudiniStatus(status: string): "pending" | "settling" | "completed" | "failed" | "expired" | "refunded" {
  switch (status) {
    case "FINISHED": return "completed";
    case "FAILED": return "failed";
    case "REFUNDED": return "refunded";
    case "EXPIRED": return "failed";
    case "WAITING":
    case "CONFIRMING":
    case "EXCHANGING":
    case "ANONYMIZING": return "settling";
    default: return "pending";
  }
}
