/** Shared origin policy for Better Auth and OMA cookie-authenticated routes. */
export function shouldUseSecureCookies(nodeEnv: string | undefined): boolean {
	return nodeEnv !== "development" && nodeEnv !== "test";
}


/** Environment fields the origin resolvers read. */
export interface AuthOriginConfig {
	BETTER_AUTH_URL?: string | undefined;
	PUBLIC_APP_URL?: string | undefined;
	PRIMARY_DOMAIN?: string | undefined;
	NODE_ENV?: string | undefined;
}

/**
 * Strip scheme, path, port and case from a configured domain.
 *
 * Single source of truth: the trusted-origin list, the auth base URL and the
 * SIWE domain previously each normalized PRIMARY_DOMAIN by hand, and the
 * copies had already drifted (only one of them treated `::1` as local).
 */
function normalizePrimaryDomain(raw: string | undefined): string {
	if (!raw?.trim()) return "";
	try {
		const value = raw.trim();
		return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.toLowerCase();
	} catch {
		return "";
	}
}

/** True when a normalized domain refers to the local machine, not a site. */
export function isLocalDomain(domain: string): boolean {
	if (!domain) return true;
	if (domain === "::1" || domain === "[::1]") return true;
	if (domain === "localhost" || domain.endsWith(".localhost")) return true;
	if (/^127\./.test(domain)) return true;
	return false;
}

/**
 * The canonical public origins for a real domain: apex and www.
 *
 * Deriving these from PRIMARY_DOMAIN is what stops a stale PUBLIC_APP_URL from
 * locking real users out of sign-in (a misconfigured localhost value used to
 * make Better Auth 403 the live site with INVALID_ORIGIN). Only real,
 * non-local domains get fabricated https origins; dev keeps its explicit
 * localhost list below.
 */
export function resolveTrustedOrigins(input: AuthOriginConfig): string[] {
	const isProd = shouldUseSecureCookies(input.NODE_ENV);
	const origins = new Set<string>();

	// The configured app origin (dev/preview/staging deployments).
	if (input.PUBLIC_APP_URL) {
		try {
			const appUrl = new URL(input.PUBLIC_APP_URL);
			if (["http:", "https:"].includes(appUrl.protocol) && (!isProd || !isLocalDomain(appUrl.hostname))) {
				origins.add(appUrl.origin);
			}
		} catch {
			// Ignore malformed optional app URLs; PRIMARY_DOMAIN remains canonical.
		}
	}

	const domain = normalizePrimaryDomain(input.PRIMARY_DOMAIN);
	if (isProd && !isLocalDomain(domain)) {
		const apex = domain.replace(/^www\./, "");
		origins.add(`https://${apex}`);
		origins.add(`https://www.${apex}`);
	}

	// Local dev/preview ports, retained so local sign-in keeps working.
	// SECURITY (audit): only add localhost when the environment is actually
	// local (non-secure-cookie env = development/test). Trusting localhost in
	// production/staging/preview means any process able to serve content on
	// localhost — or a DNS-rebinding-style host — is a trusted origin for
	// magic-link, OTP and SIWE endpoints on the live site.
	if (!isProd) {
		origins.add("http://localhost:3000");
		origins.add("http://127.0.0.1:3000");
		origins.add("http://localhost:3123");
		origins.add("http://127.0.0.1:3123");
	}

	return [...origins];
}

/**
 * The base URL Better Auth uses to build callback URLs (magic-link redirects,
 * email verification links).
 *
 * Must resolve to the SAME canonical origin as resolveTrustedOrigins: if the
 * two disagree, a link can be accepted for sending yet emailed pointing
 * somewhere unusable. In a deployed environment PRIMARY_DOMAIN wins, with
 * OMA's apex normalized to www; explicit custom and preview hosts stay intact.
 */
export function resolveAuthBaseURL(input: AuthOriginConfig): string {
	const isProd = shouldUseSecureCookies(input.NODE_ENV);
	const domain = normalizePrimaryDomain(input.PRIMARY_DOMAIN);
	if (isProd && !isLocalDomain(domain)) {
		// Only OMA's apex redirects to www. Keep explicit preview/custom hosts.
		return `https://${domain === "oma-ai.com" ? "www.oma-ai.com" : domain}`;
	}
	return input.BETTER_AUTH_URL ?? input.PUBLIC_APP_URL ?? "http://localhost:3000";
}
