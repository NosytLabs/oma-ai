import { Redis } from "@upstash/redis";
import { config } from "../config.js";
import { logger } from "./logger.js";

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
let failedAttempts = 0;
let nextRetryAt = 0;
let generation = 0;
let lastFailureStatus = "disconnected";

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;
const NETWORK_ERROR_CODES = new Set([
	"ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
	"UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "UND_ERR_BODY_TIMEOUT", "UND_ERR_SOCKET",
	"CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID",
]);

let redis: Redis | null = null;
type HealthResult = { status: string; latency?: number };
let pingPromise: Promise<HealthResult> | null = null;

function resolveRedisInstance(): Redis {
	if (!redis) {
		const restUrl = config.UPSTASH_REDIS_REST_URL ?? config.REDIS_URL;
		const restToken = config.UPSTASH_REDIS_REST_TOKEN ?? config.REDIS_TOKEN;
		if (!restUrl || !restToken) throw new Error("Redis credentials missing");
		redis = new Redis({ url: restUrl, token: restToken });
	}
	return redis;
}

// Never log the SDK error itself: its message may contain URLs, credentials,
// or command arguments. Emit only a fixed category, numeric HTTP status,
// and allowlisted transport code (Node fetch errors put this in cause.code).
function failureDetails(error: unknown): { reason: string; status?: number; code?: string } {
	const record = error && typeof error === "object"
		? error as { message?: unknown; status?: unknown; statusCode?: unknown; code?: unknown; cause?: unknown }
		: {};
	const cause = record.cause && typeof record.cause === "object"
		? record.cause as { code?: unknown } : {};
	const rawCode = record.code ?? cause.code;
	const code = typeof rawCode === "string" && NETWORK_ERROR_CODES.has(rawCode) ? rawCode : undefined;
	const message = typeof record.message === "string" ? record.message.toLowerCase() : "";
	const rawStatus = record.status ?? record.statusCode;
	const status = typeof rawStatus === "number" && Number.isInteger(rawStatus)
		&& rawStatus >= 400 && rawStatus <= 599 ? rawStatus : undefined;
	let reason = "unknown";
	if (message === "redis credentials missing") reason = "missing_configuration";
	else if (status === 401 || status === 403 || /unauthorized|forbidden|wrongpass|invalid token/.test(message)) reason = "authentication";
	else if (status === 429 || /rate.?limit|quota|too many requests/.test(message)) reason = "rate_limit";
	else if (/timeout|timed out|abort/.test(message)) reason = "timeout";
	else if (/invalid.*url|url.*invalid|https.*url/.test(message)) reason = "invalid_configuration";
	else if (status && status >= 500) reason = "upstream_error";
	else if (/fetch failed|network|econn|enotfound|unable to connect/.test(message)) reason = "network";
	return { reason, ...(status === undefined ? {} : { status }), ...(code === undefined ? {} : { code }) };
}

async function verifyConnection(force = false): Promise<HealthResult> {
	if (pingPromise) return pingPromise;
	if (redisReady && !force) return { status: "ok" };
	if (Date.now() < nextRetryAt) return { status: lastFailureStatus };
	const attemptGeneration = generation;
	const attempt = Promise.resolve().then(async (): Promise<HealthResult> => {
		const start = Date.now();
		try {
			await resolveRedisInstance().ping();
			if (generation !== attemptGeneration) return { status: "disconnected" };
			const recovered = failedAttempts > 0;
			redisReady = true;
			failedAttempts = 0;
			nextRetryAt = 0;
			if (recovered) logger.info("[redis] connection recovered");
			return { status: "ok", latency: Date.now() - start };
		} catch (error) {
			if (generation !== attemptGeneration) return { status: "disconnected" };
			redisReady = false;
			failedAttempts = Math.min(failedAttempts + 1, 6);
			const retryAfterMs = Math.min(RETRY_BASE_MS * 2 ** (failedAttempts - 1), RETRY_MAX_MS);
			nextRetryAt = Date.now() + retryAfterMs;
			lastFailureStatus = redis ? "error" : "disconnected";
			logger.warn({ ...failureDetails(error), retryAfterMs }, "[redis] connection check failed");
			return { status: lastFailureStatus };
		}
	});
	pingPromise = attempt;
	try {
		return await attempt;
	} finally {
		if (pingPromise === attempt) pingPromise = null;
	}
}

export async function getRedisClient(): Promise<Redis | null> {
	// Share one probe during startup/recovery; healthy requests reuse the client.
	const health = await verifyConnection();
	return health.status === "ok" ? redis : null;
}

export async function closeRedisClient(): Promise<void> {
	generation += 1;
	redis = null;
	redisReady = false;
	failedAttempts = 0;
	nextRetryAt = 0;
	lastFailureStatus = "disconnected";
	pingPromise = null;
}

export function isRedisReady(): boolean {
	return redisReady;
}

export async function redisHealthCheck(): Promise<HealthResult> {
	return verifyConnection(true);
}
