import { Hono } from "hono";
import { z } from "zod";
import { sessionAuth } from "../auth/middleware.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { auditLog } from "../middleware/audit.js";
import { getBalance, invalidateBalanceCache } from "../credits/index.js";
import { db } from "../db/client.js";
import { withdrawals, creditBalances } from "../db/schema.js";
import { eq, sql, and, gte } from "drizzle-orm";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { USDC_BASE } from "../constants.js";

// M5: hardcoded business constants moved to config.ts (env-tunable)
const DAILY_WITHDRAWAL_LIMIT_CENTS = config.WITHDRAW_DAILY_LIMIT_CENTS;
const WEEKLY_WITHDRAWAL_LIMIT_CENTS = config.WITHDRAW_WEEKLY_LIMIT_CENTS;

async function getRecentWithdrawalSum(userId: string, since: Date, tx?: typeof db): Promise<number> {
  const client = tx ?? db;
  const result = await client
    .select({
      total: sql<number>`COALESCE(SUM(${withdrawals.amountCents}::numeric), 0)`,
    })
    .from(withdrawals)
    .where(
      and(
        eq(withdrawals.userId, userId),
        gte(withdrawals.createdAt, since)
      )
    );
  return parseInt(String(result[0]?.total ?? 0), 10);
}

async function checkWithdrawalLimits(
  userId: string,
  amountCents: number,
  tx?: typeof db
): Promise<{
  allowed: boolean;
  reason?: string;
  dailyLimit?: number;
  weeklyLimit?: number;
  dailyUsed?: number;
  weeklyUsed?: number;
}> {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [dailySum, weeklySum] = await Promise.all([
    getRecentWithdrawalSum(userId, dayAgo, tx),
    getRecentWithdrawalSum(userId, weekAgo, tx),
  ]);

  const dailyRemaining = DAILY_WITHDRAWAL_LIMIT_CENTS - dailySum;
  const weeklyRemaining = WEEKLY_WITHDRAWAL_LIMIT_CENTS - weeklySum;

  if (dailySum + amountCents > DAILY_WITHDRAWAL_LIMIT_CENTS) {
    const err = new Error("WITHDRAWAL_LIMIT_EXCEEDED") as Error & { details: typeof limitDetails };
    const limitDetails = {
      allowed: false,
      reason: `Daily withdrawal limit exceeded. You have $${(dailyRemaining / 100).toFixed(2)} remaining for today.`,
      dailyLimit: DAILY_WITHDRAWAL_LIMIT_CENTS,
      weeklyLimit: WEEKLY_WITHDRAWAL_LIMIT_CENTS,
      dailyUsed: dailySum,
      weeklyUsed: weeklySum,
    };
    err.details = limitDetails;
    throw err;
  }

  if (weeklySum + amountCents > WEEKLY_WITHDRAWAL_LIMIT_CENTS) {
    const err = new Error("WITHDRAWAL_LIMIT_EXCEEDED") as Error & { details: typeof limitDetails };
    const limitDetails = {
      allowed: false,
      reason: `Weekly withdrawal limit exceeded. You have $${(weeklyRemaining / 100).toFixed(2)} remaining for this week.`,
      dailyLimit: DAILY_WITHDRAWAL_LIMIT_CENTS,
      weeklyLimit: WEEKLY_WITHDRAWAL_LIMIT_CENTS,
      dailyUsed: dailySum,
      weeklyUsed: weeklySum,
    };
    err.details = limitDetails;
    throw err;
  }

  return {
    allowed: true,
    dailyLimit: DAILY_WITHDRAWAL_LIMIT_CENTS,
    weeklyLimit: WEEKLY_WITHDRAWAL_LIMIT_CENTS,
    dailyUsed: dailySum,
    weeklyUsed: weeklySum,
  };
}
import { getPublicClient } from "../lib/rpc-client.js";
import type { OmaEnv } from "../types.js";

const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const withdrawalRequestSchema = z.object({
  amount: z.number().positive().max(100000),
  toAddress: z.string().regex(EVM_ADDRESS_RE, "Invalid EVM address format"),
  chainId: z.number().int().positive().optional().default(config.BASE_CHAIN_ID),
});

export const withdrawalRoutes = new Hono<OmaEnv>();

withdrawalRoutes.post("/v1/withdraw/usdc/quote", sessionAuth, rateLimit({ windowMs: 60_000, maxRequests: 10 }), async (c) => {
  const userId = c.get("userId");
  const parsed = withdrawalRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request", type: "validation_error", details: parsed.error.flatten() } }, 400);
  }
  const { amount, toAddress, chainId } = parsed.data;

  const balance = await getBalance(userId);
  const balanceUsd = parseFloat(balance.balanceCents) / 100;

  if (balanceUsd < amount) {
    return c.json({
      error: {
        message: `Insufficient balance. You have $${balanceUsd.toFixed(2)} but want to withdraw $${amount.toFixed(2)}`,
        type: "insufficient_balance",
      },
    }, 400);
  }

  const amountCents = Math.round(amount * 100);
  const limitCheck = await checkWithdrawalLimits(userId, amountCents);
  if (!limitCheck.allowed) {
    return c.json({
      error: {
        message: limitCheck.reason,
        type: "withdrawal_limit_exceeded",
        details: {
          dailyLimit: limitCheck.dailyLimit! / 100,
          weeklyLimit: limitCheck.weeklyLimit! / 100,
          dailyUsed: limitCheck.dailyUsed! / 100,
          weeklyUsed: limitCheck.weeklyUsed! / 100,
        },
      },
    }, 400);
  }

  // M5: hardcoded fees moved to config.ts (env-tunable)
  const protocolFeePercent = config.WITHDRAW_PROTOCOL_FEE_PERCENT / 100; // 0.1% → 0.001
  // Use integer cents arithmetic to avoid floating-point rounding errors, then
  // convert back to dollars for the response (matching execution handler math)
  const protocolFeeDollars = Math.round(amountCents * protocolFeePercent) / 100;
  const networkFeeEstimate = config.WITHDRAW_NETWORK_FEE_ESTIMATE_USD;
  const netAmount = amount - protocolFeeDollars - networkFeeEstimate;

  return c.json({
    amount: amount,
    netAmount: Math.max(0, netAmount),
    protocolFee: protocolFeeDollars,
    networkFee: networkFeeEstimate,
    toAddress,
    chainId,
    estimatedArrival: "5-30 minutes",
    validFor: 300,
  });
});

withdrawalRoutes.post("/v1/withdraw/usdc", sessionAuth, rateLimit({ windowMs: 60_000, maxRequests: 10 }), async (c) => {
  const userId = c.get("userId");
  const parsed = withdrawalRequestSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request", type: "validation_error", details: parsed.error.flatten() } }, 400);
  }
  const { amount, toAddress, chainId } = parsed.data;

  const balance = await getBalance(userId);
  const balanceCents = parseInt(balance.balanceCents, 10);
  const amountCents = Math.round(amount * 100);
  // Enforce integer cents upper bound: $100,000 max (10M cents)
  if (amountCents > 10_000_000) {
    return c.json({ error: { message: "Withdrawal amount exceeds maximum", type: "validation_error" } }, 400);
  }

  if (balanceCents < amountCents) {
    return c.json({
      error: {
        message: "Insufficient balance for withdrawal",
        type: "insufficient_balance",
      },
    }, 400);
  }

  // M5: hardcoded fees moved to config.ts (env-tunable)
  const protocolFeePercent = config.WITHDRAW_PROTOCOL_FEE_PERCENT / 100; // 0.1% → 0.001
  const protocolFee = amountCents * protocolFeePercent;
  const networkFeeCents = config.WITHDRAW_NETWORK_FEE_CENTS;
  const netAmountCents = amountCents - Math.round(protocolFee) - networkFeeCents;

  if (netAmountCents <= 0) {
    return c.json({
      error: {
        message: "Withdrawal amount too small to cover fees",
        type: "validation_error",
      },
    }, 400);
  }

  try {
    // C1: Wrap insert + balance deduction in a transaction with row-level lock
    // to prevent double-spend race conditions. Check withdrawal limits INSIDE
    // the transaction after acquiring the row lock to prevent TOCTOU race.
    const withdrawal = await db.transaction(async (tx) => {
      // Lock the balance row to prevent concurrent withdrawals from reading stale data
      const [lockedBalance] = await tx.select()
        .from(creditBalances)
        .where(eq(creditBalances.userId, userId))
        .for("update");

      if (!lockedBalance || parseInt(lockedBalance.balanceCents, 10) < amountCents) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Check withdrawal limits inside the transaction (after row lock) to prevent
      // TOCTOU race where concurrent withdrawals could exceed limits between
      // the check and the insert.
      await checkWithdrawalLimits(userId, amountCents, tx);

      const [w] = await tx.insert(withdrawals).values({
        userId,
        type: "usdc_withdrawal",
        amountCents: String(amountCents),
        netAmountCents: String(netAmountCents),
        feeCents: String(Math.round(protocolFee) + networkFeeCents),
        toAddress,
        chainId: String(chainId),
        status: "pending",
        txHash: null,
      }).returning();

      await tx.update(creditBalances)
        .set({
          balanceCents: sql`${creditBalances.balanceCents} - ${amountCents}`,
          totalUsedCents: sql`${creditBalances.totalUsedCents} + ${amountCents}`,
          lastActivityAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(creditBalances.userId, userId));

      return w;
    });

    await invalidateBalanceCache(userId);

    const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || undefined;
    const userAgent = c.req.header("user-agent") || undefined;

    await auditLog({
      userId,
      action: "WITHDRAWAL_CREATED",
      resource: "withdrawals",
      resourceId: withdrawal.id,
      metadata: { amount: amountCents, netAmount: netAmountCents, toAddress, chainId },
      ipAddress,
      userAgent,
    });

    return c.json({
      withdrawalId: withdrawal.id,
      amount: amount,
      netAmount: netAmountCents / 100,
      status: "pending",
      estimatedArrival: "5-30 minutes",
    });
  } catch (err: unknown) {
    // M4: Log full error server-side but return generic message to client
    logger.error({ err, userId, amount }, "[withdraw] Withdrawal failed:");
    if (err instanceof Error && err.message === "INSUFFICIENT_BALANCE") {
      return c.json({ error: { message: "Insufficient balance for withdrawal", type: "withdrawal_error" } }, 400);
    }
    if (err instanceof Error && err.message === "WITHDRAWAL_LIMIT_EXCEEDED") {
      const details = (err as Error & { details?: unknown }).details;
      if (details && typeof details === "object" && details !== null) {
        const d = details as Record<string, unknown>;
        return c.json({
          error: {
            message: String(d.reason ?? "Withdrawal limit exceeded"),
            type: "withdrawal_limit_exceeded",
            details: {
              dailyLimit: Number(d.dailyLimit ?? 0) / 100,
              weeklyLimit: Number(d.weeklyLimit ?? 0) / 100,
              dailyUsed: Number(d.dailyUsed ?? 0) / 100,
              weeklyUsed: Number(d.weeklyUsed ?? 0) / 100,
            },
          },
        }, 400);
      }
      return c.json({ error: { message: "Withdrawal limit exceeded", type: "withdrawal_limit_exceeded" } }, 400);
    }
    return c.json({ error: { message: "Withdrawal failed. Please try again later.", type: "withdrawal_error" } }, 500);
  }
});

withdrawalRoutes.get("/v1/withdraw/history", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(Math.max(parseInt(c.req.query("limit") || "20", 10) || 20, 1), 100);
  const offset = Math.max(parseInt(c.req.query("offset") || "0", 10) || 0, 0);

  const history = await db.select().from(withdrawals)
    .where(eq(withdrawals.userId, userId))
    .orderBy(sql`${withdrawals.createdAt} DESC`)
    .limit(limit)
    .offset(offset);

  return c.json({
    withdrawals: history.map((w: typeof withdrawals.$inferSelect) => ({
      id: w.id,
      amount: parseFloat(w.amountCents) / 100,
      netAmount: parseFloat(w.netAmountCents) / 100,
      fee: parseFloat(w.feeCents) / 100,
      toAddress: w.toAddress,
      status: w.status,
      txHash: w.txHash,
      createdAt: w.createdAt,
      completedAt: w.completedAt,
    })),
    pagination: { limit, offset, hasMore: history.length === limit },
  });
});

withdrawalRoutes.get("/v1/withdraw/:id", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const withdrawalId = c.req.param("id") as string;

  // C5: Filter by both id AND userId in single query to prevent timing-based
  // existence leak (404 vs 403 response time difference).
  const [withdrawal] = await db.select().from(withdrawals)
    .where(and(eq(withdrawals.id, withdrawalId), eq(withdrawals.userId, userId)))
    .limit(1);

  if (!withdrawal) {
    return c.json({ error: { message: "Withdrawal not found", type: "not_found" } }, 404);
  }

  return c.json({
    id: withdrawal.id,
    amount: parseFloat(withdrawal.amountCents) / 100,
    netAmount: parseFloat(withdrawal.netAmountCents) / 100,
    fee: parseFloat(withdrawal.feeCents) / 100,
    toAddress: withdrawal.toAddress,
    status: withdrawal.status,
    txHash: withdrawal.txHash,
    createdAt: withdrawal.createdAt,
    completedAt: withdrawal.completedAt,
  });
});

withdrawalRoutes.post("/v1/withdraw/:id/confirm", sessionAuth, rateLimit({ windowMs: 60_000, maxRequests: 20 }), async (c) => {
  const userId = c.get("userId");
  const withdrawalId = c.req.param("id") as string;

  const confirmSchema = z.object({ txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/) });
  const parsed = confirmSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid transaction hash", type: "validation_error", details: parsed.error.issues } }, 400);
  }
  const txHash = parsed.data.txHash;

  // SECURITY (A6): Filter by both ID and userId in a single query to avoid
  // timing-based existence leaks (404 vs 403 reveals whether ID exists).
  const [withdrawal] = await db.select().from(withdrawals)
    .where(and(eq(withdrawals.id, withdrawalId), eq(withdrawals.userId, userId)))
    .limit(1);

  if (!withdrawal) {
    return c.json({ error: { message: "Withdrawal not found", type: "not_found" } }, 404);
  }

  if (withdrawal.status !== "pending") {
    return c.json({ error: { message: "Withdrawal already processed", type: "invalid_state" } }, 400);
  }

  const client = getPublicClient();

  // C-4: on-chain receipt verification constants
  const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
  const padTopic = (addr: string) =>
    "0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");
  // Non-null: TREASURY_BASE_ADDRESS is required in production (config guard);
  // the withdraw route is auth-gated and only accessible in production.
  const treasuryTopic = padTopic(config.TREASURY_BASE_ADDRESS!);
  const recipientTopic = padTopic(withdrawal.toAddress);
  // USDC has 6 decimals, so 1 cent = 0.01 USDC = 10_000 raw units.
  // The previous multiplier (1_000_000) required 100x the actual amount, so
  // legitimate withdrawals could never be confirmed.
  const requiredValue = BigInt(withdrawal.netAmountCents) * 10_000n;
  // Allow a 1% tolerance to absorb rounding by the sender's client/wallet.
  const tolerance = requiredValue / 100n;

  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>> | null = null;
  try {
    receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
  } catch (err) {
    logger.error({ err }, "[withdraw] Confirmation check failed:");
    return c.json({ error: { message: "Failed to verify transaction", type: "verification_error" } }, 500);
  }

  if (!receipt || receipt.status !== "success") {
    return c.json({ error: { message: "Transaction failed on-chain", type: "tx_failed" } }, 400);
  }

  // For ERC-20 transfers (the common USDC case), receipt.to is the USDC contract,
  // not the recipient. The Transfer event log check below is the correct
  // recipient + amount + sender verification, so we intentionally do NOT check
  // receipt.to here. The Transfer event must originate from the OMA treasury
  // and target the withdrawal's recipient with sufficient value.
  const matchingTransfer = receipt.logs.find((log) => {
    if (!log.topics || log.topics.length < 3) return false;
    if (log.address.toLowerCase() !== USDC_BASE.toLowerCase()) return false;
    if (log.topics[0] !== TRANSFER_TOPIC) return false;
    if ((log.topics[1] ?? "").toLowerCase() !== treasuryTopic) return false;
    if ((log.topics[2] ?? "").toLowerCase() !== recipientTopic) return false;
    try {
      const v = BigInt(log.data);
      return v >= requiredValue && v <= requiredValue + tolerance;
    } catch {
      return false;
    }
  });

  if (!matchingTransfer) {
    return c.json({
      error: {
        message: "No matching USDC transfer from OMA treasury to recipient",
        type: "usdc_transfer_mismatch",
      },
    }, 400);
  }

  // SECURITY (A6): Include status="pending" in WHERE to make the update
  // atomic with the ownership check — prevents overwriting a concurrent
  // status change (e.g., admin marking it failed between SELECT and UPDATE).
  const [updated] = await db.update(withdrawals)
    .set({
      status: "completed",
      txHash,
      completedAt: new Date(),
    })
    .where(and(
      eq(withdrawals.id, withdrawalId),
      eq(withdrawals.userId, userId),
      eq(withdrawals.status, "pending"),
    ))
    .returning({ id: withdrawals.id });

  if (!updated) {
    return c.json({ error: { message: "Withdrawal already processed or not found", type: "invalid_state" } }, 400);
  }

  return c.json({ status: "completed", txHash });
});