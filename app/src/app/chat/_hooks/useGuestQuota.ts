"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { DailyQuota } from "@/lib/chat-stream";
import {
	freeLeftLabel,
	GUEST_DAILY_LIMIT_DEFAULT,
	quotaFromServer,
	readStoredGuestQuota,
	writeStoredGuestQuota,
	type GuestQuota,
} from "@/lib/guest-daily-quota";

interface UseGuestQuotaOptions {
	isAuthenticated: boolean;
	/** Fired when the user hits the wall (gatedSend / 429). Callers open their modal. */
	onExhausted?: () => void;
}

/**
 * The guest quota machine.
 *
 * The quota used to be a single `GuestQuota | null`, where `null` meant three
 * different things: "signed in, so no guest quota applies", "still loading",
 * and "yesterday's quota rolled over". A caller could not tell them apart,
 * so the UI showed the same "Free daily allowance" text for a signed-in
 * visitor, a visitor whose quota was still being fetched, and a visitor
 * whose free allowance had just reset.
 *
 * The state is explicit now, and `guestQuota` stays as a derived view of it
 * so every existing call site keeps working unchanged.
 */
type GuestQuotaState =
	/** The visitor is signed in: the anonymous daily quota does not apply. */
	| { kind: "not-applicable" }
	/** A guest visitor whose quota is not known yet. */
	| { kind: "hydrating" }
	/** The guest quota is known. */
	| { kind: "ready"; quota: GuestQuota }
	/** The guest quota was known and its day has rolled over. */
	| { kind: "expired" };

interface UseGuestQuotaResult {
	/** Derived view of the state: the quota when it is known, otherwise null. */
	guestQuota: GuestQuota | null;
	/** The explicit state, for UI that needs to tell the cases apart. */
	quotaState: GuestQuotaState;
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
 * A short label for the guest allowance.
 *
 * The label used to be one line with a `guestQuota ? ... : ...` ternary, so
 * "not known yet" and "reset at midnight" rendered identically. Each state
 * now says what it means.
 */
export function guestQuotaLabel(state: GuestQuotaState): string {
	switch (state.kind) {
		case "ready":
			return `${state.quota.remaining} free left`;
		case "expired":
			return "Free allowance resets at midnight";
		case "hydrating":
		case "not-applicable":
			return "Free daily allowance";
	}
}

/**
 * Guest free-tier daily quota for website chat. Server is the source of
 * truth (X-DailyLimit-* headers + 429 body); localStorage is a soft cache
 * hydrated on load and refreshed from GET /v1/usage/today.
 */
export function useGuestQuota(opts: UseGuestQuotaOptions): UseGuestQuotaResult {
	const [quotaState, setQuotaState] = useState<GuestQuotaState>({
		kind: "hydrating",
	});

	const applyGuestQuota = useCallback(
		(next: GuestQuota) => {
			setQuotaState({ kind: "ready", quota: next });
			writeStoredGuestQuota(next);
		},
		[],
	);

	// Hydrate from localStorage, then refresh from GET /v1/usage/today.
	useEffect(() => {
		if (opts.isAuthenticated) {
			setQuotaState({ kind: "not-applicable" });
			return;
		}
		const cached = readStoredGuestQuota();
		if (cached) setQuotaState({ kind: "ready", quota: cached });

		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/v1/usage/today", {
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

	// Expire the visible cache as well as the send gate when a tab remains
	// mounted overnight. The next request obtains the new day's server quota.
	// The state records "expired" rather than going back to "unknown", so the
	// UI can say the allowance reset instead of pretending it is still loading.
	const guestQuota = quotaState.kind === "ready" ? quotaState.quota : null;
	useEffect(() => {
		if (opts.isAuthenticated || !guestQuota) return;
		const resetAt = Date.parse(`${guestQuota.date}T00:00:00Z`) + 86_400_000;
		const timer = window.setTimeout(
			() => setQuotaState({ kind: "expired" }),
			Math.max(0, resetAt - Date.now()),
		);
		return () => window.clearTimeout(timer);
	}, [guestQuota, opts.isAuthenticated]);

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

	return useMemo(
		() => ({ guestQuota, quotaState, onDailyQuota, allowGuestSend }),
		[guestQuota, quotaState, onDailyQuota, allowGuestSend],
	);
}
