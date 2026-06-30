// ponytail: single source of truth for the /health polling cadence.
// TanStack Query dedupes by queryKey, so all callers share one request stream
// regardless of how many components mount this hook.

"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

interface UseHealthQueryOptions {
	/** Override the 30s default refetch interval. */
	refetchInterval?: number;
	/** Override the 25s default staleTime. */
	staleTime?: number;
	/** Disable polling entirely (e.g. for static SSR shells). */
	enabled?: boolean;
}

const DEFAULT_REFETCH_MS = 30_000;
const DEFAULT_STALE_MS = 25_000;

export function useHealthQuery(options: UseHealthQueryOptions = {}) {
	const {
		refetchInterval = DEFAULT_REFETCH_MS,
		staleTime = DEFAULT_STALE_MS,
		enabled = true,
	} = options;
	return useQuery({
		queryKey: ["health"],
		queryFn: () => api.health(),
		staleTime,
		refetchInterval,
		enabled,
	});
}
