/**
	* Shared offline-backoff state for the `/api/health` poll.
	*
	* Both health hooks (`useApiHealth` in components/api-status.tsx and
	* `useHealthQuery` in app/dashboard/_hooks) observe the same TanStack
	* query key, so they must also share one view of "how many consecutive
	* checks have failed" to agree on the next poll delay.
	*
	* Cadence contract (matches the login page's offline banner copy):
	* - Healthy: steady 30s poll.
	* - Offline: capped exponential backoff 5s → 10s → 20s → 40s → 60s,
	*   held at 60s until a check succeeds, which resets to the 30s poll.
	* - No per-attempt console logging anywhere on this path.
	*
	* Module-level (not React state) because TanStack's `refetchInterval`
	* callback needs the value synchronously and every observer of the
	* shared query must see the same count.
	*/

const HEALTH_POLL_INTERVAL_MS = 30_000;
const OFFLINE_BACKOFF_BASE_MS = 5_000;
const OFFLINE_BACKOFF_MAX_MS = 60_000;

let consecutiveFailures = 0;

/** Record the outcome of a health check. Success resets the backoff. */
export function recordHealthCheckResult(ok: boolean): void {
	consecutiveFailures = ok ? 0 : consecutiveFailures + 1;
}

/**
	* Poll delay for a given number of consecutive failures.
	* 0 → steady 30s; otherwise 5s doubling per failure, capped at 60s.
	*/
function healthPollInterval(failures: number): number {
	if (failures <= 0) return HEALTH_POLL_INTERVAL_MS;
	return Math.min(
		OFFLINE_BACKOFF_BASE_MS * 2 ** (failures - 1),
		OFFLINE_BACKOFF_MAX_MS,
	);
}

/** Delay until the next health check, based on the shared failure count. */
export function nextHealthPollMs(): number {
	return healthPollInterval(consecutiveFailures);
}
