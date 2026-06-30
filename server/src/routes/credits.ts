import { Hono } from "hono";
import { z } from "zod";
import { bearerAuth } from "../auth/middleware.js";
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
import { eq, desc, and, sql } from "drizzle-orm";
import { config } from "../config.js";
import { calculateCostCredits, getModel } from "../inference/models.js";
import { validationError } from "../lib/validation.js";
import { errorResponse } from "../lib/api-errors.js";
import { logger } from "../lib/logger.js";
import type { OmaEnv } from "../types.js";

export const creditRoutes = new Hono<OmaEnv>();

const purchaseSchema = z.object({
  amountCents: z.number().positive().min(100),
  paymentMethod: z.enum(["usdc", "sol", "oma"]).default("usdc"),
  autoReload: z.boolean().optional(),
});

const autoReloadSchema = z.object({
  enabled: z.boolean(),
  thresholdCents: z.number().positive().optional(),
  reloadAmountCents: z.number().positive().optional(),
  spendLimitCents: z.number().positive().optional(),
  paymentMethod: z.enum(["usdc", "sol", "oma"]).optional(),
});

const budgetAlertSchema = z.object({
  budgetLimitCents: z.number().positive().min(100),
  alertThresholds: z.array(z.enum(["50", "75", "90", "100"])).default(["50", "75", "90", "100"]),
  emailEnabled: z.boolean().default(true),
  webhookEnabled: z.boolean().default(false),
  webhookUrl: z.string().url().optional().nullable(),
});

creditRoutes.post("/v1/credits/purchase", bearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const parsed = purchaseSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json(validationError(parsed.error), 400);

    const { amountCents, paymentMethod, autoReload } = parsed.data;

    const [deposit] = await db.insert(deposits).values({
      userId,
      type: paymentMethod === "sol" ? "usdc_solana" : "usdc_direct",
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

creditRoutes.get("/v1/credits/balance", bearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const balance = await getBalance(userId);

    const batches = await db.select()
      .from(creditBatches)
      .where(eq(creditBatches.userId, userId))
      .orderBy(desc(creditBatches.createdAt))
      .limit(50);

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

creditRoutes.get("/v1/credits/transactions", bearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const limit = Math.min(Number(c.req.query("limit") ?? 50), 100);

    const [depositsResult, usageResult] = await Promise.all([
      db.select().from(deposits)
        .where(eq(deposits.userId, userId))
        .orderBy(desc(deposits.createdAt))
        .limit(limit),
      db.select().from(usageRecords)
        .where(eq(usageRecords.userId, userId))
        .orderBy(desc(usageRecords.createdAt))
        .limit(limit),
    ]);

    const transactions = [
      ...depositsResult.map((d: typeof deposits.$inferSelect) => ({
        id: d.id,
        type: "deposit" as const,
        amountCents: Math.round(Number(d.amountUsd) * 100),
        creditsIssued: Math.round(Number(d.creditsIssued) * 100),
        status: d.status,
        createdAt: d.createdAt,
        txHash: d.txHash,
      })),
      ...usageResult.map((u: typeof usageRecords.$inferSelect) => ({
        id: u.id,
        type: "usage" as const,
        model: u.model,
        amountCents: Number(u.totalCents),
        status: "completed" as const,
        createdAt: u.createdAt,
      })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ transactions: transactions.slice(0, limit) });
  } catch (err) {
    logger.error({ err }, "[credits] Transactions error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});

creditRoutes.get("/v1/credits/usage", bearerAuth, async (c) => {
  try {
    const userId = c.get("userId");
    const limit = Math.min(Number(c.req.query("limit") ?? 100), 500);
    const days = Math.min(Number(c.req.query("days") ?? 90), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const usageResult = await db.select({
      model: usageRecords.model,
      inputTokens: usageRecords.inputTokens,
      outputTokens: usageRecords.outputTokens,
      totalCents: usageRecords.totalCents,
    })
      .from(usageRecords)
      .where(and(
        eq(usageRecords.userId, userId),
        sql`${usageRecords.createdAt} >= ${since}`,
      ))
      .orderBy(desc(usageRecords.createdAt))
      .limit(limit);

    const modelTotals: Record<string, { inputTokens: number; outputTokens: number; totalCents: number; count: number }> = {};
    for (const record of usageResult) {
      if (!modelTotals[record.model]) {
        modelTotals[record.model] = { inputTokens: 0, outputTokens: 0, totalCents: 0, count: 0 };
      }
      modelTotals[record.model].inputTokens += record.inputTokens;
      modelTotals[record.model].outputTokens += record.outputTokens;
      modelTotals[record.model].totalCents += Number(record.totalCents);
      modelTotals[record.model].count += 1;
    }

    return c.json({
      usageByModel: Object.entries(modelTotals).map(([model, data]) => ({
        model,
        inputTokens: data.inputTokens,
        outputTokens: data.outputTokens,
        totalCents: data.totalCents,
        requestCount: data.count,
      })),
      totalUsageCents: Object.values(modelTotals).reduce((sum, m) => sum + m.totalCents, 0),
      periodDays: days,
      recordLimit: limit,
    });
  } catch (err) {
    logger.error({ err }, "[credits] Usage error:");
    return c.json({ error: { message: "Internal server error", type: "server_error" } }, 500);
  }
});

creditRoutes.post("/v1/credits/auto-reload", bearerAuth, async (c) => {
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

creditRoutes.get("/v1/credits/auto-reload", bearerAuth, async (c) => {
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
});

creditRoutes.post("/v1/credits/refund/:usageId", bearerAuth, async (c) => {
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

creditRoutes.get("/v1/credits/price-estimate", bearerAuth, async (c) => {
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

creditRoutes.post("/v1/credits/budget-alerts", bearerAuth, async (c) => {
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

creditRoutes.get("/v1/credits/budget-alerts", bearerAuth, async (c) => {
  const userId = c.get("userId");
  const config = await getBudgetAlertConfig(userId);

  if (!config) {
    return c.json({
      budgetLimitCents: 0,
      alertThresholds: DEFAULT_THRESHOLDS,
      emailEnabled: true,
      webhookEnabled: false,
      webhookUrl: null,
    });
  }

  return c.json({
    budgetLimitCents: config.budgetLimitCents,
    alertThresholds: config.alertThresholds,
    emailEnabled: config.emailEnabled,
    webhookEnabled: config.webhookEnabled,
    webhookUrl: config.webhookUrl,
  });
});

creditRoutes.delete("/v1/credits/budget-alerts", bearerAuth, async (c) => {
  const userId = c.get("userId");

  await db.delete(budgetAlerts).where(eq(budgetAlerts.userId, userId));

  return c.json({ success: true });
});

creditRoutes.get("/v1/credits/budget-alerts/history", bearerAuth, async (c) => {
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