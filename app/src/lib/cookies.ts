/**
 * Better Auth cookie helpers — server-side only.
 *
 * Imports `next/headers`, which is only valid in Server Components /
 * Route Handlers. Client code should import from `@/lib/browser-cookies`
 * instead.
 */
import { cookies } from "next/headers";
import type { ReadonlyRequestCookies } from "next/dist/server/web/spec-extension/adapters/request-cookies";

const COOKIE_NAMES = [
  "oma.session_token",
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  // Legacy / fallbacks for older browser cookies — accepted but never written.
  "oma_api_key",
];

/**
 * Read the raw session token cookie set by Better Auth. The token is
 * opaque — Better Auth signs/validates on the server. Caller is
 * expected to pass it to `auth.api.getSession({ headers })` for
 * server-side validation.
 *
 * Returns null when there is no session cookie present.
 */
export async function getAuthToken(): Promise<string | null> {
  const jar = await cookies();
  for (const name of COOKIE_NAMES) {
    const value = jar.get(name)?.value;
    if (value) return value;
  }
  return null;
}

/** Sync variant for places where the request-scoped cookies() cannot be awaited. */
export function getAuthTokenFromCookieJar(jar: ReadonlyRequestCookies): string | null {
  for (const name of COOKIE_NAMES) {
    const value = jar.get(name)?.value;
    if (value) return value;
  }
  return null;
}