/**
 * The rate limiter must default to failing OPEN when Redis is unavailable.
 *
 * PRODUCTION OUTAGE
 * -----------------
 * `rateLimit` defaulted to `failClosed: true`, which returns 503 whenever
 * `isRedisReady()` is false. The limiter uses @upstash/redis (REST), but the
 * Neon deployment sets only `REDIS_URL` — no `UPSTASH_REDIS_REST_URL` /
 * `UPSTASH_REDIS_REST_TOKEN` — so Redis was never ready.
 *
 * Every route relying on the default therefore returned 503 in production
 * while the rest of the API looked healthy. Verified live before the fix:
 *
 *   POST /api/v1/checkout     -> 503 {"code":"service_unavailable"}
 *   POST /x402/verify         -> 503 {"code":"service_unavailable"}
 *   POST /api/webhooks/polar  -> 503 {"code":"service_unavailable"}
 *
 * That is the entire revenue path: orders settle on Polar's side and the
 * internal ledger is never credited.
 *
 * WHY FAILING OPEN IS SAFE HERE
 * -----------------------------
 * `failClosed: false` does not remove the limit — it degrades to a bounded
 * per-process memory store that still returns 429 and advertises
 * `X-RateLimit-Policy: degraded-memory`. Enforcement gets weaker
 * (per-process, not cluster-wide); it does not disappear. A missing cache
 * dependency should not take down availability.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, "..", "sliding-window.ts"), "utf8");

describe("rate limiter default is fail-open", () => {
	it("does not default failClosed to true", () => {
		expect(src).toMatch(/failClosed\s*=\s*false/);
		expect(src).not.toMatch(/failClosed\s*=\s*true/);
	});

	it("still enforces a bound when degraded, rather than skipping the limit", () => {
		// A fail-open that simply calls next() would be unbounded — that was
		// the original problem this option was introduced to avoid.
		expect(src).toMatch(/checkFallbackLimit\(rateLimitKey\)/);
		expect(src).toContain("degraded-memory");
		expect(src).toMatch(/rate_limit_exceeded/);
	});
});
