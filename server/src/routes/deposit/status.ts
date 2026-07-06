import { Hono } from "hono";
import { z } from "zod";
import { sessionAuth } from "../../auth/middleware.js";
import { db } from "../../db/client.js";
import { deposits, depositNotifications } from "../../db/schema.js";
import { eq, and, desc } from "drizzle-orm";
import { validationError } from "../../lib/validation.js";
import { isWebhookUrlSafe } from "../../lib/url-safety.js";
import type { OmaEnv } from "../../types.js";
import {
  registerWebhookSubscription,
  getUserWebhookSubscriptions,
  deleteWebhookSubscription,
} from "../../jobs/deposit-notifications.js";
import {
  initiateRecovery,
  getUserRecoveries,
  scanForWrongNetworkDeposits,
} from "../../jobs/deposit-recovery.js";


export const depositStatusRoutes = new Hono<OmaEnv>();

const webhookSubscriptionSchema = z.object({
  url: z.string().url(),
  events: z.array(z.string()).optional(),
  secret: z.string().optional(),
});

const recoveryInitiateSchema = z.object({
  wrongNetworkTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  recoveryTxHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
});

depositStatusRoutes.get("/v1/deposit/status", sessionAuth, async (c) => {
  const userId = c.get("userId");

  const userDeposits = await db
    .select()
    .from(deposits)
    .where(eq(deposits.userId, userId))
    .orderBy(desc(deposits.createdAt))
    .limit(50);

  return c.json({
    deposits: userDeposits.map((d) => ({
      id: d.id,
      type: d.type,
      status: d.status,
      amountUsd: d.amountUsd,
      creditsIssued: d.creditsIssued,
      txHash: d.txHash,
      createdAt: d.createdAt,
      completedAt: d.completedAt,
    })),
  });
});

depositStatusRoutes.get("/v1/deposit/:depositId", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const depositId = c.req.param("depositId");

  if (!depositId) {
    return c.json({ error: { message: "Invalid deposit ID", type: "validation_error" } }, 400);
  }

  const [deposit] = await db
    .select()
    .from(deposits)
    .where(and(eq(deposits.id, depositId), eq(deposits.userId, userId)))
    .limit(1);

  if (!deposit) {
    return c.json({ error: { message: "Deposit not found", type: "not_found" } }, 404);
  }

  return c.json({
    deposit: {
      id: deposit.id,
      type: deposit.type,
      status: deposit.status,
      amountUsd: deposit.amountUsd,
      creditsIssued: deposit.creditsIssued,
      txHash: deposit.txHash,
      createdAt: deposit.createdAt,
      completedAt: deposit.completedAt,
    },
  });
});

depositStatusRoutes.get("/v1/webhooks", sessionAuth, async (c) => {
  const userId = c.get("userId");

  const subscriptions = await getUserWebhookSubscriptions(userId);

  return c.json({
    subscriptions: subscriptions.map((s) => ({
      id: s.id,
      url: s.url,
      event: s.event,
      // ponytail: SYNC-39 — column is now text[], already an array
      events: s.events ?? [],
      active: s.active,
      lastNotificationAt: s.lastNotificationAt,
      lastNotificationStatus: s.lastNotificationStatus,
      notificationCount: s.notificationCount,
      createdAt: s.createdAt,
    })),
  });
});

depositStatusRoutes.post("/v1/webhooks", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = webhookSubscriptionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { url, events, secret } = parsed.data;

  // ponytail: v7 C3 — SSRF guard before accepting the webhook URL.
  // Without this, an attacker can register http://169.254.169.254/latest
  // (AWS metadata) or http://localhost:5432 (Postgres) and have the
  // deposit-notifications worker fetch the response body. The lib
  // `isWebhookUrlSafe` does the protocol + DNS + private-range checks
  // and is already used by the search/fetch routes — apply it here too.
  const safety = await isWebhookUrlSafe(url);
  if (!safety.safe) {
    return c.json({ error: { message: `Webhook URL rejected: ${safety.reason}`, type: "invalid_webhook_url" } }, 400);
  }

  try {
    const result = await registerWebhookSubscription(userId, url, events || ["all"], secret);
    return c.json({ id: result.id, success: true }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "webhook_error" } }, 500);
  }
});

depositStatusRoutes.delete("/v1/webhooks/:subscriptionId", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const subscriptionId = c.req.param("subscriptionId");

  if (!subscriptionId) {
    return c.json({ error: { message: "Invalid subscription ID", type: "validation_error" } }, 400);
  }

  const deleted = await deleteWebhookSubscription(userId, subscriptionId);
  if (!deleted) {
    return c.json({ error: { message: "Webhook subscription not found", type: "not_found" } }, 404);
  }

  return c.json({ success: true });
});

depositStatusRoutes.get("/v1/recoveries", sessionAuth, async (c) => {
  const userId = c.get("userId");

  const recoveries = await getUserRecoveries(userId);

  return c.json({
    recoveries: recoveries.map((r) => ({
      id: r.id,
      originalTxHash: r.originalTxHash,
      recoveryTxHash: r.recoveryTxHash,
      amountUsd: r.amountUsd,
      status: r.status,
      rejectionReason: r.rejectionReason,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
    })),
  });
});

depositStatusRoutes.post("/v1/recoveries", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = recoveryInitiateSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { wrongNetworkTxHash, recoveryTxHash } = parsed.data;

  const result = await initiateRecovery(userId, wrongNetworkTxHash, recoveryTxHash);

  if (!result.success) {
    return c.json({ error: { message: result.error, type: "recovery_error" } }, 400);
  }

  return c.json({
    success: true,
    recoveryId: result.recoveryDepositId,
    creditsRecovered: result.creditsRecovered,
  });
});

depositStatusRoutes.get("/v1/recoveries/scan", sessionAuth, async (c) => {
  const userId = c.get("userId");

  const [user] = await db
    .select({ address: deposits.userId })
    .from(deposits)
    .where(eq(deposits.userId, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: { message: "User not found", type: "not_found" } }, 404);
  }

  const address = c.req.query("address");
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return c.json({ error: { message: "Invalid or missing address", type: "validation_error" } }, 400);
  }

  try {
    const wrongNetworkDeposits = await scanForWrongNetworkDeposits(address);

    return c.json({
      deposits: wrongNetworkDeposits.map((d) => ({
        txHash: d.txHash,
        amount: d.amount,
        fromAddress: d.fromAddress,
        toAddress: d.toAddress,
        blockNumber: d.blockNumber.toString(),
        timestamp: d.timestamp,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "scan_error" } }, 500);
  }
});

depositStatusRoutes.get("/v1/notifications", sessionAuth, async (c) => {
  const userId = c.get("userId");

  const notifications = await db
    .select()
    .from(depositNotifications)
    .where(eq(depositNotifications.userId, userId))
    .orderBy(desc(depositNotifications.createdAt))
    .limit(100);

  return c.json({
    notifications: notifications.map((n) => ({
      id: n.id,
      depositId: n.depositId,
      type: n.type,
      status: n.status,
      amountUsd: n.amountUsd,
      creditsIssued: n.creditsIssued,
      txHash: n.txHash,
      method: n.method,
      createdAt: n.createdAt,
      notifiedAt: n.notifiedAt,
    })),
  });
});
