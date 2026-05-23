import { Hono } from "hono";
import { z } from "zod";
import { bearerAuth } from "../auth/middleware.js";
import { getBalance } from "../credits/balance.js";
import { addCredits } from "../credits/balance.js";
import { db } from "../db/client.js";
import { creditBatches, autoReloadSettings, deposits, usageRecords } from "../db/schema.js";
import { eq, desc, and } from "drizzle-orm";
import { config } from "../config.js";
import { calculateCostCredits } from "../inference/models.js";
import { validationError } from "../lib/validation.js";
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

function getExpiryDate(): Date {
  const d = new Date();
  d.setDate(d.getDate() + (config.CREDIT_BATCH_EXPIRY_DAYS || 365));
  return d;
}

creditRoutes.post("/v1/credits/purchase", bearerAuth, async (c) => {
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

  const expiresAt = getExpiryDate();

  await db.insert(creditBatches).values({
    userId,
    amountCents: String(amountCents),
    remainingCents: String(amountCents),
    expiresAt,
    paymentMethod,
    depositId: deposit.id,
  });

  await db.update(deposits)
    .set({ status: "completed", creditsIssued: String(amountCents / 100), completedAt: new Date() })
    .where(eq(deposits.id, deposit.id));

  return c.json({
    success: true,
    creditsAdded: amountCents,
    expiresAt: expiresAt.toISOString(),
    depositId: deposit.id,
    paymentMethod,
    autoReloadEnabled: autoReload ?? false,
  });
});

creditRoutes.get("/v1/credits/balance", bearerAuth, async (c) => {
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
});

creditRoutes.get("/v1/credits/transactions", bearerAuth, async (c) => {
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
});

creditRoutes.get("/v1/credits/usage", bearerAuth, async (c) => {
  const userId = c.get("userId");

  const usageResult = await db.select({
    model: usageRecords.model,
    inputTokens: usageRecords.inputTokens,
    outputTokens: usageRecords.outputTokens,
    totalCents: usageRecords.totalCents,
  })
    .from(usageRecords)
    .where(eq(usageRecords.userId, userId));

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
  });
});

creditRoutes.post("/v1/credits/auto-reload", bearerAuth, async (c) => {
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
    const credits = calculateCostCredits(model, inputTokens, outputTokens);
    return c.json({
      model,
      inputTokens,
      outputTokens,
      estimatedCredits: credits,
      pricePerMillionInput: 0,
      pricePerMillionOutput: 0,
    });
  } catch (err) {
    return c.json({ error: { message: (err as Error).message, type: "invalid_request_error" } }, 400);
  }
});