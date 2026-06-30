import { db } from "../db/client.js";
import { budgetAlerts, budgetAlertHistory, creditBalances } from "../db/schema.js";
import { eq, and, gte } from "drizzle-orm";
import { logger } from "../lib/logger.js";

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
  // ponytail: SYNC-39 — column is now integer[] natively; narrow from number[]
  const thresholds = alert.alertThresholds as unknown as BudgetThreshold[];

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

export async function setBudgetAlertConfig(
  userId: string,
  config: BudgetAlertConfig
): Promise<void> {
  const thresholds = config.alertThresholds ?? DEFAULT_THRESHOLDS;

  await db.insert(budgetAlerts)
    .values({
      userId,
      budgetLimitCents: String(config.budgetLimitCents),
      alertThresholds: thresholds as number[],
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
        alertThresholds: thresholds as number[],
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
  logger.info(`[BUDGET-ALERT] Email notification for user ${userId}: ${alert.threshold}% threshold reached`);
}

export async function sendWebhookNotification(userId: string, alert: AlertTriggered, webhookUrl: string): Promise<void> {
  const urlParsed = new URL(webhookUrl);
  const hostname = urlParsed.hostname;

  // Block private/reserved IPs, cloud metadata, and localhost
  const BLOCKED_HOSTNAMES = ['localhost', '127.0.0.1', '0.0.0.0', '::1', '169.254.169.254'];
  if (BLOCKED_HOSTNAMES.some(h => hostname === h || hostname.endsWith('.local'))) {
    logger.warn(`[BUDGET-ALERT] Blocked SSRF attempt to ${webhookUrl}`);
    return;
  }

  // Block private IP ranges (10.x, 172.16-31.x, 192.168.x)
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [, a, b] = ipMatch.map(Number);
    if (a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168)) {
      logger.warn(`[BUDGET-ALERT] Blocked SSRF attempt to private IP ${webhookUrl}`);
      return;
    }
  }

  logger.info(`[BUDGET-ALERT] Webhook notification for user ${userId}: ${alert.threshold}% threshold reached to ${webhookUrl}`);
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