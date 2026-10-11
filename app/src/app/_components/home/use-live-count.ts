"use client";

/**
 * Both homepage sections consume the same enabled-model count and catalog cache.
 * Catalog availability describes configuration, not a live inference health test.
 * Keep the count unknown until the current catalog resolves.
 */

import { useEffect, useState } from "react";
import { isAvailableChatModel } from "./catalog-availability";
import { loadRawModelEntries } from "@/lib/models-data";

/** Count enabled chat catalog entries. */
export function countLiveModels(
	entries: readonly { modality?: string; category?: string; available?: boolean }[],
): number {
	return entries.filter(isAvailableChatModel).length;
}

/** Current catalog count, or null if unknown. */
export function useLiveModelCount(): number | null {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		let alive = true;
		loadRawModelEntries()
			.then((entries) => {
				if (!alive || !entries.length) return;
				setCount(countLiveModels(entries));
			})
			.catch(() => {
				/* Keep the count unknown on failure. */
			});
		return () => {
			alive = false;
		};
	}, []);

	return count;
}
