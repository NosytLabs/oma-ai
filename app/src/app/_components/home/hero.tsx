"use client";

/**
 * Home · Hero
 * Product-first landing with a clear value proposition, focused CTAs, and
 * a compact example of the OpenAI-compatible request surface.
 */

import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import Link from "next/link";
import { LiveRequestCard } from "./LiveRequestCard";
import { springs } from "@/lib/animation";

function reveal() {
	return {
		initial: false as const,
		animate: { opacity: 1, y: 0, filter: "blur(0px)" },
		transition: { ...springs.card },
	};
}

export function Hero() {
	return (
		<section className="relative overflow-hidden">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
			>
				<div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50" />
				<div className="absolute right-[-12%] top-[18%] aspect-square w-[58%] max-w-[44rem] rounded-full bg-[radial-gradient(circle_at_center,var(--color-accent)_0%,transparent_55%)] opacity-[0.05] blur-[100px]" />
			</div>

			<div className="container-page relative z-10 min-w-0 pb-10 pt-10 sm:pb-12 sm:pt-12 lg:pb-16 lg:pt-16">
				<div className="mx-auto flex w-full max-w-5xl flex-col items-center text-center">
					<m.div {...reveal()} className="mb-5 flex items-center justify-center">
						<span className="section-eyebrow-caps">Gateway online · OpenAI-compatible</span>
					</m.div>

					<m.h1 {...reveal()} className="h1-hero max-w-4xl text-balance text-text-bright">
						<span className="block">One endpoint.</span>
						<span className="block text-accent italic">Every model.</span>
					</m.h1>

					<m.p
						{...reveal()}
						className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-text-secondary sm:mt-7 sm:text-lg md:text-xl"
					>
						One OpenAI-compatible endpoint for every model. Start in the playground, then
						create an API key when you are ready to build. Credits use USDC on Base;
						agents can settle with x402.
					</m.p>

					<m.div
						{...reveal()}
						className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:mt-9 sm:w-auto sm:flex-row"
					>
						<Link
							href="/login"
							className="btn-mono btn-primary group relative w-full overflow-hidden sm:w-auto"
						>
							<KeyRound className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
							<span>Get API key</span>
							<ArrowRight
								className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5"
								strokeWidth={2}
								aria-hidden="true"
							/>
						</Link>

						<Link href="/chat" className="btn-mono group w-full sm:w-auto">
							<Sparkles
								className="h-3.5 w-3.5 text-text-muted transition-colors duration-200 ease-out group-hover:text-accent"
								strokeWidth={1.75}
								aria-hidden="true"
							/>
							<span>Try chat</span>
						</Link>
					</m.div>

					<m.div {...reveal()} className="mt-8 w-full max-w-4xl sm:mt-10">
						<div className="flex w-full justify-center">
							<LiveRequestCard className="w-full max-w-[706px] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] ring-1 ring-border-hi/50" />
						</div>
					</m.div>
				</div>
			</div>
		</section>
	);
}
