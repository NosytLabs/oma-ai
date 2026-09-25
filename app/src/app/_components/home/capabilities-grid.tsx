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
import {
	Reveal,
	RevealStagger,
} from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";
import { MODEL_COUNT, MODELS, formatPricePerMillion } from "@/lib/models-data";

// Cheapest catalog input rate — derived from the synced fallback catalog so
// the marketing "from" figure always matches the real price list.
const MIN_INPUT_PRICE = Math.min(
	...MODELS.map((m) => m.inputPricePer1M).filter((p) => p > 0),
);

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
	"Deposit USDC on Base, or use card checkout when the operator enables Polar. Spend against any model at listed rates. No subscription lock-in.",
	icon: Banknote,
	href: "/pricing",
	cta: "View pricing",
	accent: "emerald",
	highlights: [
	"USDC · optional card checkout",
	"Usage-based spend",
	"No monthly minimum",
	],
	visual: "card",
	},
	{
	id: "x402-native",
	eyebrow: "Agent USDC settlement",
	title: "x402 on Base",
	description:
	"Advanced EIP-3009 USDC authorizations for agents. Verify, settle from an authenticated account, then spend the credited balance with an API key.",
	icon: Bot,
	href: "/docs#x402",
	cta: "Advanced payment docs",
	accent: "violet",
	highlights: ["EIP-3009 on Base", "No card for agents", "Credits after settle"],
	visual: "flow",
	},
	{
	id: "privacy-routing",
	eyebrow: "Routing & privacy",
	title: "Multi-provider routing",
	description:
	"One gateway across Venice and OMA-AI models. OMA does not persist prompt or completion content; upstream handling depends on the selected provider and model.",
	icon: Zap,
	href: "/docs#endpoints",
	cta: "API endpoints",
	accent: "info",
	highlights: ["OpenAI-compatible", "Circuit-breaker protection", "No OMA prompt logging"],
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
	title: "Polar card checkout",
	body: "When enabled, checkout is hosted by Polar and card details never touch OMA.",
	href: "/pricing",
	},
] as const;

const ACCENT: Record<
	Pillar["accent"],
	{
	wrap: string;
	chip: string;
	ring: string;
	glow: string;
	iconBg: string;
	visualLine: string;
	}
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
	<div className="mt-auto mb-2 mx-auto w-full max-w-[280px]">
	<div
	aria-hidden="true"
	className="pointer-events-none w-full rounded-[var(--radius-lg)] border border-border/80 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-panel)_85%,var(--color-accent)),var(--color-panel))] p-5 shadow-lg backdrop-blur-md h-[108px] flex flex-col justify-center gap-3"
	>
	<div className="flex items-center justify-between">
	<span className="font-mono text-[10px] uppercase tracking-[0.2em] text-text-muted">
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
	<span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
	+ $25 · settled
	</span>
	<span className="font-mono text-[10px] text-accent">1:1 USD</span>
	</div>
	</div>
	</div>
	);
}

function LedgerStrip({ lineClass }: { lineClass: string }) {
	const rows = [40, 28, 48, 36, 24];
	return (
	<div className="mt-auto mb-2 mx-auto w-full max-w-[280px]">
	<div
	aria-hidden="true"
	className="pointer-events-none flex w-full items-end gap-2 h-[108px]"
	>
	{rows.map((h, i) => (
	<div key={i} className="flex-1">
	<div
	className={cn(
	"rounded-t-[4px] opacity-70 transition-[background-color,border-color,color,transform,box-shadow,opacity] duration-500",
	lineClass,
	)}
	style={{ height: `${h}px` }}
	/>
	</div>
	))}
	<div className="ml-2 flex flex-col justify-end gap-1 pb-0.5">
	<span className="font-mono text-[10px] uppercase tracking-wider text-text-muted">
	ledger
	</span>
	<span className="font-mono text-[10px] text-accent">routed</span>
	</div>
	</div>
	</div>
	);
}

function FlowVisual({ lineClass }: { lineClass: string }) {
	return (
	<div className="mt-auto mb-2 mx-auto w-full max-w-[280px]">
	<div
	aria-hidden="true"
	className="pointer-events-none flex w-full items-center gap-2 h-[108px]"
	>
	<div className="flex flex-1 flex-col gap-1 justify-center">
	<span className="rounded-[var(--radius-md)] border border-border bg-panel px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary text-center">
	POST /x402/verify
	</span>
	<span className="rounded-[var(--radius-md)] border border-border bg-panel px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-muted text-center">
	POST /x402/settle
	</span>
	</div>
	<div className="flex flex-col items-center gap-1 justify-center">
	<span className={cn("h-5 w-px", lineClass)} />
	<span className="font-mono text-[10px] text-accent font-bold">
	x402
	</span>
	<span className={cn("h-5 w-px", lineClass)} />
	</div>
	<div className="flex flex-1 flex-col gap-1 justify-center">
	<span className="rounded-[var(--radius-md)] border border-accent/40 bg-accent/10 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-accent text-center">
	EIP-3009
	</span>
	<span className="rounded-[var(--radius-md)] border border-border bg-panel px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-text-secondary text-center">
	200 · credited
	</span>
	</div>
	</div>
	</div>
	);
}

function PillarVisual({
	kind,
	lineClass,
}: {
	kind: Pillar["visual"];
	lineClass: string;
}) {
	if (kind === "card") return <CardMockup lineClass={lineClass} />;
	if (kind === "ledger") return <LedgerStrip lineClass={lineClass} />;
	return <FlowVisual lineClass={lineClass} />;
}

export function CapabilitiesGrid() {
	return (
		<section
		aria-labelledby="capabilities-headline"
		className="relative py-12 sm:py-16 lg:py-20"
		>
		<div className="container-page">
<Reveal>
	<SectionHeader
		id="capabilities-headline"
		eyebrow="Capabilities"
		eyebrowVariant="caps"
		headline={
		<>
		Three stories.
		<br />
		<span className="text-accent font-bold not-italic">
		One inference surface.
		</span>
		</>
		}
		subhead="Pay with credits, settle USDC via x402, or route privately. No subscription, no vendor lock-in."
	/>
	</Reveal>

	<RevealStagger className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
		{PILLARS.map((pillar) => {
			const Icon = pillar.icon;
			const a = ACCENT[pillar.accent];
			return (
				<div
					key={pillar.id}
					className="reveal-child lift"
				>
					<Link
						href={pillar.href}
						className={cn(
							"group relative flex h-full min-h-0 sm:min-h-[332px] flex-col overflow-hidden rounded-[var(--radius-lg)] border p-6 transition-[transform,box-shadow,border-color] duration-200 ease-out",
							"active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2",
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
								<Icon
									className="h-5 w-5"
									strokeWidth={1.5}
									aria-hidden="true"
								/>
							</div>
						</div>

						<h3 className="mt-5 font-display text-xl sm:text-2xl font-medium tracking-tight text-text-bright">
							{pillar.title}
						</h3>
						<p className="mt-3 text-[14px] leading-relaxed text-text-secondary">
							{pillar.description}
						</p>

						<ul className="mt-6 space-y-2.5 text-[13.5px] text-text-secondary">
							{pillar.highlights.map((h) => (
								<li key={h} className="flex items-center gap-3">
									<span
										className={cn("h-1.5 w-1.5 shrink-0 rounded-full", a.visualLine)}
										aria-hidden="true"
									/>
									{h}
								</li>
							))}
						</ul>

						<span className="mt-6 mb-4 inline-flex items-center gap-1.5 font-semibold text-accent text-[14.5px]">
							{pillar.cta}
							<ArrowUpRight
								className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 group-hover:-translate-y-1"
								aria-hidden="true"
							/>
						</span>

						<div className="mt-auto pt-4">
							<PillarVisual kind={pillar.visual} lineClass={a.visualLine} />
						</div>
					</Link>
				</div>
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
	<li
	key={s.id}
	className="reveal-child lift h-full"
	>
						<Link
							href={s.href}
							className="group surface-card relative flex h-full min-h-[170px] flex-col gap-4 rounded-[var(--radius-lg)] p-6 transition-[shadow,transform] duration-200 ease-out hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
						>
	<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-md)] bg-[color-mix(in_srgb,var(--color-accent)_15%,transparent)] text-accent border border-accent/20">
	<Icon
	className="h-4 w-4"
	strokeWidth={1.5}
	aria-hidden="true"
	/>
	</div>
	<div>
	<p className="text-[15px] font-display font-medium tracking-tight text-text-bright">
		{s.title}
	</p>
	<p className="mt-1.5 text-[13.5px] leading-relaxed text-text-secondary">
	{s.body}
	</p>
	</div>
	<ArrowUpRight
	className="absolute right-5 top-5 h-4 w-4 text-text-muted opacity-0 transition-[background-color,border-color,color,transform,box-shadow,opacity] duration-200 ease-out group-hover:translate-x-1 group-hover:-translate-y-1 group-hover:opacity-100 group-hover:text-accent"
	aria-hidden="true"
	/>
	</Link>
	</li>
	);
	})}
	</RevealStagger>

	<Reveal>
	<div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-mono text-text-muted">
	<span className="inline-flex items-center gap-1.5">
	<span
	aria-hidden="true"
	className="h-1.5 w-1.5 rounded-full bg-accent"
	/>
	Budget from {formatPricePerMillion(MIN_INPUT_PRICE)} / 1M tokens
	</span>
	<span aria-hidden="true" className="text-border">
	·
	</span>
	<span>USDC at 1:1 USD — no markup</span>
	<span aria-hidden="true" className="text-border">
	·
	</span>
	<span>Credits never expire</span>
	<span aria-hidden="true" className="text-border">
	·
	</span>
	<span>Circuit-breaker failover</span>
	</div>
	</Reveal>
	</div>
	</section>
	);
}
