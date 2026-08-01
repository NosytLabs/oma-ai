"use client";

import {
	ArrowUpRight,
	Banknote,
	Coins,
	Link2,
	MessageSquare,
	ShieldCheck,
} from "lucide-react";
import Link from "next/link";
import { Reveal, RevealStagger, childFadeUp } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";
import { m } from "@/lib/framer-motion-client";

interface Capability {
	title: string;
	description: string;
	icon: typeof MessageSquare;
	badge?: string;
	example?: string;
}

const CAPABILITIES: Capability[] = [
	{
		title: "Pay with credits",
		description:
			"Buy credits upfront at 1:1 USD. Credits are non-redeemable and expire 12 months after deposit, so your spend stays clear and predictable.",
		icon: Coins,
		badge: "1:1 USD",
		example: "credits → inference",
	},
	{
		title: "Agents pay per request",
		description:
			"x402 lets an agent settle each inference request directly on Base. No pre-funding, subscriptions, or API key required.",
		icon: Link2,
		badge: "x402",
		example: "HTTP 402 → USDC",
	},
	{
		title: "Routing & privacy",
		description:
			"Route across multiple providers with health checks and circuit-breaker failover, while zero data retention keeps prompt content private.",
		icon: ShieldCheck,
		badge: "zero retention",
		example: "OMA → provider → response",
	},
];

const SUPPORT_CAPABILITIES: Capability[] = [
	{
		title: "OpenAI-compatible",
		description:
			"Keep your existing SDK. Change the base URL, choose a model, and stream responses with tool calling through one stable interface.",
		icon: MessageSquare,
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
								Three pillars.
								<br />
								<span className="text-accent italic-accent">One gateway.</span>
							</>
						}
						subhead="Pay upfront or per request, then route every call through one private, OpenAI-compatible gateway."
					/>
				</Reveal>

				<RevealStagger className="mt-12 space-y-4">
					<m.div
						className="grid grid-cols-1 gap-4 md:grid-cols-3"
						variants={childFadeUp}
					>
						{CAPABILITIES.map((capability) => (
							<LLMChatHero key={capability.title} capability={capability} />
						))}
					</m.div>

					<m.div
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
						variants={childFadeUp}
					>
						<PolarCtaCard />
						<UsdcBillingCard />
						<X402DetailsCard />
						<CapabilityCard capability={SUPPORT_CAPABILITIES[0]} />
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
				"group relative h-full overflow-hidden",
				"rounded-[var(--radius-lg)] p-6",
				"bg-gradient-to-br from-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-panel))] via-[var(--color-panel)] to-[var(--color-panel)]",
				"border border-[color-mix(in_srgb,var(--color-accent)_28%,var(--color-border))]",
				"min-h-[260px] tilt-card sheen",
				"transition-shadow duration-300 group-hover:shadow-[0_24px_60px_-30px_var(--color-accent-glow)]",
			)}
		>
			<div
				className="absolute inset-0 -z-10 opacity-30 transition-opacity duration-500 group-hover:opacity-50"
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
			{/* Animated corner tick — gives the card a "live" feel */}
			<span
				aria-hidden="true"
				className="absolute right-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-accent/20 bg-accent/[0.07] px-2 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-accent"
			>
				<span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
				live
			</span>
			<div className="flex items-start gap-4">
				<div
					className={cn(
						"flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-md)]",
						"bg-accent text-[var(--color-accent-fg)]",
						"shadow-[0_8px_24px_-12px_var(--color-accent-glow)]",
					)}
				>
					<Icon className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h3 className="font-heading text-xl sm:text-2xl font-bold tracking-tight text-text-bright">
							{capability.title}
						</h3>
						{capability.badge && (
							<span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-wider text-accent">
								{capability.badge}
							</span>
						)}
					</div>
					<p className="mt-3 text-[15px] text-text leading-relaxed max-w-xl">
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
			className="group relative flex h-full min-h-[250px] flex-col overflow-hidden rounded-[var(--radius-lg)] border-2 border-accent bg-[color-mix(in_srgb,var(--color-accent)_10%,var(--color-panel))] p-6 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_24px_60px_-28px_var(--color-accent-glow)] active:scale-[0.99]"
		>
			<span className="absolute top-3 right-3 rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-[0.16em] text-[var(--color-accent-fg)]">
				New
			</span>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 opacity-50 transition-opacity duration-500 group-hover:opacity-70"
				style={{
					background:
						"radial-gradient(circle at 70% 100%, color-mix(in srgb, var(--color-accent) 35%, transparent), transparent 65%)",
				}}
			/>
			<div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-accent text-[var(--color-accent-fg)] shadow-[0_8px_24px_-12px_var(--color-accent-glow)]">
				<Banknote className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-5 font-heading text-2xl font-bold tracking-tight text-text-bright">
				Pay with card
			</h3>
			<p className="mt-3 text-[14px] text-text leading-relaxed">
				Buy credits via Polar with Visa, Mastercard, or Apple Pay. Credits land the
				moment the payment settles.
			</p>
			<div className="mt-auto pt-5 flex items-center justify-between">
				<span className="inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
					Buy credits
					<ArrowUpRight
						className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
						aria-hidden="true"
					/>
				</span>
				<span className="text-[10px] font-mono uppercase tracking-[0.18em] text-text-muted">
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
				"group relative h-full overflow-hidden",
				"rounded-[var(--radius-lg)]",
				"border border-[color-mix(in_srgb,var(--color-info)_28%,var(--color-border))]",
				"bg-[color-mix(in_srgb,var(--color-info)_8%,var(--color-panel))]",
				"p-6 min-h-[250px] flex flex-col",
				"transition-shadow duration-300 group-hover:shadow-[0_24px_60px_-30px_color-mix(in_srgb,var(--color-info)_60%,transparent)]",
			)}
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 -z-10 opacity-40 transition-opacity duration-500 group-hover:opacity-55"
				style={{
					background:
						"radial-gradient(ellipse at 100% 0%, color-mix(in srgb, var(--color-info) 25%, transparent), transparent 60%)",
				}}
			/>
			<div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-md)] bg-info/15 text-info">
				<Coins className="h-6 w-6" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-5 font-heading text-xl font-bold tracking-tight text-text-bright">
				USDC on Base deposit
			</h3>
			<p className="mt-3 text-[14px] text-text leading-relaxed">
				Deposit USDC on Base at 1:1 USD. Settlement is immediate on confirmation,
				with a per-call ledger showing every request and exact credits charged.
			</p>
			<div className="mt-auto pt-5 flex flex-wrap gap-2">
				<span className="rounded-full bg-info/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-info">
					USDC · Base
				</span>
				<span className="rounded-full bg-info/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-[0.14em] text-info">
					1:1 USD
				</span>
			</div>
		</m.article>
	);
}

function X402DetailsCard() {
	return (
		<Link
			href="/docs#x402"
			className="surface-card tilt-card sheen group relative flex h-full min-h-[250px] flex-col rounded-[var(--radius-lg)] p-6 transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_24px_60px_-30px_var(--color-accent-glow)] active:scale-[0.99]"
		>
			<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent">
				<Link2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-4 font-heading text-lg font-semibold tracking-tight text-text-bright">
				x402 technical details
			</h3>
			<p className="mt-2 text-[14px] text-text leading-relaxed">
				See the payment challenge, settlement headers, Base network details, and a
				complete agent request flow.
			</p>
			<span className="mt-auto pt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent">
				Read the protocol
				<ArrowUpRight
					className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
					aria-hidden="true"
				/>
			</span>
		</Link>
	);
}

function CapabilityCard({ capability }: { capability: Capability }) {
	const Icon = capability.icon;
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className="surface-card tilt-card sheen relative h-full rounded-[var(--radius-lg)] p-6 min-h-[250px] flex flex-col transition-shadow duration-300 hover:shadow-[0_24px_60px_-30px_var(--color-accent-glow)]"
		>
			{capability.badge && (
				<span className="absolute top-3 right-3 rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.14em] text-accent">
					{capability.badge}
				</span>
			)}
			<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent">
				<Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-4 font-heading text-lg font-semibold tracking-tight text-text-bright">
				{capability.title}
			</h3>
			<p className="mt-2 text-[14px] text-text leading-relaxed">
				{capability.description}
			</p>
		</m.article>
	);
}
