import { db } from "../db/client.js";
import { budgetAlerts, budgetAlertHistory, creditBalances, usageRecords } from "../db/schema.js";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";

export type BudgetThreshold = 50 | 75 | 90 | 100;

export const DEFAULT_THRESHOLDS: BudgetThreshold[] = [50, 75, 90, 100];

export type BudgetPeriod = "daily" | "weekly" | "monthly" | "lifetime";

export interface BudgetLimitConfig {
  dailyLimitCents?: number;
  weeklyLimitCents?: number;
  monthlyLimitCents?: number;
  lifetimeLimitCents?: number;
}

export interface BudgetUsage {
  spentCents: number;
  limitCents: number;
  percentUsed: number;
  period: BudgetPeriod;
  resetAt: Date;
}

export interface BudgetAlertConfig {
  budgetLimitCents: number;
  alertThresholds?: BudgetThreshold[];
  emailEnabled?: boolean;
  webhookEnabled?: boolean;
  webhookUrl?: string;
  dailyLimitCents?: number;
  weeklyLimitCents?: number;
  monthlyLimitCents?: number;
}

export interface AlertTriggered {
  threshold: BudgetThreshold;
  percentUsed: number;
  spentCents: number;
  budgetLimitCents: number;
  alertType: "50_percent" | "75_percent" | "90_percent" | "100_percent";
  period?: BudgetPeriod;
}

export async function getBudgetAlertConfig(userId: string): Promise<BudgetAlertConfig | null> {
  const result = await db.select().from(budgetAlerts).where(eq(budgetAlerts.userId, userId)).limit(1);
  if (!result.length) return null;

  const alert = result[0];
  const thresholds = JSON.parse(alert.alertThresholds) as BudgetThreshold[];

  return {
    budgetLimitCents: Number(alert.budgetLimitCents),
    alertThresholds: thresholds,
    emailEnabled: alert.emailEnabled,
    webhookEnabled: alert.webhookEnabled,
    webhookUrl: alert.webhookUrl ?? undefined,
    dailyLimitCents: alert.dailyLimitCents ? Number(alert.dailyLimitCents) : undefined,
    weeklyLimitCents: alert.weeklyLimitCents ? Number(alert.weeklyLimitCents) : undefined,
    monthlyLimitCents: alert.monthlyLimitCents ? Number(alert.monthlyLimitCents) : undefined,
  };
}

function getPeriodBounds(period: BudgetPeriod): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  switch (period) {
    case "daily":
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      break;
    case "weekly": {
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      break;
    }
    case "monthly":
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
      break;
    case "lifetime":
      start.setFullYear(2000, 0, 1);
      end.setFullYear(2099, 11, 31);
      break;
  }

  return { start, end };
}

export async function getBudgetUsage(userId: string, period: BudgetPeriod = "monthly"): Promise<BudgetUsage | null> {
  const config = await getBudgetAlertConfig(userId);
  if (!config) return null;

  const { start, end } = getPeriodBounds(period);
  
  let limitCents = 0;
  switch (period) {
    case "daily":
      limitCents = config.dailyLimitCents ?? config.budgetLimitCents;
      break;
    case "weekly":
      limitCents = config.weeklyLimitCents ?? (config.budgetLimitCents * 7);
      break;
    case "monthly":
      limitCents = config.monthlyLimitCents ?? (config.budgetLimitCents * 30);
      break;
    case "lifetime":
      limitCents = config.budgetLimitCents;
      break;
  }

  const result = await db
    .select({
      total: sql<number>`COALESCE(SUM(${usageRecords.totalCents}::numeric), 0)`,
    })
    .from(usageRecords)
    .where(
      and(
        eq(usageRecords.userId, userId),
        gte(usageRecords.createdAt, start),
        lte(usageRecords.createdAt, end)
      )
    )
    .limit(1);

  const spentCents = Number(result[0]?.total ?? 0);
  const percentUsed = limitCents > 0 ? (spentCents / limitCents) * 100 : 0;

  return {
    spentCents,
    limitCents,
    percentUsed,
    period,
    resetAt: end,
  };
}

export async function checkMultiPeriodThresholds(userId: string): Promise<AlertTriggered | null> {
  const periods: BudgetPeriod[] = ["daily", "weekly", "monthly", "lifetime"];

  for (const period of periods) {
    const usage = await getBudgetUsage(userId, period);
    if (!usage) continue;

    const thresholds = [50, 75, 90, 100];
    for (const threshold of thresholds) {
      if (usage.percentUsed >= threshold) {
        const alertType = `${threshold}_percent` as AlertTriggered["alertType"];
        return {
          threshold: threshold as BudgetThreshold,
          percentUsed: usage.percentUsed,
          spentCents: usage.spentCents,
          budgetLimitCents: usage.limitCents,
          alertType,
          period,
        };
      }
    }
  }

  return null;
}

export async function getAllBudgetUsage(userId: string): Promise<BudgetUsage[]> {
  const periods: BudgetPeriod[] = ["daily", "weekly", "monthly", "lifetime"];
  const usages: BudgetUsage[] = [];

  for (const period of periods) {
    const usage = await getBudgetUsage(userId, period);
    if (usage) {
      usages.push(usage);
    }
  }

  return usages;
}

async function getRedisForBudget() {
  const redis = await getRedisClient();
  if (redis && isRedisReady()) return redis;
  return null;
}

export async function cacheBudgetUsage(userId: string, usage: BudgetUsage): Promise<void> {
  const redis = await getRedisForBudget();
  if (!redis) return;

  const cacheKey = `budget:usage:${userId}:${usage.period}`;
  await redis.setEx(cacheKey, 60, JSON.stringify(usage));
}

export async function getCachedBudgetUsage(userId: string, period: BudgetPeriod): Promise<BudgetUsage | null> {
  const redis = await getRedisForBudget();
  if (!redis) return null;

  const cacheKey = `budget:usage:${userId}:${period}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    return JSON.parse(cached) as BudgetUsage;
  }
  return null;
}

export async function setBudgetAlertConfig(
  userId: string,
  config: BudgetAlertConfig
): Promise<void> {
  const thresholds = config.alertThresholds ?? DEFAULT_THRESHOLDS;

  await db.insert(budgetAlerts)
    .values({
      userId,
      budgetLimitCents: String(config.budgetLimitCents),
      alertThresholds: JSON.stringify(thresholds),
      emailEnabled: config.emailEnabled ?? true,
      webhookEnabled: config.webhookEnabled ?? false,
      webhookUrl: config.webhookUrl ?? undefined,
      dailyLimitCents: config.dailyLimitCents ? String(config.dailyLimitCents) : undefined,
      weeklyLimitCents: config.weeklyLimitCents ? String(config.weeklyLimitCents) : undefined,
      monthlyLimitCents: config.monthlyLimitCents ? String(config.monthlyLimitCents) : undefined,
    })
    .onConflictDoUpdate({
      target: budgetAlerts.userId,
      set: {
        budgetLimitCents: String(config.budgetLimitCents),
        alertThresholds: JSON.stringify(thresholds),
        emailEnabled: config.emailEnabled ?? true,
        webhookEnabled: config.webhookEnabled ?? false,
        webhookUrl: config.webhookUrl ?? undefined,
        dailyLimitCents: config.dailyLimitCents ? String(config.dailyLimitCents) : undefined,
        weeklyLimitCents: config.weeklyLimitCents ? String(config.weeklyLimitCents) : undefined,
        monthlyLimitCents: config.monthlyLimitCents ? String(config.monthlyLimitCents) : undefined,
        updatedAt: new Date(),
      },
    });
}

export async function checkBudgetThresholds(userId: string): Promise<AlertTriggered | null> {
  const config = await getBudgetAlertConfig(userId);
  if (!config) return null;

  const totalSpent = await calculateTotalSpent(userId);
  const percentUsed = (totalSpent / config.budgetLimitCents) * 100;

  const thresholds = config.alertThresholds ?? DEFAULT_THRESHOLDS;
  for (const threshold of thresholds) {
    if (percentUsed >= threshold) {
      const alreadyAlerted = await hasAlertBeenSent(userId, threshold);
      if (alreadyAlerted) continue;

      return {
        threshold,
        percentUsed,
        spentCents: totalSpent,
        budgetLimitCents: config.budgetLimitCents,
        alertType: `${threshold}_percent` as AlertTriggered["alertType"],
      };
    }
  }

  return null;
}

export async function calculateTotalSpent(userId: string): Promise<number> {
  const result = await db.select().from(creditBalances).where(eq(creditBalances.userId, userId)).limit(1);
  if (!result.length) return 0;
  return Math.round(Number(result[0].totalUsedCents));
}

export async function hasAlertBeenSent(userId: string, threshold: BudgetThreshold): Promise<boolean> {
  const alertType = `${threshold}_percent` as const;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const result = await db.select()
    .from(budgetAlertHistory)
    .where(
      and(
        eq(budgetAlertHistory.userId, userId),
        eq(budgetAlertHistory.alertType, alertType),
        gte(budgetAlertHistory.createdAt, today)
      )
    )
    .limit(1);

  return result.length > 0;
}

export async function recordAlertSent(
  userId: string,
  alert: AlertTriggered,
  channel: "email" | "webhook" | "both" = "email"
): Promise<void> {
  await db.insert(budgetAlertHistory).values({
    userId,
    alertType: alert.alertType,
    thresholdPercent: alert.threshold,
    spentCents: String(alert.spentCents),
    budgetLimitCents: String(alert.budgetLimitCents),
    notificationSent: true,
    notificationChannel: channel,
  });

  await db.update(budgetAlerts)
    .set({ lastAlertAt: new Date(), updatedAt: new Date() })
    .where(eq(budgetAlerts.userId, userId));
}

export async function sendEmailNotification(userId: string, alert: AlertTriggered): Promise<void> {
  console.log(`[BUDGET-ALERT] Email notification for user ${userId}: ${alert.threshold}% threshold reached`);
}

export async function sendWebhookNotification(userId: string, alert: AlertTriggered, webhookUrl: string): Promise<void> {
  const urlParsed = new URL(webhookUrl);
  const hostname = urlParsed.hostname;
  const PRIVATE_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
  if (PRIVATE_HOSTNAMES.some(h => hostname === h || hostname.endsWith('.local'))) {
    console.warn(`[BUDGET-ALERT] Blocked SSRF attempt to ${webhookUrl}`);
    return;
  }
  console.log(`[BUDGET-ALERT] Webhook notification for user ${userId}: ${alert.threshold}% threshold reached to ${webhookUrl}`);
}

export async function processBudgetAlert(userId: string, alert: AlertTriggered, config: BudgetAlertConfig): Promise<void> {
  let channel: "email" | "webhook" | "both" = "email";

  if (config.emailEnabled) {
    await sendEmailNotification(userId, alert);
  }

  if (config.webhookEnabled && config.webhookUrl) {
    await sendWebhookNotification(userId, alert, config.webhookUrl);
    channel = config.emailEnabled ? "both" : "webhook";
  }

  await recordAlertSent(userId, alert, channel);
}

export async function getBudgetAlertHistory(
  userId: string,
  limit: number = 50
): Promise<Array<{
  alertType: string;
  thresholdPercent: number;
  spentCents: number;
  budgetLimitCents: number;
  createdAt: Date;
}>> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const result = await db.select({
    alertType: budgetAlertHistory.alertType,
    thresholdPercent: budgetAlertHistory.thresholdPercent,
    spentCents: budgetAlertHistory.spentCents,
    budgetLimitCents: budgetAlertHistory.budgetLimitCents,
    createdAt: budgetAlertHistory.createdAt,
  })
    .from(budgetAlertHistory)
    .where(
      and(
        eq(budgetAlertHistory.userId, userId),
        gte(budgetAlertHistory.createdAt, thirtyDaysAgo)
      )
    )
    .orderBy(budgetAlertHistory.createdAt)
    .limit(limit);

  return result.map(h => ({
    alertType: h.alertType,
    thresholdPercent: h.thresholdPercent,
    spentCents: Number(h.spentCents),
    budgetLimitCents: Number(h.budgetLimitCents),
    createdAt: h.createdAt,
  }));
}