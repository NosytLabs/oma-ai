/**
 * Cookie management utilities.
 *
 * Important: cookies written via `document.cookie` in the browser CANNOT carry
 * the `HttpOnly` attribute. When a string containing `HttpOnly` is assigned to
 * `document.cookie`, the browser silently discards the entire Set-Cookie value
 * and the cookie is never set. (HttpOnly is a server-side flag that must be
 * emitted in a real `Set-Cookie` response header.)
 *
 * For this app, the JWT is always exchanged via `document.cookie` from the
 * client after `/v1/auth/account/*` returns `{ token }`, so the `oma_session`
 * cookie here is intentionally NOT HttpOnly. The real XSS hardening is to
 * keep the JWT short-lived and rely on standard CSP headers.
 */

export const SESSION_COOKIE_NAME = "oma_session";
const SESSION_META_COOKIE_NAME = "oma_session_meta";
const CSRF_COOKIE_NAME = "csrf_token";

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
 * Persist the session JWT in a client-readable cookie. The server-side
 * middleware (`app/src/middleware.ts`) reads this same cookie to verify the
 * user on protected routes, and the API client (`app/src/lib/api/client.ts`)
 * reads it to attach `Authorization: Bearer ...` to outbound requests.
 *
 * The actual JWT is delivered by the Hono backend in the response body of
 * `/v1/auth/account/create` and `/v1/auth/account/login`. The server does
 * NOT emit a `Set-Cookie` header (no /api proxy in Next.js routes), so the
 * client must persist the token itself.
 */
export function setSessionCookie(token: string, maxAgeDays = 7): void {
	if (!isBrowser()) return;
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getClientCookieString(
		SESSION_COOKIE_NAME,
		token,
		maxAgeDays,
	);
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
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getDeleteCookieString(SESSION_COOKIE_NAME);
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getDeleteCookieString(SESSION_META_COOKIE_NAME);
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
