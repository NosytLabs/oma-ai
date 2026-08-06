"use client";

/**
 * Home · Capabilities
 *
 * Bento-style three-pillar section with themed micro-visuals per payment
 * rail. The x402 card carries an animated request/response flow visual, the
 * USDC card carries a mini ledger strip, and the card rail carries a
 * credit-card mockup — each drawn in pure CSS so nothing depends on image
 * assets. A 4-up supporting row surfaces the operational primitives below.
 */

import {
	ArrowUpRight,
	Banknote,
	Bot,
	Coins,
	CreditCard,
	Sparkles,
	Wallet,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { Reveal, RevealStagger, childFadeUp } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";
import { m } from "@/lib/framer-motion-client";
import { MODEL_COUNT } from "@/lib/models-data";

interface Pillar {
	id: string;
	eyebrow: string;
	title: string;
	description: string;
	icon: typeof Coins;
	href: string;
	cta: string;
	accent: "emerald" | "info" | "violet";
	highlights: string[];
	visual: "card" | "ledger" | "flow";
}

const PILLARS: Pillar[] = [
	{
		id: "card-credits",
		eyebrow: "Pay with credits",
		title: "Prepaid credits",
		description:
			"Buy credits with card via Polar or deposit USDC on Base. Spend against any model at listed rates. No subscription lock-in.",
		icon: Banknote,
		href: "/pricing",
		cta: "View pricing",
		accent: "emerald",
		highlights: ["Card · Apple Pay · USDC", "Usage-based spend", "No monthly minimum"],
		visual: "card",
	},
	{
		id: "x402-native",
		eyebrow: "Agents pay per request",
		title: "x402 on Base",
		description:
			"HTTP 402 settlement for agent traffic. Sign USDC (EIP-3009) when the gateway challenges; no API key or prepaid balance required.",
		icon: Bot,
		href: "/docs#x402",
		cta: "Read x402 docs",
		accent: "violet",
		highlights: ["HTTP 402", "EIP-3009 on Base", "No pre-fund for agents"],
		visual: "flow",
	},
	{
		id: "privacy-routing",
		eyebrow: "Routing & privacy",
		title: "Multi-provider routing",
		description:
			"One gateway across Venice and OMA-AI (gonka) models. Private Venice mode by default, with circuit-breaker failover.",
		icon: Zap,
		href: "/docs#endpoints",
		cta: "API endpoints",
		accent: "info",
		highlights: ["OpenAI-compatible", "Failover routing", "Private by default"],
		visual: "ledger",
	},
];

const SUPPORT = [
	{
		id: "openai",
		icon: Sparkles,
		title: "OpenAI-compatible",
		body: "Same SDK, new baseURL. Every model, one endpoint.",
		href: "/docs#quickstart",
	},
	{
		id: "routing",
		icon: Zap,
		title: "Live routing + failover",
		body: `Circuit-breaker failover across ${MODEL_COUNT} curated models.`,
		href: "/docs#endpoints",
	},
	{
		id: "wallet",
		icon: Wallet,
		title: "SIWE wallet auth",
		body: "Sign in with any Base wallet. No password to lose.",
		href: "/docs#authentication",
	},
	{
		id: "polar-info",
		icon: CreditCard,
		title: "Powered by Polar",
		body: "Industry-standard checkout. Card details never touch OMA.",
		href: "/pricing",
	},
] as const;

const ACCENT: Record<
	Pillar["accent"],
	{ wrap: string; chip: string; ring: string; glow: string; iconBg: string; visualLine: string }
> = {
	emerald: {
		wrap: "border-accent/30 bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-panel))]",
		chip: "bg-accent/15 text-accent border-accent/30",
		ring: "hover:border-accent/60 focus-visible:ring-accent",
		glow: "0 24px 60px -30px var(--color-accent-glow)",
		iconBg: "bg-accent text-[var(--color-accent-fg)]",
		visualLine: "bg-accent",
	},
	info: {
		wrap: "border-info/30 bg-[color-mix(in_srgb,var(--color-info)_8%,var(--color-panel))]",
		chip: "bg-info/15 text-info border-info/30",
		ring: "hover:border-info/60 focus-visible:ring-info",
		glow: "0 24px 60px -30px color-mix(in srgb, var(--color-info) 60%, transparent)",
		iconBg: "bg-info/15 text-info",
		visualLine: "bg-info",
	},
	violet: {
		wrap: "border-violet/30 bg-[color-mix(in_srgb,var(--color-violet)_8%,var(--color-panel))]",
		chip: "bg-violet/15 text-violet border-violet/30",
		ring: "hover:border-violet/60 focus-visible:ring-violet",
		glow: "0 24px 60px -30px color-mix(in srgb, var(--color-violet) 60%, transparent)",
		iconBg: "bg-violet/15 text-violet",
		visualLine: "bg-violet",
	},
};

/* ── Micro-visuals (pure CSS) ─────────────────────────────────────── */

function CardMockup({ lineClass }: { lineClass: string }) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none mt-auto mb-2 w-full max-w-[280px] rounded-[16px] border border-border/80 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-panel)_85%,var(--color-accent)),var(--color-panel))] p-5 shadow-[0_16px_40px_-24px_rgba(0,0,0,0.9)] backdrop-blur-md h-[108px] flex flex-col justify-center gap-3"
		>
			<div className="flex items-center justify-between">
				<span className="font-mono text-[9px] uppercase tracking-[0.2em] text-text-muted">
					OMA Credits
				</span>
				<span className="h-3.5 w-5 rounded-[3px] bg-gradient-to-br from-accent/70 to-accent/30" />
			</div>
			<div className="flex items-center justify-between">
				<span className="font-mono text-sm tracking-[0.18em] text-text-bright/80">
					•••• 4••2
				</span>
				<span className={cn("h-1.5 w-1.5 rounded-full", lineClass)} />
			</div>
			<div className="flex items-center justify-between border-t border-border/60 pt-2.5">
				<span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
					+ $25 · settled
				</span>
				<span className="font-mono text-[10px] text-accent">1:1 USD</span>
			</div>
		</div>
	);
}

function LedgerStrip({ lineClass }: { lineClass: string }) {
	const rows = [40, 28, 48, 36, 24];
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none mt-auto mb-2 flex w-full max-w-[280px] items-end gap-2 h-[108px]"
		>
			{rows.map((h, i) => (
				<div key={i} className="flex-1">
					<div
						className={cn(
							"rounded-t-[4px] opacity-70 transition-all duration-500",
							lineClass,
						)}
						style={{ height: `${h}px` }}
					/>
				</div>
			))}
			<div className="ml-2 flex flex-col justify-end gap-1 pb-0.5">
				<span className="font-mono text-[9px] uppercase tracking-wider text-text-muted">
					ledger
				</span>
				<span className="font-mono text-[10px] text-accent">on-chain</span>
			</div>
		</div>
	);
}

function FlowVisual({ lineClass }: { lineClass: string }) {
	return (
		<div
			aria-hidden="true"
			className="pointer-events-none mt-auto mb-2 flex w-full max-w-[280px] items-center gap-2 h-[108px]"
		>
			<div className="flex flex-1 flex-col gap-1 justify-center">
				<span className="rounded-md border border-border bg-panel px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-text-secondary text-center">
					POST /v1/chat
				</span>
				<span className="rounded-md border border-border bg-panel px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-text-muted text-center">
					402 · payment
				</span>
			</div>
			<div className="flex flex-col items-center gap-1 justify-center">
				<span className={cn("h-5 w-px", lineClass)} />
				<span className="font-mono text-[9px] text-accent font-bold">x402</span>
				<span className={cn("h-5 w-px", lineClass)} />
			</div>
			<div className="flex flex-1 flex-col gap-1 justify-center">
				<span className="rounded-md border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-accent text-center">
					EIP-3009
				</span>
				<span className="rounded-md border border-border bg-panel px-2 py-1 font-mono text-[9px] uppercase tracking-wider text-text-secondary text-center">
					200 · stream
				</span>
			</div>
		</div>
	);
}

function PillarVisual({ kind, lineClass }: { kind: Pillar["visual"]; lineClass: string }) {
	if (kind === "card") return <CardMockup lineClass={lineClass} />;
	if (kind === "ledger") return <LedgerStrip lineClass={lineClass} />;
	return <FlowVisual lineClass={lineClass} />;
}

export function CapabilitiesGrid() {
	return (
		<section
			aria-labelledby="capabilities-headline"
			className="relative py-16 sm:py-20 lg:py-24"
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent"
			/>
			<div className="container-page">
				<Reveal>
					<SectionHeader
						id="capabilities-headline"
						eyebrow="Capabilities"
						headline={
							<>
								Three stories.
								<br />
								<span className="text-accent italic-accent">
									One inference surface.
								</span>
							</>
						}
						subhead="Pay with credits, pay per request, or route privately — OMA is built for maximum developer control and zero lock-in."
					/>
				</Reveal>

				<RevealStagger className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3">
					{PILLARS.map((pillar) => {
						const Icon = pillar.icon;
						const a = ACCENT[pillar.accent];
						return (
							<m.div
								key={pillar.id}
								variants={childFadeUp}
								whileHover={{ y: -4 }}
								transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
							>
								<Link
									href={pillar.href}
									aria-label={`${pillar.title} — ${pillar.cta}`}
									className={cn(
										"group relative flex h-full min-h-[400px] flex-col overflow-hidden rounded-[var(--radius-lg)] border p-8 transition-[transform,box-shadow] duration-200 ease-out",
										"hover:-translate-y-1 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2",
										a.wrap,
										a.ring,
									)}
									style={{ boxShadow: "var(--shadow-md)" }}
								>
									<div
										aria-hidden="true"
										className="pointer-events-none absolute inset-0 -z-10 opacity-50 transition-opacity duration-500 group-hover:opacity-75"
										style={{
											background:
												"radial-gradient(ellipse at 90% 100%, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent 60%)",
										}}
									/>

									<div className="flex items-center justify-between">
										<span
											className={cn(
												"inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase tracking-[0.16em]",
												a.chip,
											)}
										>
											{pillar.eyebrow}
										</span>
										<div
											className={cn(
												"flex h-11 w-11 items-center justify-center rounded-[var(--radius-md)]",
												a.iconBg,
											)}
										>
											<Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
										</div>
									</div>

									<h3 className="mt-6 font-heading text-2xl font-bold tracking-tight text-text-bright">
										{pillar.title}
									</h3>
									<p className="mt-3 text-[14px] leading-relaxed text-text">
										{pillar.description}
									</p>

									<ul className="mt-6 space-y-2.5 text-[13.5px] text-text-secondary">
										{pillar.highlights.map((h) => (
											<li key={h} className="flex items-center gap-3">
												<span
													className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
													aria-hidden="true"
												/>
												{h}
											</li>
										))}
									</ul>

									<span className="mt-8 mb-6 inline-flex items-center gap-1.5 font-semibold text-accent text-[14.5px]">
										{pillar.cta}
										<ArrowUpRight
											className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
											aria-hidden="true"
										/>
									</span>

									<PillarVisual kind={pillar.visual} lineClass={a.visualLine} />
								</Link>
							</m.div>
						);
					})}
				</RevealStagger>

				<RevealStagger
					as="ul"
					className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
				>
					{SUPPORT.map((s) => {
						const Icon = s.icon;
						return (
							<m.li
								key={s.id}
								variants={childFadeUp}
								whileHover={{ y: -3 }}
								transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
								className="h-full"
							>
								<Link
									href={s.href}
									className="group surface-card tilt-card relative flex h-full min-h-[170px] flex-col gap-4 rounded-[var(--radius-lg)] p-6 transition-shadow duration-300 hover:shadow-[0_24px_50px_-30px_rgba(0,0,0,0.9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-accent border border-accent/20">
										<Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
									</div>
									<div>
										<p className="text-[14.5px] font-semibold tracking-tight text-text-bright">
											{s.title}
										</p>
										<p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
											{s.body}
										</p>
									</div>
									<ArrowUpRight
										className="absolute right-5 top-5 h-4 w-4 text-text-muted opacity-0 transition-all duration-300 group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:opacity-100 group-hover:text-accent"
										aria-hidden="true"
									/>
								</Link>
							</m.li>
						);
					})}
				</RevealStagger>

				<Reveal>
					<div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-text-muted">
						<span className="inline-flex items-center gap-1.5">
							<span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
							Budget from $0.015 / 1M tokens
						</span>
						<span aria-hidden="true" className="text-border">·</span>
						<span>USDC at 1:1 USD — no markup</span>
						<span aria-hidden="true" className="text-border">·</span>
						<span>Credits never expire</span>
						<span aria-hidden="true" className="text-border">·</span>
						<span>Circuit-breaker failover</span>
					</div>
				</Reveal>
			</div>
		</section>
	);
}
