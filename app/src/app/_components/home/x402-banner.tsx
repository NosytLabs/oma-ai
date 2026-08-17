"use client";

/**
	* x402Banner — agent-native pay-per-request path.
	*
	* Spec-sheet polish (2026-08-16):
	* - Switched the rounded "x402 · agent billing" pill for the
	*   .section-eyebrow-caps style (mono uppercase + leading dot) so it
	*   reads as a section kicker, not a marketing badge.
	* - Tightened the panel to --radius-md and pulled the glow blur in
	*   so the slab feels drafted, not painted.
	* - CTAs use .btn-mono for cross-page consistency.
	*/

import { ArrowRight, CreditCard } from "lucide-react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { Reveal } from "@/app/_components/home/reveal";

// BorderBeam ships a useState initializer that reads
// `window.matchMedia("(prefers-color-scheme: dark)")` — server picks
// "light", client picks "dark", the rendered keyframes diverge, and
// React throws a hydration mismatch. Loading it client-only avoids
// the SSR render entirely (the beam is decoration; not worth a
// hydration error).
const BorderBeam = dynamic(
	() => import("border-beam").then((mod) => mod.BorderBeam),
	{ ssr: false },
);

export function X402Banner() {
	return (
		<section
		aria-labelledby="x402-headline"
		className="relative border-t border-border-subtle py-14 sm:py-18 lg:py-22"
		>
	<div className="container-page">
	<Reveal>
	<div className="relative overflow-hidden rounded-[var(--radius-md)] border border-accent/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_6%,var(--color-panel)),var(--color-panel)_70%,var(--color-panel))] p-8 sm:p-10 lg:p-12 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
	<BorderBeam
	size="sm"
	duration={6}
	theme="auto"
	className="pointer-events-none rounded-[var(--radius-md)]"
	>
	<div className="h-full w-full" />
	</BorderBeam>
	<div
	aria-hidden="true"
	className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/[0.06] blur-[100px]"
	/>
	<div className="relative grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-stretch">
	<div>
	<span className="section-eyebrow-caps mb-6">
		x402 · agent billing
	</span>
<h2
	id="x402-headline"
	className="section-headline text-text-bright text-balance"
	>
		HTTP 402 payments
		<br />
		<span className="text-text-secondary">for agents.</span>
	</h2>
		<p className="mt-5 max-w-lg text-base sm:text-lg leading-relaxed text-text-secondary">
		No pre-funded account required. On 402, read{" "}
		<code className="rounded-md bg-surface-hi px-1.5 py-0.5 font-mono text-[13px] text-accent">
		PAYMENT-REQUIRED
		</code>
		, sign USDC on Base (EIP-3009), retry with{" "}
		<code className="rounded-md bg-surface-hi px-1.5 py-0.5 font-mono text-[13px] text-accent">
		PAYMENT-SIGNATURE
		</code>
		. The gateway verifies, settles, and returns the completion.
		</p>
	<div className="mt-8 flex flex-wrap gap-3 w-full">
							<Link
								href="/docs#x402"
								className="btn-mono btn-primary group"
							>
	x402 docs
	<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
	</Link>
							<Link
								href="/pricing"
								className="btn-mono group"
							>
	<CreditCard className="h-3.5 w-3.5 text-text-muted transition-colors group-hover:text-accent" aria-hidden="true" />
	See rates
	</Link>
	</div>
	</div>

	<div className="rounded-[var(--radius-md)] border border-border bg-void-deep p-6 font-mono text-[12px] leading-relaxed text-text-secondary sm:text-[13px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] h-full">
		<div className="flex items-center gap-2 mb-4 border-b border-white/10 pb-3">
			<div className="flex gap-1.5">
				<div className="h-2.5 w-2.5 rounded-full bg-error" />
				<div className="h-2.5 w-2.5 rounded-full bg-warning" />
				<div className="h-2.5 w-2.5 rounded-full bg-success" />
			</div>
			<p className="ml-2 text-[10px] uppercase tracking-[0.2em] text-text-muted">
				request shape
			</p>
		</div>
		<pre
			tabIndex={0}
			aria-label="Example x402 HTTP request headers and body"
			className="overflow-x-auto whitespace-pre w-full max-w-full m-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
		><code className="block whitespace-pre font-mono text-[12px] sm:text-[13px] leading-[1.7]"><span className="block"><span className="text-accent font-semibold">POST</span> <span className="text-text-bright">/v1/chat/completions</span></span><span className="block"><span className="text-text-muted">PAYMENT-SIGNATURE:</span> <span className="text-[var(--color-secondary)]">{`{"signature":"0x…","payload":{"…"}}`}</span></span><span className="block"><span className="text-text-muted">Content-Type:</span> <span className="text-info">application/json</span></span><span className="block">&nbsp;</span><span className="block"><span className="text-text-muted">{"{"}</span></span><span className="block">  <span className="text-text-muted">&quot;model&quot;:</span> <span className="text-[var(--color-secondary)]">&quot;llama-3.3-70b&quot;</span>,</span><span className="block">  <span className="text-text-muted">&quot;messages&quot;:</span> [</span><span className="block">    <span className="text-text-muted">{"{"}</span> <span className="text-text-muted">&quot;role&quot;:</span> <span className="text-[var(--color-secondary)]">&quot;user&quot;</span>, <span className="text-text-muted">&quot;content&quot;:</span> <span className="text-[var(--color-secondary)]">&quot;…&quot;</span> <span className="text-text-muted">{"}"}</span></span><span className="block">  ]</span><span className="block"><span className="text-text-muted">{"}"}</span></span></code></pre>
	</div>
	</div>
	</div>
	</Reveal>
	</div>
	</section>
	);
}
