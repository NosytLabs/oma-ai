import { db } from "../db/client.js";
import { subscriptions, plans, creditBatches, creditBalances } from "../db/schema.js";
import { eq, lt, and } from "drizzle-orm";

const SUBSCRIPTION_CHECK_INTERVAL_MS = 60 * 60 * 1000;

let intervalHandle: ReturnType<typeof setInterval> | null = null;

export async function processExpiredSubscriptions(): Promise<{
  expiredCount: number;
  renewedCount: number;
}> {
  const now = new Date();

  const expiredSubs = (await db.select({
    id: subscriptions.id,
    userId: subscriptions.userId,
    planId: subscriptions.planId,
    currentPeriodEnd: subscriptions.currentPeriodEnd,
    cancelAtPeriodEnd: subscriptions.cancelAtPeriodEnd,
  })
    .from(subscriptions)
    .where(and(
      eq(subscriptions.status, "active"),
      lt(subscriptions.currentPeriodEnd, now),
    ))) || [];

  if (!expiredSubs || expiredSubs.length === 0) {
    return { expiredCount: 0, renewedCount: 0 };
  }

  let expiredCount = 0;
  let renewedCount = 0;

  for (const sub of expiredSubs) {
    if (sub.cancelAtPeriodEnd) {
      await db.update(subscriptions).set({
        status: "canceled",
        updatedAt: now,
      }).where(eq(subscriptions.id, sub.id));
      expiredCount++;
    } else {
      const [plan] = await db.select().from(plans).where(eq(plans.id, sub.planId)).limit(1);
      if (plan) {
        const newPeriodStart = sub.currentPeriodEnd;
        const newPeriodEnd = new Date(sub.currentPeriodEnd);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);

        await db.update(subscriptions).set({
          currentPeriodStart: newPeriodStart,
          currentPeriodEnd: newPeriodEnd,
          updatedAt: now,
        }).where(eq(subscriptions.id, sub.id));

        await db.insert(creditBatches).values({
          userId: sub.userId,
          amountCents: String(plan.credits),
          remainingCents: String(plan.credits),
          expiresAt: newPeriodEnd,
          paymentMethod: "subscription",
        });

        const [balance] = await db.select().from(creditBalances).where(eq(creditBalances.userId, sub.userId)).limit(1);
        if (balance) {
          await db.update(creditBalances).set({
            balanceCents: String(Number(balance.balanceCents) + plan.credits),
            lastActivityAt: now,
            updatedAt: now,
          }).where(eq(creditBalances.userId, sub.userId));
        }

        renewedCount++;
      }
    }
  }

  if (expiredCount > 0) {
    console.log(`[subscription-cron] Canceled ${expiredCount} expired subscriptions`);
  }
  if (renewedCount > 0) {
    console.log(`[subscription-cron] Renewed ${renewedCount} subscriptions and granted credits`);
  }

  return { expiredCount, renewedCount };
}

export function scheduleSubscriptionCheck(): ReturnType<typeof setInterval> {
  const run = async () => {
    try {
      await processExpiredSubscriptions();
    } catch (err: unknown) {
      console.error(`[subscription-cron] Failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  run();
  intervalHandle = setInterval(run, SUBSCRIPTION_CHECK_INTERVAL_MS);
  return intervalHandle;
}

export function stopSubscriptionCheck(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}