"use client";

/**
	* StatsStrip — product facts as a terminal ledger.
	* Live model count hydrates after mount to avoid SSR mismatch.
	*/

import { Reveal } from "@/app/_components/home/reveal";
import { isAvailableChatModel } from "./catalog-availability";
import { useEffect, useState } from "react";
import {
	MIN_INPUT_PRICE_LABEL,
	loadRawModelEntries,
} from "@/lib/models-data";

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

function useLiveModelCount() {
	const [count, setCount] = useState<number | null>(null);
	useEffect(() => {
		let alive = true;
		loadRawModelEntries()
			.then((entries) => {
				if (!alive || !entries.length) return;
				// Filter to chat-only so the "Models live" stat matches the
				// "curated chat models" label even when the upstream catalog also
				// exposes image / video / tts / embedding / asr / music / upscale
				// / inpaint rows. Without this the live number is inflated by
				// every modality bucket and the hero drifts from the static
				// `MODEL_COUNT` claim. Unavailable entries are excluded by
				// countLiveModels so the stat reports what can be called.
				const chatCount = countLiveModels(entries);
				setCount(chatCount);
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

const STATS: { label: string; value: string; hint: string; live?: boolean }[] =
	[
	{
		label: "Models live",
		value: "—",
		hint: "checking live availability",
		live: true,
	},
	{
		label: "From",
		value: MIN_INPUT_PRICE_LABEL,
		hint: "per 1M tokens (budget tier)",
	},
	{
		label: "Sign-in",
		value: "Wallet",
		hint: "or magic-link email",
	},
	{
		label: "Settlement",
		value: "USDC",
		hint: "Base · x402 optional",
	},
	] as const;

export function StatsStrip() {
	const liveCount = useLiveModelCount();
	const stats = STATS.map((s) =>
		s.live && liveCount != null
			? { ...s, value: `${liveCount}`, hint: "live now · Venice + OMA-AI" }
			: s,
	);
	return (
		<div className="flex h-full flex-col justify-start">
			<Reveal>
				<div className="mb-6 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
					<p id="stats-headline" className="section-eyebrow-caps">
						Product facts
					</p>
					<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted hidden sm:block">
						live catalog
					</p>
				</div>
			</Reveal>
			<ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-xl)] border border-border bg-border">
				{stats.map((stat, i) => (
					<li
						key={stat.label}
						className="relative bg-panel px-5 py-5 sm:py-6 transition-colors duration-200 ease-out hover:bg-surface/50"
					>
						{/* Ledger index */}
						<span
							aria-hidden="true"
							className="absolute right-4 top-4 font-mono text-[10px] tabular-nums text-text-muted"
						>
							0{i + 1}
						</span>
						<Reveal>
							<p className="text-[11px] font-mono uppercase tracking-[0.16em] text-text-muted">
								{stat.label}
							</p>
							<p
								aria-live="polite"
								className="mt-2 font-geometric text-[1.875rem] font-medium leading-none tracking-tight tabular-nums text-text-bright sm:text-[2.125rem]"
							>
								{stat.value}
							</p>
							<p className="mt-2 text-[12px] leading-snug text-text-secondary">
								{stat.hint}
							</p>
						</Reveal>
					</li>
				))}
			</ul>
		</div>
	);
}
