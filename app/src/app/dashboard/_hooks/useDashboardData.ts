"use client";

import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { api, BackendUnavailableError } from "@/lib/api";
import { useBalance } from "@/components/chat/useBalance";
import type { TimeRangeId } from "../_constants";

interface Options {
	isAuthenticated: boolean;
	userId?: string;
	timeRange?: TimeRangeId;
	analyticsEnabled?: boolean;
}

/** Full-range aggregates and on-demand history; all private caches include identity. */
export function useDashboardData({ isAuthenticated, userId, timeRange = "7d", analyticsEnabled = true }: Options) {
	const queryClient = useQueryClient();
	const enabled = isAuthenticated && !!userId;
	const analytics = enabled && analyticsEnabled;
	const timezone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC", []);
	const balanceQuery = useBalance({ enabled });
	const keysQuery = useQuery({
		queryKey: ["apiKeys", userId], queryFn: () => api.auth.listKeys(), enabled, staleTime: 60_000,
	});
	const summaryQuery = useQuery({
		queryKey: ["usageSummary", userId, timeRange, timezone],
		queryFn: () => api.usage.summary(timeRange, timezone), enabled: analytics, staleTime: 60_000,
	});
	const summary = enabled ? summaryQuery.data ?? null : null;
	const usageQuery = useInfiniteQuery({
		queryKey: ["usage", userId, timeRange, summary?.from, summary?.to],
		queryFn: ({ pageParam }) => api.usage.get({
			limit: 100, cursor: pageParam, since: summary?.from ?? undefined, until: summary?.to,
		}),
		initialPageParam: undefined as string | undefined,
		getNextPageParam: page => page.nextCursor ?? undefined,
		enabled: analytics && !!summary, staleTime: 60_000,
	});
	const modelsQuery = useQuery({
		queryKey: ["models"], queryFn: () => api.models.list(), enabled: analytics, staleTime: 300_000,
	});
	const transactionsQuery = useQuery({
		queryKey: ["recentTransactions", userId],
		queryFn: () => api.creditHistory.list(5), enabled: analytics, staleTime: 60_000,
	});
	const usage = useMemo(() => enabled ? usageQuery.data?.pages.flatMap(p => p.records) ?? [] : [],
		[enabled, usageQuery.data]);
	const errors = enabled ? [balanceQuery.error, keysQuery.error, ...(analytics ? [summaryQuery.error, usageQuery.error,
		modelsQuery.error, transactionsQuery.error] : [])] : [];
	const error = errors.find(e => e instanceof Error) as Error | undefined;
	const refresh = useCallback(async () => {
		if (!enabled) return;
		await Promise.all(["apiKeys", "usageSummary", "usage", "models", "recentTransactions", "balance", "notifications"]
			.map(key => queryClient.invalidateQueries({ queryKey: [key] })));
	}, [enabled, queryClient]);

	return {
		balance: enabled ? balanceQuery.balance : null,
		apiKeys: enabled ? keysQuery.data?.keys ?? [] : [],
		usage,
		summary,
		// Legacy batch storage is not a funding source; the balance ledger is authoritative.
		creditBatches: [],
		models: enabled ? modelsQuery.data?.data ?? [] : [],
		transactions: enabled ? transactionsQuery.data?.transactions ?? [] : [],
		loading: enabled && (balanceQuery.loading || keysQuery.isLoading || (analytics && (summaryQuery.isLoading ||
			usageQuery.isLoading || modelsQuery.isLoading || transactionsQuery.isLoading))),
		error: error ?? null,
		backendUnavailable: errors.some(e => e instanceof BackendUnavailableError),
		hasMoreUsage: enabled && usageQuery.hasNextPage,
		loadingMoreUsage: usageQuery.isFetchingNextPage,
		loadMoreUsage: usageQuery.fetchNextPage,
		refresh,
	};
}
