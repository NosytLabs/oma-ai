"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/lib/hooks/useAuth";
import { api, type BalanceResponse } from "@/lib/api";
import { isAuthError } from "@/lib/api/client";

/**
 * Live credit balance for the playground. Polls `/v1/balance` every 30 s via
 * React Query so the toolbar pill and the low-balance warning stay current
 * without hammering the API. Returns null when unauthenticated and surfaces
 * a `loading` flag for the first paint.
 *
 * On a 401 (expired session / signed-out wallet), surfaces a one-time toast
 * and clears the pill so the user knows to reconnect — previously the pill
 * silently disappeared which looked like a billing bug.
 */
export function useBalance(): {
	balance: BalanceResponse | null;
	loading: boolean;
	refresh: () => Promise<void>;
} {
	const { isAuthenticated, isDemo, isReady } = useAuth();
	const canLoadBalance = isReady && isAuthenticated && !isDemo;
	const toast = useToast();

	const query = useQuery({
		queryKey: ["balance"],
		queryFn: () => api.balance.get(),
		enabled: canLoadBalance,
		// Slower polling (120s) and stop on auth errors — the old 30s +
		// auto-refetch-on-fail created an infinite 401 loop.
		refetchInterval: 120_000,
		staleTime: 120_000,
		retry: false,
	});

	// 401/403: show a single toast then stop hammering the endpoint.
	// The old code called query.refetch() in the effect which caused an
	// infinite loop (refetch → 401 → refetch → ...). We also removed
	// `query` / `toast` from the deps array to prevent a second re-render
	// loop: toast.error() triggers a state change which... *might* create
	// new refs for those objects, re-firing the effect, re-calling toast,
	// etc. Keeping only `query.error` makes the effect fire exactly once
	// per error value.
	const shownRef = useRef(false);
	useEffect(() => {
		if (query.error && isAuthError(query.error) && !shownRef.current) {
			shownRef.current = true;
			toast.error("Session expired — sign in again");
		}
	}, [query.error, toast]);
	useEffect(() => {
		if (canLoadBalance && query.isSuccess) shownRef.current = false;
	}, [canLoadBalance, query.isSuccess]);

	const balance: BalanceResponse | null = canLoadBalance
		? (query.data ?? null)
		: null;
	const loading = canLoadBalance
		? query.isLoading || (query.isFetching && !query.data)
		: false;
	const refresh = async () => {
		await query.refetch();
	};

	return { balance, loading, refresh };
}

/** Convert a BalanceResponse (cents string) to a numeric dollar value. */
export function balanceToDollars(b: BalanceResponse | null): number {
	if (!b) return 0;
	return parseFloat(b.balanceCents ?? "0") / 100;
}

/** Format a dollar value as a compact string for the toolbar pill.
 *  Returns '—' for null/negative so the pill renders something visible
 *  instead of "0.00 cr" when the balance isn't known yet. */
export function formatCreditsShort(value: number | null | undefined): string {
	if (value == null || !Number.isFinite(value) || value < 0) return "—";
	if (value >= 1000)
		return `${(value / 1000).toFixed(value >= 10_000 ? 0 : 1)}k cr`;
	if (value >= 100) return `${value.toFixed(0)} cr`;
	if (value >= 1) return `${value.toFixed(2)} cr`;
	if (value > 0) return `${value.toFixed(4)} cr`;
	return "0 cr";
}
