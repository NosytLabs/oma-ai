// single source of truth for the /health polling cadence.
// TanStack Query dedupes by queryKey, so all callers share one request stream
// regardless of how many components mount this hook.

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
		nextHealthPollMs,
		recordHealthCheckResult,
} from "@/lib/health-backoff";

interface UseHealthQueryOptions {
		/** Override the 30s default refetch interval. */
		refetchInterval?: number;
		/** Override the 25s default staleTime. */
		staleTime?: number;
		/** Disable polling entirely (e.g. for static SSR shells). */
		enabled?: boolean;
}

const DEFAULT_STALE_MS = 25_000;

export function useHealthQuery(options: UseHealthQueryOptions = {}) {
		const { refetchInterval, staleTime = DEFAULT_STALE_MS, enabled = true } = options;
		return useQuery({
				// Deep readiness payload (checks map) — NOT the navbar liveness key.
				// useApiHealth uses ["health", "ready-v2"] for a boolean online/offline
				// ping; sharing that key left the dashboard stuck on "Checking readiness"
				// because the string "online" has no `.checks`.
				queryKey: ["health", "ready-detail"],
				queryFn: async () => {
						try {
								const res = await api.health();
								recordHealthCheckResult(true);
								return res;
						} catch (err) {
								recordHealthCheckResult(false);
								throw err;
						}
				},
				staleTime,
				// Default cadence: steady 30s while healthy, capped exponential
				// backoff (5s → 60s) while the backend is unreachable. Callers can
				// still pin a fixed interval via options.
				refetchInterval: refetchInterval ?? nextHealthPollMs,
				enabled,
				// `api.health()` throws on failure; without this TanStack fires 3
				// hidden retries per cycle, turning the stated 30s cadence into a
				// ~7.5s hot loop against a dead backend. The refetchInterval backoff
				// above is the only retry mechanism we want.
				retry: false,
				retryOnMount: false,
		});
}
