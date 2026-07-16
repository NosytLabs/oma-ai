"use client";

/**
 * HowItWorks — section 4 of the homepage.
 * 3-step horizontal process (vertical stack on mobile).
 * Numbered indicators use the mono numeric-mono utility.
 */

import { Key, Rocket, Wallet } from "lucide-react";
import { Reveal, RevealStagger, childFadeUp } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";
import { m } from "@/lib/framer-motion-client";
import type { LucideIcon } from "lucide-react";

interface Step {
	n: string;
	title: string;
	description: string;
	icon: LucideIcon;
}

const STEPS: Step[] = [
	{
		n: "01",
		title: "Sign in with wallet",
		description:
			"Connect any EVM wallet via SIWE. Low-friction signup — no email, no password. A private account number is issued on first request.",
		icon: Wallet,
	},
	{
		n: "02",
		title: "Get your API key",
		description:
			"One key works across every model and provider. Rotate, scope, and revoke from your dashboard at any time.",
		icon: Key,
	},
	{
		n: "03",
		title: "Pay per call with USDC",
		description:
			"Top up with USDC on Base or skip ahead with x402 per-request payments. Metered by token, billed in real-time.",
		icon: Rocket,
	},
];

export function HowItWorks() {
	return (
		<section
			aria-labelledby="how-it-works-headline"
			className="relative border-t border-border-subtle bg-[var(--color-surface)]/40 py-16 sm:py-20"
		>
			<div className="container-page">
				<Reveal>
					<SectionHeader
						id="how-it-works-headline"
						headline={
							<>
								Ship in three
								<br />
								<span className="gradient-text-accent">honest steps.</span>
							</>
						}
						subhead="No credit card, no sales call, no SDK migration. The first request lands in under sixty seconds."
					/>
				</Reveal>

				<RevealStagger
					as="ol"
					className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 relative"
					amount={0.2}
				>
					{STEPS.map((step, idx) => (
						<m.li key={step.n} variants={childFadeUp} className="relative">
							<StepCard step={step} isLast={idx === STEPS.length - 1} />
						</m.li>
					))}
				</RevealStagger>
			</div>
		</section>
	);
}

function StepCard({ step, isLast }: { step: Step; isLast: boolean }) {
	const Icon = step.icon;
	return (
		<div className="relative h-full surface-card p-7 flex flex-col gap-5">
			<div className="flex items-center justify-between">
				<span className="numeric-mono text-4xl sm:text-5xl font-bold text-accent leading-none">
					{step.n}
				</span>
				<div
					className={cn(
						"flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)]",
						"bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent",
					)}
				>
					<Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
				</div>
			</div>
			<div>
				<h3 className="font-heading text-xl font-semibold text-text-bright tracking-tight">
					{step.title}
				</h3>
				<p className="mt-2 text-sm text-text-secondary leading-relaxed">
					{step.description}
				</p>
			</div>
			{!isLast && (
				<div
					className="hidden md:block absolute top-1/2 -right-4 w-px h-12 -translate-y-1/2 bg-gradient-to-b from-transparent via-accent to-transparent opacity-50"
					aria-hidden="true"
				/>
			)}
		</div>
	);
}