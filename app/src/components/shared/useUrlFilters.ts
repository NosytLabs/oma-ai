"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { copyToClipboard } from "@/lib/clipboard";

/**
	* useUrlFilters — syncs filter state to URL search params.
	* Supports tier, provider, search, and sort params.
	*/
export function useUrlFilters() {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [isPending, startTransition] = useTransition();

	const tier = searchParams?.get("tier") || null;
	const provider = searchParams?.get("provider") || null;
	const search = searchParams?.get("q") || "";
	const sort = searchParams?.get("sort") || "name";

	const setParam = useCallback(
		(key: string, value: string | null) => {
			startTransition(() => {
				const params = new URLSearchParams(searchParams?.toString() ?? "");
				if (value === null || value === "") {
					params.delete(key);
				} else {
					params.set(key, value);
				}
				const qs = params.toString();
				// Reset to the CURRENT route, not a hard-coded one — this hook is
				// shared and must not silently redirect future consumers to /models.
				router.replace(qs ? `?${qs}` : (pathname ?? "/"), { scroll: false });
			});
		},
		[router, pathname, searchParams, startTransition],
	);

	const copyFilterUrl = useCallback(async () => {
		return copyToClipboard(window.location.href);
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
