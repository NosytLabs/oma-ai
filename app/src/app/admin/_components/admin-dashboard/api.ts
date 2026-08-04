/**
 * Admin dashboard fetch helpers and display formatters.
 */

// Keep admin requests same-origin so the HttpOnly Better Auth cookie is
// included in local development and production alike. The Next catch-all
// proxy forwards `/api/v1/*` to the Hono backend.
export const ADMIN_BASE = "/api";

export async function adminFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${ADMIN_BASE}${path}`, {
		credentials: "include",
		headers: {
			"Content-Type": "application/json",
			...(init?.headers ?? {}),
		},
		...init,
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status}: ${text || res.statusText}`);
	}
	return res.json() as Promise<T>;
}

export async function polarFetch<T>(path: string): Promise<T> {
	const res = await fetch(`${ADMIN_BASE}${path}`, {
		credentials: "include",
		headers: { "Content-Type": "application/json" },
	});
	if (!res.ok) {
		const text = await res.text().catch(() => "");
		throw new Error(`${res.status}: ${text || res.statusText}`);
	}
	return res.json() as Promise<T>;
}

export function centsToDollars(cents: number) {
	if (!isFinite(cents)) return "$0.00";
	return `$${(cents / 100).toLocaleString(undefined, {
		minimumFractionDigits: 2,
		maximumFractionDigits: 4,
	})}`;
}

export function formatTokens(n: number) {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
	return String(n);
}

export function timeAgo(iso: string) {
	const ms = Date.now() - new Date(iso).getTime();
	if (ms < 60_000) return `${Math.floor(ms / 1000)}s ago`;
	if (ms < 3_600_000) return `${Math.floor(ms / 60_000)}m ago`;
	if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)}h ago`;
	return `${Math.floor(ms / 86_400_000)}d ago`;
}
