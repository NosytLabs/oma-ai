/**
 * Browser-only session helpers.
 *
 * Server-side code (route handlers, server components) should import
 * `getAuthToken` from `@/lib/cookies` (which uses `next/headers`) — but
 * client components cannot import from `next/headers`. This module is
 * the client-safe counterpart.
 *
 *   - `getBrowserAuthToken()` reads `document.cookie` for the first
 *     matching session cookie value (used by SSE fetch fallbacks).
 *   - `buildAuthHeaders()` adds `X-Session-Present: 1` when a session
 *     cookie is present, so the backend can short-circuit
 *     unauthenticated traffic without the Better Auth round-trip.
 *     The cookie itself rides along automatically via
 *     `credentials: "include"`.
 */

const COOKIE_NAMES = [
  "oma.session_token",
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  // Legacy / fallbacks for older browser cookies — accepted but never written.
  "oma_api_key",
];

export function getBrowserAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const all = document.cookie.split("; ");
  for (const name of COOKIE_NAMES) {
    const entry = all.find((c) => c.startsWith(`${name}=`));
    if (entry) {
      try {
        return decodeURIComponent(entry.slice(name.length + 1));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function buildAuthHeaders(
  extra: Record<string, string> = {},
): Record<string, string> {
  const headers: Record<string, string> = { ...extra };
  if (typeof document !== "undefined") {
    const hasCookie = COOKIE_NAMES.some((n) =>
      document.cookie.split("; ").some((c) => c.startsWith(`${n}=`)),
    );
    if (hasCookie) headers["X-Session-Present"] = "1";
  }
  return headers;
}