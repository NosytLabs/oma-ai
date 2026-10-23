/**
	* Shared offline-backoff state for the `/api/ready` poll in
	* `components/api-status.tsx`.
	*
	* Cadence contract (matches the login page's offline banner copy):
	* - Healthy: steady 30s poll.
	* - Offline: capped exponential backoff 5s → 10s → 20s → 40s → 60s,
	*   held at 60s until a check succeeds, which resets to the 30s poll.
	* - No per-attempt console logging anywhere on this path.
	*
	* Module-level (not React state) because TanStack's `refetchInterval`
	* callback needs the value synchronously.
	*/

const HEALTH_POLL_INTERVAL_MS = 30_000;
const OFFLINE_BACKOFF_BASE_MS = 5_000;
const OFFLINE_BACKOFF_MAX_MS = 60_000;

let consecutiveFailures = 0;

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

/** Reset backoff after a successful health check. Called by the consumer
	*  on each successful poll — keeps state in sync without re-exporting
	*  the underlying mutation. */
export function recordHealthCheckResult(ok: boolean): void {
	consecutiveFailures = ok ? 0 : consecutiveFailures + 1;
}
