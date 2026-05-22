import { Hono } from "hono";
import { z } from "zod";
import { processUsdcDeposit, processOmaDeposit, processHoudiniDeposit, completeHoudiniDeposit, processCctpDeposit, processLifiDeposit } from "../credits/deposit.js";
import { getBalance, getStakingDiscount } from "../credits/balance.js";
import { houdiniClient, SwapType } from "../credits/houdini-client.js";
import { sessionAuth, bearerAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { deposits, usageRecords } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { config } from "../config.js";
import { checkCircuitBreaker } from "../credits/circuit-breaker.js";
import { verifyBurnTransaction, waitForAttestation, getCctpSupportedChains } from "../credits/cctp-client.js";
import { getQuoteForSwap, getRouteStatus, checkPossibleRoutes, getSupportedChains } from "../credits/lifi-client.js";
import { routeDeposit } from "../credits/deposit-router.js";
import type { Token } from "../credits/houdini-client.js";
import crypto from "crypto";
import type { OmaEnv } from "../types.js";

export const depositRoutes = new Hono<OmaEnv>();

function validationError(err: z.ZodError) {
  return { error: { message: `Validation error: ${err.errors.map((e) => e.message).join(", ")}`, type: "invalid_request_error" as const } };
}

const isHoudiniConfigured = !!config.HOUDINI_API_KEY && !!config.HOUDINI_API_SECRET;

const MOCK_HOUDINI_CHAINS = [
  { id: "BASE", name: "Base", blockchain: "BASE" },
  { id: "ETHEREUM", name: "Ethereum", blockchain: "ETHEREUM" },
  { id: "SOLANA", name: "Solana", blockchain: "SOLANA" }
];

const MOCK_HOUDINI_TOKENS = [
  { id: "USDC-BASE", name: "USD Coin (Base)", symbol: "USDC", blockchain: "BASE", decimals: 6, address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", logoUrl: "https://oma-ai.com/logos/usdc.png" },
  { id: "ETH-BASE", name: "Ethereum (Base)", symbol: "ETH", blockchain: "BASE", decimals: 18, address: "0x4200000000000000000000000000000000000006", logoUrl: "https://oma-ai.com/logos/eth.png" },
  { id: "USDC-ETH", name: "USD Coin", symbol: "USDC", blockchain: "ETHEREUM", decimals: 6, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", logoUrl: "https://oma-ai.com/logos/usdc.png" },
  { id: "ETH-ETH", name: "Ethereum", symbol: "ETH", blockchain: "ETHEREUM", decimals: 18, logoUrl: "https://oma-ai.com/logos/eth.png" },
  { id: "USDT-ETH", name: "Tether USD", symbol: "USDT", blockchain: "ETHEREUM", decimals: 6, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", logoUrl: "https://oma-ai.com/logos/usdt.png" },
  { id: "SOL-SOL", name: "Solana", symbol: "SOL", blockchain: "SOLANA", decimals: 9, logoUrl: "https://oma-ai.com/logos/sol.png" }
];

const usdcDepositSchema = z.object({
  amount: z.number().positive().max(100000),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

const omaDepositSchema = z.object({
  amount: z.number().positive(),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

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

const cctpDepositSchema = z.object({
  amount: z.number().positive().max(1000000),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  sourceChain: z.string().min(1),
  fastTransfer: z.boolean().optional(),
});

const lifiDepositSchema = z.object({
  amount: z.number().positive().max(1000000),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  fromChain: z.string().min(1),
  fromToken: z.string().min(1),
  toToken: z.string().optional(),
});

const depositRouteSchema = z.object({
  sourceChain: z.string().optional(),
  sourceToken: z.string().optional(),
  amount: z.string().min(1),
});

const lifiQuoteSchema = z.object({
  fromChain: z.string().min(1),
  fromToken: z.string().min(1),
  fromAmount: z.string().min(1),
});

depositRoutes.post("/v1/deposit/usdc", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = usdcDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amount, txHash } = parsed.data;
  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  if (existing.length > 0) return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);
  try {
    const result = await processUsdcDeposit(userId, amount, txHash);
    return c.json({ credits: result.creditsCents, depositId: result.depositId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});

depositRoutes.post("/v1/deposit/oma", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = omaDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amount, txHash } = parsed.data;
  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  if (existing.length > 0) return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);
  try {
    const result = await processOmaDeposit(userId, amount, txHash);
    return c.json({ credits: result.creditsCents, bonus: result.bonusPercent, depositId: result.depositId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("circuit breaker") || message.includes("halted")) {
      return c.json({ error: { message, type: "circuit_breaker" } }, 403);
    }
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});

depositRoutes.post("/v1/deposit/houdini", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = houdiniDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { fromCoin, amount, quoteId, swapType } = parsed.data;

  if (!isHoudiniConfigured) {
    const mockOrderId = "mock-order-" + crypto.randomBytes(4).toString("hex");
    const mockDepositAddress = "0xMockDepositAddress" + crypto.randomBytes(12).toString("hex");
    const exchangeQuoteId = quoteId ?? "mock-quote-" + crypto.randomBytes(4).toString("hex");
    const result = await processHoudiniDeposit(userId, exchangeQuoteId, fromCoin, amount, mockOrderId, mockDepositAddress);
    return c.json({ depositAddress: result.depositAddress, depositId: result.depositId, orderId: mockOrderId });
  }

  const allowedCoins = await houdiniClient.getTokens()
    .then((t) => t.map((x: Token) => x.symbol))
    .catch((err: unknown) => {
      console.error("[houdini] Failed to fetch allowed coins:", err);
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

depositRoutes.post("/v1/deposit/houdini/webhook", async (c) => {
  const rawBody = await c.req.raw.text();
  const signature = c.req.header("X-Houdini-Signature") || "";
  const secret = config.HOUDINI_WEBHOOK_SECRET;
  if (!secret) return c.json({ error: { message: "Webhook not configured", type: "config_error" } }, 503);
  const expectedSig = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  if (signature.length !== expectedSig.length) {
    return c.json({ error: { message: "Invalid signature", type: "unauthorized" } }, 401);
  }
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
    return c.json({ error: { message: "Invalid signature", type: "unauthorized" } }, 401);
  }

  const body = JSON.parse(rawBody);
  if (!body.depositId || !body.toAmount || !body.txHash) return c.json({ error: { message: "Missing required fields", type: "validation" } }, 400);

  try {
    const [deposit] = await db.select({ userId: deposits.userId }).from(deposits).where(eq(deposits.id, body.depositId)).limit(1);
    if (!deposit) return c.json({ error: { message: "Deposit not found", type: "not_found" } }, 404);
    // amountUsd is the net USD amount OMA actually receives (after HoudiniSwap fees)
    const result = await completeHoudiniDeposit(body.depositId, Number(body.toAmount), body.txHash, deposit.userId, body.amountUsd ? Number(body.amountUsd) : undefined);
    return c.json({ credits: result.creditsCents, status: "completed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("not pending") || message.includes("not found") || message.includes("ownership mismatch")) {
      return c.json({ credits: 0, status: "completed", duplicate: true });
    }
    return c.json({ error: { message, type: "webhook_error" } }, 500);
  }
});

depositRoutes.post("/v1/deposit/houdini/quote", sessionAuth, async (c) => {
  const parsed = houdiniQuoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { fromToken, toToken, amount, swapType } = parsed.data;

  if (!isHoudiniConfigured) {
    const mockQuote = [{
      quoteId: "mock-quote-" + crypto.randomBytes(4).toString("hex"),
      fromToken,
      toToken,
      fromAmount: amount,
      toAmount: String(Number(amount) * 0.995), // Mock 0.5% fee
      rate: "0.995",
      estimatedTime: 120,
      swapType: swapType ?? "standard",
      slippage: 1,
    }];
    return c.json(mockQuote);
  }

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

depositRoutes.get("/v1/deposit/houdini/tokens", async (c) => {
  const blockchain = c.req.query("blockchain");

  if (!isHoudiniConfigured) {
    const filtered = blockchain
      ? MOCK_HOUDINI_TOKENS.filter((t) => t.blockchain.toUpperCase() === blockchain.toUpperCase())
      : MOCK_HOUDINI_TOKENS;
    return c.json({ tokens: filtered });
  }

  try {
    const tokens = await houdiniClient.getTokens(blockchain);
    return c.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to fetch tokens: ${message}`, type: "external_error" } }, 502);
  }
});

depositRoutes.get("/v1/deposit/houdini/chains", async (c) => {
  if (!isHoudiniConfigured) {
    return c.json({ chains: MOCK_HOUDINI_CHAINS });
  }

  try {
    const chains = await houdiniClient.getChains();
    return c.json({ chains });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to fetch chains: ${message}`, type: "external_error" } }, 502);
  }
});

depositRoutes.post("/v1/deposit/houdini/exchange", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = houdiniExchangeSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { quoteId, fromCoin, fromAmount, refundAddress } = parsed.data;

  if (!isHoudiniConfigured) {
    const mockOrderId = "mock-order-" + crypto.randomBytes(4).toString("hex");
    const mockDepositAddress = "0xMockDepositAddress" + crypto.randomBytes(12).toString("hex");
    const result = await processHoudiniDeposit(userId, quoteId, fromCoin, fromAmount, mockOrderId, mockDepositAddress);
    return c.json({
      depositId: result.depositId,
      depositAddress: mockDepositAddress,
      orderId: mockOrderId,
      fromAmount,
      toAmount: String(Number(fromAmount) * 0.995),
      status: "pending",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  }

  try {
    const order = await houdiniClient.createExchange(quoteId, undefined, refundAddress);
    const result = await processHoudiniDeposit(userId, quoteId, fromCoin, fromAmount, order.id, order.depositAddress);
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
    return c.json({ error: { message: `Exchange failed: ${message}`, type: "exchange_error" } }, 502);
  }
});


depositRoutes.post("/v1/deposit/cctp", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = cctpDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amount, txHash, sourceChain, fastTransfer } = parsed.data;

  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  if (existing.length > 0) return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);

  try {
    const burnTx = await verifyBurnTransaction(sourceChain, txHash);
    if (!burnTx.verified) {
      return c.json({ error: { message: "Invalid burn transaction", type: "verification_error" } }, 400);
    }

    if (fastTransfer) {
      const attestation = await waitForAttestation(sourceChain, txHash, 15, 2000);
      if (attestation.status !== "complete") {
        return c.json({ error: { message: "Attestation timeout - try standard transfer", type: "attestation_timeout" } }, 408);
      }
    }

    const result = await processCctpDeposit(userId, amount, txHash, sourceChain);
    return c.json({ credits: result.creditsCents, depositId: result.depositId, method: "cctp" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});

depositRoutes.post("/v1/deposit/cctp/status", async (c) => {
  const parsed = z.object({ txHash: z.string().min(1), sourceChain: z.string().min(1) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { txHash, sourceChain } = parsed.data;
  try {
    const burnTx = await verifyBurnTransaction(sourceChain, txHash);
    const attestation = await waitForAttestation(sourceChain, txHash, 3, 2000);
    return c.json({ verified: burnTx.verified, attested: attestation.status === "complete", burnAmount: burnTx.burnAmount, burnDomain: burnTx.sourceChain });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "verification_error" } }, 502);
  }
});

depositRoutes.get("/v1/deposit/cctp/chains", async (c) => {
  const chains = getCctpSupportedChains();
  return c.json({ chains });
});

depositRoutes.post("/v1/deposit/lifi", sessionAuth, async (c) => {
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

    const result = await processLifiDeposit(userId, amount, txHash, fromChain, fromToken, toToken);
    return c.json({ credits: result.creditsCents, depositId: result.depositId, method: "lifi" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});

depositRoutes.post("/v1/deposit/lifi/quote", sessionAuth, async (c) => {
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

depositRoutes.post("/v1/deposit/lifi/check-routes", async (c) => {
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

depositRoutes.get("/v1/deposit/lifi/chains", async (c) => {
  try {
    const allChains = await getSupportedChains();
    const chains = allChains.filter((ch) => ch.enabled).map((ch) => ch.key);
    return c.json({ chains });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "error" } }, 500);
  }
});

depositRoutes.post("/v1/deposit/route", sessionAuth, async (c) => {
  const parsed = depositRouteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { sourceChain, sourceToken, amount } = parsed.data;
  try {
    const route = routeDeposit(sourceChain ?? "ethereum", sourceToken ?? "USDC", amount);
    return c.json(route);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Routing failed: ${message}`, type: "routing_error" } }, 500);
  }
});

depositRoutes.get("/v1/balance", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const balance = await getBalance(userId);
  const stakingDiscount = await getStakingDiscount(userId);
  return c.json({ balanceCents: balance.balanceCents, stakingDiscount });
});

depositRoutes.get("/v1/usage", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const records = await db.select().from(usageRecords)
    .where(eq(usageRecords.userId, userId))
    .orderBy(desc(usageRecords.createdAt))
    .limit(100);
  return c.json({ usage: records });
});

depositRoutes.get("/v1/deposit/status/:id", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const depositId = c.req.param("id");
  if (!depositId) {
    return c.json({ error: { message: "Missing deposit id", type: "validation_error" } }, 400);
  }
  const rows = await db.select().from(deposits).where(
    and(eq(deposits.id, depositId), eq(deposits.userId, userId))
  ).limit(1);
  if (!rows.length) {
    return c.json({ error: { message: "Deposit not found", type: "not_found" } }, 404);
  }
  const depositRecord = rows[0];

  const deposit = depositRecord;
  if (deposit.userId !== userId) {
    return c.json({ error: { message: "Unauthorized", type: "unauthorized" } }, 403);
  }

  if (deposit.status === "completed" || deposit.status === "failed" || deposit.status === "refunded" || deposit.status === "expired") {
    return c.json({
      id: deposit.id,
      type: deposit.type,
      status: deposit.status,
      amountUsd: deposit.amountUsd,
      creditsIssued: deposit.creditsIssued,
      txHash: deposit.txHash,
    });
  }

  if (deposit.type === "houdini_swap" && deposit.houdiniId) {
    if (deposit.houdiniId.startsWith("mock-order")) {
      const createdMs = new Date(deposit.createdAt).getTime();
      const elapsedSec = (Date.now() - createdMs) / 1000;
      let mockStatus: "pending" | "settling" | "completed" = "pending";
      
      if (elapsedSec > 30) {
        mockStatus = "completed";
      } else if (elapsedSec > 10) {
        mockStatus = "settling";
      }

      if (mockStatus !== deposit.status) {
        await db.update(deposits)
          .set({ status: mockStatus })
          .where(eq(deposits.id, depositId!));
        if (mockStatus === "completed" && !deposit.txHash) {
          const toAmount = 99.5; // Mock 99.5 USDC out of 100.0
          const mockTxHash = "0xmocktx" + crypto.randomBytes(28).toString("hex");
          await completeHoudiniDeposit(depositId!, toAmount, mockTxHash, deposit.userId);
        }
      }

      const displayAmount = (deposit.amountUsd && deposit.amountUsd !== "0") ? deposit.amountUsd : "100.0";

      return c.json({
        id: deposit.id,
        type: deposit.type,
        status: mockStatus,
        houdiniStatus: mockStatus === "completed" ? "FINISHED" : (mockStatus === "settling" ? "EXCHANGING" : "WAITING"),
        amountUsd: deposit.amountUsd,
        creditsIssued: deposit.creditsIssued,
        fromAmount: displayAmount,
        toAmount: String(Number(displayAmount) * 0.995),
        txHash: deposit.txHash || "0xmocktx" + crypto.randomBytes(28).toString("hex"),
      });
    }

    try {
      const order = await houdiniClient.getDepositStatus(deposit.houdiniId);
      const mappedStatus = mapHoudiniStatus(order.status);
      if (mappedStatus !== deposit.status) {
        await db.update(deposits)
          .set({ status: mappedStatus })
          .where(eq(deposits.id, depositId!));
      }
      if (order.status === "FINISHED" && order.toAmount && !deposit.txHash) {
        await completeHoudiniDeposit(depositId!, Number(order.toAmount), order.transactionHash ?? "", deposit.userId);
      }
      return c.json({
        id: deposit.id,
        type: deposit.type,
        status: mappedStatus,
        houdiniStatus: order.status,
        amountUsd: deposit.amountUsd,
        creditsIssued: deposit.creditsIssued,
        fromAmount: order.fromAmount,
        toAmount: order.toAmount,
        txHash: deposit.txHash || order.transactionHash,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      return c.json({
        id: deposit.id,
        type: deposit.type,
        status: deposit.status,
        amountUsd: deposit.amountUsd,
        creditsIssued: deposit.creditsIssued,
        pollError: message,
      });
    }
  }

  return c.json({
    id: deposit.id,
    type: deposit.type,
    status: deposit.status,
    amountUsd: deposit.amountUsd,
    creditsIssued: deposit.creditsIssued,
  });
});

depositRoutes.get("/v1/deposit/coins", async (c) => {
  try {
    const tokens = await houdiniClient.getTokens();
    return c.json({ tokens });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "external_error" } }, 502);
  }
});

depositRoutes.get("/v1/circuit-breaker", bearerAuth, async (c) => {
  try {
    const breaker = await checkCircuitBreaker();
    return c.json(breaker);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "oracle_error" } }, 502);
  }
});

function mapHoudiniStatus(status: string): "pending" | "settling" | "completed" | "failed" | "expired" | "refunded" {
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
