"use client";

/**
	* Shared frontend-liveness poll for the navbar status chip and connection
	* feedback. It measures website reachability, not inference/API readiness.
	*
	* Single source of truth:
	* - One query key: `["health", "ready-v2"]`.
	* - Treats any 2xx response as "online", any non-2xx or thrown error as
	* "offline".
	* - Exposes a stable `refresh()` callback so consumers can re-poll after
	* a "Retry" click.
	* - While the website is unreachable the poll backs off exponentially
	* (5s → 10s → 20s → 40s → 60s cap) instead of hammering a dead
	* endpoint on a fixed cadence. A successful check resets the backoff
	* and returns to the steady 30s poll. No per-attempt console logging.
	*/

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { nextHealthPollMs } from "@/lib/health-backoff";

type HealthStatus = "checking" | "online" | "offline";

const STALE_TIME_MS = 25_000;
const HEALTH_QUERY_KEY = ["health", "ready-v2"] as const;

async function fetchHealth(): Promise<HealthStatus> {
	try {
	const ok = await api.healthPing();
	return ok ? "online" : "offline";
	} catch {
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
