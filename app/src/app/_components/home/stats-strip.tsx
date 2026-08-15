"use client";

/**
	* StatsStrip — product facts as a terminal ledger.
	* Live model count hydrates after mount to avoid SSR mismatch.
	*/

import { useEffect, useState } from "react";
import { Reveal } from "@/app/_components/home/reveal";
import {
	formatPricePerMillion,
	MODEL_COUNT,
	MODELS,
	loadRawModelEntries,
} from "@/lib/models-data";

// Cheapest catalog input rate, derived from the synced fallback catalog so
// the hero "From" figure can never drift from the real price list again.
const MIN_INPUT_PRICE = Math.min(
	...MODELS.map((m) => m.inputPricePer1M).filter((p) => p > 0),
);

function useLiveModelCount() {
	const [count, setCount] = useState<number | null>(null);
	useEffect(() => {
	let alive = true;
	loadRawModelEntries()
	.then((entries) => {
	if (!alive || !entries.length) return;
	setCount(entries.length);
	})
	.catch(() => {
	/* backend down — keep null → fall back to MODEL_COUNT */
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
	value: `${MODEL_COUNT}`,
	hint: "curated · Venice + OMA-AI",
	live: true,
	},
	{
	label: "From",
	value: formatPricePerMillion(MIN_INPUT_PRICE),
	hint: "per 1M tokens (budget tier)",
	},
	{
	label: "Auth",
	value: "2 ways",
	hint: "magic link or SIWE wallet",
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
	<section
	aria-labelledby="stats-headline"
	className="relative bg-surface py-16 sm:py-20 z-10"
	>
	<div
	aria-hidden="true"
	className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/30 to-transparent"
	/>
	<div className="container-page">
	<Reveal>
	<div className="mb-9 flex flex-col items-center gap-2 sm:flex-row sm:justify-between">
	<p id="stats-headline" className="eyebrow text-text-muted">
	Product facts
	</p>
	<p className="font-mono text-[10px] uppercase tracking-[0.18em] text-text-muted">
	ledger · no vanity metrics
	</p>
	</div>
	</Reveal>
	<ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-xl)] border border-border bg-border lg:grid-cols-4">
	{stats.map((stat, i) => (
	<li
	key={stat.label}
	className="relative bg-panel px-5 py-6 sm:px-6 sm:py-7 transition-colors duration-200 ease-out hover:bg-surface/50"
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
	className="mt-3 font-display text-[2rem] leading-none tracking-tight text-text-bright sm:text-[2.35rem]"
	>
	{stat.value}
	</p>
	<p className="mt-2.5 text-[13px] leading-snug text-text-secondary">
	{stat.hint}
	</p>
	</Reveal>
	</li>
	))}
	</ul>
	</div>
	</section>
	);
}
