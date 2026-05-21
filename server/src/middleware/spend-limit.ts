import type { Context, Next } from "hono";
import { createClient } from "redis";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";

let redisClient: ReturnType<typeof createClient> | null = null;
let redisReady = false;

async function getRedis() {
  if (redisClient && redisReady) return redisClient;
  try {
    if (!redisClient) {
      redisClient = createClient({ url: config.REDIS_URL ?? "redis://localhost:6379" });
      redisClient.on("error", () => { redisReady = false; });
      redisClient.on("ready", () => { redisReady = true; });
      await redisClient.connect();
      redisReady = true;
    }
    return redisClient;
  } catch {
    redisReady = false;
    return null;
  }
}

function todayKey(keyHash: string): string {
  const date = new Date().toISOString().slice(0, 10);
  return `spend:${keyHash}:${date}`;
}

export async function trackSpend(
  keyHash: string,
  costCents: number,
): Promise<void> {
  const redis = await getRedis();
  if (!redis || !redisReady) return;
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
    const redis = await getRedis();
    if (!redis || !redisReady) {
      console.warn("[spend-limit] Redis unavailable -- skipping spend limit check, allowing request");
      await next();
      return;
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
