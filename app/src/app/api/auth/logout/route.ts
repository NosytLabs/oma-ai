import { type NextRequest, NextResponse } from "next/server";
import { DEFAULT_API_URL } from "@/lib/config";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { authLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * /api/auth/logout — terminates the current SIWE / account-number session.
 *
 * Forwards the call to the backend `/auth/logout` (which clears the JWT
 * server-side) and then explicitly clears the session and meta cookies on
 * this origin. The wallet-provider runs `disconnect()` on the client to
 * drop wagmi state, but without this route the server-side HttpOnly
 * session cookie survives a "log out" click — only a server-issued
 * `Set-Cookie` with `Max-Age=0` can expire an HttpOnly cookie, because
 * JS cannot write the HttpOnly flag via `document.cookie`.
 *
 * B5 fix: use the env-dependent cookie name (`__Host-oma_session` in
 * production, `oma_session` in dev) sourced from `lib/cookies.ts` so we
 * clear exactly the key the canonical `/api/auth/session/cookie` route
 * sets. Hardcoding `oma_session` cleared the wrong cookie in production
 * and left the real session alive.
 */
export const POST = withRateLimit(
	async (_req: NextRequest) => {
		const backend = DEFAULT_API_URL;
		const cookieHeader = _req.headers.get("cookie") || "";

		// Best-effort server-side logout. We don't fail the request if the
		// backend is unreachable — the client should still be able to clear
		// its local cookies and disconnect the wallet.
		try {
			await fetch(`${backend}/auth/logout`, {
				method: "POST",
				headers: { cookie: cookieHeader },
				// Short timeout so a hung backend doesn't block the UI.
				signal: AbortSignal.timeout(2_000),
			});
		} catch {
			// Swallow — see comment above.
		}

		const res = NextResponse.json({ success: true });
		const expires = "Thu, 01 Jan 1970 00:00:00 GMT";
		const isProd = process.env.NODE_ENV === "production";
		// Clear the canonical HttpOnly session cookie (matches the
		// env-dependent name set by /api/auth/session/cookie). Setting
		// Max-Age=0 / expires in the past is the only way a browser will
		// actually drop an HttpOnly cookie — JS can't reach it.
		res.headers.append(
			"Set-Cookie",
			`${SESSION_COOKIE_NAME}=; expires=${expires}; path=/; SameSite=Strict${isProd ? "; Secure" : ""}`,
		);
		res.headers.append(
			"Set-Cookie",
			`oma_session_meta=; expires=${expires}; path=/; SameSite=Strict${isProd ? "; Secure" : ""}`,
		);
		res.headers.set("cache-control", "no-store");
		return res;
	},
	{ limiter: authLimiter, route: "/api/auth/logout" },
);
