"use client";

/**
 * Home · Hero
 *
 * Product-first landing: clear value prop, dual CTAs (try / integrate),
 * and a live code strip that shows the OpenAI-compatible surface.
 */

import { ArrowRight, KeyRound, Sparkles, Zap } from "lucide-react";
import { m } from "framer-motion";
import Link from "next/link";
import { MODEL_COUNT } from "@/lib/models-data";

function reveal(index: number) {
	return {
		initial: { opacity: 0, y: 16 },
		animate: { opacity: 1, y: 0 },
		transition: {
			delay: 0.05 + index * 0.06,
			duration: 0.55,
			ease: [0.2, 0.8, 0.2, 1] as const,
		},
	};
}

export function Hero() {
	return (
		<section className="relative overflow-hidden">
			{/* Atmosphere */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10"
			>
				<div className="absolute inset-0 bg-grid opacity-[0.28] mask-radial" />
				<div className="absolute -left-40 top-8 h-[32rem] w-[32rem] rounded-full bg-accent/[0.09] blur-[140px]" />
				<div className="absolute right-[-10rem] top-32 h-[26rem] w-[26rem] rounded-full bg-tertiary/[0.07] blur-[140px]" />
				<div className="absolute bottom-0 left-1/2 h-px w-[min(90%,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
			</div>

			<div className="container-page min-w-0 pt-16 pb-14 sm:pt-24 sm:pb-20 lg:pt-28 lg:pb-24">
				<div className="grid min-w-0 grid-cols-1 items-center gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
					{/* Copy column */}
					<div className="min-w-0 max-w-full">
						<m.div {...reveal(0)} className="mb-6">
							<span className="badge">
								<span
									className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse"
									aria-hidden="true"
								/>
								OpenAI-compatible · USDC on Base
							</span>
						</m.div>

						<m.h1
							{...reveal(1)}
							className="h1-hero max-w-full break-words text-text-bright sm:max-w-3xl"
							style={{ textWrap: "balance" }}
						>
							AI inference,{" "}
							<span className="italic-accent">paid per request</span> in
							USDC.
						</m.h1>

						<m.p
							{...reveal(2)}
							className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-text-secondary sm:text-[1.125rem]"
							style={{ textWrap: "pretty" }}
						>
							One gateway, {MODEL_COUNT}+ models underneath. Wallet-based auth,
							credit billing, and x402 pay-per-request for agents — drop-in
							OpenAI SDK compatibility.
						</m.p>

						<m.div
							{...reveal(3)}
							className="mt-9 flex flex-wrap items-center gap-3"
						>
							<Link
								href="/login"
								className="btn-primary inline-flex h-12 min-w-[9.5rem] items-center justify-center gap-2 px-6 text-[15px]"
							>
								<KeyRound className="h-4 w-4" aria-hidden="true" />
								Get API key
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
							<Link
								href="/chat"
								className="btn-secondary inline-flex h-12 items-center justify-center gap-2 px-5 text-[14px]"
							>
								<Sparkles className="h-4 w-4" aria-hidden="true" />
								Try chat
							</Link>
							<Link
								href="/docs#x402"
								className="btn-ghost inline-flex h-12 items-center justify-center gap-2 px-3 text-[13px] text-text-muted"
							>
								x402 pay-per-request
							</Link>
						</m.div>

						<m.ul
							{...reveal(4)}
							className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-[12px] font-mono text-text-muted"
						>
							<li className="inline-flex items-center gap-1.5">
								<Zap className="h-3 w-3 text-accent" aria-hidden="true" />
								Streaming + function calling
							</li>
							<li className="inline-flex items-center gap-1.5">
								<span className="h-1 w-1 rounded-full bg-text-tertiary" />
								SIWE wallet auth
							</li>
							<li className="inline-flex items-center gap-1.5">
								<span className="h-1 w-1 rounded-full bg-text-tertiary" />
								Circuit-breaker failover
							</li>
							<li className="inline-flex items-center gap-1.5">
								<span className="h-1 w-1 rounded-full bg-tertiary" />
								Pay in USDC
							</li>
							<li className="inline-flex items-center gap-1.5">
								<span className="h-1 w-1 rounded-full bg-tertiary" />
								Account number login
							</li>
						</m.ul>
					</div>

					{/* Live request card */}
					<m.div {...reveal(3)} className="relative">
						<div
							aria-hidden="true"
							className="absolute -inset-4 rounded-2xl bg-accent/[0.04] blur-2xl"
						/>
						<div className="relative overflow-hidden rounded-xl border border-border-hi bg-surface-elevated/90 shadow-xl backdrop-blur-sm">
							<div className="flex items-center gap-2 border-b border-border px-4 py-3">
								<span className="h-2 w-2 rounded-full bg-error/80" />
								<span className="h-2 w-2 rounded-full bg-warning/80" />
								<span className="h-2 w-2 rounded-full bg-success/80" />
								<span className="ml-2 font-mono text-[11px] text-text-muted">
									POST /v1/chat/completions
								</span>
								<span className="ml-auto rounded-full bg-accent/10 px-2 py-0.5 font-mono text-[10px] text-accent">
									200 OK · 142ms
								</span>
							</div>
							<pre className="max-w-full overflow-x-auto p-4 font-mono text-[12px] leading-relaxed text-text-secondary sm:text-[13px]">
								<code className="block w-max min-w-full">
									<span className="text-info">curl</span> https://api.oma-ai.com
									/v1/chat/completions \{"\n"}
									{"  "}
									<span className="text-text-muted">-H</span>{" "}
									<span className="text-[var(--color-secondary)]">
										&quot;Authorization: Bearer $OMA_KEY&quot;
									</span>{" "}
									\{"\n"}
									{"  "}
									<span className="text-text-muted">-d</span>{" "}
									<span className="text-[var(--color-secondary)]">
										&apos;{`{"model":"llama-3.3-70b","messages":[...]}`}&apos;
									</span>
									{"\n\n"}
									<span className="text-text-muted">
										{"// billed in USDC · settled on Base"}
									</span>
									{"\n"}
									<span className="text-accent">
										{`{ "id": "chatcmpl_…", "usage": { "total_tokens": 87 } }`}
									</span>
								</code>
							</pre>
						</div>
					</m.div>
				</div>
			</div>
		</section>
	);
}
