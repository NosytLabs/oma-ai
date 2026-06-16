import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

const EXPIRY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ACTIVE_EXTENSION_DAYS = 90;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function processExpiredCredits(): Promise<{
  expiredCount: number;
  expiredAmount: number;
  extendedBatchCount: number;
}> {
  const now = new Date();
  const newExpiry = new Date(now);
  newExpiry.setDate(newExpiry.getDate() + ACTIVE_EXTENSION_DAYS);
  const activeCutoff = new Date(now);
  activeCutoff.setDate(activeCutoff.getDate() - ACTIVE_EXTENSION_DAYS);
  const expiryThreshold = new Date(now);
  expiryThreshold.setDate(expiryThreshold.getDate() + ACTIVE_EXTENSION_DAYS);

  // Step 1: Zero out expired batches (positive remaining) and recalculate
  // each affected user's balance from non-expired batches, all in a single
  // CTE round-trip. Returns the aggregate of zeroed rows so we can log it.
  const expireResult = await db.execute(sql<
    { expired_count: string; expired_amount: string }
  >`
    WITH expired AS (
      UPDATE credit_batches
      SET remaining_cents = 0
      WHERE expires_at < ${now}
        AND remaining_cents > 0
      RETURNING user_id, remaining_cents AS old_remaining
    ),
    balance_update AS (
      UPDATE credit_balances cb
      SET balance_cents = COALESCE((
            SELECT SUM(remaining_cents)
            FROM credit_batches
            WHERE user_id = cb.user_id AND expires_at > ${now}
          ), 0),
          updated_at = ${now}
      WHERE cb.user_id IN (SELECT user_id FROM expired)
      RETURNING 1
    )
    SELECT
      COUNT(*)::text AS expired_count,
      COALESCE(SUM(old_remaining), 0)::text AS expired_amount
    FROM expired
  `);
  const expireRow = (expireResult as unknown as {
    rows: Array<{ expired_count: string; expired_amount: string }>;
  }).rows[0] ?? { expired_count: "0", expired_amount: "0" };
  const expiredCount = Number(expireRow.expired_count);
  const expiredAmount = Number(expireRow.expired_amount);

  // Step 2: Extend batches for active users (active in the last
  // ACTIVE_EXTENSION_DAYS days) whose remaining balance is positive and that
  // expire within the next ACTIVE_EXTENSION_DAYS days. Returns the count of
  // batches extended.
  const extendResult = await db.execute(sql<{ extended: string }>`
    WITH extended AS (
      UPDATE credit_batches cb
      SET expires_at = ${newExpiry}
      WHERE cb.remaining_cents > 0
        AND cb.expires_at < ${expiryThreshold}
        AND cb.user_id IN (
          SELECT user_id FROM credit_balances
          WHERE last_activity_at > ${activeCutoff}
        )
      RETURNING 1
    )
    SELECT COUNT(*)::text AS extended FROM extended
  `);
  const extendedBatchCount = Number(
    (extendResult as unknown as { rows: Array<{ extended: string }> }).rows[0]?.extended ?? 0
  );

  if (expiredCount > 0) {
    logger.info(`[credit-expiry] Expired ${expiredCount} batches worth ${(expiredAmount / 100).toFixed(2)} credits`);
  }

  return { expiredCount, expiredAmount, extendedBatchCount };
}

export function scheduleCreditExpiry(): ReturnType<typeof setInterval> {
  const run = async () => {
    try {
      await processExpiredCredits();
    } catch (err: unknown) {
      logger.error(`[credit-expiry] Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  run();
  intervalHandle = setInterval(run, EXPIRY_CHECK_INTERVAL_MS);
  return intervalHandle;
}

export function stopCreditExpiry(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}
