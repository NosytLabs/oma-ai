import { type NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { authLimiter } from "@/lib/rate-limiter";
import { DEFAULT_API_URL } from "@/lib/config";

export const runtime = "nodejs";

/**
 * /api/auth/logout — terminates the current SIWE / account-number session.
 *
 * Calls the backend `/auth/logout` to clear the JWT server-side (best
 * effort; backend failure is non-fatal) and then clears the HttpOnly
 * session cookie on this origin. JS cannot expire an HttpOnly cookie —
 * only a server-issued `Set-Cookie` with `Max-Age=0` can.
 */
export const POST = withRateLimit(
	async (req: NextRequest) => {
		// Best-effort upstream call. We deliberately swallow failure:
		// the client should still be able to clear local cookies and
		// disconnect the wallet.
		try {
			await fetch(`${DEFAULT_API_URL}/auth/logout`, {
				method: "POST",
				headers: { cookie: req.headers.get("cookie") ?? "" },
				signal: AbortSignal.timeout(2_000),
			});
		} catch {
			// Swallow — see comment above.
		}

		const res = NextResponse.json({ success: true });
		const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
		const isProd = process.env.NODE_ENV === "production";
		const secureFlag = isProd ? "; Secure" : "";
		// Canonical session cookie name comes from lib/cookies.ts so we
		// clear exactly what /api/auth/session/cookie set.
		res.headers.append(
			"Set-Cookie",
			`${SESSION_COOKIE_NAME}=; expires=${expires}; path=/; SameSite=Strict${secureFlag}`,
		);
		res.headers.append(
			"Set-Cookie",
			`oma_session_meta=; expires=${expires}; path=/; SameSite=Strict${secureFlag}`,
		);
		res.headers.set("cache-control", "no-store");
		return res;
	},
	{ limiter: authLimiter, route: "/api/auth/logout" },
);