import type { Context, Next } from "hono";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { checkBudgetThresholds, getBudgetAlertConfig, processBudgetAlert } from "../credits/budget-alerts.js";
import { logger } from "../lib/logger.js";

interface SpendEntry {
  keyHash: string;
  costCents: number;
  timestamp: number;
}

const spendRetryQueue: SpendEntry[] = [];
const MAX_QUEUE_SIZE = 1000;
const MAX_RETENTION_MS = 5 * 60 * 1000;

function todayKey(keyHash: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `spend:${keyHash}:${date}`;
}

async function processQueue(): Promise<void> {
  if (spendRetryQueue.length === 0) return;

  const redis = await getRedisClient();
  if (!redis || !isRedisReady()) return;

  const now = Date.now();
  const remaining: SpendEntry[] = [];

  for (const entry of spendRetryQueue) {
    if (now - entry.timestamp > MAX_RETENTION_MS) continue;
    try {
      const key = todayKey(entry.keyHash);
      const val = await redis.incrByFloat(key, entry.costCents);
      if (typeof val === "number" && val === entry.costCents) {
        await redis.expire(key, 86400);
      }
    } catch {
      remaining.push(entry);
    }
  }

  spendRetryQueue.length = 0;
  spendRetryQueue.push(...remaining.slice(0, MAX_QUEUE_SIZE));
}

export async function trackSpend(
  keyHash: string,
  costCents: number,
): Promise<void> {
  try {
    const redis = await getRedisClient();
    const ready = isRedisReady();
    if (!redis || !ready) {
      throw new Error("Redis unavailable");
    }

    processQueue().catch(() => {
      // Queue processing failure is non-critical - spend tracking will retry
    });

    const key = todayKey(keyHash);
    const val = await redis.incrByFloat(key, costCents);
    await redis.set(key, val, { EX: 86400 });
  } catch (err) {
    logger.error({ err, keyHash }, "trackSpend failed, queuing for retry");
    if (spendRetryQueue.length < MAX_QUEUE_SIZE) {
      spendRetryQueue.push({ keyHash, costCents, timestamp: Date.now() });
    }
  }
}

export async function checkAndTriggerBudgetAlerts(userId: string): Promise<void> {
  const alert = await checkBudgetThresholds(userId);
  if (!alert) return;

  const alertConfig = await getBudgetAlertConfig(userId);
  if (!alertConfig) return;

  await processBudgetAlert(userId, alert, alertConfig);
}

export function spendLimit() {
  return async (c: Context<OmaEnv>, next: Next) => {
    const apiKey = c.get("apiKey");
    const userId = c.get("userId");

    if (!apiKey) {
      await next();
      return;
    }

    const limit = config.SPEND_LIMIT_DAILY_CENTS;
    const redis = await getRedisClient();
    const ready = isRedisReady();
    if (!redis || !ready) {
      logger.error("Redis unavailable -- failing closed for spend limiting");
      return c.json(
        { error: { message: "Service temporarily unavailable. Please try again later.", type: "rate_limit_error", code: "rate_limit_unavailable" } },
        503,
      );
    }

    const key = todayKey(apiKey.keyHash);
    const raw = await redis.get(key);
    const spent = raw ? Math.round(parseFloat(raw)) : 0;

    if (spent >= limit) {
      c.header("x-spend-limit-exceeded", "1");
      return c.json(
        { error: { message: "Daily spend limit exceeded. Please wait or upgrade your plan.", type: "rate_limit_error", code: "spend_limit_exceeded" } },
        429,
      );
    }

    if (userId) {
      checkAndTriggerBudgetAlerts(userId).catch(err => {
        logger.warn({ err, userId }, "Budget alert check failed");
      });
    }

    await next();
  };
}
