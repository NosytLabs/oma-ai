"use client";

import { m } from "framer-motion";
import {
	ArrowRight,
	Coins,
	CreditCard,
	HelpCircle,
	Link2,
	Rocket,
	Shield,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AccordionItem } from "@/components/ui/AccordionItem";
import { MODELS } from "@/lib/models-data";
import {
	blurInSafe,
	EASE_OUT,
	EASE_SPRING_SOFT,
	fadeUpSafe,
	Magnetic,
	Reveal,
	StaggerReveal,
	scaleInSafe,
} from "@/lib/motion";
import { formatPricePerMillion } from "@/lib/utils";

type Category = "all" | "frontier" | "premium" | "mid" | "budget";

interface PricedModel {
	id: string;
	name: string;
	category: Category;
	provider: string;
	inputPer1M: number;
	outputPer1M: number;
	ctx: string;
}

interface CreditPack {
	name: string;
	price: number;
	credits: number;
	bonus?: number;
	popular?: boolean;
	cta: string;
}

const VENDOR_DISPLAY: Record<string, string> = {
	Venice: "Venice AI",
};

const PRICED_MODELS: PricedModel[] = MODELS.map((m) => ({
	id: m.id,
	name: m.name,
	category: m.tier as Category,
	provider: VENDOR_DISPLAY[m.provider] ?? m.provider,
	inputPer1M: m.inputPricePer1M,
	outputPer1M: m.outputPricePer1M,
	ctx: m.contextLength,
}));

const CATEGORIES: { key: Category; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "frontier", label: "Frontier" },
	{ key: "premium", label: "Premium" },
	{ key: "mid", label: "Mid-Range" },
	{ key: "budget", label: "Budget" },
];

const CATEGORY_STYLES: Record<Category, { active: string; inactive: string }> =
	{
		all: {
			active: "bg-accent text-void",
			inactive: "bg-surface text-text-secondary border border-border",
		},
		frontier: {
			active: "bg-accent text-text-inverse",
			inactive: "bg-surface text-accent border border-accent/30",
		},
		premium: {
			active: "bg-accent text-text-inverse",
			inactive: "bg-surface text-accent border border-accent/30",
		},
		mid: {
			active: "bg-accent text-void",
			inactive: "bg-surface text-accent border border-accent/30",
		},
		budget: {
			active: "bg-success text-text-inverse",
			inactive: "bg-surface text-success border border-success/30",
		},
	};

const PAYMENT_METHODS = [
	{
		icon: CreditCard,
		title: "USDC on Base / Solana",
		desc: "Direct USDC transfers at 1:1 USD rate. Settlement is immediate on confirmation.",
		tag: null,
		tagStyle: "",
	},
	{
		icon: Coins,
		title: "HoudiniSwap",
		desc: "Convert 100+ cryptocurrencies to USDC credits on Base. Rate varies by asset.",
		tag: "100+ assets",
		tagStyle: "bg-surface text-text-secondary border border-border",
	},
	{
		icon: Rocket,
		title: "x402 Pay-Per-Request",
		desc: "Gasless payments on Solana and Base. Each API request deducts fees automatically.",
		tag: "no pre-fund",
		tagStyle: "bg-accent-dim text-accent border border-accent/30",
	},
];

const CREDIT_PACKS: CreditPack[] = [
	{
		name: "Starter",
		price: 10,
		credits: 1000,
		cta: "Get Starter",
	},
	{
		name: "Builder",
		price: 50,
		credits: 5000,
		bonus: 10,
		popular: true,
		cta: "Get Builder",
	},
	{
		name: "Scale",
		price: 200,
		credits: 20000,
		bonus: 20,
		cta: "Get Scale",
	},
];

interface FaqItem {
	q: string;
	a: string;
}

const FAQ_ITEMS: FaqItem[] = [
	{
		q: "How does OMA keep prices competitive?",
		a: "We run inference exclusively through Venice AI, a zero-log, uncensored provider. Our 25% markup covers the gateway, metering, and x402 settlement: predictable pricing with no hidden fees.",
	},
	{
		q: "How do I add credits?",
		a: "Deposit USDC on Base or Solana, or swap from 100+ cryptocurrencies via HoudiniSwap. Instant settlement.",
	},
	{
		q: "Do credits expire?",
		a: "Credits have a 12-month rolling expiry from deposit date. They are non-transferable and non-redeemable.",
	},
	{
		q: "What payment methods are accepted?",
		a: "USDC (Direct) on Base or Solana for 1:1 USD credits, HoudiniSwap to convert 100+ cryptocurrencies to USDC credits, or x402 pay-per-request for gasless Solana/Base payments.",
	},
	{
		q: "What is x402 pay-per-request?",
		a: "x402 enables gasless AI inference payments on Solana and Base. Pay for each API request without pre-funding credits. Fees are deducted automatically per request.",
	},
];

export function PricingContent() {
	const [category, setCategory] = useState<Category>("all");
	const [openFaq, setOpenFaq] = useState<number | null>(null);

	const filtered = useMemo(
		() =>
			PRICED_MODELS.filter(
				(m) => category === "all" || m.category === category,
			),
		[category],
	);

	return (
		<div className="relative min-h-dvh overflow-hidden bg-void">
			{/* ── Ambient background ── */}
			<div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-grid-animated opacity-[0.35] mask-radial" />
				<div className="aurora opacity-30" />
			</div>

			<div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
				{/* ── Header ── */}
				<StaggerReveal className="mb-12" stagger={0.1}>
					<m.div
						variants={fadeUpSafe}
						className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-accent/30 bg-accent-dim mb-6"
					>
						<span className="text-xs font-mono text-accent uppercase tracking-widest">
							{"// pricing"}
						</span>
					</m.div>
					<m.h1 variants={blurInSafe} className="h1-page text-text-bright">
						AI API Pricing
					</m.h1>
					<m.p
						variants={fadeUpSafe}
						className="mt-4 text-base text-text-secondary max-w-2xl"
					>
						Credit-based billing. No subscriptions. No minimums. Pay per token
						across {MODELS.length} models via unified OpenAI-compatible API.
					</m.p>
				</StaggerReveal>

				{/* ── Credit Packs ── */}
				<div className="mb-16">
					<div className="flex items-center gap-2 mb-6">
						<div className="h-px flex-1 bg-border" />
						<span className="text-xs font-mono text-text-muted uppercase tracking-widest">
							credit packs
						</span>
						<div className="h-px flex-1 bg-border" />
					</div>
					<StaggerReveal
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
						stagger={0.08}
					>
						{CREDIT_PACKS.map((pack) => (
							<m.div
								key={pack.name}
								variants={scaleInSafe}
								className={`relative rounded-2xl border p-6 transition-all ${
									pack.popular
										? "border-accent bg-accent-dim/30 glow-accent-sm"
										: "border-border bg-surface hover:border-accent/40"
								}`}
							>
								{pack.popular && (
									<div className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent text-void text-[10px] font-bold uppercase tracking-widest">
										<Zap className="h-3 w-3" />
										Most Popular
									</div>
								)}
								<div className="mb-4">
									<h3 className="text-lg font-bold text-text-bright">
										{pack.name}
									</h3>
									<div className="mt-2 flex items-baseline gap-1">
										<span className="text-3xl font-bold text-text-bright font-mono">
											${pack.price}
										</span>
										<span className="text-xs text-text-muted">one-time</span>
									</div>
								</div>
								<div className="space-y-2 mb-6">
									<div className="flex items-center gap-2 text-sm text-text-secondary">
										<Coins className="h-4 w-4 text-accent" />
										<span className="font-mono font-semibold text-text-bright">
											{pack.credits.toLocaleString()}
										</span>
										<span>credits</span>
									</div>
									{pack.bonus && (
										<div className="flex items-center gap-2 text-sm text-accent">
											<span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-accent/20">
												+{pack.bonus}%
											</span>
											<span>bonus credits</span>
										</div>
									)}

									<div className="flex items-center gap-2 text-sm text-text-secondary">
										<Zap className="h-4 w-4 text-accent" />
										<span>All models included</span>
									</div>
									<div className="flex items-center gap-2 text-sm text-text-secondary">
										<Shield className="h-4 w-4 text-accent" />
										<span>12-month expiry</span>
									</div>
								</div>
								<Link
									href="/deposit"
									className={`block w-full text-center py-2.5 rounded-xl text-sm font-semibold transition-all ${
										pack.popular
											? "bg-accent text-void hover:bg-accent-hover shadow-[0_0_20px_-4px_var(--color-accent-glow)]"
											: "bg-surface-elevated text-text-bright border border-border hover:border-accent/40 hover:bg-panel"
									}`}
								>
									{pack.cta}
								</Link>
							</m.div>
						))}
					</StaggerReveal>
					<p className="mt-4 text-center text-xs text-text-muted">
						1 credit = $0.01 USD. 12-month rolling expiry from deposit date. No
						subscription required.{" "}
						<Link href="/faq" className="text-accent hover:underline">
							Learn more →
						</Link>
					</p>
				</div>

				{/* ── Payment Methods ── */}
				<div className="mb-12">
					<div className="flex items-center gap-2 mb-6">
						<div className="h-px flex-1 bg-border" />
						<span className="text-xs font-mono text-text-muted uppercase tracking-widest">
							payment methods
						</span>
						<div className="h-px flex-1 bg-border" />
					</div>
					<StaggerReveal
						className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3"
						stagger={0.08}
					>
						{PAYMENT_METHODS.map((method) => {
							const Icon = method.icon;
							return (
								<m.div
									key={method.title}
									variants={scaleInSafe}
									className="relative group"
								>
									<div className="absolute inset-0 bg-accent-dim rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
									<div className="relative tilt-card sheen glass p-5 rounded-xl border border-border hover:border-accent/40 hover:glow-accent-sm transition-colors">
										<div className="flex items-start gap-3">
											<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-elevated">
												<Icon className="h-5 w-5 text-accent" />
											</div>
											<div className="flex-1 min-w-0">
												<h3 className="text-sm font-semibold text-text-bright truncate">
													{method.title}
												</h3>
												<p className="mt-1 text-xs text-text-secondary leading-relaxed">
													{method.desc}
												</p>
											</div>
										</div>
										{method.tag && (
											<div
												className={`mt-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-mono border ${method.tagStyle}`}
											>
												{method.tag}
											</div>
										)}
									</div>
								</m.div>
							);
						})}
					</StaggerReveal>
				</div>

				{/* ── x402 Banner (recommended highlight) ── */}
				<Reveal className="mb-12" y={20}>
					<div className="relative border-gradient float p-4 rounded-xl bg-accent-dim">
						<div className="flex items-start gap-3">
							<Link2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
							<div>
								<div className="flex items-center gap-2">
									<h4 className="text-sm font-semibold text-accent">
										x402 Protocol
									</h4>
									<span className="inline-flex items-center rounded-full bg-accent text-void px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">
										recommended
									</span>
								</div>
								<p className="mt-1 text-xs text-text-secondary leading-relaxed">
									Native x402 support lets applications integrate AI payments
									without managing credit balances.
									<Link
										href="/deposit"
										className="ml-1 font-medium text-accent hover:text-accent-hover transition-colors"
									>
										Learn more →
									</Link>
								</p>
							</div>
						</div>
					</div>
				</Reveal>

				{/* ── Model Table - Mobile Responsive ── */}
				<div className="mb-16">
					<div className="rounded-xl border border-border bg-surface overflow-hidden">
						<div className="border-b border-border px-4 py-4 sm:px-6">
							<div className="flex flex-wrap gap-2 mb-4">
								{CATEGORIES.map((cat) => {
									const active = category === cat.key;
									return (
										<m.button
											key={cat.key}
											onClick={() => setCategory(cat.key)}
											whileTap={{ scale: 0.96 }}
											transition={EASE_SPRING_SOFT}
											className={`relative px-3 py-2 min-h-[44px] min-w-[44px] text-xs font-mono font-medium rounded-full transition-colors duration-150 ${
												active
													? CATEGORY_STYLES[cat.key].active
													: CATEGORY_STYLES[cat.key].inactive
											}`}
										>
											{active && (
												<m.span
													layoutId="pricing-category-pill"
													className="absolute inset-0 rounded-full"
													transition={EASE_SPRING_SOFT}
													style={{ zIndex: -1 }}
												/>
											)}
											{cat.label}
										</m.button>
									);
								})}
							</div>
							<p className="text-xs text-text-muted font-mono">
								{filtered.length} models
							</p>
						</div>

						{/* Horizontal scroll wrapper with gradient hint */}
						<div className="relative">
							{/* Right gradient hint for scrollable content */}
							<div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-surface to-transparent pointer-events-none z-10 hidden sm:block" />

							<div
								className="overflow-x-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
								role="region"
								aria-label="Model pricing table"
							>
								<table className="w-full text-left min-w-[640px] sm:min-w-0">
									<thead>
										<tr className="border-b border-border bg-surface-elevated">
											<th
												scope="col"
												className="px-4 py-4 text-xs font-mono font-semibold uppercase tracking-widest text-text-muted"
											>
												Model
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-mono font-semibold uppercase tracking-widest text-text-muted"
											>
												Provider
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-mono font-semibold uppercase tracking-widest text-text-muted text-right"
											>
												Input / 1M
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-mono font-semibold uppercase tracking-widest text-text-muted text-right"
											>
												Output / 1M
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-mono font-semibold uppercase tracking-widest text-text-muted text-right"
											>
												Ctx
											</th>
										</tr>
									</thead>
									<tbody key={category}>
										{filtered.map((mm, i) => (
											<tr
												key={mm.id}
												className={`border-b border-border/50 transition-colors hover:bg-surface-elevated/50 ${i % 2 === 1 ? "bg-surface-elevated/30" : ""}`}
												style={{
													animation: `fadeInUp 0.3s ease-out ${i * 0.035}s both`,
												}}
											>
												<td className="px-4 py-3">
													<span className="text-sm font-medium text-text-bright">
														{mm.name}
													</span>
													<span className="ml-2 text-xs text-text-secondary font-mono hidden sm:inline">
														{mm.id}
													</span>
												</td>
												<td className="px-4 py-3">
													<span
														className={`inline-flex items-center rounded px-2 py-1 text-xs font-mono font-medium ${
															mm.provider === "Venice"
																? "bg-accent/20 text-accent"
																: "bg-secondary/20 text-secondary"
														}`}
													>
														{mm.provider}
													</span>
												</td>
												<td className="px-4 py-3 text-right font-mono text-sm font-medium text-accent">
													{formatPricePerMillion(mm.inputPer1M)}
												</td>
												<td className="px-4 py-3 text-right font-mono text-sm font-medium text-text-secondary">
													{formatPricePerMillion(mm.outputPer1M)}
												</td>
												<td className="px-4 py-3 text-right text-xs text-text-secondary font-mono">
													{mm.ctx}
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>

							{/* Mobile scroll indicator - swipe hint */}
							<div className="sm:hidden flex items-center justify-center py-2 text-[10px] sm:text-xs text-text-muted">
								<span className="font-mono">Swipe to scroll &rarr;</span>
							</div>
						</div>
					</div>
				</div>

				{/* ── FAQ ── */}
				<Reveal className="mb-12">
					<div className="flex items-center gap-2 mb-6">
						<HelpCircle className="h-4 w-4 text-accent" />
						<h3 className="text-sm font-mono font-semibold uppercase tracking-widest text-text-secondary">
							FAQ
						</h3>
					</div>
					<div className="rounded-xl border border-border bg-surface p-6">
						{FAQ_ITEMS.map((item, i) => (
							<AccordionItem
								key={i}
								title={item.q}
								isOpen={openFaq === i}
								onToggle={() => setOpenFaq(openFaq === i ? null : i)}
								id={`faq-${i}`}
							>
								{item.a}
							</AccordionItem>
						))}
					</div>
				</Reveal>

				{/* ── CTA ── */}
				<div className="relative mb-12 overflow-hidden rounded-2xl py-10">
					<div
						aria-hidden
						className="pointer-events-none absolute inset-0 -z-10"
					>
						<div className="aurora opacity-40" />
					</div>
					<Reveal className="flex flex-col items-center gap-4" y={20}>
						<m.h2
							initial={{ opacity: 1, filter: "blur(0px)", y: 0 }}
							whileInView={{ opacity: 1, filter: "blur(0px)", y: 0 }}
							viewport={{ once: true, margin: "200px 0px 200px 0px" }}
							transition={{ duration: 0.7, ease: EASE_OUT }}
							className="h2-page text-text-bright text-center"
						>
							Start building today
						</m.h2>
						<Magnetic strength={10}>
							<Link
								href="/dashboard"
								className="btn-primary text-sm px-6 py-3 w-full sm:w-auto text-center"
							>
								<Zap className="h-4 w-4 mr-2" />
								Start AI Inference
								<ArrowRight className="h-4 w-4 ml-2" />
							</Link>
						</Magnetic>
						<Magnetic strength={10}>
							<Link
								href="/deposit"
								className="btn-secondary text-sm px-6 py-3 w-full sm:w-auto text-center"
							>
								<Coins className="h-4 w-4 mr-2" />
								Deposit Crypto
							</Link>
						</Magnetic>
						<Link
							href="/models"
							className="text-sm text-text-secondary hover:text-accent transition-colors px-4 py-3 text-center"
						>
							View All Models
							<ArrowRight className="w-4 h-4 ml-1 inline-block" />
						</Link>
					</Reveal>
				</div>

				{/* ── Billing Notes ── */}
				<Reveal className="p-4 rounded-xl border border-secondary/20 bg-secondary/5">
					<h4 className="text-xs font-mono font-semibold uppercase tracking-widest text-secondary mb-3">
						Billing
					</h4>
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
						{[
							"Credits are 1:1 USD, non-redeemable, non-transferable",
							"12-month rolling expiry from date of deposit",
							"No credit float, credits appear after settlement",
							"Billed per token, deducted in real-time",
						].map((note) => (
							<div key={note} className="flex items-start gap-2">
								<div className="mt-1.5 h-1 w-1 rounded-full bg-secondary" />
								<span className="text-xs text-text-secondary">{note}</span>
							</div>
						))}
					</div>
				</Reveal>
			</div>
		</div>
	);
}
