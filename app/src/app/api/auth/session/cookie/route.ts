/**
 * /api/auth/session/cookie — C1 fix.
 *
 * Sets the canonical session cookie on the page origin with HttpOnly +
 * (in production) `__Host-` prefix. This route is what the client calls
 * immediately after a successful `/v1/auth/verify` or `/v1/auth/account/*`
 * response, with the JWT in the body.
 *
 * Why a dedicated Next.js route rather than a Hono endpoint:
 *  - The HttpOnly cookie must be set on the page origin (oma-ai.com), not
 *    the API origin (api.oma-ai.com). A cross-origin Set-Cookie from the
 *    Hono backend would require CORS with `credentials: 'include'`, and
 *    `__Host-`-prefixed cookies are rejected on cross-origin Set-Cookie
 *    anyway.
 *  - The existing dedicated routes (`/api/auth/logout`, `/api/auth/csrf-token`)
 *    follow the same pattern: a Next.js edge that either sets/clears
 *    cookies on the page origin, or proxies + forwards the upstream
 *    Set-Cookie.
 *
 * Validation mirrors `app/src/middleware.ts` so the JWT we accept here is
 * exactly the JWT the rest of the app trusts. We re-verify on every call —
 * a token that doesn't verify never lands in a cookie.
 */
import { jwtVerify } from "jose";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { SESSION_COOKIE_NAME } from "@/lib/cookies";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { authLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

const ISSUER = "oma-ai";
const AUDIENCE = "oma-ai-api";

const bodySchema = z.object({
	token: z.string().min(1),
});

function getSecret(): Uint8Array | null {
	const secret = process.env.JWT_SECRET;
	if (!secret || secret.length < 32) {
		return null;
	}
	return new TextEncoder().encode(secret);
}

/**
 * Build the canonical Set-Cookie value for the session JWT.
 *
 * In production: `__Host-oma_session=<jwt>; Path=/; HttpOnly; Secure;
 * SameSite=Strict; Max-Age=86400` (24h, matching the JWT expiry in
 * `server/src/auth/siwe.ts`).
 *
 * In dev: `oma_session=<jwt>; Path=/; HttpOnly; SameSite=Strict; Max-Age=86400`.
 * No `Secure` because http://localhost has no TLS, and no `__Host-` prefix
 * for the same reason.
 */
function buildSessionCookie(jwt: string): string {
	const isProd = process.env.NODE_ENV === "production";
	const maxAge = 60 * 60 * 24; // 24h, matches JWT expiry
	const parts = [
		`${SESSION_COOKIE_NAME}=${jwt}`,
		"Path=/",
		"HttpOnly",
		"SameSite=Strict",
		`Max-Age=${maxAge}`,
	];
	if (isProd) parts.push("Secure");
	return parts.join("; ");
}

export const POST = withRateLimit(
	async (req: NextRequest) => {
		let payload: { token: string };
		try {
			const json = (await req.json()) as unknown;
			const parsed = bodySchema.safeParse(json);
			if (!parsed.success) {
				return NextResponse.json(
					{
						error: {
							message: "Invalid request body — expected { token: string }",
							type: "invalid_request_error",
						},
					},
					{ status: 400 },
				);
			}
			payload = parsed.data;
		} catch {
			return NextResponse.json(
				{ error: { message: "Malformed JSON body", type: "invalid_request_error" } },
				{ status: 400 },
			);
		}

		// Verify the JWT before persisting it. Mirrors the algorithm + issuer
		// + audience pinning in `app/src/middleware.ts` and
		// `server/src/auth/siwe.ts` so we never accept a token that wouldn't
		// pass the rest of the app's auth checks. The 5s clock skew matches
		// the other verifiers.
		const secret = getSecret();
		if (!secret) {
			// Mirror middleware behavior: if JWT_SECRET is missing/weak in
			// production, refuse to mint a cookie at all.
			if (process.env.NODE_ENV === "production") {
				console.error(
					"[/api/auth/session/cookie] JWT_SECRET missing or too short; refusing to set session cookie",
				);
			}
			return NextResponse.json(
				{ error: { message: "Session service unavailable", type: "server_error" } },
				{ status: 503 },
			);
		}

		try {
			await jwtVerify(payload.token, secret, {
				issuer: ISSUER,
				audience: AUDIENCE,
				algorithms: ["HS256"],
				clockTolerance: 5,
			});
		} catch {
			return NextResponse.json(
				{
					error: {
						message: "Invalid or expired session token",
						type: "authentication_error",
					},
				},
				{ status: 401 },
			);
		}

		const res = NextResponse.json({ success: true });
		res.headers.set("Set-Cookie", buildSessionCookie(payload.token));
		res.headers.set("cache-control", "no-store");
		return res;
	},
	{ limiter: authLimiter, route: "/api/auth/session/cookie" },
);
