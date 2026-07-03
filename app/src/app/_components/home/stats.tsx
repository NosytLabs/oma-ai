/**
 * Stats — section 6 of the homepage.
 *
 * Honest, non-numeric credibility block. Every figure is sourced from
 * real data:
 *
 *   - Model count      → passed as prop from server (avoids client import
 *                        of server/models.json which causes hydration mismatch)
 *   - API surface      → one OpenAI-compatible endpoint
 *   - Price range      → min and max inputPricePer1M in MODELS
 *
 * No fake uptime, no fake latency.
 */

import { Reveal } from "@/app/_components/home/reveal";
import Link from "next/link";

export interface StatsProps {
	modelCount: number;
}

export function Stats({ modelCount }: StatsProps) {
	return (
		<section
			aria-labelledby="stats-headline"
			className="relative border-y border-border-subtle bg-[var(--color-bg-base)] py-20 sm:py-24"
		>
			<div className="container-page">
				<Reveal>
					<p
						id="stats-headline"
						className="text-xs uppercase tracking-[0.18em] font-mono text-text-muted text-center mb-8"
					>
						What is actually here
					</p>
				</Reveal>

				<Reveal>
					<p className="text-center text-2xl sm:text-3xl text-text-bright font-medium tracking-tight">
						{modelCount}+ models · 1 OpenAI-compatible API · Pay per request
					</p>
				</Reveal>

				<Reveal>
					<p className="mt-6 text-center text-sm sm:text-base text-text-secondary max-w-2xl mx-auto">
						Input pricing ranges from{" "}
						<span className="font-mono text-text-primary">$0.06</span> to{" "}
						<span className="font-mono text-text-primary">$15.00</span> per
						1M tokens, depending on model tier.{" "}
						<Link
							href="/pricing"
							className="text-accent hover:text-accent-hover underline-offset-4 hover:underline"
						>
							See full pricing
						</Link>
						.
					</p>
				</Reveal>
			</div>
		</section>
	);
}