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
			{/* Atmosphere — terminal void with aperture glow */}
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10"
			>
				<div className="absolute inset-0 bg-grid-animated opacity-[0.22] mask-radial" />
				<div className="film-grain absolute inset-0 opacity-[0.35]" />
				<FloatingIcons count={6} opacity={0.05} speed={22} />
				<PulseLines
					gap={44}
					speed={10}
					lineOpacity={0.05}
					sweepOpacity={0.28}
					style={{ opacity: 0.65 }}
				/>
				<div className="absolute -left-40 top-4 h-[34rem] w-[34rem] rounded-full bg-accent/[0.10] blur-[150px]" />
				<div className="absolute right-[-12rem] top-24 h-[28rem] w-[28rem] rounded-full bg-tertiary/[0.06] blur-[150px]" />
				{/* Horizon rule — gateway threshold */}
				<div className="absolute bottom-0 left-1/2 h-px w-[min(92%,52rem)] -translate-x-1/2 bg-gradient-to-r from-transparent via-accent/45 to-transparent" />
			</div>

			<div className="container-page min-w-0 pt-5 pb-14 sm:pt-8 sm:pb-16 lg:pt-10 lg:pb-20">
				<div className="grid min-w-0 grid-cols-1 items-center gap-14 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 xl:gap-20">
					{/* Copy column */}
					<div className="min-w-0 max-w-full">
						<m.div
							{...reveal(0, entrance)}
							className="mb-6 flex flex-wrap items-center gap-3"
						>
							<span className="badge">
								<span
									className="relative flex h-1.5 w-1.5"
									aria-hidden="true"
								>
									<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-40" />
									<span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
								</span>
								Buy credits · card · USDC · x402
							</span>
							<span className="hidden font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted sm:inline">
								v2 · open gateway
							</span>
						</m.div>

						<m.h1
							{...reveal(1, entrance)}
							className="h1-hero max-w-[18ch] text-text-bright"
						>
							{/* Trailing spaces keep SR from joining block lines. */}
							<span className="block">One OpenAI-compatible API. </span>
							<span className="mt-1 block italic-accent sm:mt-1.5">
								{MODEL_COUNT} curated models.{" "}
							</span>
							<span className="mt-1 block sm:mt-1.5">
								Credits, USDC, or x402.
							</span>
						</m.h1>

						<m.p
							{...reveal(2, entrance)}
							className="mt-7 max-w-xl text-[1.0625rem] leading-[1.65] text-text-secondary sm:text-[1.125rem]"
							style={{ textWrap: "pretty" }}
						>
							Route inference through a single endpoint. Fund with card via
							Polar, deposit USDC on Base, or settle agent traffic per request
							with x402. Same request shape as OpenAI.
						</m.p>

						{/* First-timer callout — soft terminal panel */}
						<m.div {...reveal(3, entrance)} className="mt-6 max-w-xl">
							<Link
								href="/getting-started"
								className="group/new flex items-start gap-3 rounded-xl border border-border/80 bg-surface/30 px-4 py-3.5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)] transition-[border-color,background-color,box-shadow] duration-200 hover:border-accent/35 hover:bg-accent/[0.04] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--color-accent)_12%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								<span
									className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-accent/25 bg-accent/10 text-accent"
									aria-hidden="true"
								>
									<BookOpen className="h-3.5 w-3.5" />
								</span>
								<span className="min-w-0">
									<span className="block text-[13px] font-semibold tracking-tight text-text-bright">
										New here? Start with free chat, then get an API key.
									</span>
									<span className="mt-1 block text-[12px] leading-relaxed text-text-muted">
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
							className="mt-10 flex flex-wrap items-center gap-3"
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
										className="btn-primary inline-flex h-12 min-w-[10rem] items-center justify-center gap-2 px-6 text-[15px] transition-transform active:scale-[0.97]"
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
								<span className="font-mono text-[11px] text-text-muted">
									· {MODEL_COUNT}
								</span>
							</Link>
						</m.div>

						<m.ul
							{...reveal(5, entrance)}
							className="mt-10 flex w-full flex-wrap gap-x-5 gap-y-2.5 font-mono text-[11.5px] text-text-muted sm:text-[12px]"
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
									className="text-text-secondary underline-offset-4 transition-colors hover:text-accent hover:underline"
								>
									x402 pay-per-request
								</Link>
							</li>
						</m.ul>
					</div>

					{/* Live request — framed as open gateway aperture */}
					<m.div
						{...reveal(6, entrance)}
						className="relative mx-auto w-full min-w-0 max-w-lg lg:mx-0 lg:max-w-none"
					>
						<div
							aria-hidden="true"
							className="absolute -inset-6 rounded-[1.75rem] bg-accent/[0.07] blur-3xl"
						/>
						{/* Corner ticks = open ring / aperture */}
						<div
							aria-hidden="true"
							className="aperture-frame pointer-events-none absolute -inset-3 z-10"
						>
							<span className="aperture-corner aperture-tl" />
							<span className="aperture-corner aperture-tr" />
							<span className="aperture-corner aperture-bl" />
							<span className="aperture-corner aperture-br" />
						</div>
						<LiveRequestCard className="relative" />
						<p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted lg:text-left">
							Live demo · cycles models · no key required
						</p>
					</m.div>
				</div>
			</div>
		</section>
	);
}
