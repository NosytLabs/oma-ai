"use client";

/**
	* StatsStrip — product facts as a terminal ledger.
	* Live model count hydrates after mount to avoid SSR mismatch.
	*/

import { Reveal } from "@/app/_components/home/reveal";
import {
	MIN_INPUT_PRICE_LABEL,
} from "@/lib/models-data";
import { countLiveModels, useLiveModelCount } from "./use-live-count";

// `countLiveModels` + `useLiveModelCount` live in ./use-live-count so the hero
// and this strip cannot report different numbers for the same catalog.
// Re-exported here for the existing test import path.
export { countLiveModels };

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
