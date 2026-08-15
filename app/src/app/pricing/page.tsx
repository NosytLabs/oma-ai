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
import { InViewFade } from "@/components/motion/in-view-fade";
import { formatPricePerMillion, loadModels, MODEL_COUNT, type Model, MODELS } from "@/lib/models-data";
import {
	toPricedModel,
	type Category,
} from "./_lib/pricing-utils";
import {
	BreadcrumbListJsonLd,
	ProductJsonLd,
	FAQPageJsonLd,
} from "@/components/json-ld";
import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { PricingTable } from "./_components/PricingTable";

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
			active: "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border border-[var(--color-accent)]",
			inactive: "bg-[var(--color-surface)] text-text-secondary border border-[var(--color-border)]",
		},
		frontier: {
			active: "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border border-[var(--color-accent)]",
			inactive: "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)] border border-[var(--color-accent)]/30",
		},
		premium: {
			active: "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border border-[var(--color-accent)]",
			inactive: "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)] border border-[var(--color-accent)]/30",
		},
		mid: {
			active: "bg-[var(--color-accent)] text-[var(--color-accent-fg)] border border-[var(--color-accent)]",
			inactive: "bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)] border border-[var(--color-accent)]/30",
		},
		budget: {
			active: "bg-[var(--color-success)] text-[var(--color-void-deep)] border border-[var(--color-success)]",
			inactive: "bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)] border border-[var(--color-success)]/30",
		},
	};

const PAYMENT_METHODS = [
	{
		icon: CreditCard,
		title: "Card · Visa · Mastercard",
		desc: "Buy credits with card via Polar (Apple Pay supported). No wallet required.",
		tag: "Card",
		tagStyle: "bg-accent-dim text-accent border border-accent/30",
	},
	{
		icon: Coins,
		title: "USDC on Base",
		desc: "Transfer USDC on Base to your deposit address. Credits apply after confirmation.",
		tag: "On-chain",
		tagStyle: "bg-surface text-text-secondary border border-border",
	},
	{
		icon: Rocket,
		title: "x402 Pay-Per-Request",
		desc: "HTTP 402 settlement on Base. Agents pay per request without pre-funding credits.",
		tag: "Agents",
		tagStyle: "bg-surface text-text-secondary border border-border",
	},
];

const POLAR_TIERS: Array<{
	name: string;
	price: string;
	credits: string;
	description: string;
	badge?: string;
}> = [
	{
		name: "Hobby",
		price: "$10",
		credits: "1,000 credits",
		description: "A small, flexible start for side projects and exploration.",
	},
	{
		name: "Builder",
		price: "$50",
		credits: "5,000 credits",
		description: "A practical runway for production apps and autonomous agents.",
		badge: "Recommended",
	},
	{
		name: "Scale",
		price: "$250",
		credits: "25,000 credits",
		description: "The best value per credit for high-volume workloads.",
		badge: "Best value",
	},
];

const FAQ_ITEMS = [
	{
		q: "How do I add credits?",
		a: "Buy credits with a card (Visa, Mastercard, Apple Pay) via Polar — no wallet needed — or deposit USDC on Base at 1:1 USD. Credits land the moment payment settles.",
	},
	{
		q: "Do credits expire?",
		a: "No — credits do not expire. They are non-redeemable and non-transferable. 1 credit = $0.01 USD (so $1 = 100 credits), and each request consumes the model's per-token cost in credits at request time.",
	},
	{
		q: "What payment methods are accepted?",
		a: "Cards via Polar (Visa, Mastercard, Apple Pay — charges appear as 'NOSYT'), USDC direct on Base at 1:1 USD, or x402 pay-per-request on Base for agents.",
	},
	{
		q: "What is x402 pay-per-request?",
		a: "x402 enables per-request AI inference payments on Base. Pay for each API request without pre-funding credits. Fees are deducted automatically per request — ideal for agents and automated workflows.",
	},
];

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
				className="flex w-full items-center justify-between py-5 text-left transition-[color,transform] duration-200 ease-out hover:text-text-bright focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2 active:scale-[0.97]"
				aria-expanded={isOpen}
				aria-controls={panelId}
			>
				<span className="font-medium text-text">{item.q}</span>
				<span
					className="shrink-0 transition-transform duration-200 ease-spring"
					style={{ transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
				>
					<ChevronDown className="h-5 w-5 text-text-muted" />
				</span>
			</button>
			<div
				id={panelId}
				role="region"
				aria-labelledby={buttonId}
				className="overflow-hidden transition-[height,opacity] duration-200 ease-spring-soft"
				style={{
					maxHeight: isOpen ? "500px" : "0px",
					opacity: isOpen ? 1 : 0,
				}}
			>
				<p className="pb-5 text-sm text-text-secondary leading-relaxed">{item.a}</p>
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
	description={`Pay-per-request AI inference across ${MODEL_COUNT}+ models. No monthly fees, no lock-in.`}

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
				<div className="absolute inset-x-0 top-0 h-[480px] bg-[radial-gradient(ellipse_at_top,color-mix(in_srgb,var(--color-accent)_18%,transparent)_0%,transparent_70%)]" />
				<div className="absolute inset-0 bg-grid opacity-[0.35] mask-radial" />
				<FloatingIcons count={6} />
			</div>

			<div className="container-page page-shell">
				<div className="page-hero animate-[fadeInUp_0.6s_ease-out_both]">
					<span className="page-kicker">AI API Pricing</span>
					<h1 className="h1-page text-text-bright">Transparent usage pricing for every model.</h1>
					<p className="page-intro">
						See model costs first, then choose how to pay. OMA bills per token
						or per request, with no subscriptions, no lock-in. Base provider
						rates are shown below — a 25% platform fee is applied at billing
						for Venice-routed models. OMA-AI models have no additional fee.
					</p>
					<div className="meta-strip">
							<span>{modelCount} live models</span>
						<span>Usage-based billing</span>
						<span>Card · USDC · x402</span>
					</div>
				</div>

				<InViewFade>
					<div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
						<m.div
							whileHover={{ y: -4 }}
							transition={springs.card}
							className="surface-card p-5 rounded-[var(--radius-xl)] border border-transparent transition-[border-color,box-shadow] duration-200 ease-out hover:border-accent/30 hover:shadow-[var(--shadow-md)]"
						>
							<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted">
								Starts at
							</p>
							<p className="mt-3 text-3xl font-semibold text-text-bright">
								{lowestInputPrice}
							</p>
							<p className="mt-2 text-sm leading-relaxed text-text">
								Lowest displayed price tier per 1M input tokens across the current
								catalog.
							</p>
						</m.div>
						<m.div
							whileHover={{ y: -4 }}
							transition={springs.card}
							className="surface-card p-5 rounded-[var(--radius-xl)] border border-transparent transition-[border-color,box-shadow] duration-200 ease-out hover:border-accent/30 hover:shadow-[var(--shadow-md)]"
						>
							<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted">
								Pay your way
							</p>
							<p className="mt-3 text-3xl font-semibold text-text-bright">Card or USDC</p>
							<p className="mt-2 text-sm leading-relaxed text-text">
								Buy credits with Visa or Mastercard via Polar, or top up with USDC on
								Base.
							</p>
							<p className="mt-3 text-xs leading-relaxed text-text-muted">
								x402 pay-per-request also supported for agents —{" "}
								<Link href="#x402" className="font-medium text-accent hover:text-accent-hover transition-colors duration-200 ease-out inline-flex items-center">
									see below →
								</Link>
							</p>
						</m.div>
						<m.div
							whileHover={{ y: -4 }}
							transition={springs.card}
							className="surface-card p-5 rounded-[var(--radius-xl)] border border-transparent transition-[border-color,box-shadow] duration-200 ease-out hover:border-accent/30 hover:shadow-[var(--shadow-md)]"
						>
							<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-text-muted">
								No contract
							</p>
							<p className="mt-3 text-3xl font-semibold text-text-bright">No minimums</p>
							<p className="mt-2 text-sm leading-relaxed text-text">
								Ship one request or one million. Credits deduct in real time with a
								clear ledger.
							</p>
						</m.div>
					</div>
				</InViewFade>

				<InViewFade delay={0.1}>
					<section className="relative border-t border-border-subtle py-16 sm:py-20">
						<div className="mb-5 flex items-end justify-between gap-4">
							<div>
								<p className="page-kicker">Model Costs</p>
								<h2 className="h2-page text-text-bright mt-3">
									Compare prices before you deposit.
								</h2>
							</div>
							<p className="hidden max-w-sm text-right text-sm leading-relaxed text-text md:block">
								Filter by tier to find the most cost-effective model that still fits your
								latency and context needs.
							</p>
						</div>
						<PricingTable
							models={pricedModels}
							category={category}
							setCategory={setCategory}
							categories={CATEGORIES}
							categoryStyles={CATEGORY_STYLES}
						/>
					</section>
				</InViewFade>

				<InViewFade delay={0.2}>
					<section className="relative border-t border-border-subtle py-16 sm:py-20" aria-labelledby="polar-tiers-heading">
						<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<p className="page-kicker">Buy credits upfront</p>
								<h2 id="polar-tiers-heading" className="mt-3 text-2xl font-semibold text-text-bright">
									Pay your way.
								</h2>
							</div>
							<p className="max-w-md text-sm leading-relaxed text-text-secondary sm:text-right">
								Choose a credit pack instead of managing a monthly subscription or
								per-token invoice. Every pack is 1:1 USD.
							</p>
						</div>
						<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
							{POLAR_TIERS.map((tier) => {
								const recommended = tier.name === "Builder";
								return (
									<m.article
										key={tier.name}
										whileHover={{ y: -4 }}
										transition={springs.card}
										className={`relative flex h-full flex-col rounded-[var(--radius-xl)] border p-6 transition-[border-color,box-shadow] duration-200 ease-out shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] ${recommended ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-surface"}`}
									>
										{tier.badge && (
											<span className="absolute -top-3 right-6 rounded-full bg-accent px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-void shadow-sm">
												{tier.badge}
											</span>
										)}
										<p className="text-xs font-mono uppercase tracking-[0.18em] text-text-muted">
											{tier.name}
										</p>
										<p className="mt-5 font-mono text-4xl font-semibold tracking-tight text-text-bright">
											{tier.price}
										</p>
										<p className="mt-2 font-mono text-sm font-medium text-accent">{tier.credits}</p>
										<p className="mt-5 min-h-12 text-sm leading-relaxed text-text-secondary">
											{tier.description}
										</p>
										<Link
											href="/deposit?method=card"
											className={`${recommended ? "btn-primary" : "btn-secondary"} mt-8 inline-flex min-h-[44px] w-full items-center justify-center gap-2 text-sm font-medium`}
										>
											<CreditCard className="h-4 w-4" aria-hidden="true" />
											Buy with card
										</Link>
										<p className="mt-4 text-center text-[10px] font-mono uppercase tracking-wider text-text-muted/70">
											Powered by Polar
										</p>
									</m.article>
								);
							})}
						</div>
					</section>
				</InViewFade>

				<InViewFade delay={0.4}>
					<section className="relative border-t border-border-subtle py-16 sm:py-20">
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
										<div className="absolute inset-0 bg-accent/5 rounded-[var(--radius-xl)] blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
										<m.div
											whileHover={{ y: -4 }}
											transition={springs.card}
											className="relative p-6 rounded-[var(--radius-xl)] border border-border bg-surface hover:border-accent/30 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-[border-color,box-shadow] duration-200 ease-out"
										>
											<div className="flex items-start gap-4">
												<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-elevated shadow-sm">
													<Icon className="h-5 w-5 text-accent" />
												</div>
												<div className="flex-1 min-w-0">
													<h3 className="text-sm font-semibold text-text-bright truncate">
														{method.title}
													</h3>
													<p className="mt-2 text-xs text-text-secondary leading-relaxed">
														{method.desc}
													</p>
												</div>
											</div>
											{method.tag && (
												<div
													className={`mt-4 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-medium border ${method.tagStyle}`}
												>
													{method.tag}
												</div>
											)}
										</m.div>
									</div>
								);
							})}
						</div>
					</section>
				</InViewFade>

				<div id="x402" className="relative border-t border-border-subtle py-16 sm:py-20 scroll-mt-20">
					<m.div
						whileHover={{ y: -4 }}
						transition={springs.card}
						className="relative p-6 rounded-[var(--radius-xl)] bg-accent/5 border border-accent/20 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-[box-shadow] duration-200 ease-out"
					>
						<div className="flex items-start gap-4">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10 border border-accent/20">
								<Link2 className="h-5 w-5 text-accent" />
							</div>
							<div>
								<div className="flex items-center gap-3">
									<h3 className="text-base font-semibold text-accent">
										x402 Protocol
									</h3>
									<span className="inline-flex items-center rounded-full bg-accent text-void px-2.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-widest shadow-sm">
										recommended for agents
									</span>
								</div>
								<p className="mt-2 text-sm text-text-secondary leading-relaxed">
									Native x402 support lets applications pay for inference call by
									call, without maintaining prepaid credits.
									<Link
										href="/docs#x402"
										className="ml-2 font-medium text-accent hover:text-accent-hover transition-colors duration-200 ease-out inline-flex items-center"
										aria-label="Learn more about the x402 payment protocol"
									>
										Learn more about x402 <ArrowRight className="ml-1 h-3 w-3" />
									</Link>
								</p>
							</div>
						</div>
					</m.div>
				</div>

				{/* ── FAQ ── */}
				<InViewFade delay={0.5}>
					<div id="faq" className="mb-12 scroll-mt-20">
					<div className="flex items-center gap-2 mb-6">
						<HelpCircle className="h-4 w-4 text-accent" />
						<h3 className="text-sm font-mono font-semibold uppercase tracking-widest text-text-secondary">
							FAQ
						</h3>
					</div>
					<div className="rounded-[var(--radius-xl)] border border-border bg-surface p-6 shadow-[var(--shadow-sm)]">
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
				</InViewFade>

				{/* ── CTA ── */}
				<div className="relative mb-12 overflow-hidden rounded-2xl py-10">
					<div
						aria-hidden="true"
						className="pointer-events-none absolute inset-0 -z-10"
					>
						<div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-transparent to-transparent" />
					</div>
					<div className="flex flex-col items-center gap-5">
						<h2 className="h2-page text-text-bright text-center">
							Start building today
						</h2>
						<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-4">
							<Link
								href="/dashboard"
								className="btn-primary inline-flex h-12 min-w-[10rem] items-center justify-center gap-2 px-6 text-[14px] font-semibold"
							>
								<Zap className="h-4 w-4" aria-hidden="true" />
								Get API key
								<ArrowRight className="h-4 w-4" aria-hidden="true" />
							</Link>
							<Link
								href="/deposit?method=card"
								className="btn-secondary inline-flex h-12 items-center justify-center gap-2 px-5 text-[14px] font-semibold"
							>
								<CreditCard className="h-4 w-4" aria-hidden="true" />
								Buy credits
							</Link>
						</div>
						<Link
							href="/models"
							className="font-mono text-xs text-text-muted transition-colors duration-200 ease-out hover:text-accent"
						>
							View all models →
						</Link>
					</div>
				</div>

				{/* ── Billing Notes ── */}
				<div className="p-5 rounded-[var(--radius-xl)] border border-amber/20 bg-amber/5 shadow-sm">
					<h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-amber mb-4">
						Billing
					</h3>
					<div className="grid grid-cols-1 gap-2 md:grid-cols-2">
						{[
						"Credits are 1:1 USD, non-redeemable, non-transferable",
						"Credits never expire while your account is active",
						"No credit float — credits appear after settlement",
						"Billed per token, deducted in real-time",
						"Card purchases via Polar appear as 'NOSYT' on your statement",
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
