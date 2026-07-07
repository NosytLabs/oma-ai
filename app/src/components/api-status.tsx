"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import { useCallback } from "react";

type HealthStatus = "checking" | "online" | "offline";

const POLL_INTERVAL_MS = 30_000;
const STALE_TIME_MS = 25_000;

async function fetchHealth(): Promise<HealthStatus> {
	try {
		const res = await fetch("/api/health", {
			method: "GET",
			cache: "no-store",
			// 2.5s timeout. On abort the catch returns "offline" so the
			// UI never sees an unhandled rejection. Kept well under the
			// 30s polling cadence so users stuck on /login see the
			// "Reconnecting…" banner quickly when the API is down.
			signal: AbortSignal.timeout(2_500),
		});
		return res.ok ? "online" : "offline";
	} catch {
		return "offline";
	}
}

export function useApiHealth() {
	const queryClient = useQueryClient();
	// Shared `["health"]` key with useHealthQuery so all callers share
	// one polling stream regardless of which hook they import.
	const { data: status = "checking", dataUpdatedAt } = useQuery({
		queryKey: ["health"],
		queryFn: fetchHealth,
		staleTime: STALE_TIME_MS,
		refetchInterval: POLL_INTERVAL_MS,
		refetchOnWindowFocus: false,
		// fetchHealth already swallows errors and resolves with "offline".
		// Disabling retries prevents React Query from racing the abort
		// signal during React 19 StrictMode unmount/remount cycles in
		// dev mode (which logs `net::ERR_ABORTED` for every double-fetch).
		retry: false,
		retryOnMount: false,
	});

	const refresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: ["health"] });
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
			<div className="flex items-center gap-1.5">
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
				<span
					role="status"
					aria-live="polite"
					aria-label={`API Status: ${info.text}`}
					className={`text-[10px] ${info.className}`}
				>
					{info.text}
				</span>
			</div>
			{status === "offline" && showRetryButton && (
				<button
					type="button"
					onClick={handleRetry}
					className="flex items-center gap-1 text-[10px] text-text-muted hover:text-text transition-colors"
					aria-label="Retry connection"
				>
					<RefreshCw className="h-3 w-3" />
				</button>
			)}
		</div>
	);
}
