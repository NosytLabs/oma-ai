import type { Context, Next } from "hono";

/**
 * Hono security headers. Next.js's `next.config.ts` `headers()` already adds
 * CSP, HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, and
 * Permissions-Policy to every response — including responses proxied through
 * the Next `/api/*` catch-all. We only add Hono-only responses get these
 * (e.g. direct hits to the API base that bypass the Next proxy).
 *
 * The CSP here is intentionally a *subset* of the Next CSP so that when both
 * fire on a single response (Next proxy + Hono middleware) the duplicate
 * header combines safely rather than producing an unsatisfiable policy.
 */
export async function securityHeaders(c: Context, next: Next) {
	c.header(
		"Content-Security-Policy",
		// Same script/style/frame-ancestors/object-src as Next's policy.
		// `connect-src` is broadened only with `https:` so direct API hits
		// (which never execute browser scripts anyway) can still serve JSON.
		"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https: blob:; font-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; connect-src 'self' https:",
	);
	// Defense-in-depth for direct (non-proxied) API responses: the Next proxy
	// already sets these, but direct hits to the API base bypass it.
	c.header("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
	c.header("X-Content-Type-Options", "nosniff");
	c.header("X-Frame-Options", "DENY");
	c.header("Referrer-Policy", "no-referrer");
	c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
	c.header("X-XSS-Protection", "0");
	await next();
}
