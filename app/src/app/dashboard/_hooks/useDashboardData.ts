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
import {
	DEMO_API_KEYS,
	DEMO_BALANCE,
	DEMO_BATCHES,
	DEMO_MODELS,
	DEMO_TRANSACTIONS,
	DEMO_USAGE,
} from "@/lib/demo-fixtures";

interface UseDashboardDataOptions {
	isAuthenticated: boolean;
	/** When true, return fixtures and skip all network calls. */
	isDemo?: boolean;
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
 * Real session: React Query against live APIs.
 * Demo session: shared fixtures, zero network.
 */
export function useDashboardData({
	isAuthenticated,
	isDemo = false,
}: UseDashboardDataOptions): UseDashboardDataResult {
	const queryClient = useQueryClient();
	const enabled = isAuthenticated && !isDemo;

	const { balance: balanceData, loading: balanceLoading } = useBalance();
	const keysQuery = useQuery({
		queryKey: ["apiKeys"],
		queryFn: () => api.auth.listKeys(),
		enabled,
		staleTime: STALE_DEFAULT,
	});
	const usageQuery = useQuery({
		queryKey: ["usage"],
		queryFn: () => api.usage.get({ limit: 500 }),
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

	const apiKeys = useMemo<ApiKey[]>(
		() => (isDemo ? DEMO_API_KEYS : (keysQuery.data ?? [])),
		[isDemo, keysQuery.data],
	);
	const usage = useMemo<UsageRecord[]>(
		() => (isDemo ? DEMO_USAGE : (usageQuery.data?.records ?? [])),
		[isDemo, usageQuery.data?.records],
	);
	const creditBatches = useMemo<CreditBatch[]>(
		() => (isDemo ? DEMO_BATCHES : (batchesQuery.data?.activeBatches ?? [])),
		[isDemo, batchesQuery.data?.activeBatches],
	);
	const models = useMemo<Model[]>(
		() => (isDemo ? DEMO_MODELS : (modelsQuery.data?.data ?? [])),
		[isDemo, modelsQuery.data?.data],
	);
	const transactions = useMemo<CreditTransaction[]>(
		() =>
			isDemo
				? DEMO_TRANSACTIONS
				: (transactionsQuery.data?.transactions ?? []),
		[isDemo, transactionsQuery.data?.transactions],
	);

	const balance: BalanceResponse | null = isDemo
		? DEMO_BALANCE
		: balanceData;
	const loading = isDemo
		? false
		: balanceLoading ||
			keysQuery.isLoading ||
			usageQuery.isLoading ||
			batchesQuery.isLoading ||
			modelsQuery.isLoading ||
			transactionsQuery.isLoading;

	const anyError = isDemo
		? null
		: keysQuery.error ||
			usageQuery.error ||
			batchesQuery.error ||
			modelsQuery.error ||
			transactionsQuery.error;

	const backendUnavailable =
		!isDemo &&
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
		if (isDemo) return;
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["apiKeys"] }),
			queryClient.invalidateQueries({ queryKey: ["usage"] }),
			queryClient.invalidateQueries({ queryKey: ["creditBatches"] }),
			queryClient.invalidateQueries({ queryKey: ["models"] }),
			queryClient.invalidateQueries({ queryKey: ["recentTransactions"] }),
			queryClient.invalidateQueries({ queryKey: ["balance"] }),
		]);
	}, [isDemo, queryClient]);

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
