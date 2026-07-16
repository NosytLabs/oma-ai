import { type NextRequest, NextResponse } from "next/server";
import { proxyRequest } from "@/lib/api/proxy";
import { readSessionToken } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * /api/user — current session user (account number + linked wallets).
 *
 * Unauthenticated callers get 204 (not 401) so the global wallet restore
 * on every public page doesn't spam the browser console with failed
 * network requests. Authenticated callers are proxied to the Hono
 * backend with cookie → Bearer translation.
 */
export const GET = withRateLimit(
	async (request: NextRequest) => {
		const session = await readSessionToken();
		if (!session) {
			return new NextResponse(null, {
				status: 204,
				headers: { "cache-control": "no-store" },
			});
		}
		return proxyRequest(request, { backendPath: "/user", timeoutMs: 5_000 });
	},
	{ limiter: generalLimiter, route: "/api/user" },
);
