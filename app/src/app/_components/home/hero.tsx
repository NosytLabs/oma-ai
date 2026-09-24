"use client";

/**
 * Home · Hero
 * Product-first landing with a clear value proposition, focused CTAs, and
 * a compact example of the OpenAI-compatible request surface.
 */

import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import { m } from "@/lib/framer-motion-client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveRequestCard } from "./LiveRequestCard";
import { models as modelsApi } from "@/lib/api/resources";
import { springs } from "@/lib/animation";

/**
 * Live count of models actually accepting requests.
 *
 * The hero previously interpolated MODEL_COUNT, a hardcoded static fallback
 * that does not know which providers are dark. It rendered "20 models" while
 * the catalog reported 2 available — a 10x overstatement in the first
 * sentence of the page. Falls back to the static number only until the
 * catalog resolves, so SSR still has something truthful-ish to paint, and
 * never renders a zero or a stale claim once live data arrives.
 */
function useLiveModelCount(): number | null {
	const [count, setCount] = useState<number | null>(null);
	useEffect(() => {
		let cancelled = false;
		modelsApi
			.list()
			.then((res) => {
				if (cancelled) return;
				const live = (res.data ?? []).filter((m) => m.available !== false).length;
				setCount(live > 0 ? live : null);
			})
			.catch(() => {
				/* keep the static fallback; the API may be briefly down */
			});
		return () => {
			cancelled = true;
		};
	}, []);
	return count;
}

function reveal() {
	return {
		initial: false as const,
		animate: { opacity: 1, y: 0, filter: "blur(0px)" },
		transition: { ...springs.card },
	};
}

export function Hero() {
	const liveCount = useLiveModelCount();
	// Until the catalog resolves, omit the number entirely rather than
	// assert a static count we cannot currently stand behind.
	const scale = liveCount ? `${liveCount} live models` : "a live model catalog";

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
						<span className="block">One API.</span>
						<span className="block text-accent italic">Switch models freely.</span>
					</m.h1>

					<m.p
						{...reveal()}
						className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-text-secondary sm:mt-7 sm:text-lg md:text-xl"
					>
						One OpenAI-compatible key and {scale}. Change the model ID to change the
						model — no new integration, no new account. Try it free in the playground.
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
