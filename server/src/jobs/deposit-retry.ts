import { db } from "../db/client.js";
import { deposits } from "../db/schema.js";
import { eq, and, lte } from "drizzle-orm";
import { getRedisClient } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";
import { houdiniClient } from "../credits/houdini-client.js";
import { completeHoudiniDeposit } from "../credits/deposit.js";
import { addSettlementToDlq } from "../lib/dlq.js";

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_INTERVAL_MS = 60000;
const PENDING_DEPOSIT_TIMEOUT_MS = 30 * 60 * 1000;

interface RetryResult {
  depositId: string;
  success: boolean;
  creditsProcessed?: number;
  error?: string;
  attempts: number;
}

export async function retryFailedDeposits(): Promise<RetryResult[]> {
  const results: RetryResult[] = [];

  const failedDeposits = await db
    .select()
    .from(deposits)
    .where(
      and(
        eq(deposits.status, "pending"),
      )
    )
    .limit(100);

  for (const deposit of failedDeposits) {
    const retryKey = `deposit:retry:${deposit.id}`;
    const redis = await getRedisClient();

    if (redis) {
      const attempts = await redis.incr(retryKey);
      await redis.expire(retryKey, 3600);

      if (attempts > MAX_RETRY_ATTEMPTS) {
        results.push({
          depositId: deposit.id,
          success: false,
          error: "Max retry attempts exceeded",
          attempts,
        });
        continue;
      }
    }

    try {
      const result = await retryDeposit(deposit);
      results.push(result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error({ depositId: deposit.id, error: errorMessage }, "[retry] Failed to process deposit");

      results.push({
        depositId: deposit.id,
        success: false,
        error: errorMessage,
        attempts: 1,
      });

      if (redis) {
        await addSettlementToDlq(
          deposit.id,
          deposit.amountUsd || "0",
          deposit.type || "unknown",
          errorMessage,
        );
      }
    }
  }

  return results;
}

async function retryDeposit(deposit: typeof deposits.$inferSelect): Promise<RetryResult> {
  if (deposit.type === "houdini_swap" && deposit.houdiniId) {
    return retryHoudiniDeposit(deposit);
  }

  if (deposit.type === "cctp_crosschain" && deposit.txHash) {
    return retryCctpDeposit(deposit);
  }

  return {
    depositId: deposit.id,
    success: false,
    error: "Unknown deposit type or missing required fields",
    attempts: 1,
  };
}

async function retryHoudiniDeposit(deposit: typeof deposits.$inferSelect): Promise<RetryResult> {
  const houdiniId = deposit.houdiniId;
  if (!houdiniId) {
    return {
      depositId: deposit.id,
      success: false,
      error: "Missing Houdini order ID",
      attempts: 1,
    };
  }

  try {
    const order = await houdiniClient.getOrder(houdiniId);

    if (order.status === "FINISHED" && order.transactionHash) {
      const creditsProcessed = await completeHoudiniDeposit(
        deposit.id,
        Number(order.toAmount),
        order.transactionHash,
        deposit.userId,
      );

      return {
        depositId: deposit.id,
        success: true,
        creditsProcessed: creditsProcessed.creditsCents,
        attempts: 1,
      };
    }

    if (order.status === "FAILED" || order.status === "REFUNDED" || order.status === "EXPIRED") {
      await db
        .update(deposits)
        .set({
          status: "failed",
          completedAt: new Date(),
        })
        .where(eq(deposits.id, deposit.id));

      return {
        depositId: deposit.id,
        success: false,
        error: `Order status: ${order.status}`,
        attempts: 1,
      };
    }

    return {
      depositId: deposit.id,
      success: false,
      error: `Order still pending: ${order.status}`,
      attempts: 1,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error({ depositId: deposit.id, houdiniId, error: errorMessage }, "[retry] Houdini retry failed");

    return {
      depositId: deposit.id,
      success: false,
      error: errorMessage,
      attempts: 1,
    };
  }
}

async function retryCctpDeposit(deposit: typeof deposits.$inferSelect): Promise<RetryResult> {
  const txHash = deposit.txHash;
  if (!txHash) {
    return {
      depositId: deposit.id,
      success: false,
      error: "Missing transaction hash",
      attempts: 1,
    };
  }

  logger.info({ depositId: deposit.id, txHash }, "[retry] CCTP deposit still pending verification");

  return {
    depositId: deposit.id,
    success: false,
    error: "CCTP deposit pending - requires manual attestation verification",
    attempts: 1,
  };
}

export async function expireStaleDeposits(): Promise<number> {
  const cutoffTime = new Date(Date.now() - PENDING_DEPOSIT_TIMEOUT_MS);

  const staleDeposits = await db
    .select()
    .from(deposits)
    .where(
      and(
        eq(deposits.status, "pending"),
        lte(deposits.createdAt, cutoffTime),
      )
    )
    .limit(100);

  let expiredCount = 0;

  for (const deposit of staleDeposits) {
    try {
      await db
        .update(deposits)
        .set({
          status: "expired",
          completedAt: new Date(),
        })
        .where(eq(deposits.id, deposit.id));

      expiredCount++;
      logger.info({ depositId: deposit.id }, "[retry] Expired stale deposit");
    } catch (error) {
      logger.error({ depositId: deposit.id, error }, "[retry] Failed to expire deposit");
    }
  }

  return expiredCount;
}

export async function scheduleDepositRetry(): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    logger.warn("[retry] Redis not available, retry functionality limited");
  }

  setInterval(async () => {
    try {
      const results = await retryFailedDeposits();
      const succeeded = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      if (succeeded > 0 || failed > 0) {
        logger.info({ succeeded, failed }, "[retry] Deposit retry cycle completed");
      }

      const expired = await expireStaleDeposits();
      if (expired > 0) {
        logger.info({ expired }, "[retry] Expired stale deposits");
      }
    } catch (error) {
      logger.error({ error }, "[retry] Error in retry scheduler");
    }
  }, RETRY_INTERVAL_MS);

  logger.info("[retry] Deposit retry scheduler started");
}

export async function getDepositRetryStatus(depositId: string): Promise<{
  attempts: number;
  canRetry: boolean;
  nextRetryAt: Date | null;
  status: string;
} | null> {
  const redis = await getRedisClient();
  if (!redis) {
    return null;
  }

  const retryKey = `deposit:retry:${depositId}`;
  const attempts = await redis.get(retryKey);

  if (!attempts) {
    return {
      attempts: 0,
      canRetry: true,
      nextRetryAt: null,
      status: "not_started",
    };
  }

  const attemptCount = parseInt(attempts, 10);

  return {
    attempts: attemptCount,
    canRetry: attemptCount < MAX_RETRY_ATTEMPTS,
    nextRetryAt: new Date(Date.now() + RETRY_INTERVAL_MS),
    status: attemptCount >= MAX_RETRY_ATTEMPTS ? "max_attempts_exceeded" : "in_progress",
  };
}

export async function resetDepositRetry(depositId: string): Promise<boolean> {
  const redis = await getRedisClient();
  if (!redis) {
    return false;
  }

  const retryKey = `deposit:retry:${depositId}`;
  await redis.del(retryKey);
  return true;
}
