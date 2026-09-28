"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { copyToClipboard } from "@/lib/clipboard";

/**
	* useUrlFilters — syncs filter state to URL search params.
	* Supports tier, provider, search, and sort params.
	*/
export function useUrlFilters() {
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	const tier = searchParams?.get("tier") || null;
	const provider = searchParams?.get("provider") || null;
	const search = searchParams?.get("q") || "";
	const sort = searchParams?.get("sort") || "name";

	const setParams = useCallback(
		(updates: Record<string, string | null>) => {
			startTransition(() => {
				// Native history updates are synchronous and integrate with Next's
				// useSearchParams. Consecutive changes cannot overwrite each other.
				const params = new URLSearchParams(window.location.search);
				for (const [key, value] of Object.entries(updates)) {
					if (value === null || value === "") params.delete(key);
					else params.set(key, value);
				}
				const qs = params.toString();
				// Reset to the CURRENT route, not a hard-coded one — this hook is
				// shared and must not silently redirect future consumers to /models.
				window.history.replaceState(null, "", `${pathname ?? "/"}${qs ? `?${qs}` : ""}${window.location.hash}`);
			});
		},
		[pathname, startTransition],
	);
	const setParam = useCallback((key: string, value: string | null) => setParams({ [key]: value }), [setParams]);

	const copyFilterUrl = useCallback(async () => {
		return copyToClipboard(window.location.href);
	}, []);

	return {
		tier,
		provider,
		search,
		sort,
		setParam,
		setParams,
		params: searchParams,
		copyFilterUrl,
		isPending,
	};
}
