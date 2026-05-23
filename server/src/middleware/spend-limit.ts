import type { Context, Next } from "hono";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";

function todayKey(keyHash: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `spend:${keyHash}:${date}`;
}

export async function trackSpend(
  keyHash: string,
  costCents: number,
): Promise<void> {
  const redis = await getRedisClient();
  const ready = isRedisReady();
  if (!redis || !ready) {
    console.error("Redis not available for trackSpend");
    return;
  }
  const key = todayKey(keyHash);
  const val = await redis.incrByFloat(key, costCents);
  if (typeof val === "number" && val === costCents) {
    await redis.expire(key, 86400);
  }
}

export function spendLimit() {
  return async (c: Context<OmaEnv>, next: Next) => {
    const apiKey = c.get("apiKey");
    if (!apiKey) {
      await next();
      return;
    }

    const limit = config.SPEND_LIMIT_DAILY_CENTS;
    const redis = await getRedisClient();
    const ready = isRedisReady();
    if (!redis || !ready) {
      console.error("[spend-limit] CRITICAL: Redis unavailable -- failing closed for spend limiting");
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
        { error: { message: "Daily spend limit exceeded. Please wait or upgrade your plan.", type: "rate_limit_error" } },
        429,
      );
    }

    await next();
  };
}
