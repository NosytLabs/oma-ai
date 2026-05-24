import { Hono } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import crypto from "node:crypto";
import { houdiniClient, SwapType, OrderStatus } from "../credits/houdini-client.js";
import { getModel } from "../inference/models.js";
import { getModelPricing, handleChatCompletion } from "../inference/router.js";
import { settlePayment, verifyPayment, getSettlementReceipt } from "./facilitator.js";
import { bearerAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { config } from "../config.js";
import { validationError } from "../lib/validation.js";
import { USDC_BASE } from "../constants.js";
import type { OmaEnv } from "../types.js";

import { getRedisClient } from "../lib/redis-client.js";

export const crosschainRoutes = new Hono<OmaEnv>();

const FACILITATOR_MARGIN_PERCENT = 1.5;
const QUOTE_TTL_SECONDS = 60;
const QUOTE_CACHE_PREFIX = "quote:";

const quoteSchema = z.object({
  model: z.string().min(1),
  inputTokens: z.number().int().min(1).default(100),
  fromToken: z.string().min(1),
  fromChain: z.string().min(1),
  swapType: z.enum(["private", "standard", "dex"]).optional(),
});

const depositSchema = z.object({
  quoteId: z.string().min(1),
  refundAddress: z.string().optional(),
});

interface PendingQuote {
  quoteId: string;
  fromToken: string;
  fromChain: string;
  fromAmount: string;
  toAmount: string;
  routingFee: string;
  facilitatorFee: string;
  totalCostUsd: string;
  model: string;
  inputTokens: number;
  swapType: SwapType;
  houdiniQuoteId: string;
  createdAt: number;
}

crosschainRoutes.post("/v1/x402/quote", async (c) => {
  const parsed = quoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { model, inputTokens, fromToken, fromChain, swapType } = parsed.data;

  const modelInfo = getModel(model);
  if (!modelInfo) {
    return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 400);
  }

  const pricing = getModelPricing(model);
  const estimatedOutputTokens = Math.floor(modelInfo.maxTokens / 4);
  const inputCostUsd = (inputTokens * pricing.inputPer1k) / 1000;
  const outputCostUsd = (estimatedOutputTokens * pricing.outputPer1k) / 1000;
  const markupMultiplier = 1 + pricing.markup / 100;
  const inferenceCostUsd = (inputCostUsd + outputCostUsd) * markupMultiplier;
  const facilitatorFee = inferenceCostUsd * (FACILITATOR_MARGIN_PERCENT / 100);

  try {
    const quotes = await houdiniClient.getQuotes(
      fromToken,
      "USDC",
      inferenceCostUsd.toFixed(8),
      swapType as SwapType | undefined
    );

    if (!quotes.length) {
      return c.json({ error: { message: "No HoudiniSwap route found for this token/chain pair", type: "no_route" } }, 404);
    }

    const bestQuote = quotes[0];
    const routingFee = bestQuote.fee ?? "0";
    const totalCostUsd = (inferenceCostUsd + facilitatorFee + parseFloat(routingFee)).toFixed(8);

    const quoteId = crypto.randomUUID();

    const pendingQuote: PendingQuote = {
      quoteId,
      fromToken,
      fromChain,
      fromAmount: bestQuote.amount,
      toAmount: bestQuote.estimatedAmount,
      routingFee,
      facilitatorFee: facilitatorFee.toFixed(8),
      totalCostUsd,
      model,
      inputTokens,
      swapType: (swapType as SwapType) ?? SwapType.STANDARD,
      houdiniQuoteId: bestQuote.id,
      createdAt: Date.now(),
    };

    const redis = await getRedisClient();
    if (!redis) {
      return c.json({ error: { message: "Cache service unavailable", type: "cache_error" } }, 503);
    }
    
    await redis.set(`${QUOTE_CACHE_PREFIX}${quoteId}`, JSON.stringify(pendingQuote), { EX: QUOTE_TTL_SECONDS * 2 });

    return c.json({
      quoteId,
      fromToken,
      fromChain,
      fromAmount: pendingQuote.fromAmount,
      toAmount: pendingQuote.toAmount,
      toToken: "USDC",
      routingFee,
      facilitatorFee: pendingQuote.facilitatorFee,
      totalCostUsd,
      expiresIn: QUOTE_TTL_SECONDS,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Quote failed: ${message}`, type: "quote_error" } }, 502);
  }
});

crosschainRoutes.post("/v1/x402/deposit", async (c) => {
  const parsed = depositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { quoteId, refundAddress } = parsed.data;

  const redis = await getRedisClient();
  if (!redis) {
    return c.json({ error: { message: "Cache service unavailable", type: "cache_error" } }, 503);
  }

  const lockKey = `${QUOTE_CACHE_PREFIX}lock:${quoteId}`;
  const lockAcquired = await redis.set(lockKey, "1", { NX: true, EX: 10 });
  
  if (!lockAcquired) {
    return c.json({ error: { message: "Quote is currently being processed", type: "rate_limit" } }, 429);
  }

  try {
    const rawQuote = await redis.get(`${QUOTE_CACHE_PREFIX}${quoteId}`);
    if (!rawQuote) {
      return c.json({ error: { message: "Quote not found or expired", type: "not_found" } }, 404);
    }
    
    const pendingQuote = JSON.parse(rawQuote) as PendingQuote;

    if (Date.now() - pendingQuote.createdAt > QUOTE_TTL_SECONDS * 1000) {
      await redis.del(`${QUOTE_CACHE_PREFIX}${quoteId}`);
      return c.json({ error: { message: "Quote expired", type: "expired" } }, 410);
    }

    const houdiniToAddress = config.HOUDINI_ADDRESS_TO;
    if (!houdiniToAddress) {
      return c.json({ error: { message: "HOUDINI_ADDRESS_TO not configured", type: "config_error" } }, 500);
    }

    const order = await houdiniClient.createExchange(
      pendingQuote.houdiniQuoteId,
      houdiniToAddress,
      refundAddress
    );

    await redis.del(`${QUOTE_CACHE_PREFIX}${quoteId}`);

    return c.json({
      orderId: order.id,
      depositAddress: order.depositAddress,
      fromToken: pendingQuote.fromToken,
      fromAmount: pendingQuote.fromAmount,
      toToken: "USDC",
      status: order.status,
      swapType: pendingQuote.swapType,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Deposit creation failed: ${message}`, type: "deposit_error" } }, 502);
  } finally {
    await redis.del(lockKey);
  }
});

crosschainRoutes.get("/v1/x402/deposit/:orderId/status", async (c) => {
  const orderId = c.req.param("orderId");
  if (!orderId) {
    return c.json({ error: { message: "orderId required", type: "invalid_request_error" } }, 400);
  }

  try {
    const order = await houdiniClient.getOrder(orderId);

    const response: Record<string, unknown> = {
      orderId: order.id,
      status: mapHoudiniStatus(order.status),
      houdiniStatus: order.status,
      fromAmount: order.fromAmount,
      toAmount: order.toAmount,
      txHash: order.transactionHash ?? null,
    };

  if (order.status === OrderStatus.FINISHED && order.toAmount) {
    if (!order.transactionHash) {
      response.status = "settling";
      response.message = "Transaction hash not yet available. Settlement pending on-chain verification.";
    } else {
      const houdiniToAddress = config.HOUDINI_ADDRESS_TO || "";
      const paymentSig = {
        x402Version: "1" as const,
        signature: order.transactionHash,
        authorization: "houdini_crosschain",
        payload: {
          x402Version: "1" as const,
          scheme: "evm" as const,
          networkId: "base",
          asset: USDC_BASE,
          amount: order.toAmount,
          payee: houdiniToAddress,
          payFrom: order.depositAddress,
          maxAmountRequired: order.toAmount,
          validBefore: Math.floor(Date.now() / 1000) + 3600,
          validAfter: Math.floor(Date.now() / 1000) - 3600,
        },
      };

      const verification = await verifyPayment(paymentSig);
      if (!verification.valid) {
        response.status = "settling";
        response.message = `On-chain verification pending: ${verification.error}`;
      } else {
        const settlementResult = settlePayment(
          order.transactionHash,
          order.toAmount,
          "base",
          houdiniToAddress,
        );
        response.creditsIssued = order.toAmount;
        response.receipt = settlementResult.receipt;
      }
    }
  }

    return c.json(response);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Status check failed: ${message}`, type: "status_error" } }, 502);
  }
});

crosschainRoutes.get("/v1/x402/chains", async (c) => {
  try {
    const chains = await houdiniClient.getChains();
    return c.json({ chains });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to fetch chains: ${message}`, type: "external_error" } }, 502);
  }
});

crosschainRoutes.get("/v1/x402/tokens", async (c) => {
  const blockchain = c.req.query("blockchain");
  try {
    const tokens = blockchain
      ? await houdiniClient.getTokensForChain(blockchain)
      : await houdiniClient.getTokens();
    return c.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to fetch tokens: ${message}`, type: "external_error" } }, 502);
  }
});

crosschainRoutes.use("/v1/x402/proxy/*", bearerAuth);
crosschainRoutes.use("/v1/x402/proxy/*", rateLimit({ windowMs: 60_000, maxRequests: 30 }));

crosschainRoutes.post("/v1/x402/proxy/chat/completions", async (c) => {
  const orderId = c.req.header("X-Houdini-Order-Id");
  if (!orderId) {
    return c.json({ error: { message: "X-Houdini-Order-Id header required", type: "payment_error" } }, 402);
  }

  let order;
  try {
    order = await houdiniClient.getOrder(orderId);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Order lookup failed: ${message}`, type: "payment_error" } }, 502);
  }

  if (order.status !== OrderStatus.FINISHED) {
    return c.json({
      error: {
        message: `Order not settled yet. Status: ${order.status}`,
        type: "payment_pending",
        orderStatus: order.status,
      },
    }, 402);
  }

  const houdiniToAddress = config.HOUDINI_ADDRESS_TO || "";

  const paymentSig = {
    x402Version: "1" as const,
    signature: order.transactionHash ?? orderId,
    authorization: "houdini_crosschain",
    payload: {
      x402Version: "1" as const,
      scheme: "evm" as const,
      networkId: "base",
      asset: USDC_BASE,
      amount: order.toAmount ?? "0",
      payee: houdiniToAddress,
      payFrom: order.depositAddress,
      maxAmountRequired: order.toAmount ?? "0",
      validBefore: Math.floor(Date.now() / 1000) + 3600,
      validAfter: Math.floor(Date.now() / 1000) - 3600,
    },
  };

  const verification = await verifyPayment(paymentSig);
  if (!verification.valid) {
    return c.json({ error: { message: `Payment verification failed: ${verification.error}`, type: "payment_error" } }, 402);
  }

  const mode = config.FACILITATOR_MODE ?? "mock";
  if (mode !== "mock" && verification.txHash) {
    settlePayment(
      verification.txHash,
      verification.amount ?? paymentSig.payload.amount,
      verification.networkId ?? paymentSig.payload.networkId,
      paymentSig.payload.payee,
    );
  }

  const body = await c.req.json();
  const userId = c.get("userId");
  const apiKey = c.get("apiKey");
  const apiKeyId = apiKey?.id ?? "unknown";

  if (!body.model || !body.messages) {
    return c.json({ error: { message: "model and messages are required", type: "invalid_request_error" } }, 400);
  }

  const payload = { ...body, stream: !!body.stream };

  try {
    const { response, provider } = await handleChatCompletion(userId, apiKeyId, payload);

    if (payload.stream) {
      return new Response(response.body, {
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "X-Accel-Buffering": "no",
          "x-provider": provider,
          "x-payment-receipt": settlementReceipt(orderId) ?? "",
        },
      });
    }

    const json = await response.json();
    return c.json(json, { headers: { "x-provider": provider, "x-payment-receipt": settlementReceipt(orderId) ?? "" } });
  } catch (err: unknown) {
    const errObj = err as Record<string, unknown>;
    const status = typeof errObj.status === "number" ? errObj.status as ContentfulStatusCode : 500;
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: (typeof errObj.type === "string" ? errObj.type : "inference_error") } }, status);
  }
});

function settlementReceipt(orderId: string): string | null {
  return getSettlementReceipt(orderId, "base");
}

function mapHoudiniStatus(status: string): string {
  switch (status) {
    case "FINISHED": return "completed";
    case "FAILED":
    case "EXPIRED": return "failed";
    case "REFUNDED": return "refunded";
    case "WAITING":
    case "CONFIRMING":
    case "EXCHANGING":
    case "ANONYMIZING": return "settling";
    default: return "pending";
  }
}
