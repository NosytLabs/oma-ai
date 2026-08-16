import { DEFAULT_API_URL } from "@/lib/config";

/**
	* Core HTTP client for the oma-ai frontend.
	*
	* - In the browser: paths go through the Next.js server (same origin)
	*   so the rewrite proxy handles forwarding to the backend. The
	*   Better Auth session cookie is sent on every same-origin request.
	* - On the server (SSR): uses `NEXT_PUBLIC_API_URL` to reach the
	*   backend directly.
	*/
function toBrowserPath(path: string): string {
		if (path.startsWith("/api")) return path;
		return `/api${path.startsWith("/") ? path : `/${path}`}`;
}

function getBaseUrl(path: string): string {
		if (typeof window !== "undefined" && path.startsWith("/api")) return "";
		return DEFAULT_API_URL;
}

/**
	* Response cache with TTL support. Used for /v1/balance, /v1/models.
	*/
const cache = new Map<string, { data: unknown; timestamp: number; ttl: number }>();
const DEFAULT_TTL = 60_000;
const STALE_TTL = 300_000;
const REQUEST_TIMEOUT_MS = 30_000;

export { STALE_TTL };

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
	*/
export class BackendUnavailableError extends Error {
		constructor() {
				super(
						"Backend server is not reachable. Please ensure the API server is started (configured via NEXT_PUBLIC_API_URL).",
				);
				this.name = "BackendUnavailableError";
		}
}

/**
	* True when an error from the API client represents an expired/invalid
	* session (HTTP 401/403).
	*/
export function isAuthError(err: unknown): boolean {
		if (err instanceof ApiError) {
				return err.status === 401 || err.status === 403;
		}
		const anyErr = err as { status?: number } | null | undefined;
		return anyErr?.status === 401 || anyErr?.status === 403;
}

/**
	* True when an error represents a suspended account (HTTP 403 +
	* code "account_suspended"). Consumed by DashboardErrorBanner.
	*/
export function isSuspendedAccountError(err: unknown): boolean {
		if (err instanceof ApiError) {
				const body = err.body as { error?: { code?: string } } | null | undefined;
				return err.status === 403 && body?.error?.code === "account_suspended";
		}
		const anyErr = err as { status?: number; body?: unknown } | null | undefined;
		if (anyErr?.status === 403 && anyErr.body) {
				const body = anyErr.body as { error?: { code?: string } } | null | undefined;
				return body?.error?.code === "account_suspended";
		}
		return false;
}

/**
	* True when an error represents a payment requirement (HTTP 402).
	* Consumed by DashboardErrorBanner.
	*/
export function isPaymentRequiredError(err: unknown): boolean {
		if (err instanceof ApiError) return err.status === 402;
		const anyErr = err as { status?: number } | null | undefined;
		return anyErr?.status === 402;
}

/**
	* True when an error represents daily quota exhaustion (HTTP 429 +
	* code "daily_limit_exceeded"). Consumed by DashboardErrorBanner.
	*/
export function isQuotaError(err: unknown): boolean {
		if (err instanceof ApiError) {
				const body = err.body as { error?: { code?: string } } | null | undefined;
				return err.status === 429 && body?.error?.code === "daily_limit_exceeded";
		}
		const anyErr = err as { status?: number; body?: unknown } | null | undefined;
		if (anyErr?.status === 429 && anyErr.body) {
				const body = anyErr.body as { error?: { code?: string } } | null | undefined;
				return body?.error?.code === "daily_limit_exceeded";
		}
		return false;
}

/**
	* Extract quota info (remaining, limit, resetMs) from a daily_limit_exceeded
	* error body. Consumed by DashboardErrorBanner.
	*/
export function extractQuotaInfo(
		err: unknown,
): { remaining: number; limit: number; resetMs?: number } | undefined {
		let body: { error?: { remaining?: number; limit?: number; reset_ms?: number } } | null | undefined = null;
		if (err instanceof ApiError) {
				body = err.body as { error?: { remaining?: number; limit?: number; reset_ms?: number } } | null | undefined;
		} else {
				const anyErr = err as { body?: unknown } | null | undefined;
				if (anyErr?.body) body = anyErr.body as { error?: { remaining?: number; limit?: number; reset_ms?: number } } | null | undefined;
		}
		if (!body?.error) return undefined;
		const remaining = typeof body.error.remaining === "number" ? Math.max(0, body.error.remaining) : 0;
		const limit = typeof body.error.limit === "number" && body.error.limit > 0 ? body.error.limit : 20;
		const resetMs = typeof body.error.reset_ms === "number" ? body.error.reset_ms : undefined;
		return { remaining, limit, resetMs };
}

/** Get a cached entry by key. Returns null if missing or beyond STALE_TTL. */
export function getCached<T>(key: string): T | null {
		const entry = cache.get(key);
		if (!entry) return null;
		const age = Date.now() - entry.timestamp;
		if (age > STALE_TTL) {
				cache.delete(key);
				return null;
		}
		return entry.data as T;
}

/** Set a cache entry. Defaults to DEFAULT_TTL (60s). */
export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL): void {
		cache.set(key, { data, timestamp: Date.now(), ttl });
}

/**
	* Options accepted by `request()`. Extends the standard `RequestInit`
	* with a `responseType` discriminator so callers can ask for a `Blob`
	* (CSV/JSON export downloads) instead of the default JSON parse.
	*/
export interface RequestOptions extends RequestInit {
		responseType?: "json" | "blob";
}

/**
	* Core request function. The Better Auth session cookie is sent on
	* every same-origin browser request automatically (HttpOnly, secure
	* when applicable). Server-side requests can pass `Authorization: Bearer`
	* via `opts.headers` if needed.
	*/
export async function request<T>(
		path: string,
		opts: RequestOptions = {},
): Promise<T> {
		const { responseType = "json", ...fetchOpts } = opts;
		const headers: Record<string, string> = {
				"Content-Type": "application/json",
				Accept: "application/json",
				...(fetchOpts.headers as Record<string, string> | undefined),
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
				const resolvedPath =
						typeof window !== "undefined" ? toBrowserPath(path) : path;
				const res = await fetch(`${getBaseUrl(resolvedPath)}${resolvedPath}`, {
						...fetchOpts,
						headers,
						credentials: "same-origin",
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
}
