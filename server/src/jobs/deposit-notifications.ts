import { db } from "../db/client.js";
import { deposits, users, webhookSubscriptions, depositNotifications } from "../db/schema.js";
import { eq, and, or } from "drizzle-orm";
import { getRedisClient } from "../lib/redis-client.js";
import { logger } from "../lib/logger.js";
import crypto from "crypto";

export interface DepositNotification {
  id: string;
  userId: string;
  depositId: string;
  type: "deposit_pending" | "deposit_completed" | "deposit_failed" | "deposit_refunded";
  status: string;
  amountUsd: string | null;
  creditsIssued: string | null;
  txHash: string | null;
  method: string | null;
  createdAt: Date;
  notifiedAt: Date | null;
}

export interface WebhookPayload {
  event: "deposit.pending" | "deposit.completed" | "deposit.failed" | "deposit.refunded";
  timestamp: string;
  data: {
    depositId: string;
    userId: string;
    type: string;
    status: string;
    amountUsd: string | null;
    creditsIssued: string | null;
    txHash: string | null;
    method: string | null;
    message?: string;
  };
}

const WEBHOOK_RETRY_MAX = 3;
const WEBHOOK_RETRY_DELAY_MS = 5000;

async function sendWebhook(url: string, payload: WebhookPayload, retries = 0): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",

      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000),
    });

    if (response.ok) {
      return true;
    }

    if (response.status >= 500 && retries < WEBHOOK_RETRY_MAX) {
      await new Promise((r) => setTimeout(r, WEBHOOK_RETRY_DELAY_MS * (retries + 1)));
      return sendWebhook(url, payload, retries + 1);
    }

    return false;
  } catch (error) {
    logger.error({ error, url }, "[webhook] Failed to send webhook");
    if (retries < WEBHOOK_RETRY_MAX) {
      await new Promise((r) => setTimeout(r, WEBHOOK_RETRY_DELAY_MS * (retries + 1)));
      return sendWebhook(url, payload, retries + 1);
    }
    return false;
  }
}

export async function notifyDepositUpdate(
  userId: string,
  depositId: string,
  eventType: WebhookPayload["event"],
  additionalData: Record<string, unknown> = {}
): Promise<void> {
  const subscriptions = await db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.userId, userId),
        or(
          eq(webhookSubscriptions.event, eventType),
          eq(webhookSubscriptions.event, "all")
        ),
        eq(webhookSubscriptions.active, true)
      )
    );

  if (subscriptions.length === 0) {
    return;
  }

  const [deposit] = await db
    .select()
    .from(deposits)
    .where(eq(deposits.id, depositId))
    .limit(1);

  if (!deposit) {
    logger.warn({ depositId }, "[webhook] Deposit not found for notification");
    return;
  }

  const payload: WebhookPayload = {
    event: eventType,
    timestamp: new Date().toISOString(),
    data: {
      depositId,
      userId,
      type: deposit.type,
      status: deposit.status,
      amountUsd: deposit.amountUsd,
      creditsIssued: deposit.creditsIssued,
      txHash: deposit.txHash,
      method: deposit.type,
      ...additionalData,
    },
  };

  for (const sub of subscriptions) {
    if (!sub.url) continue;

    const success = await sendWebhook(sub.url, { ...payload, data: { ...payload.data } });

    await db
      .update(webhookSubscriptions)
      .set({
        lastNotificationAt: new Date(),
        lastNotificationStatus: success ? "success" : "failed",
        notificationCount: sub.notificationCount + 1,
      })
      .where(eq(webhookSubscriptions.id, sub.id));

    if (success) {
      await db.insert(depositNotifications).values({
        id: crypto.randomUUID(),
        userId,
        depositId,
        type: eventType.replace(".", "_") as DepositNotification["type"],
        status: deposit.status,
        amountUsd: deposit.amountUsd,
        creditsIssued: deposit.creditsIssued,
        txHash: deposit.txHash,
        method: deposit.type,
        createdAt: new Date(),
        notifiedAt: new Date(),
      });
    }
  }
}

export async function scheduleDepositNotifications(): Promise<void> {
  const redis = await getRedisClient();
  if (!redis) {
    logger.warn("[notifications] Redis not available, skipping deposit notification scheduler");
    return;
  }

  setInterval(async () => {
    try {
      await processPendingDeposits();
      await retryFailedWebhooks();
    } catch (error) {
      logger.error({ error }, "[notifications] Error in notification scheduler");
    }
  }, 60000);

  logger.info("[notifications] Deposit notification scheduler started");
}

async function processPendingDeposits(): Promise<void> {
  const pendingDeposits = await db
    .select({
      deposit: deposits,
      user: users,
    })
    .from(deposits)
    .leftJoin(users, eq(deposits.userId, users.id))
    .where(
      and(
        eq(deposits.status, "pending"),
      )
    )
    .limit(100);

  for (const { deposit } of pendingDeposits) {
    const createdAt = deposit.createdAt;
    if (!createdAt) continue;

    const pendingDuration = Date.now() - new Date(createdAt).getTime();
    const FIFTEEN_MINUTES = 15 * 60 * 1000;

    if (pendingDuration > FIFTEEN_MINUTES) {
      await notifyDepositUpdate(
        deposit.userId,
        deposit.id,
        "deposit.pending",
        { message: "Deposit is taking longer than expected", pendingDuration }
      );
    }
  }
}

async function retryFailedWebhooks(): Promise<void> {
  const failedNotifications = await db
    .select()
    .from(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.lastNotificationStatus, "failed"),
        eq(webhookSubscriptions.active, true)
      )
    )
    .limit(50);

  for (const sub of failedNotifications) {
    if (!sub.userId || !sub.url) continue;

    const recentDeposit = await db
      .select()
      .from(deposits)
      .where(eq(deposits.userId, sub.userId))
      .orderBy(deposits.createdAt)
      .limit(1);

    if (recentDeposit.length > 0) {
      await notifyDepositUpdate(
        sub.userId,
        recentDeposit[0].id,
        "deposit.completed"
      );
    }
  }
}

export async function registerWebhookSubscription(
  userId: string,
  url: string,
  events: string[] = ["all"],
  secret?: string
): Promise<{ id: string }> {
  const [subscription] = await db
    .insert(webhookSubscriptions)
    .values({
      id: crypto.randomUUID(),
      userId,
      url,
      events: events.join(","),
      event: events[0] || "all",
      secret,
      active: true,
      createdAt: new Date(),
    })
    .returning({ id: webhookSubscriptions.id });

  return { id: subscription.id };
}

export async function getUserWebhookSubscriptions(userId: string) {
  return db
    .select()
    .from(webhookSubscriptions)
    .where(eq(webhookSubscriptions.userId, userId));
}

export async function deleteWebhookSubscription(userId: string, subscriptionId: string): Promise<boolean> {
  const result = await db
    .delete(webhookSubscriptions)
    .where(
      and(
        eq(webhookSubscriptions.id, subscriptionId),
        eq(webhookSubscriptions.userId, userId)
      )
    )
    .returning();

  return result.length > 0;
}
