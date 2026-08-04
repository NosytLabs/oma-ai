"use client";

/**
 * StatsStrip — honest product metrics (no vanity counters).
 * The "Models live" figure is fetched from the running API so the label
 * is only ever true. Falls back to the build-time MODEL_COUNT if the
 * backend is unreachable (honest: shows the catalog size, not a lie).
 *
 * Hydration: the first paint always renders the build-time MODEL_COUNT
 * to match the server output. The live count swaps in *after* mount via
 * the `aria-live` element so screen readers announce the update without
 * triggering a React hydration mismatch.
 */

import { useEffect, useState } from "react";
import { Reveal } from "@/app/_components/home/reveal";
import { MODEL_COUNT } from "@/lib/models-data";

function useLiveModelCount() {
	const [count, setCount] = useState<number | null>(null);
	useEffect(() => {
		let alive = true;
		fetch("/api/v1/models", { credentials: "same-origin" })
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (!alive || !data?.data?.length) return;
				setCount(data.data.length);
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

const STATS: { label: string; value: string; hint: string; live?: boolean }[] = [
	{
		label: "Models live",
		value: `${MODEL_COUNT}+`,
		hint: "via Venice + routing",
		live: true,
	},
	{
		label: "From",
		value: "$0.015",
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
		// Only swap the value on the *client* — server renders the
		// build-time MODEL_COUNT, client swaps to the live number
		// after the first fetch resolves. Returning the same value
		// for the initial paint avoids a React hydration mismatch.
		s.live && liveCount != null
			? { ...s, value: `${liveCount}+`, hint: "live now · Venice + routing" }
			: s,
	);
	return (
		<section
			aria-labelledby="stats-headline"
			className="relative border-y border-border-subtle bg-[var(--color-panel)]/60 py-10 sm:py-12"
		>
			<div className="container-page">
				<Reveal>
					<p
						id="stats-headline"
						className="eyebrow text-center text-text-muted mb-8"
					>
						Product facts
					</p>
				</Reveal>
				<ul className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
					{stats.map((stat) => (
						<li key={stat.label} className="text-center sm:text-left">
							<Reveal>
								<p className="text-[11px] font-mono uppercase tracking-[0.16em] text-text-muted">
									{stat.label}
								</p>
								<p
									aria-live="polite"
									className="mt-2 text-display text-3xl sm:text-4xl tracking-tight text-text-bright"
								>
									{stat.value}
								</p>
								<p className="mt-1.5 text-sm text-text-secondary">{stat.hint}</p>
							</Reveal>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
}
