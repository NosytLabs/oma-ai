import { type NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { DEFAULT_API_URL } from "@/lib/config";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

/**
 * Resolve the JWT from the HttpOnly session cookie server-side. The browser
 * cannot read it via `document.cookie`, so this proxy must read it via
 * `cookies()` from `next/headers` and forward it as `Authorization: Bearer
 * <jwt>` — the Hono backend's `sessionAuth` middleware only inspects
 * `Authorization`, not raw cookies.
 *
 * The env-dependent name (`__Host-oma_session` in production, `oma_session`
 * in dev) is sourced from `lib/cookies.ts` so logout, the session-cookie
 * endpoint, and this proxy all agree on the same key.
 */
async function readSessionToken(): Promise<string | null> {
	const cookieStore = await cookies();
	return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * /api/user — fetches the current session user (account number + linked wallets).
 *
 * Forwarded to the backend `/user` endpoint. The session can come from
 * either a caller-supplied `Authorization: Bearer <jwt>` header OR the
 * HttpOnly session cookie (which this proxy resolves server-side and
 * re-attaches as a Bearer token).
 */
export const GET = withRateLimit(
	async (req: NextRequest) => {
		const backend = DEFAULT_API_URL;
		const cookieHeader = req.headers.get("cookie") || "";
		const authHeader = req.headers.get("authorization") || "";

		const headers: Record<string, string> = {
			cookie: cookieHeader,
			accept: "application/json",
		};
		if (authHeader) {
			headers.authorization = authHeader;
		} else {
			// B1 fix: forward the HttpOnly session cookie as
			// `Authorization: Bearer <jwt>`. The browser cannot read the
			// cookie directly (HttpOnly), and the backend's `sessionAuth`
			// middleware only honors the Authorization header — without
			// this fallback, every `api.auth.getUser()` call 401s in
			// production.
			const sessionToken = await readSessionToken();
			if (sessionToken) {
				headers.authorization = `Bearer ${sessionToken}`;
			}
		}

		try {
			const upstream = await fetch(`${backend}/user`, {
				method: "GET",
				headers,
				signal: AbortSignal.timeout(5_000),
				cache: "no-store",
			});

			const body = await upstream.text();
			const res = new NextResponse(body, {
				status: upstream.status,
				headers: {
					"content-type":
						upstream.headers.get("content-type") ?? "application/json",
					"cache-control": "no-store",
				},
			});

			// Forward any Set-Cookie from upstream (e.g. session rotation)
			const setCookie = upstream.headers.get("set-cookie");
			if (setCookie) res.headers.append("set-cookie", setCookie);

			return res;
		} catch (_err) {
			return NextResponse.json(
				{
					error: {
						message: "Backend unreachable",
						type: "backend_unavailable",
					},
				},
				{ status: 502 },
			);
		}
	},
	{ limiter: generalLimiter, route: "/api/user" },
);
