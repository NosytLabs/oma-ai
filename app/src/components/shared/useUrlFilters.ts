"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * useUrlFilters — syncs filter state to URL search params.
 * Supports tier, provider, search, and sort params.
 */
export function useUrlFilters() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	const tier = searchParams.get("tier") || null;
	const provider = searchParams.get("provider") || null;
	const search = searchParams.get("q") || "";
	const sort = searchParams.get("sort") || "name";

	const setParam = useCallback(
		(key: string, value: string | null) => {
			startTransition(() => {
				const params = new URLSearchParams(searchParams.toString());
				if (value === null || value === "") {
					params.delete(key);
				} else {
					params.set(key, value);
				}
				const qs = params.toString();
				router.replace(qs ? `?${qs}` : "/models", { scroll: false });
			});
		},
		[router, searchParams, startTransition],
	);

	const copyFilterUrl = useCallback(async () => {
		const url = window.location.href;
		await navigator.clipboard.writeText(url);
	}, []);

	return {
		tier,
		provider,
		search,
		sort,
		setParam,
		copyFilterUrl,
		isPending,
	};
}
