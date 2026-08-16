"use client";

/**
	* x402Banner — agent-native pay-per-request path.
	*/

import { ArrowRight, Bot, CreditCard } from "lucide-react";
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
	className="relative py-14 sm:py-18"
	>
	<div className="container-page">
	<Reveal>
	<div className="relative overflow-hidden rounded-2xl border border-accent/20 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-accent)_6%,var(--color-panel)),var(--color-panel)_70%,var(--color-panel))] p-8 sm:p-10 lg:p-12 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.6)]">
	<BorderBeam
	size="sm"
	duration={6}
	theme="auto"
	className="pointer-events-none rounded-3xl"
	>
	<div className="h-full w-full" />
	</BorderBeam>
	<div
	aria-hidden="true"
	className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-accent/[0.06] blur-[100px]"
	/>
	<div className="relative grid grid-cols-1 gap-12 lg:grid-cols-[1.4fr_1fr] lg:items-stretch">
	<div>
	<span className="inline-flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-[10px] uppercase tracking-widest text-accent mb-6 shadow-[0_0_12px_var(--color-accent-shadow)]">
	<Bot className="h-3.5 w-3.5" aria-hidden="true" />
	x402 · agent billing
	</span>
<h2
		id="x402-headline"
		className="font-display text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight text-text-bright leading-[1.1]"
	>
		HTTP 402 payments
		<br />
		for agents.
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
								className="group inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] bg-accent px-6 font-mono text-sm font-bold text-void transition-[transform,background-color,box-shadow] duration-200 ease-out hover:scale-[1.02] hover:bg-accent-bright hover:shadow-[0_0_20px_var(--color-accent-glow)] active:scale-[0.98] focus-ring"
							>
	x402 docs
	<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
	</Link>
							<Link
								href="/pricing"
								className="inline-flex h-12 items-center gap-2 rounded-[var(--radius-md)] border border-border-hi bg-surface px-6 font-mono text-sm font-medium text-text-primary transition-[transform,border-color,background-color] duration-200 ease-out hover:scale-[1.02] hover:border-accent/50 hover:bg-surface-hi active:scale-[0.98] focus-ring"
							>
	<CreditCard className="h-4 w-4 text-text-muted transition-colors group-hover:text-text-primary" aria-hidden="true" />
	See rates
	</Link>
	</div>
	</div>

	<div className="rounded-2xl border border-border bg-[#050505] p-6 font-mono text-[12px] leading-relaxed text-text-secondary sm:text-[13px] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.8)] h-full">
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
