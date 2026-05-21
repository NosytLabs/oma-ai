import { db } from "../db/client.js";
import { creditBatches, creditBalances } from "../db/schema.js";
import { eq, lt, gt, and, sql } from "drizzle-orm";

const EXPIRY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const ACTIVE_EXTENSION_DAYS = 90;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function processExpiredCredits(): Promise<{
  expiredCount: number;
  expiredAmount: number;
  extendedBatchCount: number;
}> {
  const now = new Date();

  const expiredBatches = await db.select({
    id: creditBatches.id,
    remainingCents: creditBatches.remainingCents,
    userId: creditBatches.userId,
  })
    .from(creditBatches)
    .where(and(
      lt(creditBatches.expiresAt, now),
      gt(creditBatches.remainingCents, '0'),
    ));

  let expiredAmount = 0;
  const affectedUserIds = new Set<string>();

  for (const batch of expiredBatches) {
    expiredAmount += Number(batch.remainingCents);
    affectedUserIds.add(batch.userId);

    await db.update(creditBatches)
      .set({ remainingCents: '0' })
      .where(eq(creditBatches.id, batch.id));
  }

  for (const userId of affectedUserIds) {
    const [newSum] = await db.select({ total: sql`COALESCE(SUM(${creditBatches.remainingCents}), 0)` })
      .from(creditBatches)
      .where(and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.expiresAt, now),
      ));

    await db.update(creditBalances)
      .set({
        balanceCents: String(newSum?.total ?? 0),
        updatedAt: now,
      })
      .where(eq(creditBalances.userId, userId));
  }

  if (expiredBatches.length > 0) {
    console.log(`[credit-expiry] Expired ${expiredBatches.length} batches worth ${(expiredAmount / 100).toFixed(2)} credits (breakage), ${affectedUserIds.size} users affected`);
  }

  const extensionCutoff = new Date();
  extensionCutoff.setDate(extensionCutoff.getDate() - ACTIVE_EXTENSION_DAYS);

  const expiryThreshold = new Date();
  expiryThreshold.setDate(expiryThreshold.getDate() + ACTIVE_EXTENSION_DAYS);

  const activeUsers = await db.select({ userId: creditBalances.userId })
    .from(creditBalances)
    .where(gt(creditBalances.lastActivityAt, extensionCutoff));

  let extendedBatchCount = 0;

  for (const { userId } of activeUsers) {
    const expiringBatches = await db.select({ id: creditBatches.id })
      .from(creditBatches)
      .where(and(
        eq(creditBatches.userId, userId),
        gt(creditBatches.remainingCents, '0'),
        lt(creditBatches.expiresAt, expiryThreshold),
      ));

    if (expiringBatches.length === 0) continue;

    const newExpiry = new Date();
    newExpiry.setDate(newExpiry.getDate() + ACTIVE_EXTENSION_DAYS);

    for (const batch of expiringBatches) {
      await db.update(creditBatches)
        .set({ expiresAt: newExpiry })
        .where(eq(creditBatches.id, batch.id));
    }

    extendedBatchCount += expiringBatches.length;
  }

  if (extendedBatchCount > 0) {
    console.log(`[credit-expiry] Extended ${extendedBatchCount} batches for ${activeUsers.length} active users`);
  }

  return { expiredCount: expiredBatches.length, expiredAmount, extendedBatchCount };
}

export function scheduleCreditExpiry(): ReturnType<typeof setInterval> {
  const run = async () => {
    try {
      await processExpiredCredits();
    } catch (err: unknown) {
      console.error(`[credit-expiry] Failed: ${err instanceof Error ? err.message : String(err)}`);
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
