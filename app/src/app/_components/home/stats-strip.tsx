"use client";

/**
 * StatsStrip — honest product metrics (no vanity counters).
 */

import { Reveal } from "@/app/_components/home/reveal";
import { MODEL_COUNT } from "@/lib/models-data";

const STATS = [
	{
		label: "Models live",
		value: `${MODEL_COUNT}+`,
		hint: "via Venice + routing",
	},
	{
		label: "From",
		value: "$0.01",
		hint: "per 1M tokens (budget tier)",
	},
	{
		label: "Auth",
		value: "SIWE",
		hint: "wallet or account number",
	},
	{
		label: "Settlement",
		value: "USDC",
		hint: "Base · x402 optional",
	},
] as const;

export function StatsStrip() {
	return (
		<section
			aria-labelledby="stats-headline"
			className="relative border-y border-border-subtle bg-[var(--color-panel)]/60 py-12 sm:py-14"
		>
			<div className="container-page">
				<Reveal>
					<p
						id="stats-headline"
						className="eyebrow text-center text-text-muted mb-8"
					>
						What is actually here
					</p>
				</Reveal>
				<ul className="grid grid-cols-2 gap-6 lg:grid-cols-4 lg:gap-8">
					{STATS.map((stat) => (
						<li key={stat.label} className="text-center sm:text-left">
							<Reveal>
								<p className="text-[11px] font-mono uppercase tracking-[0.16em] text-text-muted">
									{stat.label}
								</p>
								<p className="mt-2 text-display text-3xl sm:text-4xl tracking-tight text-text-bright">
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
