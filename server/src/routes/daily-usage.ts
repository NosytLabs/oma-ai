/**
 * Daily usage endpoint — returns current day's usage count for the website chat
 * free tier. Used by the frontend to display remaining messages and trigger
 * upgrade prompts.
 */
import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { optionalAuth, sessionAuth } from "../auth/middleware.js";
import { getRedisClient, isRedisReady } from "../lib/redis-client.js";
import { extractClientIp } from "../middleware/rate-limit/utils.js";
import { db } from "../db/client.js";
import { usageRecords } from "../db/schema.js";
import { sql, eq, and, gte } from "drizzle-orm";

export const dailyUsageRoutes = new Hono<OmaEnv>();

const DAILY_LIMIT_ANONYMOUS = 20;
const DAILY_LIMIT_REGISTERED = 100;

/**
 * GET /v1/usage/today
 * Returns current daily usage count. Used by the website chat frontend.
 * For anonymous users, tracks by IP. For authenticated users, tracks by userId.
 */
dailyUsageRoutes.get("/v1/usage/today", optionalAuth, async (c) => {
  const userId = c.get("userId");
  const isAuthenticated = !!userId;

  // For authenticated users, query the DB for today's usage
  if (isAuthenticated && userId) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
      const result = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(usageRecords)
        .where(
          and(
            eq(usageRecords.userId, userId),
            gte(usageRecords.createdAt, today)
          )
        );

      const used = result[0]?.count ?? 0;
      const limit = DAILY_LIMIT_REGISTERED;
      const remaining = Math.max(0, limit - used);

      // Calculate reset time (midnight UTC)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const resetMs = tomorrow.getTime() - Date.now();

      return c.json({
        used,
        limit,
        remaining,
        isAuthenticated: true,
        resetMs,
      });
    } catch (err) {
      console.error("[daily-usage] DB query failed", err);
      return c.json({
        used: 0,
        limit: DAILY_LIMIT_REGISTERED,
        remaining: DAILY_LIMIT_REGISTERED,
        isAuthenticated: true,
        resetMs: 0,
        error: "Failed to fetch usage",
      }, 500);
    }
  }

  // For anonymous users, check Redis
  const redis = await getRedisClient();
  const ready = isRedisReady();

  if (!redis || !ready) {
    return c.json({
      used: 0,
      limit: DAILY_LIMIT_ANONYMOUS,
      remaining: DAILY_LIMIT_ANONYMOUS,
      isAuthenticated: false,
      resetMs: 0,
    });
  }

  const today = new Date().toISOString().slice(0, 10);
  const ip = extractClientIp(c);
  const key = `daily:ip:${ip}:${today}`;

  try {
    const used = parseInt((await redis.get(key)) ?? "0", 10);
    const limit = DAILY_LIMIT_ANONYMOUS;
    const remaining = Math.max(0, limit - used);
    const ttl = await redis.ttl(key);
    const resetMs = ttl > 0 ? ttl * 1000 : 86400000;

    return c.json({
      used,
      limit,
      remaining,
      isAuthenticated: false,
      resetMs,
    });
  } catch (err) {
    console.error("[daily-usage] Redis query failed", err);
    return c.json({
      used: 0,
      limit: DAILY_LIMIT_ANONYMOUS,
      remaining: DAILY_LIMIT_ANONYMOUS,
      isAuthenticated: false,
      resetMs: 0,
    });
  }
});
