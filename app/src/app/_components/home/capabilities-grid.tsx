"use client";

import {
	ArrowUpRight,
	Banknote,
	Coins,
	Link2,
	MessageSquare,
	ShieldCheck,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Reveal, RevealStagger, childFadeUp } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/components/ui/utils";
import { m } from "@/lib/framer-motion-client";

const AgentSessionDemo = dynamic(
	() =>
		import("@/components/marketing/AgentSessionDemo").then(
			(mod) => mod.AgentSessionDemo,
		),
	{
		ssr: false,
		loading: () => <Skeleton className="h-[380px] w-full rounded-xl" />,
	},
);

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
		title: "OpenAI-compatible chat",
		description:
			"Use the familiar chat completions surface with streaming, JSON-schema tools, and real models like GLM 4.7, Qwen 3.7 Max, and Venice Uncensored 1.2.",
		icon: MessageSquare,
	},
	{
		title: "Private by default",
		description:
			"Zero retention on prompt content, with a self-hosted option when your team needs full control.",
		icon: ShieldCheck,
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

				<RevealStagger className="mt-14 space-y-4">
					<m.div
						className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4"
						variants={childFadeUp}
					>
						<div className="md:col-span-8 md:row-span-2">
							<LLMChatHero capability={CAPABILITIES[0]} />
						</div>
						<div className="md:col-span-4">
							<PolarCtaCard />
						</div>
						<div className="md:col-span-4">
							<UsdcBillingCard />
						</div>
					</m.div>

					<m.div
						className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4"
						variants={childFadeUp}
					>
						<div className="md:col-span-8 md:row-span-2">
							<LLMChatHero capability={CAPABILITIES[1]} />
						</div>
						<div className="md:col-span-4">
							<AgentSessionCard />
						</div>
						<div className="md:col-span-4">
							<X402DetailsCard />
						</div>
					</m.div>

					<m.div
						className="grid grid-cols-1 gap-3 md:grid-cols-12 md:gap-4"
						variants={childFadeUp}
					>
						<div className="md:col-span-8 md:row-span-2">
							<LLMChatHero capability={CAPABILITIES[2]} />
						</div>
						<div className="md:col-span-4">
							<CapabilityCard capability={SUPPORT_CAPABILITIES[0]} />
						</div>
						<div className="md:col-span-4">
							<CapabilityCard capability={SUPPORT_CAPABILITIES[1]} />
						</div>
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
				"min-h-[280px] md:min-h-[320px] tilt-card sheen",
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
				Pay with card
			</h3>
			<p className="mt-3 text-sm text-text leading-relaxed">
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
				USDC on Base deposit
			</h3>
			<p className="mt-3 text-sm text-text leading-relaxed">
				Deposit USDC on Base at 1:1 USD. Settlement is immediate on confirmation,
				with a per-call ledger showing every request and exact credits charged.
			</p>
			<div className="mt-auto pt-5 flex flex-wrap gap-2">
				<span className="rounded-full bg-info/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-info">
					USDC · Base
				</span>
				<span className="rounded-full bg-info/15 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-info">
					1:1 USD
				</span>
			</div>
		</m.article>
	);
}

function AgentSessionCard() {
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className="surface-card tilt-card sheen relative h-full min-h-[220px] overflow-hidden p-2"
		>
			<AgentSessionDemo className="border-0 shadow-none [&_[role=region]]:max-h-[190px]" />
		</m.article>
	);
}

function X402DetailsCard() {
	return (
		<Link
			href="/docs#x402"
			className="surface-card tilt-card sheen group relative flex h-full min-h-[220px] flex-col p-6 sm:p-7"
		>
			<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent">
				<Link2 className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-4 font-heading text-lg font-semibold tracking-tight text-text-bright">
				x402 technical details
			</h3>
			<p className="mt-2 text-sm text-text leading-relaxed">
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
