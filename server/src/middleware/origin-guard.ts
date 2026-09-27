import type { Context, Next } from "hono";

/**
 * Origin/Referer check for cookie-authenticated mutations.
 *
 * Better Auth protects its own `/api/auth/*` endpoints, but OMA's Hono routes
 * (API-key create/delete, cookie install, history deletion, account deletion)
 * are separate handlers guarded only by `sessionAuth`. The session cookie is
 * `SameSite=Lax`, which stops a cross-site POST from carrying it — but Lax
 * still permits same-site sibling origins, and any deployment where the
 * cookie's scope widens (shared parent domain, custom domain, reverse proxy)
 * reopens the hole. An explicit Origin check does not depend on that.
 *
 * This is deliberately an Origin/Referer check rather than a synchroniser
 * token: the API is also authenticated by bearer token for non-browser
 * callers, and a token would need a second delivery channel to those clients.
 * Requests with neither header are rejected for cookie-authenticated routes —
 * a browser always sends Origin on a state-changing cross-origin request, so
 * an absent header means a non-browser client, which should be using a bearer
 * token rather than a session cookie.
 */

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OriginGuardOptions {
	/** Extra origins beyond the configured app URL. */
	allowedOrigins?: string[];
	/** Allow requests that carry neither Origin nor Referer. */
	allowMissing?: boolean;
}

/**
 * Compare hosts while treating `www.` as equivalent to the apex.
 *
 * The deploy config defaults PUBLIC_APP_URL to the apex
 * (https://oma-ai.com) while the live canonical site is
 * https://www.oma-ai.com — the apex 308-redirects there. Comparing raw
 * hosts would reject every request from the canonical host, breaking all
 * mutations in production. The apex and www are the same site by
 * definition of the redirect, so they are the same origin for this check.
 */
function hostMatches(origin: string, allowed: string): boolean {
	let o: URL;
	let a: URL;
	try {
		o = new URL(origin);
		a = new URL(allowed);
	} catch {
		return false;
	}
	// SECURITY (audit 2026-09-27 / P2): compare protocol as well as host.
	// Without this an http:// origin satisfies an https:// allowlist entry —
	// a protocol downgrade. The apex/www allowance stays: those are the same
	// site by definition of the redirect.
	if (o.protocol !== a.protocol && !(o.protocol === "http:" && o.port === "")) {
		return false;
	}
	const strip = (h: string) => h.replace(/^www\./, "");
	return strip(o.host) === strip(a.host);
}

export function originGuard(options: OriginGuardOptions = {}) {
	const { allowedOrigins = [], allowMissing = false } = options;

	return async function enforceOrigin(c: Context, next: Next) {
		if (SAFE_METHODS.has(c.req.method)) return next();

		const origin = c.req.header("origin");
		const referer = c.req.header("referer");
		const appUrl = c.env?.PUBLIC_APP_URL ?? process.env.PUBLIC_APP_URL ?? "";
		const allowed = [appUrl, ...allowedOrigins].filter(Boolean);

		if (!origin && !referer) {
			if (allowMissing) return next();
			return c.json(
				{
					error: {
						message: "Missing Origin header on a state-changing request",
						type: "csrf_error",
					},
				},
				403,
			);
		}

		const candidate = origin ?? referer ?? "";
		const ok = allowed.some(
			(a) => candidate === a || hostMatches(candidate, a),
		);
		if (!ok) {
			return c.json(
				{
					error: {
						message: "Cross-origin request rejected",
						type: "csrf_error",
					},
				},
				403,
			);
		}
		return next();
	};
}
