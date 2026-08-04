"use client";

/**
 * Home · Hero
 *
 * Product-first landing: clear value prop, dual CTAs (try / integrate),
 * and a live code strip that shows the OpenAI-compatible surface.
 */

import { ArrowRight, BookOpen, KeyRound, Sparkles, Zap } from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import Link from "next/link";
import { MODEL_COUNT } from "@/lib/models-data";
import { PulseLines } from "@/components/pulse-lines";
import { useHasBeenInView } from "./reveal";
import { ScrambleText } from "@/components/scramble-text";
import { FloatingIcons } from "@/components/floating-icons";
import { ElectricBorder } from "@/components/electric-border";
import { JuiceButton } from "@/components/juice-button";
import { LiveRequestCard } from "./LiveRequestCard";
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

			<div className="container-page min-w-0 pt-4 pb-12 sm:pt-6 sm:pb-16 lg:pt-8 lg:pb-20">
				<div className="grid min-w-0 grid-cols-1 items-center gap-12 md:grid-cols-1 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">
					{/* Copy column */}
					<div className="min-w-0 max-w-full">
						<m.div {...reveal(0, entrance)} className="mb-5">
							<span className="badge">
								<span
									className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse"
									aria-hidden="true"
								/>
								Buy credits · card · USDC · x402
							</span>
						</m.div>

						<m.h1
							{...reveal(1, entrance)}
							className="h1-hero max-w-full text-text-bright font-extrabold text-4xl sm:text-5xl lg:text-[3.5rem] leading-[1.08] tracking-tight"
						>
							<span className="block">One OpenAI-compatible API.</span>
							<span className="block italic-accent text-accent text-3xl sm:text-4xl lg:text-[2.5rem] font-semibold mt-1 sm:mt-2">
								{MODEL_COUNT} curated models.
							</span>
							<span className="block">Credits, USDC, or x402.</span>
						</m.h1>

						<m.p
							{...reveal(2, entrance)}
							className="mt-6 max-w-xl text-[1.0625rem] leading-relaxed text-text sm:text-[1.125rem]"
							style={{ textWrap: "pretty" }}
						>
							Route inference through a single endpoint. Fund with card via
							Polar, deposit USDC on Base, or settle agent traffic per request
							with x402. Same request shape as OpenAI.
						</m.p>

						{/* First-timer callout */}
						<m.div {...reveal(3, entrance)} className="mt-5 max-w-xl">
							<Link
								href="/getting-started"
								className="group/new flex items-start gap-3 rounded-xl border border-border bg-surface/40 px-4 py-3 transition-colors hover:border-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								<span
									className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-accent/30 bg-accent/10 text-accent"
									aria-hidden="true"
								>
									<BookOpen className="h-3.5 w-3.5" />
								</span>
								<span className="min-w-0">
									<span className="block text-[13px] font-semibold text-text-bright">
										New here? Start with free chat, then get an API key.
									</span>
									<span className="mt-0.5 block text-[12px] leading-relaxed text-text-secondary">
										No sign-up for guest chat. Walk through the first request
										when you are ready.{" "}
										<span className="text-accent underline-offset-4 group-hover/new:underline">
											Getting started →
										</span>
									</span>
								</span>
							</Link>
						</m.div>

						<m.div
							{...reveal(4, entrance)}
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
										className="btn-primary inline-flex h-12 min-w-[9.5rem] items-center justify-center gap-2 px-6 text-[15px] transition-transform active:scale-[0.97]"
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
								className="btn-secondary inline-flex h-12 items-center justify-center gap-2 px-5 text-[14px] transition-transform active:scale-[0.97]"
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
								className="group/models inline-flex h-12 items-center justify-center gap-1.5 rounded-md px-3 text-[14px] font-semibold text-text-secondary transition-colors hover:text-accent"
							>
								Live models
								<span className="text-[11px] font-mono text-text-muted">· {MODEL_COUNT}</span>
							</Link>
						</m.div>

						<m.ul
							{...reveal(5, entrance)}
							className="mt-9 flex flex-wrap gap-x-4 gap-y-2 w-full text-[12px] font-mono text-text-muted sm:gap-x-5 sm:text-[12.5px]"
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
								Card or USDC
							</li>
							<li className="inline-flex items-center gap-1.5">
								<span className="h-1 w-1 rounded-full bg-tertiary" />
								<Link
									href="/models"
									className="text-text-secondary transition-colors hover:text-accent"
								>
									{MODEL_COUNT} live models
								</Link>
							</li>
							<li className="inline-flex items-center gap-1.5">
								<span className="h-1 w-1 rounded-full bg-tertiary" />
								<Link
									href="/docs#x402"
									aria-label="x402 pay-per-request — learn more"
									title="x402 is the HTTP 402 payment protocol. Agents pay per request with USDC on Base — no API key, no subscription."
									className="text-text-secondary hover:text-accent transition-colors underline-offset-4 hover:underline"
								>
									x402 pay-per-request
								</Link>
							</li>
						</m.ul>
					</div>

					{/* Live request card */}
					<m.div {...reveal(6, entrance)} className="relative w-full max-w-lg mx-auto lg:max-w-none lg:mx-0">
						<div
							aria-hidden="true"
							className="absolute -inset-4 rounded-2xl bg-accent/[0.06] blur-2xl"
						/>
						<LiveRequestCard className="relative" />
					</m.div>
				</div>
			</div>
		</section>
	);
}
