"use client";

/**
 * Stats — section 6 of the homepage.
 * Four metrics in plain layout (NOT cards). Hairline dividers separate metrics.
 */

import { Reveal, RevealStagger, childFadeUp } from "@/app/_components/home/reveal";
import { cn } from "@/components/ui/utils";
import { m } from "@/lib/framer-motion-client";

interface Stat {
	value: string;
	label: string;
	hint?: string;
}

const STATS: Stat[] = [
	{ value: "17+", label: "Models online", hint: "Updated every 60s" },
	{ value: "$0.06", label: "Per 1M tokens", hint: "From price, frontier tier" },
	{ value: "<200ms", label: "p50 latency", hint: "Cached provider pool" },
	{ value: "99.99%", label: "Uptime / 30d", hint: "Rolling window" },
];

export function Stats() {
	return (
		<section
			aria-labelledby="stats-headline"
			className="relative border-y border-border-subtle bg-[var(--color-bg-base)] py-20 sm:py-24"
		>
			<div className="container-page">
				<Reveal>
					<p
						id="stats-headline"
						className="text-xs uppercase tracking-[0.18em] font-mono text-text-muted text-center mb-10"
					>
						Live network signal
					</p>
				</Reveal>
				<RevealStagger
					className="grid grid-cols-2 md:grid-cols-4 gap-y-10 md:gap-x-12"
					amount={0.3}
				>
					{STATS.map((stat, idx) => (
						<m.div
							key={stat.label}
							variants={childFadeUp}
							className={cn(
								"flex flex-col items-start md:items-center text-left md:text-center",
								"relative",
								idx > 0 &&
									"md:border-l md:border-border-subtle md:pl-12",
							)}
						>
							<div className="numeric-mono text-4xl sm:text-5xl font-bold text-text-bright tracking-tight">
								{stat.value}
							</div>
							<div className="mt-2 text-sm font-medium text-text-primary">
								{stat.label}
							</div>
							{stat.hint && (
								<div className="mt-1 text-xs text-text-muted font-mono">
									{stat.hint}
								</div>
							)}
						</m.div>
					))}
				</RevealStagger>
				<Reveal>
					<p className="mt-10 text-center text-xs text-text-muted font-mono">
						Figures are placeholders — live counts wire to /api/health on deploy.
					</p>
				</Reveal>
			</div>
		</section>
	);
}