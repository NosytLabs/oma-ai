import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { optionalAuth } from "../auth/middleware.js";
import { extractClientIp } from "../middleware/rate-limit/utils.js";
import { readDailyQuota, DAILY_LIMIT_ANONYMOUS, DAILY_LIMIT_REGISTERED } from "../lib/daily-quota.js";

export const dailyUsageRoutes = new Hono<OmaEnv>();

/** Free-chat admission quota; differs from persisted successful request history. */
dailyUsageRoutes.get("/v1/usage/today", optionalAuth, async c => {
	const userId = c.get("userId");
	const identifier = userId ? `user:${userId}` : `ip:${extractClientIp(c)}`;
	const quota = await readDailyQuota(identifier, userId ? DAILY_LIMIT_REGISTERED : DAILY_LIMIT_ANONYMOUS);
	c.header("Cache-Control", "private, no-store");
	return c.json({ ...quota, isAuthenticated: !!userId });
});
