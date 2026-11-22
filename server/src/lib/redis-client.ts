import { Redis } from "@upstash/redis";
import { config } from "../config.js";
import {
	REDIS_CONNECTION_STATE,
	type RedisConnectionSnapshot,
	type RedisConnectionState,
	parseRedisConnectionState,
} from "./redis-connection-state.js";
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
let lastFailureStatus: RedisConnectionState = REDIS_CONNECTION_STATE.Disconnected;
// Failure reason from the same taxonomy the client logs (see failureDetails),
// surfaced to operators through redisConnectionState().
let lastFailureReason: string | null = null;
// One-shot flag so the "no endpoint configured" degrade logs a single line.
let endpointDegradeLogged = false;

const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30_000;

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
// or command arguments. Emit only a fixed category and a numeric HTTP status.
function failureDetails(error: unknown): { reason: string; status?: number } {
	const record = error && typeof error === "object"
		? error as { message?: unknown; status?: unknown; statusCode?: unknown; cause?: unknown }
		: {};
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
	return { reason, ...(status === undefined ? {} : { status }) };
}

// @upstash/redis speaks HTTP(S) REST only. A native redis:// URL or a missing
// token can never produce a working client, and the environment cannot change
// while the process runs, so treat that as "not configured": degrade once
// instead of scheduling retries that can only fail the same way. Plain http://
// REST endpoints are legitimate (local proxies, test fixtures), so both
// schemes count as configured.
function restEndpointConfigured(): boolean {
	const url = config.UPSTASH_REDIS_REST_URL ?? config.REDIS_URL;
	const token = config.UPSTASH_REDIS_REST_TOKEN ?? config.REDIS_TOKEN;
	return typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://")) && !!token;
}

async function verifyConnection(force = false): Promise<HealthResult> {
	if (!restEndpointConfigured()) {
		if (!endpointDegradeLogged) {
			endpointDegradeLogged = true;
			lastFailureReason = "missing_configuration";
			logger.info(
				"[redis] no HTTP(S) REST endpoint configured -- staying on the in-memory fallback " +
					"(set UPSTASH_REDIS_REST_URL/TOKEN for shared rate limiting)",
			);
		}
		return { status: REDIS_CONNECTION_STATE.Disconnected };
	}
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
			lastFailureReason = null;
			if (recovered) logger.info("[redis] connection recovered");
			return { status: "ok", latency: Date.now() - start };
		} catch (error) {
			if (generation !== attemptGeneration) return { status: "disconnected" };
			redisReady = false;
			failedAttempts = Math.min(failedAttempts + 1, 6);
			const retryAfterMs = Math.min(RETRY_BASE_MS * 2 ** (failedAttempts - 1), RETRY_MAX_MS);
			nextRetryAt = Date.now() + retryAfterMs;
			lastFailureStatus = redis ? REDIS_CONNECTION_STATE.Error : REDIS_CONNECTION_STATE.Disconnected;
			const failure = failureDetails(error);
			lastFailureReason = failure.reason;
			logger.warn({ ...failure, retryAfterMs }, "[redis] connection check failed");
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
	lastFailureStatus = REDIS_CONNECTION_STATE.Disconnected;
	lastFailureReason = null;
	endpointDegradeLogged = false;
	pingPromise = null;
}

export function isRedisReady(): boolean {
	return redisReady;
}

/**
 * The connection's state as an explicit snapshot: what is happening, how many
 * attempts have failed, when the next attempt lands, and (when not ready) the
 * reason from the same taxonomy the client logs. Additive -- every existing
 * caller keeps asking isRedisReady()/getRedisClient().
 */
export function redisConnectionState(): RedisConnectionSnapshot {
	const state = parseRedisConnectionState(redisReady ? "ok" : lastFailureStatus);
	const retryInMs =
		!redisReady && nextRetryAt > Date.now() ? nextRetryAt - Date.now() : null;
	return {
		state,
		failedAttempts,
		retryInMs,
		...(state === REDIS_CONNECTION_STATE.Ready
			? {}
			: { reason: lastFailureReason ?? lastFailureStatus }),
	};
}

export async function redisHealthCheck(): Promise<HealthResult> {
	return verifyConnection(true);
}
