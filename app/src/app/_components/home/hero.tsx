"use client";

/**
 * Home · Hero
 * Product-first landing with a clear value proposition, focused CTAs, and
 * a compact example of the OpenAI-compatible request surface.
 */

import { ArrowRight, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { LiveRequestCard } from "./LiveRequestCard";
import { models as modelsApi } from "@/lib/api/resources";
import { isAvailableChatModel } from "./catalog-availability";

/**
 * Live count of models actually accepting requests.
 *
 * The hero previously interpolated MODEL_COUNT, a hardcoded static fallback
 * that does not know which providers are dark. It rendered "20 models" while
 * the catalog reported 2 available — a 10x overstatement in the first
 * sentence of the page. Omits the number until
 * the catalog resolves so static rendering cannot overstate availability.
 */
function useLiveModelCount(): number | null {
	const [count, setCount] = useState<number | null>(null);
	useEffect(() => {
		let cancelled = false;
		modelsApi
			.list()
			.then((res) => {
				if (cancelled) return;
				const live = (res.data ?? []).filter(isAvailableChatModel).length;
				setCount(live);
			})
			.catch(() => {
				/* Omit the count while availability is unknown. */
			});
		return () => {
			cancelled = true;
		};
	}, []);
	return count;
}

export function Hero() {
	const liveCount = useLiveModelCount();
	// Until the catalog resolves, omit the number entirely rather than
	// assert a static count we cannot currently stand behind.
	const scale = liveCount === null ? "a curated model catalog" : `${liveCount} live ${liveCount === 1 ? "model" : "models"}`;

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
					<div className="mb-5 flex items-center justify-center">
						<span className="section-eyebrow-caps">Open model access · OpenAI-compatible</span>
					</div>

					<h1 className="h1-hero max-w-4xl text-balance text-text-bright">
						<span className="block">One API.</span>
						<span className="block text-accent italic">Switch models freely.</span>
					</h1>

					<p className="mx-auto mt-6 max-w-2xl text-balance text-base leading-relaxed text-text-secondary sm:mt-7 sm:text-lg lg:text-xl">
						One OpenAI-compatible key and {scale}. Change the model ID to change the
						model — no new integration, no new account. Try it free in the playground.
					</p>

					<div className="mt-8 flex w-full flex-col items-center justify-center gap-3 sm:mt-9 sm:w-auto sm:flex-row">
						<Link
							href="/login?next=/dashboard"
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

						<Link
							href="/chat"
							prefetch={false}
							className="btn-mono group w-full sm:w-auto">
							<Sparkles
								className="h-3.5 w-3.5 text-text-muted transition-colors duration-200 ease-out group-hover:text-accent"
								strokeWidth={1.75}
								aria-hidden="true"
							/>
							<span>Try chat</span>
						</Link>
					</div>

					<div className="mt-8 w-full max-w-4xl sm:mt-10">
						<div className="flex w-full justify-center">
							<LiveRequestCard className="w-full max-w-[706px] shadow-[0_40px_80px_-20px_rgba(0,0,0,1)] ring-1 ring-border-hi/50" />
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
