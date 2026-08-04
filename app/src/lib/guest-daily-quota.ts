/**
 * Guest free-tier daily quota helpers for website chat.
 *
 * Server is source of truth (X-DailyLimit-* headers + 429 body).
 * localStorage is a soft cache only — never incremented on failed sends.
 */

export const GUEST_DAILY_LIMIT_DEFAULT = 20;
export const GUEST_QUOTA_STORAGE_KEY = "oma-guest-msgs";

export type GuestQuota = {
	/** Messages remaining today (0 when exhausted). */
	remaining: number;
	/** Daily cap (anonymous default 20). */
	limit: number;
	/** ISO date YYYY-MM-DD the values apply to. */
	date: string;
};

export type ServerQuotaPayload = {
	remaining?: number | null;
	limit?: number | null;
	used?: number | null;
	code?: string | null;
};

export function todayUtc(): string {
	return new Date().toISOString().slice(0, 10);
}

/** Build quota from /v1/usage/today JSON or 429 error body. */
export function quotaFromServer(
	payload: ServerQuotaPayload,
	fallbackLimit = GUEST_DAILY_LIMIT_DEFAULT,
): GuestQuota {
	const limit =
		typeof payload.limit === "number" && Number.isFinite(payload.limit) && payload.limit > 0
			? Math.floor(payload.limit)
			: fallbackLimit;

	let remaining: number;
	if (typeof payload.remaining === "number" && Number.isFinite(payload.remaining)) {
		remaining = Math.max(0, Math.floor(payload.remaining));
	} else if (typeof payload.used === "number" && Number.isFinite(payload.used)) {
		remaining = Math.max(0, limit - Math.floor(payload.used));
	} else if (payload.code === "daily_limit_exceeded") {
		remaining = 0;
	} else {
		remaining = limit;
	}

	return { remaining, limit, date: todayUtc() };
}

/** Parse X-DailyLimit-Remaining / X-DailyLimit-Limit response headers. */
export function quotaFromHeaders(
	headers: Headers,
	fallbackLimit = GUEST_DAILY_LIMIT_DEFAULT,
): GuestQuota | null {
	const rem = headers.get("X-DailyLimit-Remaining");
	if (rem == null || rem === "") return null;
	const remaining = Number(rem);
	if (!Number.isFinite(remaining)) return null;
	const limRaw = headers.get("X-DailyLimit-Limit");
	const limit =
		limRaw != null && limRaw !== "" && Number.isFinite(Number(limRaw))
			? Math.max(1, Math.floor(Number(limRaw)))
			: fallbackLimit;
	return {
		remaining: Math.max(0, Math.floor(remaining)),
		limit,
		date: todayUtc(),
	};
}

export function readStoredGuestQuota(): GuestQuota | null {
	if (typeof localStorage === "undefined") return null;
	try {
		const raw = localStorage.getItem(GUEST_QUOTA_STORAGE_KEY);
		if (!raw) return null;
		const parsed = JSON.parse(raw) as {
			date?: string;
			count?: number;
			remaining?: number;
			limit?: number;
		};
		const date = todayUtc();
		if (parsed.date !== date) return null;
		const limit =
			typeof parsed.limit === "number" && parsed.limit > 0
				? parsed.limit
				: GUEST_DAILY_LIMIT_DEFAULT;
		if (typeof parsed.remaining === "number" && Number.isFinite(parsed.remaining)) {
			return {
				remaining: Math.max(0, Math.floor(parsed.remaining)),
				limit,
				date,
			};
		}
		// Legacy shape: { date, count } where count = messages used
		if (typeof parsed.count === "number" && Number.isFinite(parsed.count)) {
			return {
				remaining: Math.max(0, limit - Math.floor(parsed.count)),
				limit,
				date,
			};
		}
		return null;
	} catch {
		return null;
	}
}

export function writeStoredGuestQuota(quota: GuestQuota): void {
	if (typeof localStorage === "undefined") return;
	try {
		localStorage.setItem(
			GUEST_QUOTA_STORAGE_KEY,
			JSON.stringify({
				date: quota.date,
				remaining: quota.remaining,
				limit: quota.limit,
				// Keep legacy `count` for older readers
				count: Math.max(0, quota.limit - quota.remaining),
			}),
		);
	} catch {
		/* ignore quota */
	}
}

export function freeLeftLabel(quota: GuestQuota | null, fallbackLimit = GUEST_DAILY_LIMIT_DEFAULT): number {
	if (!quota) return fallbackLimit;
	return Math.max(0, quota.remaining);
}
