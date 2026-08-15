/**
	* RATE LIMIT FAIL-OPEN vs FAIL-CLOSED DESIGN:
	* =============================================
	*
	* `rateLimit()` and `tokenBucket()` (used for inference/auth routes):
	*   -> FAILS CLOSED (returns 503 when Redis is down)
	*   Rationale: Security > availability. Auth and inference endpoints must
	*   not allow unlimited requests when rate limiting infrastructure fails.
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
