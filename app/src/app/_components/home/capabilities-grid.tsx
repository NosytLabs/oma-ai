"use client";

/**
 * CapabilitiesGrid — section 3 of the homepage.
 * Editorial bento: asymmetric 12-col grid with 4 story clusters.
 * Row 1: "LLM Chat" hero (8 cols) + "Pay with Card" Polar highlight (4 cols).
 * Row 2: "Crypto-Native" USDC (4 cols, tall) + 3 stacked standard cards (8 cols).
 * Row 3: 3 standard cards (routing, tool calling, private).
 * Each cluster uses a distinct visual treatment so the section reads
 * as a content magazine, not a "features grid".
 */

import {
	ArrowUpRight,
	Banknote,
	Coins,
	GitBranch,
	KeyRound,
	MessageSquare,
	ShieldCheck,
	Wallet,
	Wand2,
} from "lucide-react";
import Link from "next/link";
import { Reveal, RevealStagger, childFadeUp } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";
import { m } from "@/lib/framer-motion-client";

type CapabilityCell = "hero" | "polar" | "usdc" | "standard";

interface Capability {
	title: string;
	description: string;
	icon: typeof MessageSquare;
	cell: CapabilityCell;
	badge?: string;
	example?: string;
}

const CAPABILITIES: Capability[] = [
	{
		title: "LLM Chat",
		description:
			"One OpenAI-compatible schema. Claude, Llama, MiniMax 2.7, Kimi K2.6 — plus decentralized Gonka. Streaming, JSON-schema tools, and server-sent events all included.",
		icon: MessageSquare,
		cell: "hero",
		badge: "22+ models",
		example: "POST /v1/chat/completions",
	},
	{
		title: "Tool Calling & Streaming",
		description:
			"Native OpenAI-style function calling, JSON-schema tools, and SSE. Swap the base URL — no migration, no lock-in.",
		icon: Wand2,
		cell: "standard",
	},
	{
		title: "Model Routing",
		description:
			"Venice for premium models. Gonka for cost-effective. Per-model routing, automatic retry on transient failures, and a health-checked provider registry.",
		icon: GitBranch,
		cell: "standard",
	},
	{
		title: "Private by Default",
		description:
			"Zero data retention on prompt content. Self-hosted deployment for full control. Circuit-breaker failover keeps requests flowing.",
		icon: ShieldCheck,
		cell: "standard",
	},
];

export function CapabilitiesGrid() {
	return (
		<section
			aria-labelledby="capabilities-headline"
			className="relative py-16 sm:py-20 lg:py-24"
		>
			<div className="container-page">
				<Reveal>
					<SectionHeader
						id="capabilities-headline"
						eyebrow="Capabilities"
						headline={
							<>
								One API.
								<br />
								<span className="text-accent italic-accent">
									Every model underneath.
								</span>
							</>
						}
						subhead="Drop-in OpenAI compatibility plus routing, failover, and billing that works for humans and agents alike. Card, USDC, or x402."
					/>
				</Reveal>

				<RevealStagger className="mt-14 grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4">
					{/* Row 1 — 8 + 4 */}
					<m.div className="md:col-span-8" variants={childFadeUp}>
						<LLMChatHero capability={CAPABILITIES[0]} />
					</m.div>
					<m.div className="md:col-span-4" variants={childFadeUp}>
						<PolarCtaCard />
					</m.div>

					{/* Row 2 — 4 tall + 4 + 4 (leaves USDC card spanning 2 rows) */}
					<m.div className="md:col-span-4 md:row-span-2" variants={childFadeUp}>
						<UsdcBillingCard />
					</m.div>
					<m.div className="md:col-span-4" variants={childFadeUp}>
						<CapabilityCard capability={CAPABILITIES[1]} />
					</m.div>
					<m.div className="md:col-span-4" variants={childFadeUp}>
						<CapabilityCard capability={CAPABILITIES[2]} />
					</m.div>

					{/* Row 4 — 8 + 4 — auth + private. Auth lives next to USDC continuation. */}
					<m.div className="md:col-span-8" variants={childFadeUp}>
						<AuthLoginCard />
					</m.div>
					<m.div className="md:col-span-4" variants={childFadeUp}>
						<CapabilityCard capability={CAPABILITIES[3]} />
					</m.div>
				</RevealStagger>
			</div>
		</section>
	);
}

function LLMChatHero({ capability }: { capability: Capability }) {
	const Icon = capability.icon;
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className={cn(
				"relative h-full overflow-hidden",
				"rounded-[var(--radius-md)] p-7 sm:p-8",
				"bg-gradient-to-br from-[color-mix(in_srgb,var(--color-accent)_14%,var(--color-panel))] via-[var(--color-panel)] to-[var(--color-panel)]",
				"border border-[color-mix(in_srgb,var(--color-accent)_30%,var(--color-border))]",
				"min-h-[280px] md:min-h-[320px]",
			)}
		>
			<div
				className="absolute inset-0 -z-10 opacity-30"
				style={{
					background:
						"radial-gradient(ellipse at 90% 0%, color-mix(in srgb, var(--color-accent) 30%, transparent), transparent 60%)",
				}}
				aria-hidden="true"
			/>
			{/* Subtle grid overlay */}
			<div
				aria-hidden="true"
				className="absolute inset-0 -z-10 bg-grid opacity-[0.18] mask-radial"
			/>
			<div className="flex items-start gap-4">
				<div
					className={cn(
						"flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-sm)]",
						"bg-accent text-[var(--color-accent-fg)]",
					)}
				>
					<Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
							{capability.title}
						</h3>
						{capability.badge && (
							<span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-accent">
								{capability.badge}
							</span>
						)}
					</div>
					<p className="mt-3 text-base text-text leading-relaxed max-w-xl">
						{capability.description}
					</p>
					{capability.example && (
						<div className="mt-5 inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-border bg-[var(--color-surface)] px-3 py-2 font-mono text-xs text-text-secondary">
							<span className="text-accent">$</span>
							<span>{capability.example}</span>
						</div>
					)}
				</div>
			</div>
		</m.article>
	);
}

function PolarCtaCard() {
	return (
		<Link
			href="/deposit?method=card"
			aria-label="Buy credits with a card via Polar"
			className="group relative flex h-full min-h-[280px] md:min-h-[320px] flex-col overflow-hidden rounded-[var(--radius-md)] border-2 border-accent bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-panel))] p-6 sm:p-7"
		>
			<span className="absolute top-3 right-3 rounded-full bg-accent px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--color-accent-fg)]">
				New
			</span>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 opacity-50"
				style={{
					background:
						"radial-gradient(circle at 70% 100%, color-mix(in srgb, var(--color-accent) 35%, transparent), transparent 65%)",
				}}
			/>
			<div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] bg-accent text-[var(--color-accent-fg)]">
				<Banknote className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-5 font-heading text-2xl font-bold tracking-tight text-text-bright">
				Pay with Card
			</h3>
			<p className="mt-3 text-sm text-text leading-relaxed">
				Buy credits with Visa, Mastercard, or Apple Pay via Polar. No wallet, no
				USDC. Credits land the moment the payment settles.
			</p>
			<div className="mt-auto pt-5 flex items-center justify-between">
				<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
					Buy credits
					<ArrowUpRight
						className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
						aria-hidden="true"
					/>
				</span>
				<span className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
					via Polar
				</span>
			</div>
		</Link>
	);
}

function UsdcBillingCard() {
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className={cn(
				"relative h-full overflow-hidden",
				"rounded-[var(--radius-md)]",
				"border border-[color-mix(in_srgb,var(--color-info)_28%,var(--color-border))]",
				"bg-[color-mix(in_srgb,var(--color-info)_8%,var(--color-panel))]",
				"p-6 sm:p-7 min-h-[260px] flex flex-col",
			)}
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 opacity-40"
				style={{
					background:
						"radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--color-info) 25%, transparent), transparent 60%)",
				}}
			/>
			<div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] bg-info/15 text-info">
				<Coins className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-5 font-heading text-xl font-bold tracking-tight text-text-bright">
				Crypto-Native Billing
			</h3>
			<p className="mt-3 text-sm text-text leading-relaxed">
				USDC on Base at 1:1 USD. x402 pay-per-request for agents — no
				pre-funding, no subscriptions. Per-call ledger shows every request and
				exact cents charged.
			</p>
			<div className="mt-auto pt-5 flex flex-wrap gap-2">
				<span className="rounded-full bg-info/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-info">
					USDC · Base
				</span>
				<span className="rounded-full bg-info/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-info">
					x402 per-call
				</span>
			</div>
		</m.article>
	);
}

function AuthLoginCard() {
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className="surface-card tilt-card sheen relative h-full p-6 sm:p-7 min-h-[220px] flex flex-col"
		>
			<div className="flex items-center gap-3">
				<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent">
					<Wallet className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
				</div>
				<h3 className="font-heading text-lg font-semibold tracking-tight text-text-bright">
					Magic Link, Wallet, or Account #
				</h3>
			</div>
			<p className="mt-3 text-sm text-text leading-relaxed">
				Sign in with email magic link, Sign-In With Ethereum (SIWE), or a 16-digit
				account number. Same account either way — mint keys, top up, chat from
				any device.
			</p>
			<div className="mt-auto pt-4 flex flex-wrap gap-2">
				<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-void/60 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-secondary">
					<KeyRound className="h-3 w-3 text-accent" aria-hidden="true" />
					Magic link
				</span>
				<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-void/60 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-secondary">
					Wallet
				</span>
				<span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-void/60 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-text-secondary">
					Account #
				</span>
			</div>
		</m.article>
	);
}

function CapabilityCard({ capability }: { capability: Capability }) {
	const Icon = capability.icon;
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className="surface-card tilt-card sheen relative h-full p-6 sm:p-7 min-h-[180px] flex flex-col"
		>
			{capability.badge && (
				<span className="absolute top-3 right-3 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-accent">
					{capability.badge}
				</span>
			)}
			<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent">
				<Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-4 font-heading text-lg font-semibold tracking-tight text-text-bright">
				{capability.title}
			</h3>
			<p className="mt-2 text-sm text-text leading-relaxed">
				{capability.description}
			</p>
		</m.article>
	);
}
