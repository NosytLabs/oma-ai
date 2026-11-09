/**
 * Redis connection state.
 *
 * The client module keeps the connection alive in module-level variables --
 * a ready boolean, a failure counter, a retry timestamp and a free-text last
 * failure status. Together they form a small state machine, but nothing
 * exposed it: callers could only ask `isRedisReady()`, which answers "can I
 * use it?" and never "why not?". An operator reading /ready could see
 * "degraded" with no way to tell a missing configuration from an auth
 * failure from a plain outage.
 *
 * The vocabulary lives here, dependency-free, so metrics, health checks and
 * operator tools can read it without importing the client (and its config
 * requirements).
 */

export const REDIS_CONNECTION_STATE = {
	/** The last ping succeeded; the client is usable. */
	Ready: "ready",
	/** No usable connection and no failure reason yet (startup, or closed). */
	Disconnected: "disconnected",
	/** A connection attempt failed; retrying with backoff. */
	Error: "error",
} as const;

export type RedisConnectionState =
	(typeof REDIS_CONNECTION_STATE)[keyof typeof REDIS_CONNECTION_STATE];

/**
 * The health snapshot the client exposes about the connection.
 *
 * `state` answers "what is happening"; `reason` (when present) answers "why
 * is it not ready", using the same taxonomy the client logs. Unknown reasons
 * are passed through as-is: an unfamiliar failure must stay visible, not be
 * flattened into a generic value.
 */
export interface RedisConnectionSnapshot {
	state: RedisConnectionState;
	failedAttempts: number;
	/** Milliseconds until the next connection attempt, when backing off. */
	retryInMs: number | null;
	reason?: string;
}

/**
 * Classify a health status string into the vocabulary.
 *
 * Anything unrecognised is "disconnected" -- the one state that cannot
 * reassure a caller. "ok" maps to ready; the two failure statuses the client
 * writes ("error", "disconnected") map to themselves.
 */
export function parseRedisConnectionState(
	raw: string | undefined | null,
): RedisConnectionState {
	if (raw === "ok") return REDIS_CONNECTION_STATE.Ready;
	if (raw === REDIS_CONNECTION_STATE.Error) return REDIS_CONNECTION_STATE.Error;
	return REDIS_CONNECTION_STATE.Disconnected;
}
