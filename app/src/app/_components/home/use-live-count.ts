"use client";

/**
 * Shared live model count for the homepage.
 *
 * Previously `hero.tsx` and `stats-strip.tsx` each carried their own
 * `useLiveModelCount()` — different fetch paths, different filters, no shared
 * cache — so the hero sentence ("N live models") and the "Models live" stat
 * could report different numbers for the same catalog snapshot. This hook is
 * the single implementation both consume.
 *
 * Source of truth: `loadRawModelEntries()` (the unfiltered `/api/v1/models`
 * response), filtered by `countLiveModels()` which applies
 * `isAvailableChatModel` — i.e. chat modality AND available. That is the same
 * signal the /models and /pricing availability badges already surface, so an
 * unavailable entry is never counted as live.
 *
 * Returns `null` until the catalog resolves (and on network failure) so
 * callers omit the number rather than assert a static count they cannot stand
 * behind. `loadRawModelEntries` collapses concurrent callers into one fetch,
 * and the module-level cache is shared with `loadModels()`.
 */

import { useEffect, useState } from "react";
import { isAvailableChatModel } from "./catalog-availability";
import { loadRawModelEntries } from "@/lib/models-data";

/**
 * Count the models a visitor can actually call right now.
 *
 * The previous count filtered by modality only, so the "Models live" stat
 * reported the whole catalog (20) while the API was serving 2 as available
 * and 18 as unavailable — the same signal the /models and /pricing badges
 * already surface. An unavailable entry is not live, so it is excluded here
 * too; entries that omit the flag are counted, matching loadModels().
 */
export function countLiveModels(
	entries: readonly { modality?: string; category?: string; available?: boolean }[],
): number {
	return entries.filter(isAvailableChatModel).length;
}

/** Live count of chat models actually accepting requests, or null if unknown. */
export function useLiveModelCount(): number | null {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		let alive = true;
		loadRawModelEntries()
			.then((entries) => {
				if (!alive || !entries.length) return;
				// Filter to chat-only so the number matches the "curated chat
				// models" framing even when the upstream catalog also exposes
				// image / video / tts / embedding / asr / music / upscale /
				// inpaint rows. Unavailable entries are excluded by
				// countLiveModels so the figure reports what can be called.
				setCount(countLiveModels(entries));
			})
			.catch(() => {
				/* Availability unknown — keep the placeholder instead of claiming the catalog is live. */
			});
		return () => {
			alive = false;
		};
	}, []);

	return count;
}