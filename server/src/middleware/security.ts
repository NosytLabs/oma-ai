import type { Context, Next } from "hono";

export async function securityHeaders(c: Context, next: Next) {
		c.header(
				"Content-Security-Policy",
				"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self';",
		);
		c.header("X-Content-Type-Options", "nosniff");
		c.header("X-Frame-Options", "DENY");
		c.header("Referrer-Policy", "strict-origin-when-cross-origin");
		c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
		c.header("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
		c.header("X-XSS-Protection", "0");
		await next();
}