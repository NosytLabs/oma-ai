"use client";

/**
	* FinalCTA — section 8 of the homepage (last before footer).
	* Asymmetric: large left headline + single primary CTA right.
	*/

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Reveal } from "@/app/_components/home/reveal";

export function FinalCTA() {
	return (
	<section
	aria-labelledby="final-cta-headline"
	className="relative overflow-hidden border-t border-border-subtle bg-surface/30 py-16 sm:py-20 lg:py-24"
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
	<div className="flex flex-col gap-4 items-center">
	<p className="eyebrow text-text-muted">Open the gateway</p>
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

		<div className="flex flex-col gap-6 items-center w-full mt-4">
		<div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
		<Link
			href="/login"
			className="group relative w-full sm:w-auto inline-flex h-12 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-accent px-8 font-mono text-sm font-bold text-void transition-[transform,background-color,box-shadow] duration-200 ease-out hover:bg-accent-bright hover:shadow-[0_0_20px_var(--color-accent-glow)] active:scale-[0.97] focus-ring overflow-hidden"
		>
			<span className="relative z-10 inline-flex items-center gap-2">
				Get API key
				<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
			</span>
			<span
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-500 ease-out group-hover:translate-x-full"
			/>
		</Link>
						<Link
							href="/pricing"
							className="inline-flex w-full sm:w-auto h-12 items-center justify-center rounded-[var(--radius-md)] border border-border-hi bg-surface px-8 font-mono text-sm font-medium text-text-primary transition-[border-color,transform] duration-200 ease-out active:scale-[0.97] hover:border-accent/50 focus-visible:ring-2 focus-visible:ring-accent focus-ring"
						>
		View pricing
		</Link>
		</div>
	<nav
	aria-label="Quick links"
	className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-text-muted"
	>
	<Link
	href="/docs"
	className="text-accent underline-offset-4 hover:text-accent-hover hover:underline"
	>
	docs
	</Link>
	<span className="text-border-hi" aria-hidden="true">
	·
	</span>
	<Link
	href="/chat"
	className="underline-offset-4 hover:text-text-bright hover:underline transition-colors"
	>
	playground
	</Link>
	<span className="text-border-hi" aria-hidden="true">
	·
	</span>
	<Link
	href="/pricing"
	className="underline-offset-4 hover:text-text-bright hover:underline transition-colors"
	>
	pricing
	</Link>
	</nav>
	</div>
	</div>
	</Reveal>
	</div>
	</section>
	);
}
