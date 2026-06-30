"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import {
	type ApiKey,
	api,
	BackendUnavailableError,
	type BalanceResponse,
	type CreditBatch,
	type CreditTransaction,
	type Model,
	type UsageRecord,
} from "@/lib/api";

interface UseDashboardDataOptions {
	isAuthenticated: boolean;
}

interface UseDashboardDataResult {
	balance: BalanceResponse | null;
	apiKeys: ApiKey[];
	usage: UsageRecord[];
	creditBatches: CreditBatch[];
	models: Model[];
	transactions: CreditTransaction[];
	loading: boolean;
	/** User-facing message for non-backend errors; null when the only error
	 *  is a BackendUnavailableError (which renders its own banner). */
	error: string | null;
	/** True when at least one query failed because the backend is down. The
	 *  dashboard renders a distinct banner + RETRY button in that case. */
	backendUnavailable: boolean;
	refresh: () => Promise<void>;
}

const STALE_DEFAULT = 60_000;
const STALE_MODELS = 300_000;

/**
 * Aggregated dashboard data hook. Replaces the six inline `useQuery` calls
 * that used to live in `app/dashboard/page.tsx`. Same query keys, same
 * `staleTime`, same `enabled: isAuthenticated` gating — only the shape
 * is consolidated so the page component stays at orchestration level.
 */
export function useDashboardData({
	isAuthenticated,
}: UseDashboardDataOptions): UseDashboardDataResult {
	const queryClient = useQueryClient();
	const enabled = isAuthenticated;

	const balanceQuery = useQuery({
		queryKey: ["balance"],
		queryFn: () => api.balance(),
		enabled,
		staleTime: STALE_DEFAULT,
	});
	const keysQuery = useQuery({
		queryKey: ["apiKeys"],
		queryFn: () => api.auth.listKeys(),
		enabled,
		staleTime: STALE_DEFAULT,
	});
	const usageQuery = useQuery({
		queryKey: ["usage"],
		queryFn: () => api.usage({ limit: 500 }),
		enabled,
		staleTime: STALE_DEFAULT,
	});
	const batchesQuery = useQuery({
		queryKey: ["creditBatches"],
		queryFn: () => api.credits.getBatches(),
		enabled,
		staleTime: STALE_DEFAULT,
	});
	const modelsQuery = useQuery({
		queryKey: ["models"],
		queryFn: () => api.models(),
		enabled,
		staleTime: STALE_MODELS,
	});
	const transactionsQuery = useQuery({
		queryKey: ["recentTransactions"],
		queryFn: () => api.creditHistory.list(5),
		enabled,
		staleTime: STALE_DEFAULT,
	});

	const apiKeys = useMemo<ApiKey[]>(
		() => keysQuery.data ?? [],
		[keysQuery.data],
	);
	const usage = useMemo<UsageRecord[]>(
		() => usageQuery.data?.records ?? [],
		[usageQuery.data?.records],
	);
	const creditBatches = useMemo<CreditBatch[]>(
		() => batchesQuery.data?.activeBatches ?? [],
		[batchesQuery.data?.activeBatches],
	);
	const models = useMemo<Model[]>(
		() => modelsQuery.data?.data ?? [],
		[modelsQuery.data?.data],
	);
	const transactions = useMemo<CreditTransaction[]>(
		() => transactionsQuery.data?.transactions ?? [],
		[transactionsQuery.data?.transactions],
	);

	const balance: BalanceResponse | null = balanceQuery.data ?? null;
	const loading =
		balanceQuery.isLoading ||
		keysQuery.isLoading ||
		usageQuery.isLoading ||
		batchesQuery.isLoading ||
		modelsQuery.isLoading ||
		transactionsQuery.isLoading;

	const anyError =
		balanceQuery.error ||
		keysQuery.error ||
		usageQuery.error ||
		batchesQuery.error ||
		modelsQuery.error ||
		transactionsQuery.error;

	const { error, backendUnavailable } = useMemo(() => {
		if (!anyError)
			return { error: null as string | null, backendUnavailable: false };
		// Mirror the original page logic: BackendUnavailableError is surfaced
		// separately (different banner + RETRY button), all other errors get a
		// generic ERR: <message> treatment.
		if (anyError instanceof BackendUnavailableError) {
			return { error: null as string | null, backendUnavailable: true };
		}
		const message =
			anyError instanceof Error
				? anyError.message
				: "Failed to load dashboard data";
		return { error: message, backendUnavailable: false };
	}, [anyError]);

	const refresh = useCallback(async () => {
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["balance"] }),
			queryClient.invalidateQueries({ queryKey: ["apiKeys"] }),
			queryClient.invalidateQueries({ queryKey: ["usage"] }),
			queryClient.invalidateQueries({ queryKey: ["creditBatches"] }),
			queryClient.invalidateQueries({ queryKey: ["recentTransactions"] }),
			queryClient.invalidateQueries({ queryKey: ["models"] }),
		]);
	}, [queryClient]);

	return {
		balance,
		apiKeys,
		usage,
		creditBatches,
		models,
		transactions,
		loading,
		error,
		backendUnavailable,
		refresh,
	};
}
