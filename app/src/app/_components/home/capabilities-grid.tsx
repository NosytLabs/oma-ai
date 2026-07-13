"use client";

/**
 * CapabilitiesGrid — section 3 of the homepage.
 * Bento grid with asymmetric layout: 1 large hero cell + 4 smaller cells.
 */

import {
	Coins,
	GitBranch,
	Image as ImageIcon,
	MessageSquare,
	ShieldCheck,
	Video,
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
			"Venice-powered chat completions: Claude, GPT, Gemini, DeepSeek, Llama, Qwen — one API key, one OpenAI-compatible schema. Streaming, function-calling, vision inputs included.",
		icon: MessageSquare,
		cell: "hero",
		example: "POST /v1/chat/completions",
	},
	{
		title: "Image Generation",
		description:
			"Bring your own key for FLUX, SDXL, Imagen — or route any provider behind the same endpoint. Pay per image, not per minute.",
		icon: ImageIcon,
		cell: "standard",
	},
	{
		title: "Video Generation",
		description:
			"Text-to-video and image-to-video via the same gateway. Per-second billing, automatic provider failover when keys are configured.",
		icon: Video,
		cell: "tinted",
	},
	{
		title: "Model Routing",
		description:
			"Venice primary, Surplus fallback, Gonka budget — automatic circuit-breaker failover and latency-optimized routing across all providers.",
		icon: GitBranch,
		cell: "standard",
	},
	{
		title: "Crypto-Native Billing",
		description:
			"USDC on Base at 1:1 USD. x402 pay-per-request for agents — no pre-funding, no subscriptions. Also supports LI.FI / CCTP from 100+ assets.",
		icon: Coins,
		cell: "standard",
	},
	{
		title: "Wallet-Based Auth",
		description:
			"Sign in with any Ethereum wallet (SIWE). Low-friction signup — no email, no password, no card. Your wallet is your account.",
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
				"min-h-[280px]",
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
				"surface-card h-full p-6 min-h-[180px]",
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