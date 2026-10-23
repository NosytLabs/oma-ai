import apiLimits from "../inference/api-limits.json" with { type: "json" };
import { getRedisClient, isRedisReady } from "./redis-client.js";
import { logger } from "./logger.js";

export const DAILY_LIMIT_ANONYMOUS = apiLimits.anonymousWebsiteRequestsPerDay;
export const DAILY_LIMIT_REGISTERED = apiLimits.registeredWebsiteRequestsPerDay;
const DAY_MS = 86_400_000;
const MAX_LOCAL_COUNTERS = 10_000;

interface Counter { used: number; resetAt: number }
const counters = new Map<string, Counter>();

export interface DailyQuota {
	used: number;
	remaining: number;
	limit: number;
	resetMs: number;
	policy: "shared-redis" | "degraded-memory";
}

function currentCounter(identifier: string) {
	const now = Date.now();
	const resetAt = (Math.floor(now / DAY_MS) + 1) * DAY_MS;
	const key = `daily:${identifier}:${new Date(now).toISOString().slice(0, 10)}`;
	let counter = counters.get(key);
	if (!counter) {
		if (counters.size >= MAX_LOCAL_COUNTERS) {
			for (const [oldKey, value] of counters) if (value.resetAt <= now) counters.delete(oldKey);
			if (counters.size >= MAX_LOCAL_COUNTERS) counters.delete(counters.keys().next().value!);
		}
		counter = { used: 0, resetAt };
		counters.set(key, counter);
	}
	return { key, counter };
}

function result(counter: Counter, limit: number, policy: DailyQuota["policy"]): DailyQuota {
	const used = Math.min(limit, counter.used);
	return { used, remaining: limit - used, limit, resetMs: Math.max(0, counter.resetAt - Date.now()), policy };
}

function count(value: string | number | null): number {
	const parsed = Number(value ?? 0);
	if (!Number.isSafeInteger(parsed) || parsed < 0) throw new Error("Invalid daily quota counter");
	return parsed;
}

/** Read the same admission counter that enforces free chat, without consuming it. */
export async function readDailyQuota(identifier: string, limit: number): Promise<DailyQuota> {
	const { key, counter } = currentCounter(identifier);
	try {
		const redis = await getRedisClient();
		if (redis && isRedisReady()) {
			counter.used = Math.max(counter.used, count(await redis.get(key)));
			return result(counter, limit, "shared-redis");
		}
	} catch (err) {
		logger.warn({ err }, "Daily quota read failed; using observed local usage");
	}
	return result(counter, limit, "degraded-memory");
}

/** Reserve an attempt before inference. Shared and degraded counters reset at UTC midnight. */
export async function consumeDailyQuota(identifier: string, limit: number): Promise<DailyQuota & { allowed: boolean }> {
	const { key, counter } = currentCounter(identifier);
	if (counter.used >= limit) return { ...result(counter, limit, "degraded-memory"), allowed: false };
	// Keep a bounded local shadow even while Redis is healthy. A later outage
	// must not forget this process's attempts or already observed shared usage.
	counter.used++;
	try {
		const redis = await getRedisClient();
		if (redis && isRedisReady()) {
			const used = count(await redis.incr(key));
			counter.used = Math.max(counter.used, used);
			const seconds = Math.max(1, Math.ceil((counter.resetAt - Date.now()) / 1000));
			if (used === 1) await redis.expire(key, seconds);
			else if (await redis.ttl(key) < 0) await redis.expire(key, seconds);
			return { ...result(counter, limit, "shared-redis"), allowed: used <= limit };
		}
	} catch (err) {
		logger.warn({ err }, "Daily quota reservation failed; enforcing a bounded local cap");
	}
	return { ...result(counter, limit, "degraded-memory"), allowed: counter.used <= limit };
}
