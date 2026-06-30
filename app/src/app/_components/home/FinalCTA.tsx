"use client";

import { m } from "framer-motion";
import { ArrowRight, Wallet } from "lucide-react";
import Link from "next/link";
import { blurInSafe, FadeIn, Magnetic, staggerContainer } from "@/lib/motion";

export function FinalCTA() {
	return (
		<section className="relative overflow-hidden">
			<div className="aurora" aria-hidden="true" />
			<div
				className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,color-mix(in_srgb,var(--color-accent-hover)_12%,transparent),color-mix(in_srgb,var(--color-accent-hover)_0%,transparent)_60%)]"
				aria-hidden="true"
			/>
			<div className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-20 sm:py-28 text-center">
				<m.h2
					variants={staggerContainer(0.18, 0.05)}
					initial="hidden"
					whileInView="show"
					viewport={{ once: true, margin: "200px 0px 200px 0px" }}
					className="text-4xl sm:text-5xl lg:text-6xl font-bold text-text-bright tracking-[-0.03em] leading-[1.05]"
				>
					<m.span variants={blurInSafe} className="block">
						Stop renting models.
					</m.span>
					<m.span
						variants={blurInSafe}
						className="block text-accent glow-text-accent"
					>
						Start paying for answers.
					</m.span>
				</m.h2>
				<FadeIn
					delay={0.08}
					className="mt-5 text-text-secondary text-base sm:text-lg max-w-xl mx-auto"
				>
					Anonymous AI inference. No KYC, no email, no sales call. Generate a
					16-digit account number in one click or use x402 pay-per-request. No
					enterprise contract, no rate limit.
				</FadeIn>
				<FadeIn
					delay={0.16}
					className="mt-8 flex flex-wrap items-center justify-center gap-3"
				>
					<Magnetic strength={6}>
						<Link
							href="/chat"
							className="btn-primary sheen glow-breathe inline-flex items-center gap-2 transition-shadow hover:glow-accent-sm"
						>
							<Wallet className="h-4 w-4" aria-hidden="true" />
							Try x402 - no signup
							<ArrowRight className="h-4 w-4" aria-hidden="true" />
						</Link>
					</Magnetic>
					<Magnetic strength={6}>
						<Link
							href="/dashboard"
							className="btn-secondary inline-flex items-center gap-2"
						>
							Open dashboard
						</Link>
					</Magnetic>
				</FadeIn>
				<FadeIn
					delay={0.24}
					className="mt-6 text-[11px] text-text-tertiary font-mono"
				>
					Source-available · No data retention
				</FadeIn>
			</div>
		</section>
	);
}
