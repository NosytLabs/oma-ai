/**
 * Catch-all API proxy — forwards requests on any /api/* path to the Hono
 * backend on DEFAULT_API_URL. This replaces the need for a per-endpoint
 * proxy route file.
 *
 * Dedicated routes (e.g. /api/auth/csrf-token, /api/user, /api/health)
 * take precedence because Next.js matches specific routes before
 * catch-alls. The proxy plumbing itself is shared via lib/api/proxy.ts.
 */
import { type NextRequest } from "next/server";
import { proxyRequest } from "@/lib/api/proxy";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

const handler = (request: NextRequest) => proxyRequest(request);

export const GET = withRateLimit(handler, {
	limiter: generalLimiter,
	route: "/api/*",
});
export const POST = withRateLimit(handler, {
	limiter: generalLimiter,
	route: "/api/*",
});
export const PUT = withRateLimit(handler, {
	limiter: generalLimiter,
	route: "/api/*",
});
export const PATCH = withRateLimit(handler, {
	limiter: generalLimiter,
	route: "/api/*",
});
export const DELETE = withRateLimit(handler, {
	limiter: generalLimiter,
	route: "/api/*",
});