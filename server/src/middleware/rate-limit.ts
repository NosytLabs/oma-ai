/**
	* RATE LIMIT FAIL-OPEN vs FAIL-CLOSED DESIGN:
	* =============================================
	*
	* `rateLimit()` defaults to a bounded per-instance request counter.
	* Explicit failClosed routes return 503 when Redis is unavailable.
	* Inference token buckets use an emergency five-request/minute allowance
	* shared across an account's keys; anonymous traffic remains IP-scoped.
	* Script failures preserve request/token weights in bounded local counters.
	* These fallbacks do not provide a distributed quota across workers.
	*
	* `checkSessionRateLimit()` and `createSessionRateLimitMiddleware()`:
	*   -> FAILS OPEN (allows requests when Redis is down)
	*   Rationale: Availability > security. Session-level TPM/RPM limits are
	*   operational safeguards, not security controls. Better to serve traffic
	*   without limits than to block all traffic during a Redis outage.
	*
	* This is intentional. Do not change without explicit architectural review.
	*/

export * from "./rate-limit/lua-scripts.js";
export * from "./rate-limit/memory-store.js";
export * from "./rate-limit/sliding-window.js";
export * from "./rate-limit/token-bucket.js";
export * from "./rate-limit/utils.js";
