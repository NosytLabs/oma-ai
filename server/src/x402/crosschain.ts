import { Hono, type Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { z } from "zod";
import crypto from "node:crypto";
import { houdiniClient, SwapType, OrderStatus } from "../credits/houdini-client.js";
import { getModel } from "../inference/models.js";
import { getModelPricing, handleChatCompletion } from "../inference/router.js";
import { settlePayment, verifyPayment, getSettlementReceipt, type PaymentSignature } from "./facilitator.js";
import { bearerAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { config } from "../config.js";
import { validationError } from "../lib/validation.js";
import { USDC_BASE } from "../constants.js";
import type { OmaEnv } from "../types.js";
import { createPublicClient, http } from "viem";
import { base } from "viem/chains";

import { getRedisClient } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";

export const crosschainRoutes = new Hono<OmaEnv>();

const FACILITATOR_MARGIN_PERCENT = 1.5;
const QUOTE_TTL_SECONDS = 60;
const QUOTE_CACHE_PREFIX = "quote:";
const MAX_QUOTE_CACHE_SIZE = 1000;
const LOCK_TTL_SECONDS = 10;
const LOCK_VALUE_PREFIX = "lock:";

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
  expectedToAmount: string;
  routingFee: string;
  facilitatorFee: string;
  totalCostUsd: string;
  model: string;
  inputTokens: number;
  swapType: SwapType;
  houdiniQuoteId: string;
  createdAt: number;
  slippageTolerance: number;
  requestId: string;
}

function routeError(c: Context, err: unknown, prefix: string, type: string): Response {
  const message = err instanceof Error ? err.message : String(err);
  return c.json({ error: { message: `${prefix}: ${message}`, type } }, 502);
}

function buildHoudiniPaymentSig(
  order: { id: string; depositAddress: string; transactionHash?: string; toAmount?: string },
  orderId: string,
  houdiniToAddress: string,
): PaymentSignature {
  return {
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
      nonce: `houdini:${order.id}:${order.transactionHash ?? orderId}`.padEnd(32, "0").slice(0, 64),
    },
  };
}

async function evictOldestQuotes(redis: NonNullable<Awaited<ReturnType<typeof getRedisClient>>>, count: number): Promise<void> {
  const keys: string[] = [];
  let cursor = "0";
  do {
    const result = await redis.scan(cursor, { MATCH: `${QUOTE_CACHE_PREFIX}*`, COUNT: 100 });
    cursor = result.cursor;
    keys.push(...result.keys);
  } while (cursor !== "0");

  if (keys.length === 0) return;

  keys.sort();
  const keysToDelete = keys.slice(0, count);
  if (keysToDelete.length > 0) {
    await redis.del(keysToDelete);
  }
}

// ponytail: CRIT-2 — rate-limit Houdini crosschain quote/deposit (not x402 protocol) to prevent abuse & drain attacks
const x402QuoteRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 20 });
const x402DepositRateLimit = rateLimit({ windowMs: 60_000, maxRequests: 20 });

crosschainRoutes.post("/v1/x402/quote", x402QuoteRateLimit, async (c) => {
  const parsed = quoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { model, inputTokens, fromToken, fromChain, swapType } = parsed.data;

  const modelInfo = await getModel(model);
  if (!modelInfo) {
    return c.json({ error: { message: `Model '${model}' not found`, type: "invalid_request_error" } }, 400);
  }

  const pricing = await getModelPricing(model);
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
    const slippageTolerance = config.CROSSCHAIN_SLIPPAGE_TOLERANCE ?? 0.02;

    const quoteId = crypto.randomUUID();
    const requestId = crypto.randomUUID();

    const pendingQuote: PendingQuote = {
      quoteId,
      fromToken,
      fromChain,
      fromAmount: bestQuote.amount,
      toAmount: bestQuote.estimatedAmount,
      expectedToAmount: bestQuote.estimatedAmount,
      routingFee,
      facilitatorFee: facilitatorFee.toFixed(8),
      totalCostUsd,
      model,
      inputTokens,
      swapType: (swapType as SwapType) ?? SwapType.STANDARD,
      houdiniQuoteId: bestQuote.id,
      createdAt: Date.now(),
      slippageTolerance,
      requestId,
    };

    const redis = await getRedisClient();
    if (!redis) {
      return c.json({ error: { message: "Cache service unavailable", type: "cache_error" } }, 503);
    }

    let currentSize = 0;
    let cursor = "0";
    do {
      const result = await redis.scan(cursor, { MATCH: `${QUOTE_CACHE_PREFIX}*`, COUNT: 100 });
      cursor = result.cursor;
      currentSize += result.keys.length;
    } while (cursor !== "0");

    if (currentSize >= MAX_QUOTE_CACHE_SIZE) {
      await evictOldestQuotes(redis, 10);
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
      slippageTolerance,
    });
  } catch (err: unknown) {
    return routeError(c, err, "Quote failed", "quote_error");
  }
});

crosschainRoutes.post("/v1/x402/deposit", x402DepositRateLimit, async (c) => {
  const parsed = depositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { quoteId, refundAddress } = parsed.data;

  const redis = await getRedisClient();
  if (!redis) {
    return c.json({ error: { message: "Cache service unavailable", type: "cache_error" } }, 503);
  }

  const rawQuote = await redis.get(`${QUOTE_CACHE_PREFIX}${quoteId}`);
  if (!rawQuote) {
    return c.json({ error: { message: "Quote not found or expired", type: "not_found" } }, 404);
  }
  
  const pendingQuote = JSON.parse(rawQuote) as PendingQuote;
  const lockKey = `${QUOTE_CACHE_PREFIX}${LOCK_VALUE_PREFIX}${quoteId}`;
  const lockValue = pendingQuote.requestId;
  const lockAcquired = await redis.set(lockKey, lockValue, { NX: true, EX: LOCK_TTL_SECONDS });
  
  if (!lockAcquired) {
    return c.json({ error: { message: "Quote is currently being processed", type: "rate_limit" } }, 429);
  }

  try {
    const currentLockValue = await redis.get(lockKey);
    if (currentLockValue !== lockValue) {
      logger.error(`[CROSSCHAIN] Lock ownership verification failed for quote ${quoteId}`);
      return c.json({ error: { message: "Quote lock expired or transferred", type: "lock_error" } }, 409);
    }

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
      refundAddress,
      pendingQuote.slippageTolerance
    );

    await redis.del(`${QUOTE_CACHE_PREFIX}${quoteId}`);

    return c.json({
      orderId: order.id,
      depositAddress: order.depositAddress,
      fromToken: pendingQuote.fromToken,
      fromAmount: pendingQuote.fromAmount,
      toToken: "USDC",
      expectedToAmount: pendingQuote.expectedToAmount,
      minAcceptedAmount: (parseFloat(pendingQuote.expectedToAmount) * (1 - pendingQuote.slippageTolerance)).toFixed(8),
      status: order.status,
      swapType: pendingQuote.swapType,
      expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });
  } catch (err: unknown) {
    return routeError(c, err, "Deposit creation failed", "deposit_error");
  } finally {
    const currentLockValue = await redis.get(lockKey);
    if (currentLockValue === lockValue) {
      await redis.del(lockKey);
    }
  }
});

crosschainRoutes.get("/v1/x402/deposit/:orderId/status", async (c) => {
  const orderId = c.req.param("orderId");
  if (!orderId) {
    return c.json({ error: { message: "orderId required", type: "invalid_request_error" } }, 400);
  }

  try {
    const order = await houdiniClient.getOrder(orderId);

    const statusResult = mapHoudiniStatus(order.status, order);
    const response: Record<string, unknown> = {
      orderId: order.id,
      status: statusResult.status,
      houdiniStatus: order.status,
      fromAmount: order.fromAmount,
      toAmount: order.toAmount,
      txHash: order.transactionHash ?? null,
      ...(statusResult.refundTxHash && {
        refundTxHash: statusResult.refundTxHash,
        refundStatus: "processed",
      }),
    };

  if (order.status === OrderStatus.FINISHED && order.toAmount) {
    if (!order.transactionHash) {
      response.status = "settling";
      response.message = "Transaction hash not yet available. Settlement pending on-chain verification.";
    } else {
      const requiredConfirmations = config.CROSSCHAIN_BLOCK_CONFIRMATIONS ?? 6;
      const confirmationCheck = await checkBlockConfirmations(order.transactionHash, requiredConfirmations);

      if (!confirmationCheck.confirmed) {
        response.status = "settling";
        response.message = `Waiting for block confirmations: ${confirmationCheck.confirmations}/${requiredConfirmations}`;
        response.blockConfirmations = confirmationCheck;
      } else {
        const houdiniToAddress = config.HOUDINI_ADDRESS_TO || "";
        const pendingQuoteMinAmount = (parseFloat(order.toAmount) * 0.98).toFixed(8);
        const actualToAmount = parseFloat(order.toAmount);
        const minAcceptedAmount = parseFloat(pendingQuoteMinAmount);

        if (actualToAmount < minAcceptedAmount) {
          response.status = "slippage_violation";
          response.message = `Slippage exceeded: received ${actualToAmount} USDC, expected at least ${minAcceptedAmount} USDC`;
          response.creditsIssued = null;
          response.receipt = null;
        } else {
          const paymentSig = buildHoudiniPaymentSig(order, order.id, houdiniToAddress);

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
            response.slippageProtection = {
              expectedAmount: order.toAmount,
              actualAmount: actualToAmount,
              minAcceptedAmount,
              withinTolerance: true,
            };
          }
        }
      }
    }
  }

    return c.json(response);
  } catch (err: unknown) {
    return routeError(c, err, "Status check failed", "status_error");
  }
});

crosschainRoutes.get("/v1/x402/chains", async (c) => {
  try {
    const chains = await houdiniClient.getChains();
    return c.json({ chains });
  } catch (err: unknown) {
    return routeError(c, err, "Failed to fetch chains", "external_error");
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
    return routeError(c, err, "Failed to fetch tokens", "external_error");
  }
});

crosschainRoutes.use("/v1/x402/proxy/*", bearerAuth);
crosschainRoutes.use("/v1/x402/proxy/*", rateLimit({ windowMs: 60_000, maxRequests: 30 }));

crosschainRoutes.post("/v1/x402/proxy/chat/completions", async (c) => {
  const orderId = c.req.header("X-Houdini-Order-Id");
  if (!orderId) {
    return c.json({ error: { message: "X-Houdini-Order-Id header required", type: "payment_error" } }, 402);
  }

  let order: Awaited<ReturnType<typeof houdiniClient.getOrder>>;
  try {
    order = await houdiniClient.getOrder(orderId);
  } catch (err: unknown) {
    return routeError(c, err, "Order lookup failed", "payment_error");
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

  const paymentSig = buildHoudiniPaymentSig(order, orderId, houdiniToAddress);

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

function settlementReceipt(txHash: string): string | null {
  return getSettlementReceipt(txHash, "base");
}

function mapHoudiniStatus(status: string, order?: { refundTxHash?: string; refundAddress?: string }): { status: string; refundTxHash?: string; refundAddress?: string } {
  const baseStatus = (() => {
    switch (status) {
      case "FINISHED": return "completed";
      case "FAILED":
      case "EXPIRED": return "failed";
      case "REFUNDED": {
        logger.info(`[CROSSCHAIN] [AUDIT] Refund processed for order. refundTxHash: ${order?.refundTxHash ?? "N/A"}, refundAddress: ${order?.refundAddress ?? "N/A"}`);
        return "refunded";
      }
      case "WAITING":
      case "CONFIRMING":
      case "EXCHANGING":
      case "ANONYMIZING": return "settling";
      default: return "pending";
    }
  })();
  
  return {
    status: baseStatus,
    ...(status === "REFUNDED" && order ? {
      refundTxHash: order.refundTxHash,
      refundAddress: order.refundAddress,
    } : {}),
  };
}

async function checkBlockConfirmations(
  txHash: string,
  requiredConfirmations: number
): Promise<{ confirmed: boolean; currentBlock: number; confirmations: number }> {
  try {
    const client = createPublicClient({
      chain: base,
      transport: http(config.CHAIN_RPC_URL),
    });

    const currentBlock = await client.getBlockNumber();
    const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });

    if (!receipt) {
      return { confirmed: false, currentBlock: Number(currentBlock), confirmations: 0 };
    }

    const confirmations = Number(currentBlock - receipt.blockNumber);
    return {
      confirmed: confirmations >= requiredConfirmations,
      currentBlock: Number(currentBlock),
      confirmations,
    };
  } catch (err) {
    logger.error(`[CROSSCHAIN] Block confirmation check failed for ${txHash}: %s`, err);
    return { confirmed: false, currentBlock: 0, confirmations: 0 };
  }
}
