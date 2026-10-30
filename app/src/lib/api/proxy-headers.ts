import { isIP } from "node:net";
import { stripHopByHopHeaders } from "./hop-headers";

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
 * forge it — the server overwrites whatever arrived. Only Vercel's own
 * platform IP header survives, and only when this proxy runs on Vercel.
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
	get(name: string): string | null;
	set(name: string, value: string): void;
	delete(name: string): void;
	keys(): Iterable<string>;
}

/** Only Vercel's single platform connection address can identify a visitor. */
export function getTrustedPlatformIp(headers: Pick<ProxyHeaderSink, "get">): string | undefined {
	if (process.env.VERCEL !== "1") return undefined;
	const ip = headers.get("x-vercel-forwarded-for")?.trim();
	return ip && isIP(ip) ? ip : undefined;
}

/**
 * Normalize connection-scoped headers and apply authenticated proxy trust.
 *
 * Order matters: capture platform identity before filtering, then set server
 * credentials AFTER stripping Connection options and client forwarding fields.
 */
export function applyTrustedProxyHeaders(headers: ProxyHeaderSink): void {
	// Vercel supplies this header from its edge connection; local/custom
	// hosts cannot authenticate a browser-provided forwarding value.
	// Read before deletion so both chat/quota and auth use the same visitor
	// identity rather than a changing Vercel egress address.
	const platformIp = getTrustedPlatformIp(headers);
	stripHopByHopHeaders(headers);
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
		if (platformIp && isIP(platformIp)) {
			headers.set("x-vercel-forwarded-for", platformIp);
		}
	}
}
