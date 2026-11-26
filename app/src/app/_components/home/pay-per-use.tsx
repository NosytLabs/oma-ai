import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";

/**
 * Section 04 — Pay per use, in the open (2026-11 revamp).
 * Copy is COPY.md §1 verbatim.
 */

export function PayPerUse() {
	return (
		<section aria-labelledby="pay-heading" className="border-b border-border">
			<div className="container-page py-16 sm:py-20">
				<Reveal>
					<p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-accent">
						04 — Pay per use, in the open
					</p>
					<h2
						id="pay-heading"
						className="section-headline mt-4 text-text-bright"
					>
						Pay per use, in the open.
					</h2>
					<p className="mt-4 max-w-3xl text-base leading-relaxed text-text-secondary">
						$1 = 100 credits. Every model lists its input and output token
						rates before you deposit, usage is deducted per token in real
						time, and credits never expire while your account is active. No
						monthly fee, no plan tiers, no renewal.
					</p>
					<Link
						href="/pricing"
						className="mt-8 inline-block font-mono text-[12px] uppercase tracking-[0.18em] text-accent underline-offset-4 hover:underline"
					>
						See model pricing
					</Link>
				</Reveal>
			</div>
		</section>
	);
}
