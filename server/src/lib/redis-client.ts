import { Redis } from "@upstash/redis";
import { config } from "../config.js";

// Serverless/HTTP Redis client backed by Upstash (@upstash/redis). Works on
// Neon Functions (serverless, connectionless) and locally (no Docker/Redis
// daemon required) by talking to an Upstash REST endpoint over HTTPS.
//
// Credential resolution priority:
//   1. UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN  (recommended, Upstash)
//   2. REDIS_URL (https://...upstash.io) + REDIS_TOKEN     (compat fallback)
//
// Upstash's @upstash/redis uses lowercase Lua-style command names (setex,
// lpush, lrange, ...) and lower-case `set` option keys ({nx, ex}). Call sites
// that used node-redis camelCase must be updated accordingly; see the type
// surface below.

let redisReady = false;
let connectionFailed = false;
let connectionAttempted = false;

let redis: Redis | null = null;
let pingPromise: Promise<boolean> | null = null;

function resolveRedisInstance(): Redis | null {
	if (!redis) {
		const restUrl = config.UPSTASH_REDIS_REST_URL ?? config.REDIS_URL;
		const restToken = config.UPSTASH_REDIS_REST_TOKEN ?? config.REDIS_TOKEN;
		if (!restUrl || !restToken) return null;

		try {
			redis = new Redis({ url: restUrl, token: restToken });
		} catch {
			connectionFailed = true;
			return null;
		}
	}
	return redis;
}

async function verifyConnection(): Promise<boolean> {
	if (redisReady) return true;
	if (pingPromise) return pingPromise;
	if (!connectionAttempted) {
		connectionAttempted = true;
		pingPromise = (async () => {
			const client = resolveRedisInstance();
			if (!client) {
				connectionFailed = true;
				return false;
			}
			try {
				await client.ping();
				redisReady = true;
				return true;
			} catch {
				connectionFailed = true;
				return false;
			} finally {
				pingPromise = null;
			}
		})();
	}
	return pingPromise ?? false;
}

export async function getRedisClient(): Promise<Redis | null> {
	if (connectionFailed) return null;
	const client = resolveRedisInstance();
	if (!client) return null;
	// Fire-and-forget readiness verification — upstash is connectionless.
	void verifyConnection();
	return client;
}

export async function closeRedisClient(): Promise<void> {
	redis = null;
	redisReady = false;
}

export function isRedisReady(): boolean {
	return redisReady;
}

export async function redisHealthCheck(): Promise<{ status: string; latency?: number }> {
	const client = resolveRedisInstance();
	if (!client) return { status: "disconnected" };
	try {
		const start = Date.now();
		await client.ping();
		redisReady = true;
		return { status: "ok", latency: Date.now() - start };
	} catch {
		return { status: "error" };
	}
}
