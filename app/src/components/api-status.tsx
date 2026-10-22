"use client";

/**
 * `useApiHealth` — gateway readiness for sign-in and account services.
 * The website's own liveness cannot establish database/cache readiness
 * or whether an upstream model can serve inference.
 *
 * Single source of truth:
 * - One query key: ["health", "ready-v3"].
 * - Requires a successful readiness response; failures are "offline".
 * - Exposes a stable `refresh()` callback so consumers can re-poll after
 *   a "Retry" click.
 * - Steady 30s poll while online; capped exponential backoff
 *   (5s → 10s → 20s → 40s → 60s cap) while offline so a dead backend
 *   isn't hammered on a hot loop.
 *
 * The previous `ApiStatus` JSX wrapper lived here too but had no
 * consumer in the repo. Removed in 2026-10 cleanup; status-chip UIs are
 * free to use `useApiHealth` directly if they need to display.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { api } from "@/lib/api";
import { nextHealthPollMs } from "@/lib/health-backoff";

type HealthStatus = "checking" | "online" | "offline";

const STALE_TIME_MS = 25_000;
const HEALTH_QUERY_KEY = ["health", "ready-v3"] as const;

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
		// Steady 30s poll while online; capped exponential backoff
		// (5s → 60s) while offline so a dead backend isn't hammered.
		refetchInterval: nextHealthPollMs,
		refetchOnWindowFocus: false,
		// fetchHealth swallows errors and resolves with "offline".
		// Disabling retries prevents React Query from racing the abort
		// signal during React 19 StrictMode unmount/remount cycles in
		// dev (which logs `net::ERR_ABORTED` for every double-fetch).
		retry: false,
		retryOnMount: false,
	});

	const refresh = useCallback(() => {
		queryClient.invalidateQueries({ queryKey: HEALTH_QUERY_KEY });
	}, [queryClient]);

	return { status, refresh, lastCheckedAt: dataUpdatedAt };
}

export type { HealthStatus };
