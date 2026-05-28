/**
 * Cookie management utilities optimized for security and performance.
 * Implements HttpOnly, Secure, SameSite cookies for session management.
 */

// Cookie configuration constants
export const SESSION_COOKIE_NAME = 'oma_session';
export const SESSION_META_COOKIE_NAME = 'oma_session_meta';
export const CSRF_COOKIE_NAME = 'csrf_token';

export interface SessionMeta {
  authMethod: string;
}

/**
 * Check if we're running in a browser environment.
 * Essential for SSR safety.
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

/**
 * Build a secure cookie string with proper attributes.
 * - HttpOnly: Prevents XSS from accessing cookies
 * - Secure: Only sent over HTTPS in production
 * - SameSite: CSRF protection
 */
function getSecureCookieString(name: string, value: string, maxAgeDays: number): string {
  const expires = new Date(Date.now() + maxAgeDays * 86400000).toUTCString();
  const maxAge = maxAgeDays * 86400;
  const isSecure = process.env.NODE_ENV === 'production';
  
  // Build cookie with security attributes
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `expires=${expires}`,
    `path=/`,
    `max-age=${maxAge}`,
    'HttpOnly',
    isSecure ? 'Secure' : '', // Only Secure in production
    'SameSite=Strict', // Strict for maximum CSRF protection
  ].filter(Boolean);
  
  return parts.join('; ');
}

/**
 * Build a cookie deletion string.
 * Sets expires to epoch to remove cookie.
 */
function getDeleteCookieString(name: string): string {
  return `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; HttpOnly; Secure; SameSite=Strict`;
}

/**
 * Set session cookie with SSR safety check.
 */
export function setSessionCookie(token: string, maxAgeDays = 7): void {
  if (!isBrowser()) return;
  const cookieStr = getSecureCookieString(SESSION_COOKIE_NAME, token, maxAgeDays);
  document.cookie = cookieStr;
}

/**
 * Set session metadata cookie.
 */
export function setSessionMetaCookie(meta: SessionMeta, maxAgeDays = 7): void {
  if (!isBrowser()) return;
  const cookieStr = getSecureCookieString(SESSION_META_COOKIE_NAME, JSON.stringify(meta), maxAgeDays);
  document.cookie = cookieStr;
}

/**
 * Get session token with SSR safety.
 * Parses cookie string efficiently.
 */
export function getSessionToken(): string | null {
  if (!isBrowser()) return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === SESSION_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join('='));
    }
  }
  return null;
}

/**
 * Get session metadata with SSR safety.
 */
export function getSessionMeta(): SessionMeta | null {
  if (!isBrowser()) return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === SESSION_META_COOKIE_NAME) {
      try {
        return JSON.parse(decodeURIComponent(valueParts.join('='))) as SessionMeta;
      } catch {
        return null;
      }
    }
  }
  return null;
}

/**
 * Delete session cookies for logout.
 */
export function deleteSessionCookie(): void {
  if (!isBrowser()) return;
  document.cookie = getDeleteCookieString(SESSION_COOKIE_NAME);
  document.cookie = getDeleteCookieString(SESSION_META_COOKIE_NAME);
}

/**
 * Set CSRF token cookie.
 */
export function setCsrfTokenCookie(token: string): void {
  if (!isBrowser()) return;
  const cookieStr = getSecureCookieString(CSRF_COOKIE_NAME, token, 1);
  document.cookie = cookieStr;
}

/**
 * Get CSRF token with SSR safety.
 */
export function getCsrfToken(): string | null {
  if (!isBrowser()) return null;
  
  const cookies = document.cookie.split(';');
  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === CSRF_COOKIE_NAME) {
      return decodeURIComponent(valueParts.join('='));
    }
  }
  return null;
}

/**
 * Clear all session-related cookies.
 */
export function clearAllSessionCookies(): void {
  deleteSessionCookie();
  if (isBrowser()) {
    document.cookie = getDeleteCookieString(CSRF_COOKIE_NAME);
  }
}

/**
 * Check if a stored session exists.
 * Efficient check for auth state.
 */
export function hasStoredSession(): boolean {
  return getSessionToken() !== null;
}
