/**
 * Request-header trust policy for the Vercel -> backend hop.
 *
 * There are two Next.js proxy paths (`/api/[...path]` and
 * `/api/auth/[...path]`). They legitimately differ in how they handle
 * COOKIES and REDIRECTS, but the rules below are SECURITY policy and must be
 * identical in both: when they drift, a fix applied to one path silently
 * leaves the other exposed.
 *
 * The invariant: the backend function is PUBLICLY reachable, so it refuses to
 * trust a forwarded client IP unless the caller proves it is our Vercel proxy.
 * Without the shared secret every visitor resolved to Vercel's single egress
 * address and shared ONE rate-limit and free-tier bucket. A browser cannot
 * forge it — the frontend never sets the header, and we overwrite whatever
 * arrived.
 */

/** Client-supplied forwarding headers: meaningless to the backend. */
const CLIENT_FORWARDING_HEADERS = [
	"x-forwarded-for",
	"x-vercel-forwarded-for",
	"x-real-ip",
] as const;

const PROXY_SECRET_HEADER = "x-oma-proxy-secret";

/** Minimal surface both proxy routes can satisfy. */
export interface ProxyHeaderSink {
	set(name: string, value: string): void;
	delete(name: string): void;
	keys(): Iterable<string>;
}

/**
 * Apply the authenticated-proxy trust policy to an outgoing header container.
 *
 * Order matters: the secret is set AFTER deleting the client forwarding
 * headers so a spoofed value can never survive alongside it.
 */
export function applyTrustedProxyHeaders(headers: ProxyHeaderSink): void {
	// Runtime provenance headers must never originate from a website visitor.
	for (const name of [...headers.keys()]) {
		if (name.toLowerCase().startsWith("x-neon-")) headers.delete(name);
	}
	for (const name of CLIENT_FORWARDING_HEADERS) {
		headers.delete(name);
	}
	headers.delete(PROXY_SECRET_HEADER);
	const proxySecret = process.env.INTERNAL_PROXY_SECRET;
	if (proxySecret) {
		headers.set(PROXY_SECRET_HEADER, proxySecret);
	}
}
