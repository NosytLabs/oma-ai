"use client";

import { useCallback, useEffect, useState } from "react";
import type { DailyQuota } from "@/lib/chat-stream";
import { DEFAULT_API_URL } from "@/lib/config";
import {
	freeLeftLabel,
	GUEST_DAILY_LIMIT_DEFAULT,
	quotaFromServer,
	readStoredGuestQuota,
	writeStoredGuestQuota,
	type GuestQuota,
} from "@/lib/guest-daily-quota";

export interface UseGuestQuotaOptions {
	isAuthenticated: boolean;
	/** Fired when the user hits the wall (gatedSend / 429). Callers open their modal. */
	onExhausted?: () => void;
}

export interface UseGuestQuotaResult {
	guestQuota: GuestQuota | null;
	/** Wire the stream hook's onDailyQuota to this to mirror server quota. */
	onDailyQuota: (info: DailyQuota) => void;
	/**
	 * Block send only when server (or cached) remaining is known-zero.
	 * Fires onExhausted instead of optimistically decrementing — failed/429
	 * sends must not burn the local counter ahead of the server.
	 */
	allowGuestSend: () => boolean;
}

/**
	* Guest free-tier daily quota for website chat. Server is the source of
	* truth (X-DailyLimit-* headers + 429 body); localStorage is a soft cache
	* hydrated on load and refreshed from GET /v1/usage/today.
	*/
export function useGuestQuota(opts: UseGuestQuotaOptions): UseGuestQuotaResult {
	const [guestQuota, setGuestQuota] = useState<GuestQuota | null>(null);

	const applyGuestQuota = useCallback(
		(next: GuestQuota) => {
			setGuestQuota(next);
			writeStoredGuestQuota(next);
		},
		[],
	);

	// Hydrate from localStorage, then refresh from GET /v1/usage/today.
	useEffect(() => {
		if (opts.isAuthenticated) {
			setGuestQuota(null);
			return;
		}
		const cached = readStoredGuestQuota();
		if (cached) setGuestQuota(cached);

		let cancelled = false;
		(async () => {
			try {
				const res = await fetch(`${DEFAULT_API_URL}/v1/usage/today`, {
					credentials: "include",
					headers: { Accept: "application/json" },
				});
				if (!res.ok || cancelled) return;
				const body = (await res.json()) as {
					remaining?: number;
					limit?: number;
					used?: number;
				};
				if (cancelled) return;
				applyGuestQuota(quotaFromServer(body));
			} catch {
				/* offline — keep cache */
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [opts.isAuthenticated, applyGuestQuota]);

	const onDailyQuota = useCallback(
		(info: DailyQuota) => {
			if (opts.isAuthenticated) return;
			applyGuestQuota(
				quotaFromServer({
					remaining: info.remaining,
					limit: info.limit,
					code: info.exhausted ? "daily_limit_exceeded" : undefined,
				}),
			);
			if (info.exhausted || info.remaining <= 0) {
				opts.onExhausted?.();
			}
		},
		[applyGuestQuota, opts.isAuthenticated, opts.onExhausted],
	);

	const allowGuestSend = useCallback(() => {
		if (opts.isAuthenticated) return true;
		const left = freeLeftLabel(guestQuota, GUEST_DAILY_LIMIT_DEFAULT);
		if (guestQuota != null && left <= 0) {
			opts.onExhausted?.();
			return false;
		}
		// Do NOT optimistically increment — failed/429 sends must not
		// burn the local counter ahead of the server.
		return true;
	}, [guestQuota, opts.isAuthenticated, opts.onExhausted]);

	return { guestQuota, onDailyQuota, allowGuestSend };
}