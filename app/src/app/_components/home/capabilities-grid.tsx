"use client";

/**
 * CapabilitiesGrid — section 3 of the homepage.
 * Bento grid with asymmetric layout: 1 large hero cell + 4 smaller cells.
 */

import {
	Coins,
	GitBranch,
	MessageSquare,
	ShieldCheck,
	Zap,
} from "lucide-react";
import { Reveal, childFadeUp } from "@/app/_components/home/reveal";
import { SectionHeader } from "@/app/_components/home/section-header";
import { cn } from "@/components/ui/utils";
import { m } from "@/lib/framer-motion-client";

interface Capability {
	title: string;
	description: string;
	icon: typeof MessageSquare;
	cell: "hero" | "standard" | "tinted";
	example?: string;
}

const CAPABILITIES: Capability[] = [
	{
		title: "LLM Chat",
		description:
			"Venice + Gonka chat completions: Claude, Llama, plus MiniMax 2.7 and Kimi K2.6 on decentralized Gonka — one API key, one OpenAI-compatible schema. Streaming, function-calling, and tool use included.",
		icon: MessageSquare,
		cell: "hero",
		example: "POST /v1/chat/completions",
	},
	{
		title: "Cheap-by-default",
		description:
			"Pay-per-token on Gonka at $0.015/M input (MiniMax 2.7) and $0.024/M (Kimi K2.6) — ~50x cheaper than OpenAI, with no markup on the budget tier. Premium Claude still on Venice at $2.50/M.",
		icon: Zap,
		cell: "standard",
	},
	{
		title: "Tool Calling & Streaming",
		description:
			"Native OpenAI-style function calling, JSON-schema tools, and Server-Sent Events streaming. Re-use your existing OpenAI SDK by swapping the base URL — no migration, no lock-in.",
		icon: ShieldCheck,
		cell: "tinted",
	},
	{
		title: "Model Routing",
      description:
        "Venice for premium models, Gonka for cheap models. Per-model routing, automatic retry on transient failures, and a health-checked provider registry so a slow upstream never blocks your chat.",
		icon: GitBranch,
		cell: "standard",
	},
	{
		title: "Crypto-Native Billing",
		description:
			"USDC on Base at 1:1 USD. x402 pay-per-request for agents — no pre-funding, no subscriptions. Per-call ledger shows every request, model, and exact cents charged.",
		icon: Coins,
		cell: "standard",
	},
	{
		title: "Magic Link or Wallet",
		description:
			"Sign in with email magic link (Resend) or Sign-In With Ethereum (SIWE). Same account either way — mint API keys, top up USDC, and chat from any device.",
		icon: ShieldCheck,
		cell: "standard",
	},
];

export function CapabilitiesGrid() {
	return (
		<section
			aria-labelledby="capabilities-headline"
			className="relative py-16 sm:py-20"
		>
			<div className="container-page">
				<Reveal>
					<SectionHeader
						id="capabilities-headline"
						eyebrow="Capabilities"
						headline={
							<>
								One API. Every model.
								<br />
								<span className="text-text-secondary">Paid like a meter.</span>
							</>
						}
						subhead="Drop-in OpenAI compatibility plus routing, failover, and crypto-native billing. Bring your own key — or don't."
					/>
				</Reveal>

				<div className="mt-14 bento-grid">
					<Reveal className="bento-span-2" variants={childFadeUp}>
						<HeroCapability capability={CAPABILITIES[0]} />
					</Reveal>

					{CAPABILITIES.slice(1).map((cap) => (
						<Reveal key={cap.title} variants={childFadeUp}>
							<CapabilityCard capability={cap} />
						</Reveal>
					))}
				</div>
			</div>
		</section>
	);
}

function HeroCapability({ capability }: { capability: Capability }) {
	const Icon = capability.icon;
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className={cn(
				"relative h-full overflow-hidden",
				"rounded-[var(--radius-md)] p-8",
				"bg-gradient-to-br from-[color-mix(in_srgb,var(--color-accent)_12%,var(--color-panel))] via-[var(--color-panel)] to-[var(--color-panel)]",
				"border border-[color-mix(in_srgb,var(--color-accent)_30%,var(--color-border))]",
				"min-h-[220px] md:min-h-[230px]",
			)}
		>
			<div
				className="absolute inset-0 -z-10 opacity-30"
				style={{
					background:
						"radial-gradient(ellipse at 90% 0%, color-mix(in srgb, var(--color-accent) 25%, transparent), transparent 60%)",
				}}
				aria-hidden="true"
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
					<h3 className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-text-bright">
						{capability.title}
					</h3>
					<p className="mt-3 text-base text-text-secondary leading-relaxed max-w-md">
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

function CapabilityCard({ capability }: { capability: Capability }) {
	const Icon = capability.icon;
	const isTinted = capability.cell === "tinted";
	return (
		<m.article
			whileHover={{ y: -4 }}
			transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
			className={cn(
				"surface-card h-full p-6 md:p-8 min-h-[220px] md:min-h-[230px]",
				isTinted &&
					"bg-[color-mix(in_srgb,var(--color-info)_8%,var(--color-panel))] border-[color-mix(in_srgb,var(--color-info)_20%,var(--color-border))]",
			)}
		>
			<div
				className={cn(
					"flex h-10 w-10 items-center justify-center rounded-[var(--radius-sm)]",
					isTinted
						? "bg-info/15 text-info"
						: "bg-[color-mix(in_srgb,var(--color-accent)_12%,transparent)] text-accent",
				)}
			>
				<Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden="true" />
			</div>
			<h3 className="mt-4 font-heading text-lg font-semibold tracking-tight text-text-bright">
				{capability.title}
			</h3>
			<p className="mt-2 text-sm text-text-secondary leading-relaxed">
				{capability.description}
			</p>
		</m.article>
	);
}