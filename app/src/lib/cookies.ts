/**
 * Cookie management utilities.
 *
 * C1 fix: the JWT is now persisted as an HttpOnly cookie set by the
 * dedicated Next.js route `POST /api/auth/session/cookie`. JS cannot write
 * the HttpOnly flag via `document.cookie` (the browser silently drops the
 * whole Set-Cookie value), so the canonical cookie path is server-side.
 * XSS can no longer trivially read the JWT out of `document.cookie`.
 *
 * The JWT is still returned in the response body of `/v1/auth/*` for the
 * SPA to keep in React state / localStorage so the in-page client can
 * attach `Authorization: Bearer <jwt>` to outbound requests. The HttpOnly
 * cookie is the authoritative copy; the in-memory copy is a fast-path
 * convenience.
 *
 * C2 fix: the cookie name switches to `__Host-oma_session` in production
 * (the `__Host-` prefix requires `Secure` + `Path=/` + no `Domain`
 * attribute, which prevents subdomain takeover from forging a session
 * cookie) and stays as `oma_session` in dev. The server's logout already
 * uses this env-dependent name; the client now matches.
 */

export const SESSION_COOKIE_NAME = isSecureEnv()
	? "__Host-oma_session"
	: "oma_session";
const SESSION_META_COOKIE_NAME = "oma_session_meta";
// H6 fix: mirror the `__Host-` prefix pattern used by the API key cookie
// (`__Host-oma_api_key` in production) and the session cookie. The CSRF
// cookie is NOT HttpOnly (the double-submit pattern requires JS to read
// and echo it as `x-csrf-token`), so the only protection the prefix adds
// is subdomain-takeover resistance — an attacker who controls
// `evil.oma-ai.com` can no longer forge a `csrf_token` cookie that the
// browser sends to `oma-ai.com`. The matching server-side change is in
// `server/src/routes/auth.ts#createCsrfCookieHeader`.
const CSRF_COOKIE_NAME = isSecureEnv()
	? "__Host-csrf_token"
	: "csrf_token";

interface SessionMeta {
	authMethod: string;
}

function isBrowser(): boolean {
	return typeof window !== "undefined";
}

function isSecureEnv(): boolean {
	return process.env.NODE_ENV === "production";
}

/**
 * Build a browser-writable cookie string.
 *
 * Note: NO `HttpOnly` here. `HttpOnly` is rejected by the browser when set via
 * `document.cookie` and the entire cookie is dropped. `Secure` is only set in
 * production (HTTPS) because dev runs on http://localhost.
 */
function getClientCookieString(
	name: string,
	value: string,
	maxAgeDays: number,
): string {
	const expires = new Date(Date.now() + maxAgeDays * 86400000).toUTCString();
	const maxAge = Math.floor(maxAgeDays * 86400);
	const parts = [
		`${name}=${encodeURIComponent(value)}`,
		`expires=${expires}`,
		"path=/",
		`max-age=${maxAge}`,
		isSecureEnv() ? "Secure" : "",
		"SameSite=Strict",
	].filter(Boolean);
	return parts.join("; ");
}

function getDeleteCookieString(name: string): string {
	return `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; SameSite=Strict`;
}

/**
 * Persist the session JWT as an HttpOnly cookie via the server endpoint.
 *
 * C1 fix: previously this wrote the JWT via `document.cookie`, which is
 * readable by any JS on the page (XSS exfiltration risk). The canonical
 * cookie path is now `POST /api/auth/session/cookie`, which emits a real
 * `Set-Cookie: __Host-oma_session=<jwt>; HttpOnly; Secure; SameSite=Strict`
 * header in production. The JWT is ALSO returned in the response body so
 * the SPA can keep it in React state / localStorage for `Authorization:
 * Bearer` headers (see `lib/api/client.ts` for the consumer).
 *
 * The `maxAgeDays` parameter is accepted for backwards compatibility with
 * the previous call sites but is ignored — the server-side endpoint uses
 * a 24h Max-Age that matches the JWT's server-side expiry.
 */
export function setSessionCookie(token: string, _maxAgeDays = 7): void {
	if (!isBrowser()) return;
	// Fire-and-forget: the server endpoint sets the HttpOnly cookie. We do
	// NOT await because callers (wallet-provider, account-login-modal) want
	// to navigate / reload immediately after auth succeeds. A failed POST
	// surfaces as a 401 on the next API call — same UX as before.
	void fetch("/api/auth/session/cookie", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token }),
		credentials: "same-origin",
		// Keepalive so the request survives a navigation triggered immediately
		// after (e.g. window.location.reload() in the login modal).
		keepalive: true,
	}).catch(() => {
		// Cookie write failed — the next /api/* request will 401 and the
		// wallet-provider will clear local state. No need to surface here.
	});
}

/**
 * Persist the small non-sensitive meta marker that `wallet-provider.tsx` reads
 * to populate `isAuthenticated`. Keeping this in a SEPARATE cookie from the
 * JWT means we can rotate / clear the JWT without losing the auth-method
 * hint used by the UI.
 */
export function setSessionMetaCookie(meta: SessionMeta, maxAgeDays = 7): void {
	if (!isBrowser()) return;
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getClientCookieString(
		SESSION_META_COOKIE_NAME,
		JSON.stringify(meta),
		maxAgeDays,
	);
}

export function getSessionToken(): string | null {
	if (!isBrowser()) return null;

	// C1 fix: the session cookie is now HttpOnly, so this returns null
	// when the canonical cookie is set. Callers that need the JWT for
	// `Authorization: Bearer ...` headers should source it from the
	// /v1/auth/* response body (kept in React state / localStorage by the
	// caller), not from `document.cookie`. This function is preserved for
	// the `buildAuthHeaders` consumers that look it up here; it will return
	// null in production now and callers should fall back to the in-memory
	// copy if they need to attach the header.
	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, ...valueParts] = cookie.trim().split("=");
		if (name === SESSION_COOKIE_NAME) {
			return decodeURIComponent(valueParts.join("="));
		}
	}
	return null;
}

export function deleteSessionCookie(): void {
	if (!isBrowser()) return;
	// C1 fix: the HttpOnly session cookie is cleared server-side by the
	// canonical /api/auth/logout route. Here we just clear the JS-readable
	// meta cookie and any stale non-HttpOnly legacy cookie that an older
	// build may have left behind.
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getDeleteCookieString(SESSION_META_COOKIE_NAME);
	// Defensive: also clear the legacy non-prefixed name in case a previous
	// deployment wrote it. Doesn't hurt if the cookie doesn't exist.
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getDeleteCookieString("oma_session");
}

export function setCsrfTokenCookie(token: string): void {
	if (!isBrowser()) return;
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getClientCookieString(CSRF_COOKIE_NAME, token, 1);
}

export function getCsrfToken(): string | null {
	if (!isBrowser()) return null;

	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, ...valueParts] = cookie.trim().split("=");
		if (name === CSRF_COOKIE_NAME) {
			return decodeURIComponent(valueParts.join("="));
		}
	}
	return null;
}

/**
 * Build authorization headers for API requests.
 * Returns an object with Authorization header if a session token exists.
 */
/**
 * Server-side: resolve the JWT from the HttpOnly session cookie. The browser
 * cannot read it via `document.cookie`, so API proxy routes must read it via
 * `cookies()` from `next/headers` and forward it as `Authorization: Bearer <jwt>`.
 *
 * The env-dependent name (`__Host-oma_session` in production, `oma_session`
 * in dev) is sourced from this module so logout, the session-cookie endpoint,
 * and proxy routes all agree on the same key.
 */
export async function readSessionToken(): Promise<string | null> {
	const { cookies } = await import("next/headers");
	const cookieStore = await cookies();
	return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function buildAuthHeaders(
	additional?: Record<string, string>,
): Record<string, string> {
	const headers: Record<string, string> = { ...additional };
	const token = getSessionToken();
	if (token) {
		headers.Authorization = `Bearer ${token}`;
	}
	return headers;
}
