/**
 * Cookie management utilities.
 * JWT is HttpOnly via `POST /api/auth/session/cookie`; also returned in `/v1/auth/*` body for in-memory `Authorization: Bearer`.
 * Production uses `__Host-` prefix for subdomain takeover protection.
 */

export const SESSION_COOKIE_NAME = isSecureEnv() ? "__Host-oma_session" : "oma_session";
const SESSION_META_COOKIE_NAME = "oma_session_meta";
const CSRF_COOKIE_NAME = isSecureEnv() ? "__Host-csrf_token" : "csrf_token";

interface SessionMeta { authMethod: string; }

function isBrowser(): boolean { return typeof window !== "undefined"; }
function isSecureEnv(): boolean { return process.env.NODE_ENV === "production"; }

function getClientCookieString(name: string, value: string, maxAgeDays: number): string {
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

/** Persist session JWT via server endpoint (HttpOnly). maxAgeDays ignored — server uses 24h. */
export function setSessionCookie(token: string, _maxAgeDays = 7): void {
	if (!isBrowser()) return;
	void fetch("/api/auth/session/cookie", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ token }),
		credentials: "same-origin",
		keepalive: true,
	}).catch(() => {});
}

/** Persist non-sensitive meta marker for `isAuthenticated` UI state. */
export function setSessionMetaCookie(meta: SessionMeta, maxAgeDays = 7): void {
	if (!isBrowser()) return;
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getClientCookieString(SESSION_META_COOKIE_NAME, JSON.stringify(meta), maxAgeDays);
}

/** Returns null in production (HttpOnly). Callers should use in-memory JWT from `/v1/auth/*` response. */
export function getSessionToken(): string | null {
	if (!isBrowser()) return null;
	const cookies = document.cookie.split(";");
	for (const cookie of cookies) {
		const [name, ...valueParts] = cookie.trim().split("=");
		if (name === SESSION_COOKIE_NAME) return decodeURIComponent(valueParts.join("="));
	}
	return null;
}

export function deleteSessionCookie(): void {
	if (!isBrowser()) return;
	// biome-ignore lint/suspicious/noDocumentCookie: cookie utility
	document.cookie = getDeleteCookieString(SESSION_META_COOKIE_NAME);
	// Also clear legacy non-prefixed name.
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
		if (name === CSRF_COOKIE_NAME) return decodeURIComponent(valueParts.join("="));
	}
	return null;
}

/** Server-side: read JWT from HttpOnly cookie for API proxy routes. */
export async function readSessionToken(): Promise<string | null> {
	const { cookies } = await import("next/headers");
	const cookieStore = await cookies();
	return cookieStore.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export function buildAuthHeaders(additional?: Record<string, string>): Record<string, string> {
	const headers: Record<string, string> = { ...additional };
	const token = getSessionToken();
	if (token) headers.Authorization = `Bearer ${token}`;
	return headers;
}