"use client";

/**
	* Home · Hero
	*
	* Product-first landing: clear value prop, dual CTAs (try / integrate),
	* and a live code strip that shows the OpenAI-compatible surface.
	*
	* Spec-sheet polish (2026-08-16):
	* - Larger hero h1 (up to 6.5rem cap) with emerald italic accent on the
	*   punchline line — the "Every model." still leans Instrument Serif
	*   italic but the surrounding type is tighter and reads sharper.
	* - "Gateway online" pill replaced with mono uppercase status line
	*   (matches gonka's all-caps mono kicker convention).
	* - CTAs use the new .btn-mono utility so the "Get API key" slab is
	*   pixel-identical wherever it appears (nav + hero + final-cta).
	*/

import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import Link from "next/link";
import { LiveRequestCard } from "./LiveRequestCard";
import { springs } from "@/lib/animation";


// Entrance props. The hero copy is already painted by SSR — replaying a
// hidden→visible animation after hydration (the old `enabled` gate did exactly
// that ~350ms in) flashes the headline out and back on every visit. So the
// mount state is always final (`initial: false`): no flash, no layout shift,
// and headless captures see the real content. Scroll-triggered sections below
// the fold keep their reveals (see ./reveal.tsx).
function reveal() {
	return {
		initial: false as const,
		animate: { opacity: 1, y: 0, filter: "blur(0px)" },
		transition: {
			...springs.card, // stiffness 320 / damping 24 — Kinetics-style overshoot
		},
	};
}

export function Hero() {
	return (
<section className="relative overflow-hidden flex flex-col">
			{/* Atmosphere — calm spec sheet: faint grid + single accent wash.
			   Pulled radial-orb intensity 50% (mix-blend-screen + opacity 0.12
			   → mix-blend-normal + opacity 0.06) so the hero doesn't fight
			   the headline; precision beats ambient drift. */}
			<div
			aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
			>
				<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50" />
				<div className="absolute right-[-12%] top-[18%] aspect-square w-[58%] max-w-[44rem] rounded-full bg-[radial-gradient(circle_at_center,var(--color-accent)_0%,transparent_55%)] opacity-[0.05] blur-[100px]" />
			</div>

			<div className="container-page relative z-10 min-w-0 pb-10 pt-12 lg:pb-16 lg:pt-20 flex-1">
				<div className="flex flex-col items-center justify-center text-center max-w-5xl mx-auto">
					<m.div
						{...reveal()}
						className="mb-5 flex items-center justify-center"
					>
						<span className="section-eyebrow-caps">
							Gateway online · OpenAI-compatible
						</span>
					</m.div>

					<m.h1
						{...reveal()}
						className="h1-hero text-balance text-text-bright"
					>
						<span className="block">One endpoint.</span>
						<span className="block text-accent italic">
							Every model.
						</span>
					</m.h1>

					<m.p
						{...reveal()}
						className="mt-7 text-balance text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed text-text-secondary"
					>
						One OpenAI&#8209;compatible endpoint for every model. Fund with
						card, deposit USDC on Base, or let agents settle per request with
						x402.
					</m.p>

					<m.div
						{...reveal()}
						className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3 w-full sm:w-auto"
					>
						<Link
							href="/login"
							className="btn-mono btn-primary group relative overflow-hidden w-full sm:w-auto"
						>
							<KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
							<span>Get API key</span>
							<ArrowRight
								className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
								strokeWidth={2}
								aria-hidden="true"
							/>
						</Link>

						<Link
							href="/chat"
							className="btn-mono group w-full sm:w-auto"
						>
							<Sparkles
								className="h-3.5 w-3.5 text-text-muted transition-colors duration-200 ease-out group-hover:text-accent"
								strokeWidth={1.75}
								aria-hidden="true"
							/>
							<span>Try chat</span>
						</Link>
					</m.div>

					<m.div
						{...reveal()}
						className="mt-12 w-full max-w-4xl mx-auto flex justify-center perspective-[1200px]"
					>
						<div className="transform-gpu transition-transform duration-200 ease-out hover:rotate-x-[2deg] hover:rotate-y-[-1deg] hover:scale-[1.01] w-full flex justify-center">
							<LiveRequestCard className="shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] ring-1 ring-border-hi/50 w-full max-w-[706px]" />
						</div>
					</m.div>
				</div>
			</div>
		</section>
	);
}
