/**
 * Core HTTP client for the oma-ai frontend.
 *
 * - In the browser: uses `NEXT_PUBLIC_API_URL` directly to reach the Hono
 *   backend. The Next.js `/api/v1/chat/completions` proxy is intentionally
 *   disabled by default (CHAT_PROXY_ENABLED=false) and is only used in
 *   self-hosted deployments that need the proxy hop for same-origin cookies.
 * - On the server (SSR): uses `NEXT_PUBLIC_API_URL` (or `OPENAI_BASE_URL` for
 *   legacy reasons) to reach the backend directly.
 */
const API = (process.env.NEXT_PUBLIC_API_URL || process.env.OPENAI_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');

/**
 * Request deduplication — prevents duplicate concurrent requests.
 * Keyed by method + path + first 64 chars of body JSON.
 */
const pendingRequests = new Map<string, Promise<unknown>>();

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

/** Response cache with TTL support. Used for /v1/balance, /v1/models. */
const cache = new Map<string, CacheEntry<unknown>>();
export const DEFAULT_TTL = 60_000;        // 60s default
export const STALE_TTL = 300_000;         // 5 min for stale-while-revalidate
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Custom error class for API errors with proper typing.
 */
export class ApiError extends Error {
  status: number;
  body: unknown;
  isNetworkError: boolean;

  constructor(status: number, message: string, body?: unknown, isNetworkError = false) {
    super(`[${status}] ${message}`);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
    this.isNetworkError = isNetworkError;
  }
}

/**
 * Thrown when the browser can't reach the backend at all (network error).
 * Different from ApiError — backend being down is not the same as a 500.
 */
export class BackendUnavailableError extends Error {
  constructor() {
    super('Backend server is not running. Please ensure the API server is started on port 3001.');
    this.name = 'BackendUnavailableError';
  }
}

/** Get a cached entry by key. Returns null if missing or expired. */
export function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  const age = Date.now() - entry.timestamp;
  if (age > entry.ttl) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

/** Set a cache entry. Defaults to DEFAULT_TTL (60s). */
export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
  cache.set(key, { data, timestamp: Date.now(), ttl });
}

/** Invalidate cache entries by substring match, or clear everything. */
export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}

/**
 * Core request function.
 * - Deduplicates in-flight requests
 * - 30s timeout via AbortController
 * - Injects `Authorization: Bearer <sessionToken>` from cookies (browser only)
 * - Throws `ApiError` on non-2xx, `BackendUnavailableError` on network failure
 */
export async function request<T>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const bodyHash = opts.body ? JSON.stringify(opts.body) : '';
  const requestKey = `${opts.method || 'GET'}:${path}:${bodyHash.slice(0, 64)}`;

  if (pendingRequests.has(requestKey)) {
    return pendingRequests.get(requestKey) as Promise<T>;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };

  if (typeof window !== 'undefined') {
    try {
      const sessionCookie = document.cookie
        .split('; ')
        .find((c) => c.startsWith('oma_session='));
      if (sessionCookie) {
        const token = sessionCookie.split('=')[1];
        if (token) headers['Authorization'] = `Bearer ${token}`;
      }
    } catch {
      // SSR or cookie access denied — skip auth header
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const fetchPromise = (async () => {
    try {
      const res = await fetch(`${API}${path}`, {
        ...opts,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        let message = res.statusText;
        let body: unknown;
        try {
          body = await res.json();
          if (body && typeof body === 'object' && 'error' in body) {
            const errVal = (body as { error: unknown }).error;
            if (typeof errVal === 'string') {
              message = errVal;
            } else if (errVal && typeof errVal === 'object' && 'message' in errVal) {
              message = String((errVal as { message: unknown }).message);
            } else {
              message = res.statusText;
            }
          }
        } catch {
          // Non-JSON body — fall back to status text
        }
        throw new ApiError(res.status, message, body);
      }

      if (res.status === 204) return undefined as T;
      return (await res.json()) as T;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new BackendUnavailableError();
      }
      if (error instanceof ApiError) throw error;
      throw error;
    }
  })();

  pendingRequests.set(requestKey, fetchPromise);

  try {
    return await fetchPromise;
  } finally {
    pendingRequests.delete(requestKey);
  }
}
