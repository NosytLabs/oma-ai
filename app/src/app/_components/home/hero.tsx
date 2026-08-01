"use client";

/**
 * Home · Hero
 *
 * Product-first landing: clear value prop, dual CTAs (try / integrate),
 * and a live code strip that shows the OpenAI-compatible surface.
 */

import { ArrowRight, Info, KeyRound, Sparkles, Zap } from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import Link from "next/link";
import { MODEL_COUNT } from "@/lib/models-data";
import { PulseLines } from "@/components/pulse-lines";
import { useHasBeenInView } from "./reveal";
import { ScrambleText } from "@/components/scramble-text";
import { FloatingIcons } from "@/components/floating-icons";
import { ElectricBorder } from "@/components/electric-border";
import { JuiceButton } from "@/components/juice-button";
import Image from "next/image";
import { springs } from "@/lib/animation";

// Entrance animation props. Until the page has been live a moment
// (`enabled`), render plain HTML so the hero copy paints immediately —
// LCP-safe SSR, crawlers and screenshots see real content.
function reveal(index: number, enabled: boolean) {
	if (!enabled) return {};
	return {
		initial: { opacity: 0, y: 16 },
		animate: { opacity: 1, y: 0 },
		transition: {
			...springs.card, // stiffness 320 / damping 24 — Kinetics-style overshoot
			delay: 0.05 + index * 0.06,
		},
	};
}

export function Hero() {
	const entrance = useHasBeenInView();
	return (
		<section className="relative overflow-hidden">
			{/* Atmosphere */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10"
			>
				<div className="absolute inset-0 bg-grid opacity-[0.28] mask-radial" />
				{/* FloatingIcons — subtly drifting crypto symbols in the background */}
				<FloatingIcons count={6} opacity={0.06} speed={20} />
				{/* PulseLines — Originkit-inspired sweep. Sits beneath the
				    radial blobs; reads as ambient depth, never competes with copy. */}
				<PulseLines
					gap={42}
					speed={9}
					lineOpacity={0.06}
					sweepOpacity={0.32}
					style={{ opacity: 0.7 }}
				/>
				<div className="absolute -left-40 top-8 h-[32rem] w-[32rem] rounded-full bg-accent/[0.09] blur-[140px]" />
				<div className="absolute right-[-10rem] top-32 h-[26rem] w-[26rem] rounded-full bg-tertiary/[0.07] blur-[140px]" />
				<div className="absolute bottom-0 left-1/2 h-px w-[min(90%,48rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
			</div>

			<div className="container-page min-w-0 pt-6 pb-12 sm:pt-10 sm:pb-16 lg:pt-12 lg:pb-20">
				<div className="grid min-w-0 grid-cols-1 items-center gap-12 md:grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
					{/* Copy column */}
					<div className="min-w-0 max-w-full">
						<m.div {...reveal(0, entrance)} className="mb-6">
							<span className="badge">
								<span
									className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse"
									aria-hidden="true"
								/>
								OpenAI-compatible · USDC on Base
							</span>
						</m.div>

						<m.h1
							{...reveal(1, entrance)}
							className="h1-hero max-w-full text-text-bright font-extrabold text-4xl sm:text-5xl lg:text-6xl leading-tight"
						>
							<span className="block">AI inference,</span>
							<span className="italic-accent block mt-2 text-accent font-semibold text-2xl sm:text-3xl">paid per request</span>
							<span className="block">in USDC.</span>
						</m.h1>

						<m.p
							{...reveal(2, entrance)}
							className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-text-secondary sm:text-[1.125rem]"
							style={{ textWrap: "pretty" }}
						>
							One gateway, {MODEL_COUNT}+ models underneath. Wallet-based auth,
							credit billing, and x402 pay-per-request for agents — drop-in
							OpenAI SDK compatibility.
						</m.p>

						<m.div
							{...reveal(3, entrance)}
							className="mt-9 flex flex-wrap items-center gap-3"
						>
							<JuiceButton
								color="var(--color-accent)"
								size={160}
								opacity={0.15}
								className="rounded-full"
							>
								<ElectricBorder
									borderRadius="9999px"
									borderWidth={1}
									active={true}
									className="electric-border-host"
								>
									<Link
										href="/login"
										className="btn-primary inline-flex h-12 min-w-[9.5rem] items-center justify-center gap-2 px-6 text-[15px]"
									>
										<KeyRound className="h-4 w-4" aria-hidden="true" />
										<ScrambleText
											text="Get API key"
											trigger="hover"
											as="span"
											className="inline-block"
										/>
										<ArrowRight className="h-4 w-4" aria-hidden="true" />
									</Link>
								</ElectricBorder>
							</JuiceButton>
							<Link
								href="/chat"
								className="btn-secondary inline-flex h-12 items-center justify-center gap-2 px-5 text-[14px]"
							>
								<Sparkles className="h-4 w-4" aria-hidden="true" />
								<ScrambleText
									text="Try chat"
									trigger="hover"
									as="span"
									className="inline-block"
								/>
							</Link>
							<Link
								href="/models"
								className="btn-ghost inline-flex h-12 items-center justify-center gap-2 px-3 text-[13px] text-text-muted"
							>
								<ScrambleText
									text="View Live Models"
									trigger="hover"
									as="span"
									className="inline-block"
								/>
								<span className="ml-2 text-xs font-mono text-text-muted">
									{MODEL_COUNT}+
								</span>
							</Link>
							<Link
								href="/docs#x402"
								aria-label="x402 pay-per-request — learn more"
								title="x402 is the HTTP 402 payment protocol. Agents pay per request with USDC on Base — no API key, no subscription."
								className="group/x402 btn-ghost inline-flex h-12 items-center justify-center gap-1.5 px-3 text-[13px] text-text-muted"
							>
								<span>x402 pay-per-request</span>
								<Info
									className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover/x402:opacity-100"
									aria-hidden="true"
								/>
							</Link>
						</m.div>

						<m.ul
							{...reveal(4, entrance)}
							className="mt-8 flex flex-wrap gap-x-3 gap-y-2 w-full text-[12px] font-mono text-text-muted sm:gap-x-5 sm:text-[13px]"
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
					<m.div {...reveal(3, entrance)} className="relative w-full max-w-lg mx-auto lg:max-w-none lg:mx-0">
						<div
							aria-hidden="true"
							className="absolute -inset-4 rounded-2xl bg-accent/[0.06] blur-2xl"
						/>
						<div className="relative overflow-hidden rounded-xl border border-border-hi bg-surface-elevated/90 shadow-xl backdrop-blur-sm">
							<div className="border-b border-border p-3">
								<div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg border border-border bg-panel">
									<Image
										src="/og-image.webp"
										alt="OMA AI inference gateway preview"
										width={1280}
										height={720}
										priority
										fetchPriority="high"
										sizes="(min-width: 1024px) 32rem, 100vw"
										className="h-full w-full object-cover"
									/>
									<div
										aria-hidden="true"
										className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-void/60 via-transparent to-accent/10"
									/>
								</div>
							</div>
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
