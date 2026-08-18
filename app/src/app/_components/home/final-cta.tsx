"use client";

/**
	* FinalCTA — section 8 of the homepage (last before footer).
	* Centered: headline, subhead, and paired primary/secondary CTAs.
	*
	* Spec-sheet polish (2026-08-16):
	* - Uses .btn-mono so the primary CTA matches the hero CTA exactly.
	* - Section eyebrow switched to caps+dot (section-eyebrow-caps) so it
	*   reads as a spec-sheet opener, not a soft kicker.
	* - Removed the per-button sheen overlay (was redundant with the new
	*   .btn-primary inner glow + .btn-mono sharp slab).
	* - Removed the redundant "QUICK LINKS" sub-nav — those targets already
	*   live in the navbar, and listing them here muddied the call to action.
	*/

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";

export function FinalCTA() {
	return (
		<section
		aria-labelledby="final-cta-headline"
		className="relative overflow-hidden border-t border-border-subtle bg-surface/30 py-14 sm:py-18 lg:py-22"
		>
<div
		aria-hidden="true"
		className="pointer-events-none absolute inset-0 -z-10"
		>
		<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-40" />
		<div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.035] blur-[160px]" />
	</div>
	<div className="container-page relative z-10">
	<Reveal>
	<div className="flex flex-col items-center justify-center text-center max-w-3xl mx-auto gap-8">
	<div className="flex flex-col gap-5 items-center">
	<span className="section-eyebrow-caps">Get started</span>
	<h2
	id="final-cta-headline"
	className="display-headline text-text-bright"
	>
	Get an API key.
	<br />
	<span className="gradient-text-accent">Call any model.</span>
	</h2>
				<p className="text-base leading-relaxed text-text-secondary sm:text-lg">
					Fund credits with card via Polar, or deposit USDC on Base. Use
					x402 when agents need to pay per request. One OpenAI-compatible
					surface.
				</p>
	</div>

		<div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto mt-2">
		<Link
			href="/login"
			className="btn-mono btn-primary group w-full sm:w-auto"
		>
			<span>Get API key</span>
			<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
		</Link>
					<Link
						href="/pricing"
						className="btn-mono w-full sm:w-auto"
					>
		View pricing
		</Link>
		</div>
	</div>
	</Reveal>
	</div>
	</section>
	);
}
