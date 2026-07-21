"use client";

import {
	ArrowRight,
	ChevronDown,
	Coins,
	CreditCard,
	HelpCircle,
	Link2,
	Rocket,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { FloatingIcons } from "@/components/floating-icons";
import { JuiceButton } from "@/components/juice-button";
import { ElectricBorder } from "@/components/electric-border";
import { formatPricePerMillion, loadModels, type Model, MODELS } from "@/lib/models-data";
import {
	BreadcrumbListJsonLd,
	ProductJsonLd,
	FAQPageJsonLd,
} from "@/components/json-ld";

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

const VENDOR_DISPLAY: Record<string, string> = {
	Venice: "Venice",
	Gonka: "Gonka",
};

function toPricedModel(m: Model): PricedModel {
	return {
		id: m.id,
		name: m.name,
		category: m.tier as Category,
		provider: VENDOR_DISPLAY[m.provider] ?? m.provider,
		inputPer1M: m.inputPricePer1M,
		outputPer1M: m.outputPricePer1M,
		ctx: m.contextLength,
	};
}

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
		title: "USDC on Base",
		desc: "Direct USDC transfers at 1:1 USD rate. Settlement is immediate on confirmation.",
		tag: null,
		tagStyle: "",
	},
	{
		icon: Coins,
		title: "LI.FI / CCTP",
		desc: "Bridge or convert assets to USDC credits on Base via LI.FI / CCTP. Rate varies by asset.",
		tag: "100+ assets",
		tagStyle: "bg-surface text-text-secondary border border-border",
	},
	{
		icon: Rocket,
		title: "x402 Pay-Per-Request",
		desc: "Agent-native payments on Base. Each API request can settle fees without pre-funding credits.",
		tag: "no pre-fund",
		tagStyle: "bg-accent-dim text-accent border border-accent/30",
	},
];

const FAQ_ITEMS = [
	{
		q: "How do I add credits?",
		a: "Deposit USDC on Base, or bridge/convert from 100+ cryptocurrencies via LI.FI / CCTP. Settlement is immediate on confirmation.",
	},
	{
		q: "Do credits expire?",
		a: "Credits have a 12-month rolling expiry from deposit date. They are non-transferable and non-redeemable.",
	},
	{
		q: "What payment methods are accepted?",
		a: "USDC (Direct) on Base for 1:1 USD credits, LI.FI / CCTP to convert 100+ cryptocurrencies to USDC credits, or x402 pay-per-request on Base.",
	},
	{
		q: "What is x402 pay-per-request?",
		a: "x402 enables per-request AI inference payments on Base. Pay for each API request without pre-funding credits. Fees are deducted automatically per request — ideal for agents and automated workflows.",
	},
];

function fmtPrice(n: number): string {
	if (n < 0.01) return "$0.01";
	if (n < 1) return `$${n.toFixed(4)}`;
	return `$${n.toFixed(2)}`;
}

function AccordionItem({
	item,
	isOpen,
	onToggle,
	index,
}: {
	item: (typeof FAQ_ITEMS)[0];
	isOpen: boolean;
	onToggle: () => void;
	index: number;
}) {
	const buttonId = `faq-button-${index}`;
	const panelId = `faq-panel-${index}`;

	return (
		<div className="border-b border-border">
			<button
				type="button"
				id={buttonId}
				onClick={onToggle}
				className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-text-bright focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
				aria-expanded={isOpen}
				aria-controls={panelId}
			>
				<span className="font-medium text-text">{item.q}</span>
				<span
					className="shrink-0 transition-transform duration-200"
					style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
				>
					<ChevronDown className="h-5 w-5 text-text-muted" />
				</span>
			</button>
			<div
				id={panelId}
				role="region"
				aria-labelledby={buttonId}
				className="overflow-hidden transition-all duration-300"
				style={{
					maxHeight: isOpen ? "500px" : "0px",
					opacity: isOpen ? 1 : 0,
				}}
			>
				<p className="pb-5 text-sm text-text-secondary">{item.a}</p>
			</div>
		</div>
	);
}

export default function PricingPage() {
	const [category, setCategory] = useState<Category>("all");
	const [openFaq, setOpenFaq] = useState<number | null>(null);
	const [models, setModels] = useState<Model[]>(MODELS);

	useEffect(() => {
		let cancelled = false;
		loadModels()
			.then((live) => {
				if (!cancelled) setModels(live);
			})
			.catch(() => {
				// keep static fallback
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const pricedModels = useMemo(() => models.map(toPricedModel), [models]);
	const lowestInputPrice = useMemo(
		() =>
			formatPricePerMillion(
				Math.min(...pricedModels.map((m) => m.inputPer1M)),
			),
		[pricedModels],
	);
	const modelCount = models.length;

	const filtered = useMemo(
		() =>
			pricedModels.filter(
				(m) => category === "all" || m.category === category,
			),
		[category, pricedModels],
	);

	return (
		<div className="relative min-h-screen overflow-hidden bg-void">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Pricing", url: "/pricing" },
				]}
			/>
			<ProductJsonLd
				name="OMA AI API Inference"
				description="Pay-per-request AI inference across 200+ models. No monthly fees, no lock-in."
				price="0.01"
			/>
			<FAQPageJsonLd
				questions={FAQ_ITEMS.map((item) => ({
					question: item.q,
					answer: item.a,
				}))}
			/>
			{/* ── Ambient background ── */}
			<div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
				<div className="absolute inset-0 bg-grid opacity-[0.35] mask-radial" />
				<FloatingIcons count={6} />
			</div>

			<div className="container-page page-shell">
				<div className="page-hero animate-[fadeInUp_0.6s_ease-out_both]">
					<span className="page-kicker">AI API Pricing</span>
					<h1 className="h1-page text-text-bright">Transparent usage pricing for every model.</h1>
					<p className="page-intro">
						See model costs first, then choose how to pay. OMA bills per token
						or per request, with no subscriptions, no lock-in, and no hidden
						platform fee layered on top of the quoted rates.
					</p>
					<div className="meta-strip">
							<span>{modelCount} live models</span>
						<span>Usage-based billing</span>
						<span>x402 native</span>
					</div>
				</div>

				<div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
					<div className="surface-card p-5">
						<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted">
							Starts at
						</p>
						<p className="mt-3 text-3xl font-semibold text-text-bright">
							{lowestInputPrice}
						</p>
						<p className="mt-2 text-sm leading-relaxed text-text-secondary">
							Lowest displayed price tier per 1M input tokens across the current
							catalog.
						</p>
					</div>
					<div className="surface-card p-5">
						<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted">
							Pay your way
						</p>
						<p className="mt-3 text-3xl font-semibold text-text-bright">USDC or x402</p>
						<p className="mt-2 text-sm leading-relaxed text-text-secondary">
							Top up credits with USDC or let agents settle each call directly on
							Base.
						</p>
					</div>
					<div className="surface-card p-5">
						<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted">
							No contract
						</p>
						<p className="mt-3 text-3xl font-semibold text-text-bright">No minimums</p>
						<p className="mt-2 text-sm leading-relaxed text-text-secondary">
							Ship one request or one million. Credits deduct in real time with a
							clear ledger.
						</p>
					</div>
				</div>

				<div className="mb-16">
					<div className="mb-5 flex items-end justify-between gap-4">
						<div>
							<p className="page-kicker">Model Costs</p>
							<h2 className="mt-3 text-2xl font-semibold text-text-bright">
								Compare prices before you deposit.
							</h2>
						</div>
						<p className="hidden max-w-sm text-right text-sm leading-relaxed text-text-secondary md:block">
							Filter by tier to find the most cost-effective model that still fits your
							latency and context needs.
						</p>
					</div>
					<div className="rounded-xl border border-border bg-surface overflow-hidden">
						<div className="border-b border-border px-4 py-4 sm:px-6">
							<div className="flex flex-wrap gap-2 mb-4">
								{CATEGORIES.map((cat) => {
									const active = category === cat.key;
									return (
										<button
											type="button"
											key={cat.key}
											onClick={() => setCategory(cat.key)}
											className={`relative px-3 py-2 min-h-[44px] min-w-[44px] text-xs font-mono font-medium rounded-full transition-colors duration-150 ${
												active
													? CATEGORY_STYLES[cat.key].active
													: CATEGORY_STYLES[cat.key].inactive
											}`}
										>
											{cat.label}
										</button>
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

							<div className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent [-webkit-overflow-scrolling:touch]">
								<table
									className="w-full min-w-[36rem] text-left"
									aria-label="Model pricing by tier"
								>
									<thead>
										<tr className="border-b border-border bg-surface-elevated">
											<th
												scope="col"
												className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted"
											>
												Model
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted"
											>
												Provider
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right"
											>
												Input / 1M
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right"
											>
												Output / 1M
											</th>
											<th
												scope="col"
												className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right"
											>
												Ctx
											</th>
										</tr>
									</thead>
									{/* key=category re-triggers stagger on filter change */}
									<tbody key={category}>
										{filtered.map((mm, i) => (
											<tr
												key={mm.id}
												style={{
													animation: `fadeInUp 0.3s ease-out ${i * 0.035}s both`,
												}}
												className={`border-b border-border/50 transition-colors hover:bg-surface-elevated/50 ${i % 2 === 1 ? "bg-surface-elevated/30" : ""}`}
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
																: mm.provider === "Gonka"
																? "bg-accent/10 text-accent"
																: "bg-secondary/20 text-secondary"
														}`}
													>
														{mm.provider}
													</span>
												</td>
												<td className="px-4 py-3 text-right font-mono text-sm font-medium text-accent">
													{fmtPrice(mm.inputPer1M)}
												</td>
												<td className="px-4 py-3 text-right font-mono text-sm font-medium text-text-secondary">
													{fmtPrice(mm.outputPer1M)}
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

				<div className="mb-12">
					<div className="mb-6 flex items-center gap-2">
						<div className="h-px flex-1 bg-border" />
						<span className="text-xs font-mono text-text-muted uppercase tracking-widest">
							payment methods
						</span>
						<div className="h-px flex-1 bg-border" />
					</div>
					<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
						{PAYMENT_METHODS.map((method) => {
							const Icon = method.icon;
							return (
								<div key={method.title} className="relative group">
									<div className="absolute inset-0 bg-accent-dim rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
									<div className="relative p-5 rounded-xl border border-border hover:border-accent/40 transition-colors duration-150">
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
								</div>
							);
						})}
					</div>
				</div>

				<div className="mb-12">
					<div className="relative p-5 rounded-xl bg-accent-dim border border-accent/30">
						<div className="flex items-start gap-3">
							<Link2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
							<div>
								<div className="flex items-center gap-2">
									<h3 className="text-sm font-semibold text-accent">
										x402 Protocol
									</h3>
									<span className="inline-flex items-center rounded-full bg-accent text-void px-2 py-0.5 text-[10px] font-mono uppercase tracking-widest">
										recommended for agents
									</span>
								</div>
								<p className="mt-2 text-sm text-text-secondary leading-relaxed">
									Native x402 support lets applications pay for inference call by
									call, without maintaining a prepaid balance.
									<Link
										href="/docs#x402"
										className="ml-1 font-medium text-accent hover:text-accent-hover transition-colors"
										aria-label="Learn more about the x402 payment protocol"
									>
										Learn more about x402 →
									</Link>
								</p>
							</div>
						</div>
					</div>
				</div>

				{/* ── FAQ ── */}
				<div id="faq" className="mb-12 scroll-mt-20">
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
								item={item}
								isOpen={openFaq === i}
								onToggle={() => setOpenFaq(openFaq === i ? null : i)}
								index={i}
							/>
						))}
					</div>
				</div>

				{/* ── CTA ── */}
				<div className="relative mb-12 overflow-hidden rounded-2xl py-10">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 -z-10"
					>
						<div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
					</div>
					<div className="flex flex-col items-center gap-4">
						<h2 className="h2-page text-text-bright text-center">
							Start building today
						</h2>
						<JuiceButton
							color="var(--color-accent)"
							size={180}
							opacity={0.15}
							className="rounded-full"
						>
							<ElectricBorder
								borderRadius="9999px"
								borderWidth={1}
								active={true}
							>
								<Link
									href="/dashboard"
									className="btn-primary text-sm px-6 py-3 w-full sm:w-auto text-center inline-flex items-center justify-center"
								>
									<Zap className="h-4 w-4 mr-2" />
									Start AI Inference
									<ArrowRight className="h-4 w-4 ml-2" />
								</Link>
							</ElectricBorder>
						</JuiceButton>
						<JuiceButton
							color="var(--color-accent)"
							size={120}
							opacity={0.12}
							className="rounded-full"
						>
							<Link
								href="/deposit"
								className="btn-secondary text-sm px-6 py-3 w-full sm:w-auto text-center inline-flex items-center justify-center"
							>
								<Coins className="h-4 w-4 mr-2" />
								Deposit Crypto
							</Link>
						</JuiceButton>
						<Link
							href="/models"
							className="text-sm text-text-secondary hover:text-accent transition-colors px-4 py-3 text-center"
						>
							View All Models
							<ArrowRight className="w-4 h-4 ml-1 inline-block" />
						</Link>
					</div>
				</div>

				{/* ── Billing Notes ── */}
				<div className="p-4 rounded-xl border border-amber/20 bg-amber/5">
					<h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-amber mb-3">
						Billing
					</h3>
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
						{[
							"Credits are 1:1 USD, non-redeemable, non-transferable",
							"12-month rolling expiry from date of deposit",
							"No credit float — credits appear after settlement",
							"Billed per token, deducted in real-time",
						].map((note) => (
							<div key={note} className="flex items-start gap-2">
								<div className="mt-1.5 h-1 w-1 rounded-full bg-amber" />
								<span className="text-xs text-text-secondary">{note}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
