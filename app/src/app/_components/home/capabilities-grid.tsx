"use client";

/**
 * Home · Capabilities
 *
 * Three-pillar bento: pay upfront, pay per request, pay with USDC. Each pillar
 * is anchored by a single primary action, with a 4-up supporting row that
 * surfaces the operational primitives (live models, circuit breaker, x402
 * spec, OpenAI SDK). Layout flips to a vertical stack under `md`.
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
}

const PILLARS: Pillar[] = [
	{
		id: "card-credits",
		eyebrow: "Card · Polar",
		title: "Buy credits by card",
		description:
			"Top up with Visa, Mastercard, or Apple Pay in seconds. Credits land the moment the payment settles and meter every request at 1:1 USD.",
		icon: Banknote,
		href: "/deposit?method=card",
		cta: "Buy credits",
		accent: "emerald",
		highlights: ["No wallet required", "Apple Pay supported", "Instant settlement"],
	},
	{
		id: "usdc-base",
		eyebrow: "USDC · Base",
		title: "Deposit USDC on Base",
		description:
			"Direct USDC deposits at 1:1 USD. Every request is metered against a transparent on-chain ledger so you see exactly where each credit goes.",
		icon: Coins,
		href: "/deposit",
		cta: "Deposit USDC",
		accent: "info",
		highlights: ["1:1 USD", "On-chain ledger", "100+ chains via LI.FI"],
	},
	{
		id: "x402",
		eyebrow: "x402 · agents",
		title: "Agents pay per request",
		description:
			"x402 lets an agent settle every inference call on Base in USDC. No account, no API key, no subscription — wallet-based and gasless.",
		icon: Bot,
		href: "/docs#x402",
		cta: "Read the protocol",
		accent: "violet",
		highlights: ["Gasless EIP-3009", "Per-request pricing", "HTTP 402 native"],
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
		body: `Circuit-breaker failover across ${MODEL_COUNT}+ models.`,
		href: "/network",
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
	{ wrap: string; chip: string; ring: string; glow: string; iconBg: string }
> = {
	emerald: {
		wrap: "border-accent/30 bg-[color-mix(in_srgb,var(--color-accent)_8%,var(--color-panel))]",
		chip: "bg-accent/15 text-accent border-accent/30",
		ring: "hover:border-accent/60 focus-visible:ring-accent",
		glow: "0 24px 60px -30px var(--color-accent-glow)",
		iconBg: "bg-accent text-[var(--color-accent-fg)]",
	},
	info: {
		wrap: "border-info/30 bg-[color-mix(in_srgb,var(--color-info)_8%,var(--color-panel))]",
		chip: "bg-info/15 text-info border-info/30",
		ring: "hover:border-info/60 focus-visible:ring-info",
		glow: "0 24px 60px -30px color-mix(in srgb, var(--color-info) 60%, transparent)",
		iconBg: "bg-info/15 text-info",
	},
	violet: {
		wrap: "border-violet/30 bg-[color-mix(in_srgb,var(--color-violet)_8%,var(--color-panel))]",
		chip: "bg-violet/15 text-violet border-violet/30",
		ring: "hover:border-violet/60 focus-visible:ring-violet",
		glow: "0 24px 60px -30px color-mix(in srgb, var(--color-violet) 60%, transparent)",
		iconBg: "bg-violet/15 text-violet",
	},
};

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
								Three ways to pay.
								<br />
								<span className="text-accent italic-accent">
									One gateway underneath.
								</span>
							</>
						}
						subhead="Card, USDC, or x402 — pick the rail that fits. Every payment path funnels into the same private, OpenAI-compatible inference surface."
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
										"group relative flex h-full min-h-[300px] flex-col overflow-hidden rounded-[var(--radius-lg)] border p-6 transition-[transform,box-shadow] duration-200 ease-out",
										"hover:-translate-y-0.5 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2",
										a.wrap,
										a.ring,
									)}
									style={{ boxShadow: "var(--shadow-sm)" }}
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

									<ul className="mt-5 space-y-1.5 text-[12.5px] text-text-secondary">
										{pillar.highlights.map((h) => (
											<li key={h} className="flex items-center gap-2">
												<span
													className="h-1 w-1 shrink-0 rounded-full bg-accent"
													aria-hidden="true"
												/>
												{h}
											</li>
										))}
									</ul>

									<span className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-accent">
										{pillar.cta}
										<ArrowUpRight
											className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
											aria-hidden="true"
										/>
									</span>
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
									className="group surface-card tilt-card relative flex h-full min-h-[150px] flex-col gap-3 rounded-[var(--radius-md)] p-5 transition-shadow duration-200 hover:shadow-[0_18px_40px_-30px_rgba(0,0,0,0.8)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									<div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent">
										<Icon className="h-4 w-4" strokeWidth={1.5} aria-hidden="true" />
									</div>
									<div>
										<p className="text-[13.5px] font-semibold tracking-tight text-text-bright">
											{s.title}
										</p>
										<p className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
											{s.body}
										</p>
									</div>
									<ArrowUpRight
										className="absolute right-4 top-4 h-3.5 w-3.5 text-text-muted opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
										aria-hidden="true"
									/>
								</Link>
							</m.li>
						);
					})}
				</RevealStagger>
			</div>
		</section>
	);
}
