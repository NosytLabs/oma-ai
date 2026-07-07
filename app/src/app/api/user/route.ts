import { type NextRequest } from "next/server";
import { proxyRequest } from "@/lib/api/proxy";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * /api/user — fetches the current session user (account number + linked
 * wallets). The proxy primitive handles auth-cookie-to-Bearer translation
 * and Set-Cookie forwarding; this route only pins the backend path.
 */
export const GET = withRateLimit(
	async (request: NextRequest) =>
		proxyRequest(request, { backendPath: "/user", timeoutMs: 5_000 }),
	{ limiter: generalLimiter, route: "/api/user" },
);