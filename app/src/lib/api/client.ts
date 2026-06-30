import { DEFAULT_API_URL } from "@/lib/config";

/**
 * Core HTTP client for the oma-ai frontend.
 *
 * - In the browser: `/api/*` paths go through the Next.js server (same origin)
 *   so the rewrite proxy handles forwarding to the backend. This ensures cookies
 *   (CSRF, session) are set on the same origin as the page.
 * - Non-`/api` paths (e.g. `/v1/models`) go directly to the backend.
 * - On the server (SSR): uses `NEXT_PUBLIC_API_URL` to reach the backend
 *   directly.
 */
function getBaseUrl(path: string): string {
	// Browser: /api/* paths use relative URL → goes through Next.js proxy
	if (typeof window !== "undefined" && path.startsWith("/api")) return "";
	return DEFAULT_API_URL;
}

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
const DEFAULT_TTL = 60_000; // 60s default
export const STALE_TTL = 300_000; // 5 min for stale-while-revalidate
const REQUEST_TIMEOUT_MS = 30_000;

/**
 * Custom error class for API errors with proper typing.
 */
export class ApiError extends Error {
	status: number;
	body: unknown;
	isNetworkError: boolean;

	constructor(
		status: number,
		message: string,
		body?: unknown,
		isNetworkError = false,
	) {
		super(`[${status}] ${message}`);
		this.name = "ApiError";
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
		super(
			"Backend server is not running. Please ensure the API server is started on port 3001.",
		);
		this.name = "BackendUnavailableError";
	}
}

/**
 * True when an error from the API client represents an expired/invalid
 * session (HTTP 401/403 from a Bearer-authenticated endpoint). The
 * playground uses this to surface a one-time toast on session expiry
 * instead of letting the credits pill silently disappear.
 */
export function isAuthError(err: unknown): boolean {
	if (err instanceof ApiError) {
		return err.status === 401 || err.status === 403;
	}
	// Some callers throw raw Errors with a `status` property when the
	// request helper isn't on the path — accept those too.
	const anyErr = err as { status?: number } | null | undefined;
	return anyErr?.status === 401 || anyErr?.status === 403;
}

/** Get a cached entry by key. Returns null if missing or beyond STALE_TTL. */
export function getCached<T>(key: string): T | null {
	const entry = cache.get(key) as CacheEntry<T> | undefined;
	if (!entry) return null;
	const age = Date.now() - entry.timestamp;
	if (age > STALE_TTL) {
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
 * Options accepted by `request()`. Extends the standard `RequestInit` with
 * a `responseType` discriminator so callers can ask for a `Blob` (CSV/JSON
 * export downloads) instead of the default JSON parse.
 */
export interface RequestOptions extends RequestInit {
	/**
	 * How to interpret a successful response body.
	 * - `'json'` (default) — parse the body as JSON and return it as `T`.
	 * - `'blob'` — return the body as a `Blob` (for binary downloads such as
	 *   CSV/JSON exports). The caller casts `T` to `Blob`.
	 *
	 * Error responses are still parsed as JSON when possible so we can
	 * surface a typed `ApiError` regardless of the requested response type.
	 */
	responseType?: "json" | "blob";
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
	opts: RequestOptions = {},
): Promise<T> {
	// Lightweight dedup key: method + path + first 200 chars of body (if any).
	// Full JSON.stringify is wasteful for dedup — we only need enough to distinguish
	// different request payloads.
	const bodyPrefix = opts.body ? JSON.stringify(opts.body).slice(0, 200) : "";
	const responseType = opts.responseType ?? "json";
	const requestKey = `${opts.method || "GET"}:${path}:${bodyPrefix}`;

	if (pendingRequests.has(requestKey)) {
		return pendingRequests.get(requestKey) as Promise<T>;
	}

	const headers: Record<string, string> = {
		"Content-Type": "application/json",
		Accept: "application/json",
		...(opts.headers as Record<string, string> | undefined),
	};

	if (typeof window !== "undefined") {
		try {
			const sessionCookie = document.cookie
				.split("; ")
				.find((c) => c.startsWith("oma_session="));
			if (sessionCookie) {
				const token = sessionCookie.slice("oma_session=".length);
				if (token) headers.Authorization = `Bearer ${token}`;
			}
		} catch {
			// SSR or cookie access denied — skip auth header
		}

		// Inject x-csrf-token for state-changing requests. The server sets the
		// csrf_token cookie (now JS-readable in dev) and expects the same value
		// echoed in x-csrf-token header. GET requests don't need it.
		const method = (opts.method || "GET").toUpperCase();
		if (method !== "GET" && method !== "HEAD") {
			try {
				const csrfCookie = document.cookie
					.split("; ")
					.find((c) => c.startsWith("csrf_token="));
				if (csrfCookie && !headers["x-csrf-token"]) {
					const token = decodeURIComponent(csrfCookie.split("=")[1]);
					if (token) headers["x-csrf-token"] = token;
				}
			} catch {
				// Cookie access denied — skip
			}
		}
	}

	const controller = new AbortController();
	const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

	const { responseType: _ignored, ...fetchOpts } = opts;

	const fetchPromise = (async () => {
		try {
			const res = await fetch(`${getBaseUrl(path)}${path}`, {
				...fetchOpts,
				headers,
				signal: controller.signal,
			});

			clearTimeout(timeoutId);

			if (!res.ok) {
				let message = res.statusText;
				let body: unknown;
				try {
					body = await res.json();
					if (body && typeof body === "object" && "error" in body) {
						const errVal = (body as { error: unknown }).error;
						if (typeof errVal === "string") {
							message = errVal;
						} else if (
							errVal &&
							typeof errVal === "object" &&
							"message" in errVal
						) {
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
			if (responseType === "blob") return (await res.blob()) as T;
			return (await res.json()) as T;
		} catch (error) {
			clearTimeout(timeoutId);
			if (error instanceof TypeError && error.message.includes("fetch")) {
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
