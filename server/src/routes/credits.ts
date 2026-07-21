import { Hono } from "hono";
import { z } from "zod";
import { sessionOrBearerAuth } from "../auth/middleware.js";
import { getBalance, addCredits } from "../credits/index.js";
import {
  getBudgetAlertConfig,
  setBudgetAlertConfig,
  getBudgetAlertHistory,
  DEFAULT_THRESHOLDS,
  type BudgetThreshold,
} from "../credits/budget-alerts.js";
import { auditLog } from "../middleware/audit.js";
import { db } from "../db/client.js";
import { creditBatches, autoReloadSettings, deposits, usageRecords, budgetAlerts } from "../db/schema.js";
import { eq, desc, and, sql, gte } from "drizzle-orm";
import { config } from "../config.js";
import { calculateCostCredits, getModel } from "../inference/models.js";
import { validationError } from "../lib/validation.js";
import { errorResponse } from "../lib/api-errors.js";
import { logger } from "../lib/logger.js";
import type { OmaEnv } from "../types.js";

export const creditRoutes = new Hono<OmaEnv>();

const purchaseSchema = z.object({
  amountCents: z.number().positive().min(100),
  // Only USDC on Base is wired for settlement. Legacy "sol"/"oma" enums
  // were never backed by deposit routes — reject them at validation.
  paymentMethod: z.enum(["usdc"]).default("usdc"),
  autoReload: z.boolean().optional(),
});

// Row shape for the UNION ALL credits + usage query.
interface UnifiedTransactionRow {
  id: string;
  type: string;
  amount_cents: string | number;
  credits_issued: string | number | null;
  status: string;
  model: string | null;
  created_at: Date | string;
  tx_hash: string | null;
}

const autoReloadSchema = z.object({
  enabled: z.boolean(),
  thresholdCents: z.number().positive().optional(),
  reloadAmountCents: z.number().positive().optional(),
  spendLimitCents: z.number().positive().optional(),
  paymentMethod: z.enum(["usdc"]).optional(),
});

const budgetAlertSchema = z.object({
  budgetLimitCents: z.number().positive().min(100),
  alertThresholds: z.array(z.enum(["50", "75", "90", "100"])).default(["50", "75", "90", "100"]),
  emailEnabled: z.boolean().default(true),
  webhookEnabled: z.boolean().default(false),
  webhookUrl: z.string().url().optional().nullable(),
});

creditRoutes.post("/v1/credits/purchase", sessionOrBearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const parsed = purchaseSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json(validationError(parsed.error), 400);

    const { amountCents, paymentMethod, autoReload } = parsed.data;

    const [deposit] = await db.insert(deposits).values({
      userId,
      type: "usdc_direct",
      status: "pending",
      amountUsd: String(amountCents / 100),
      creditsIssued: "0",
    }).returning();

    if (autoReload) {
      await db.insert(autoReloadSettings)
        .values({
          userId,
          enabled: true,
          thresholdCents: String(config.AUTO_RELOAD_THRESHOLD),
          reloadAmountCents: String(amountCents),
          spendLimitCents: String(config.AUTO_RELOAD_SPEND_LIMIT),
          paymentMethod,
        })
        .onConflictDoUpdate({
          target: autoReloadSettings.userId,
          set: {
            enabled: true,
            thresholdCents: String(config.AUTO_RELOAD_THRESHOLD),
            reloadAmountCents: String(amountCents),
            paymentMethod,
            updatedAt: new Date(),
          },
        });
    }

    return c.json({
      success: true,
      depositId: deposit.id,
      status: "pending",
      amountCents,
      paymentMethod,
      autoReloadEnabled: autoReload ?? false,
      message: "Deposit created. Credits will be issued after payment confirmation.",
    });
  } catch (err) {
    return errorResponse(c, err);
  }
});

  creditRoutes.get("/v1/credits/balance", sessionOrBearerAuth, async (c) => {
  try {
    const userId = c.get("userId");

    const [balance, batches] = await Promise.all([
      getBalance(userId),
      db.select()
        .from(creditBatches)
        .where(eq(creditBatches.userId, userId))
        .orderBy(desc(creditBatches.createdAt))
        .limit(50),
    ]);

    const activeBatches = batches.filter(b => Number(b.remainingCents) > 0 && new Date(b.expiresAt) > new Date());

    return c.json({
      balanceCents: balance.balanceCents,
      totalDepositedCents: balance.totalDepositedCents,
      totalUsedCents: balance.totalUsedCents,
      lastActivityAt: balance.lastActivityAt,
      activeBatches: activeBatches.map(b => ({
        id: b.id,
        amountCents: b.amountCents,
        remainingCents: b.remainingCents,
        expiresAt: b.expiresAt,
        paymentMethod: b.paymentMethod,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[credits] Balance error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});

creditRoutes.get("/v1/credits/transactions", sessionOrBearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);

    // Single query with UNION ALL — eliminates N+1 and JS merge/sort
    const rows = await db.execute(sql<UnifiedTransactionRow>`
      WITH normalized_transactions AS (
        -- Deposits
        SELECT
          id,
          'deposit' as type,
          (amount_usd * 100)::bigint as amount_cents,
          (credits_issued * 100)::bigint as credits_issued,
          status,
          NULL as model,
          created_at,
          tx_hash
        FROM deposits
        WHERE user_id = ${userId}

        UNION ALL

        -- Usage records
        SELECT
          id,
          'usage' as type,
          total_cents::bigint as amount_cents,
          0 as credits_issued,
          'completed' as status,
          model,
          created_at,
          NULL as tx_hash
        FROM usage_records
        WHERE user_id = ${userId}
      )
      SELECT id, type, amount_cents, credits_issued, status, model, created_at, tx_hash
      FROM normalized_transactions
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    const transactions = rows.rows.map((r) => ({
      id: r.id,
      type: r.type,
      amountCents: Number(r.amount_cents),
      creditsIssued: Number(r.credits_issued),
      status: r.status,
      model: r.model,
      createdAt: r.created_at,
      txHash: r.tx_hash,
    }));

    return c.json({ transactions });
  } catch (err) {
    logger.error({ err }, "[credits] Transactions error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});

creditRoutes.get("/v1/credits/usage", sessionOrBearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const limit = Math.min(Number(c.req.query("limit") ?? 20), 100);
    const days = Math.min(Number(c.req.query("days") ?? 90), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // SQL-level GROUP BY — fetches aggregated rows instead of 500+ individual records
    const modelAgg = await db.select({
      model: usageRecords.model,
      inputTokens: sql<number>`coalesce(sum(${usageRecords.inputTokens}), 0)`,
      outputTokens: sql<number>`coalesce(sum(${usageRecords.outputTokens}), 0)`,
      totalCents: sql<string>`coalesce(sum(${usageRecords.totalCents}), 0)`,
      requestCount: sql<number>`count(${usageRecords.id})`,
    })
      .from(usageRecords)
      .where(and(
        eq(usageRecords.userId, userId),
        gte(usageRecords.createdAt, since),
      ))
      .groupBy(usageRecords.model)
      .orderBy(sql`sum(${usageRecords.totalCents}) desc`)
      .limit(limit);

    return c.json({
      usageByModel: modelAgg.map((r) => ({
        model: r.model,
        inputTokens: Number(r.inputTokens),
        outputTokens: Number(r.outputTokens),
        totalCents: Number(r.totalCents),
        requestCount: Number(r.requestCount),
      })),
      totalUsageCents: modelAgg.reduce((sum, m) => sum + Number(m.totalCents), 0),
      periodDays: days,
      recordLimit: limit,
    });
  } catch (err) {
    logger.error({ err }, "[credits] Usage error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});

creditRoutes.post("/v1/credits/auto-reload", sessionOrBearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const parsed = autoReloadSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json(validationError(parsed.error), 400);

    const { enabled, thresholdCents, reloadAmountCents, spendLimitCents, paymentMethod } = parsed.data;

    await db.insert(autoReloadSettings)
      .values({
        userId,
        enabled,
        thresholdCents: String(thresholdCents ?? config.AUTO_RELOAD_THRESHOLD),
        reloadAmountCents: String(reloadAmountCents ?? config.AUTO_RELOAD_AMOUNT),
        spendLimitCents: String(spendLimitCents ?? config.AUTO_RELOAD_SPEND_LIMIT),
        paymentMethod: paymentMethod ?? "usdc",
      })
      .onConflictDoUpdate({
        target: autoReloadSettings.userId,
        set: {
          enabled,
          thresholdCents: String(thresholdCents ?? config.AUTO_RELOAD_THRESHOLD),
          reloadAmountCents: String(reloadAmountCents ?? config.AUTO_RELOAD_AMOUNT),
          spendLimitCents: String(spendLimitCents ?? config.AUTO_RELOAD_SPEND_LIMIT),
          paymentMethod: paymentMethod ?? "usdc",
          updatedAt: new Date(),
        },
      });

    const settings = await db.select().from(autoReloadSettings).where(eq(autoReloadSettings.userId, userId)).limit(1);

    return c.json({
      enabled: settings[0]?.enabled ?? enabled,
      thresholdCents: Number(settings[0]?.thresholdCents ?? thresholdCents ?? config.AUTO_RELOAD_THRESHOLD),
      reloadAmountCents: Number(settings[0]?.reloadAmountCents ?? reloadAmountCents ?? config.AUTO_RELOAD_AMOUNT),
      spendLimitCents: Number(settings[0]?.spendLimitCents ?? spendLimitCents ?? config.AUTO_RELOAD_SPEND_LIMIT),
      paymentMethod: settings[0]?.paymentMethod ?? paymentMethod ?? "usdc",
    });
  } catch (err) {
    logger.error({ err }, "[credits] Auto-reload error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});

creditRoutes.get("/v1/credits/auto-reload", sessionOrBearerAuth, async (c) => {
  try {
    const userId = c.get("userId");

    const settings = await db.select().from(autoReloadSettings).where(eq(autoReloadSettings.userId, userId)).limit(1);

    if (!settings.length) {
      return c.json({
        enabled: false,
        thresholdCents: config.AUTO_RELOAD_THRESHOLD,
        reloadAmountCents: config.AUTO_RELOAD_AMOUNT,
        spendLimitCents: config.AUTO_RELOAD_SPEND_LIMIT,
        paymentMethod: "usdc",
      });
    }

    return c.json({
      enabled: settings[0].enabled,
      thresholdCents: Number(settings[0].thresholdCents),
      reloadAmountCents: Number(settings[0].reloadAmountCents),
      spendLimitCents: Number(settings[0].spendLimitCents),
      paymentMethod: settings[0].paymentMethod,
    });
  } catch (err) {
    logger.error({ err }, "[credits] Auto-reload get error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});

creditRoutes.post("/v1/credits/refund/:usageId", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  const usageId = c.req.param("usageId");

  if (!usageId) {
    return c.json({ error: { message: "Usage ID is required", type: "invalid_request_error" } }, 400);
  }

  const usageRecordsResult = await db.select().from(usageRecords)
    .where(and(eq(usageRecords.id, usageId), eq(usageRecords.userId, userId)))
    .limit(1);

  if (!usageRecordsResult.length) {
    return c.json({ error: { message: "Usage record not found", type: "not_found" } }, 404);
  }

  const usage = usageRecordsResult[0];

  // C2: Atomically claim the refund slot — only one concurrent request can
  // succeed. Uses UPDATE...WHERE with status check and .returning() to detect
  // if we actually changed the row (eliminates TOCTOU race condition).
  const [updated] = await db.update(usageRecords)
    .set({ status: "refunded", refundedAt: new Date() })
    .where(and(eq(usageRecords.id, usageId), sql`${usageRecords.status} != 'refunded'`))
    .returning();

  if (!updated) {
    return c.json({ error: { message: "Usage record has already been refunded", type: "duplicate_refund" } }, 409);
  }

  await addCredits(userId, Number(usage.totalCents));

  return c.json({ success: true, creditsRefunded: Number(usage.totalCents) });
});

creditRoutes.get("/v1/credits/price-estimate", sessionOrBearerAuth, async (c) => {
  const model = c.req.query("model");
  const inputTokens = Number(c.req.query("inputTokens") ?? 0);
  const outputTokens = Number(c.req.query("outputTokens") ?? 0);

  if (!model) {
    return c.json({ error: { message: "model is required", type: "invalid_request_error" } }, 400);
  }

  try {
    const credits = await calculateCostCredits(model, inputTokens, outputTokens);
    const modelDef = await getModel(model);
    return c.json({
      model,
      inputTokens,
      outputTokens,
      estimatedCredits: credits,
      pricePerMillionInput: modelDef?.inputPricePer1M ?? 0,
      pricePerMillionOutput: modelDef?.outputPricePer1M ?? 0,
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "invalid_request_error" } }, 400);
  }
});

creditRoutes.post("/v1/credits/budget-alerts", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = budgetAlertSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { budgetLimitCents, alertThresholds, emailEnabled, webhookEnabled, webhookUrl } = parsed.data;
  const thresholds = alertThresholds.map(Number) as BudgetThreshold[];

  await setBudgetAlertConfig(userId, {
    budgetLimitCents,
    alertThresholds: thresholds,
    emailEnabled,
    webhookEnabled,
    webhookUrl: webhookUrl ?? undefined,
  });

  const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || undefined;
  const userAgent = c.req.header("user-agent") || undefined;

  await auditLog({
    userId,
    action: "BUDGET_ALERT_CHANGED",
    resource: "budget_alerts",
    metadata: { budgetLimitCents, alertThresholds: thresholds, emailEnabled, webhookEnabled },
    ipAddress,
    userAgent,
  });

  return c.json({
    success: true,
    budgetLimitCents,
    alertThresholds: thresholds,
    emailEnabled,
    webhookEnabled,
    webhookUrl,
  });
});

creditRoutes.get("/v1/credits/budget-alerts", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  const alertConfig = await getBudgetAlertConfig(userId);

  if (!alertConfig) {
    return c.json({
      budgetLimitCents: 0,
      alertThresholds: DEFAULT_THRESHOLDS,
      emailEnabled: true,
      webhookEnabled: false,
      webhookUrl: null,
    });
  }

  return c.json({
    budgetLimitCents: alertConfig.budgetLimitCents,
    alertThresholds: alertConfig.alertThresholds,
    emailEnabled: alertConfig.emailEnabled,
    webhookEnabled: alertConfig.webhookEnabled,
    webhookUrl: alertConfig.webhookUrl,
  });
});

creditRoutes.delete("/v1/credits/budget-alerts", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");

  await db.delete(budgetAlerts).where(eq(budgetAlerts.userId, userId));

  return c.json({ success: true });
});

creditRoutes.get("/v1/credits/budget-alerts/history", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);

  const history = await getBudgetAlertHistory(userId, limit);

  return c.json({
    history: history.map(h => ({
      alertType: h.alertType,
      thresholdPercent: h.thresholdPercent,
      spentCents: Number(h.spentCents),
      budgetLimitCents: Number(h.budgetLimitCents),
      createdAt: h.createdAt,
    })),
  });
});