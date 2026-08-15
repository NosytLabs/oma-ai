"use client";

/**
	* Shared `/api/health` poll for both the navbar status chip and the login
	* page's "API is offline" banner.
	*
	* The previous implementation used a private React Query key
	* (`["health"]`) and a 2.5 s fetch timeout. That poll returned `offline`
	* even when the Next.js `/api/health` route answered 200, which made the
	* login page show a persistent "API is offline" banner and disabled the
	* wallet-connect button on a healthy backend.
	*
	* Root cause: the query was racing with the route's first compile, with
	* network setup, and with TanStack Query's own retry handling. The
	* duplicate `useHealthQuery` hook used elsewhere on the dashboard
	* (`queryKey: ["health", "ready-v2"]`) was the actual source of truth.
	*
	* This file is now the single source of truth:
	* - One shared query key: `["health", "ready-v2"]`.
	* - One 3 s timeout on the GET to /api/health.
	* - Treats any 2xx response as "online", any non-2xx or thrown error as
	* "offline".
	* - Exposes a stable `refresh()` callback so consumers can re-poll after
	* a "Retry" click.
	* - While the API is offline the poll backs off exponentially
	* (5s → 10s → 20s → 40s → 60s cap) instead of hammering a dead
	* backend on a fixed cadence. A successful check resets the backoff
	* and returns to the steady 30s poll. No per-attempt console logging.
	*/

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback } from "react";
import { api } from "@/lib/api";
import {
	nextHealthPollMs,
	recordHealthCheckResult,
} from "@/lib/health-backoff";

type HealthStatus = "checking" | "online" | "offline";

const STALE_TIME_MS = 25_000;
const HEALTH_QUERY_KEY = ["health", "ready-v2"] as const;

async function fetchHealth(): Promise<HealthStatus> {
	try {
	const ok = await api.healthPing();
	recordHealthCheckResult(ok);
	return ok ? "online" : "offline";
	} catch {
	recordHealthCheckResult(false);
	return "offline";
	}
}

export function useApiHealth() {
	const queryClient = useQueryClient();
	const { data: status = "checking", dataUpdatedAt } = useQuery({
	queryKey: HEALTH_QUERY_KEY,
	queryFn: fetchHealth,
	staleTime: STALE_TIME_MS,
	// Steady 30s poll while online; capped exponential backoff (5s → 60s)
	// while offline so a dead backend isn't hammered on a hot loop.
	refetchInterval: nextHealthPollMs,
	refetchOnWindowFocus: false,
	// fetchHealth already swallows errors and resolves with "offline".
	// Disabling retries prevents React Query from racing the abort
	// signal during React 19 StrictMode unmount/remount cycles in
	// dev mode (which logs `net::ERR_ABORTED` for every double-fetch).
	retry: false,
	retryOnMount: false,
	});

	const refresh = useCallback(() => {
	queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
	}, [queryClient]);

	return { status, refresh, lastCheckedAt: dataUpdatedAt };
}

interface ApiStatusProps {
	onRetry?: () => void;
	showRetryButton?: boolean;
}

export function ApiStatus({ onRetry, showRetryButton = true }: ApiStatusProps) {
	const { status, refresh } = useApiHealth();

	const handleRetry = () => {
	refresh();
	onRetry?.();
	};

	const getStatusInfo = () => {
	switch (status) {
	case "checking":
	return {
	icon: <RefreshCw className="h-3 w-3 animate-spin" />,
	text: "Connecting...",
	className: "text-text-muted",
	dotClass: "bg-warning animate-pulse",
	};
	case "online":
	return {
	icon: <Wifi className="h-3 w-3" />,
	text: "API Online",
	className: "text-success",
	dotClass: "bg-success",
	};
	case "offline":
	return {
	icon: <WifiOff className="h-3 w-3" />,
	text: "Reconnecting…",
	className: "text-warning",
	dotClass: "bg-warning animate-pulse",
	};
	}
	};

	const info = getStatusInfo();

	return (
	<div className="flex items-center gap-2">
	<div
	className="flex items-center gap-1.5 rounded-full border border-border bg-surface/60 px-2.5 py-1"
	role="status"
	aria-live="polite"
	aria-label={`${info.text}`}
	title={`API status: ${info.text} — polls /api/health every 30s`}
	>
	<span className={`relative flex h-2 w-2`}>
	{status === "checking" && (
	<span
	className={`absolute inline-flex h-full w-full rounded-full ${info.dotClass} opacity-75`}
	/>
	)}
	<span
	className={`relative inline-flex rounded-full h-2 w-2 ${info.dotClass}`}
	/>
	</span>
	<span className={`text-[11px] ${info.className}`}>
	{info.text}
	</span>
	</div>
	{status === "offline" && showRetryButton && (
	<button
	type="button"
	onClick={handleRetry}
	className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text transition-colors duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
	aria-label="Retry connection"
	>
	<RefreshCw className="h-3 w-3" />
	</button>
	)}
	</div>
	);
}
