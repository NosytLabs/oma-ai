/**
	* Rate-limit middleware for Next.js API routes (Node.js runtime).
	*
	* Wraps a route handler with per-IP rate limiting and adds standard
	* `X-RateLimit-*` headers to every response.  Returns 429 with a
	* `Retry-After` header when the limit is exceeded.
	*
	* Usage:
	* ```ts
	* import { withRateLimit } from '@/lib/rate-limit-middleware'
	* import { authLimiter } from '@/lib/rate-limiter'
	*
	* export const runtime = 'nodejs'
	*
	* export const POST = withRateLimit(async (req) => {
	*   // … your handler
	* }, { limiter: authLimiter, route: '/api/auth/sign-in/email' })
	* ```
	*/

import { type NextRequest, NextResponse } from "next/server";
import type { RateLimiter, RateLimitResult } from "./rate-limiter";

export interface RateLimitOptions {
	/** The RateLimiter instance to use (determines limit/window). */
	limiter: RateLimiter;
	/** A logical route name used as the rate-limit key (e.g. '/api/auth/login'). */
	route: string;
}

/**
	* Extract the client IP for rate-limit keys.
	*
	* SEC: Client-controlled proxy headers are only trusted when:
	*   - Running on Vercel (`VERCEL=1`), where the edge sets x-forwarded-for, or
	*   - `TRUSTED_PROXY_IPS` is set (non-empty) for other reverse proxies.
	* Otherwise return "unknown" so spoofed XFF cannot bypass per-IP limits.
	* Local dev collapsing to one bucket is acceptable.
	*/
function getClientIp(req: NextRequest | Request): string {
	const trustProxyHeaders =
		process.env.VERCEL === "1" || Boolean(process.env.TRUSTED_PROXY_IPS?.trim());
	if (!trustProxyHeaders) return "unknown";

	const xff = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	if (xff) return xff;
	const realIp = req.headers.get("x-real-ip")?.trim();
	if (realIp) return realIp;
	return "unknown";
}

/**
	* Apply rate-limit headers to any NextResponse.
	*/
function applyRateLimitHeaders(
	res: NextResponse,
	result: RateLimitResult,
	limit: number,
): NextResponse {
	res.headers.set("X-RateLimit-Limit", String(limit));
	res.headers.set("X-RateLimit-Remaining", String(result.remaining));
	res.headers.set(
		"X-RateLimit-Reset",
		String(Math.floor(result.resetAt / 1000)),
	);
	return res;
}

/** Access the private `limit` field for header values. */
function getLimit(limiter: RateLimiter): number {
	return (limiter as unknown as { limit: number }).limit;
}

/**
	* Higher-order function that wraps a Next.js route handler with
	* rate-limiting logic.
	*
	* - On allowed requests: delegates to `handler` and appends
	*   `X-RateLimit-*` headers to the response.
	* - On rejected requests: immediately returns 429 JSON with
	*   `Retry-After` and `X-RateLimit-*` headers.
	*
	* The handler may accept a `NextRequest`, a `Request`, or no argument
	* at all (for routes that don't inspect the request).
	*/
// Overload: handler takes no argument
export function withRateLimit(
	handler: () => Promise<Response>,
	options: RateLimitOptions,
): (req: NextRequest | Request) => Promise<Response>;
// Overload: handler takes a typed request argument
export function withRateLimit<T extends NextRequest | Request>(
	handler: (req: T) => Promise<Response>,
	options: RateLimitOptions,
): (req: T) => Promise<Response>;
// Implementation
export function withRateLimit(
	handler: (req?: NextRequest | Request) => Promise<Response>,
	options: RateLimitOptions,
): (req: NextRequest | Request) => Promise<Response> {
	const { limiter, route } = options;
	const limit = getLimit(limiter);

	return async (req: NextRequest | Request): Promise<Response> => {
		const ip = getClientIp(req);
		const result = limiter.check(ip, route);

		if (!result.allowed) {
			const retryAfterSec = Math.ceil((result.resetAt - Date.now()) / 1000);
			const res = NextResponse.json(
				{
					error: {
						message: "Too many requests. Please try again later.",
						type: "rate_limit_exceeded",
					},
				},
				{
					status: 429,
					headers: { "Retry-After": String(retryAfterSec) },
				},
			);
			return applyRateLimitHeaders(res, result, limit);
		}

		// Run the actual handler — pass the request even if the handler
		// ignores it (the overload signatures handle the type difference).
		const response = await handler(req);

		// Convert to NextResponse so we can set headers.  If the handler
		// already returns a NextResponse, we can mutate headers directly.
		let nextRes: NextResponse;
		if (response instanceof NextResponse) {
			nextRes = response;
		} else {
			// Re-wrap a plain Response as a NextResponse so we can set headers.
			const body = response.body;
			const { status, statusText } = response;
			const headers = new Headers(response.headers);
			nextRes = new NextResponse(body, { status, statusText, headers });
		}

		return applyRateLimitHeaders(nextRes, result, limit);
	};
}
