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
import { useBalance } from "@/components/chat/useBalance";

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
	error: string | null;
	backendUnavailable: boolean;
	refresh: () => Promise<void>;
}

const STALE_DEFAULT = 60_000;
const STALE_MODELS = 300_000;

/**
	* Aggregated dashboard data hook.
	* React Query against live APIs (auth + key + usage + batches + models +
	* recent transactions). Returns null balance and empty arrays when
	* unauthenticated so the page can render the sign-in wall without
	* noisy loading skeletons.
	*/
export function useDashboardData({
	isAuthenticated,
}: UseDashboardDataOptions): UseDashboardDataResult {
	const queryClient = useQueryClient();
	const enabled = isAuthenticated;

	const { balance: balanceData, loading: balanceLoading } = useBalance();
	const keysQuery = useQuery({
		queryKey: ["apiKeys"],
		queryFn: () => api.auth.listKeys(),
		enabled,
		staleTime: STALE_DEFAULT,
	});
	const usageQuery = useQuery({
		queryKey: ["usage"],
		queryFn: () => api.usage.get({ limit: 200 }),
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
		queryFn: () => api.models.list(),
		enabled,
		staleTime: STALE_MODELS,
	});
	const transactionsQuery = useQuery({
		queryKey: ["recentTransactions"],
		queryFn: () => api.creditHistory.list(5),
		enabled,
		staleTime: STALE_DEFAULT,
	});

	const apiKeys = useMemo<ApiKey[]>(() => keysQuery.data?.keys ?? [], [keysQuery.data?.keys]);
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

	const balance: BalanceResponse | null = balanceData;
	const loading = enabled
		? balanceLoading ||
			keysQuery.isLoading ||
			usageQuery.isLoading ||
			batchesQuery.isLoading ||
			modelsQuery.isLoading ||
			transactionsQuery.isLoading
		: false;

	const anyError = enabled
		? keysQuery.error ||
			usageQuery.error ||
			batchesQuery.error ||
			modelsQuery.error ||
			transactionsQuery.error
		: null;

	const backendUnavailable =
		enabled &&
		[
			keysQuery.error,
			usageQuery.error,
			batchesQuery.error,
			modelsQuery.error,
			transactionsQuery.error,
		].some((e) => e instanceof BackendUnavailableError);

	const error =
		backendUnavailable || !anyError
			? null
			: anyError instanceof Error
				? anyError.message
				: "Failed to load dashboard data";

	const refresh = useCallback(async () => {
		if (!enabled) return;
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["apiKeys"] }),
			queryClient.invalidateQueries({ queryKey: ["usage"] }),
			queryClient.invalidateQueries({ queryKey: ["creditBatches"] }),
			queryClient.invalidateQueries({ queryKey: ["models"] }),
			queryClient.invalidateQueries({ queryKey: ["recentTransactions"] }),
			queryClient.invalidateQueries({ queryKey: ["balance"] }),
		]);
	}, [enabled, queryClient]);

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