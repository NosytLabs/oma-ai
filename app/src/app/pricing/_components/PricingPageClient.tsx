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
import { InViewFade } from "@/components/motion/in-view-fade";
import { formatPricePerMillion, loadModels, MODEL_COUNT, type Model, MODELS } from "@/lib/models-data";
import { CREDIT_PLANS } from "@/lib/credit-utils";
import {
	toPricedModel,
	type Category,
} from "../_lib/pricing-utils";
import {
	BreadcrumbListJsonLd,
	ProductJsonLd,
	FAQPageJsonLd,
} from "@/components/json-ld";
import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { PricingTable } from "./PricingTable";
import {
	railByKey,
	type SitePaymentSettings,
} from "@/lib/payment-rails";

const CATEGORIES: { key: Category; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "frontier", label: "Frontier" },
	{ key: "premium", label: "Premium" },
	{ key: "mid", label: "Mid-Range" },
	{ key: "budget", label: "Budget" },
];

// Most tiers share the same active/inactive look — only "budget" needs a
// separate accent (success) for visual differentiation. "All" uses the
// neutral surface so the active state reads as a selected chip rather than
// the brand slab (the rest of the page already has plenty of accent).
const ACCENT_ACTIVE =
	"bg-[var(--color-accent)] text-[var(--color-accent-fg)] border border-[var(--color-accent)]";
const ACCENT_INACTIVE =
	"bg-[color-mix(in_srgb,var(--color-accent)_10%,transparent)] text-[var(--color-accent)] border border-[var(--color-accent)]/30";
const SUCCESS_ACTIVE =
	"bg-[var(--color-success)] text-[var(--color-void-deep)] border border-[var(--color-success)]";
const SUCCESS_INACTIVE =
	"bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-[var(--color-success)] border border-[var(--color-success)]/30";
const NEUTRAL_ACTIVE =
	"bg-[var(--color-text-bright)] text-[var(--color-void)] border border-[var(--color-text-bright)]";

const CATEGORY_STYLES: Record<Category, { active: string; inactive: string }> =
	{
		all: { active: NEUTRAL_ACTIVE, inactive: "bg-[var(--color-surface)] text-text-secondary border border-[var(--color-border)]" },
		frontier: { active: ACCENT_ACTIVE, inactive: ACCENT_INACTIVE },
		premium: { active: ACCENT_ACTIVE, inactive: ACCENT_INACTIVE },
		mid: { active: ACCENT_ACTIVE, inactive: ACCENT_INACTIVE },
		budget: { active: SUCCESS_ACTIVE, inactive: SUCCESS_INACTIVE },
	};

const PAYMENT_METHODS = [
	{
		icon: CreditCard,
		title: "Card checkout · when enabled",
		desc: "Where the operator has enabled Polar, buy credits by card without a wallet.",
		tag: "Optional",
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
		title: "x402 Agent Settlement",
		desc: "EIP-3009 USDC on Base. Agents verify, settle to credit a balance, then spend with an API key.",
		tag: "Agents",
		tagStyle: "bg-surface text-text-secondary border border-border",
	},
];

// Tiers render from the single CREDIT_PLANS source (lib/credit-utils.ts).
// Marketing-only copy + recommended badges are layered on top here so the
// pricing UI can evolve without touching the deposit flow that consumes it.
const POLAR_TIERS: Array<{
	name: string;
	price: string;
	credits: string;
	description: string;
	badge?: string;
}> = CREDIT_PLANS.map((p) => {
	const tierCopy: Record<string, { description: string; badge?: string }> = {
		Hobby: {
			description: "A small start for side projects and first experiments.",
		},
		Builder: {
			description:
				"Enough credits to carry a production app or an autonomous agent.",
			badge: "Recommended",
		},
		Scale: {
			description: "The best value per credit for high-volume workloads.",
			badge: "Best value",
		},
	};
	// Note: 1 credit = $0.01, so a pack is NOT "credits at 1:1 USD" —
	// $10 buys 1,000 credits. Stating the real rate here keeps the card
	// consistent with the FAQ and the credits page.
	const copy = tierCopy[p.tag] ?? {
		description: `${p.credits.toLocaleString()} credits (1 credit = $0.01).`,
	};
	return {
		name: p.tag,
		price: `$${p.usd}`,
		credits: `${p.credits.toLocaleString()} credits`,
		description: copy.description,
		badge: copy.badge,
	};
});

const FAQ_ITEMS = [
	{
		q: "How do I add credits?",
		a: "Deposit USDC on Base at 1:1 USD, settle USDC via x402 to credit your balance, or buy credits with card where Polar checkout is enabled. The credits page always shows which rails are available.",
	},
	{
		q: "Do credits expire?",
		a: "No. Credits never expire while your account is active. They are non-redeemable and non-transferable. 1 credit = $0.01 USD (so $1 = 100 credits), and each request consumes the model's listed per-token cost at request time.",
	},
	{
		q: "What payment methods are accepted?",
		a: "USDC direct on Base at 1:1 USD, plus x402 verify/settle to credit your balance for agent workflows. Card checkout through Polar is available only when the operator has configured and enabled it; the credits page shows its live status.",
	},
	{
		q: "Is there a free tier?",
		a: "Yes — the 2 OMA-AI models are free in browser website chat only: 20 messages/day anonymous, 100/day signed in. API-key calls always spend credits, even on those models. New sign-ups also get $1.00 in trial credit.",
	},
	{
		q: "What is x402?",
		a: "x402 lets agents fund with USDC on Base without a card: sign the payment envelope, verify at /x402/verify, settle to credit your account, then spend with an API key. Ideal for agents and automated workflows.",
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
				className={`grid transition-all duration-200 ease-spring-soft ${isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
			>
				<div className="min-h-0 overflow-hidden">
					<p className="pb-5 text-sm text-text-secondary leading-relaxed">{item.a}</p>
				</div>
			</div>
		</div>
	);
}

export default function PricingPage() {
	const [category, setCategory] = useState<Category>("all");
	const [openFaq, setOpenFaq] = useState<number | null>(null);
	const [models, setModels] = useState<Model[]>(MODELS);
	const [siteSettings, setSiteSettings] = useState<SitePaymentSettings | null>(
		null,
	);

	useEffect(() => {
		let cancelled = false;
		loadModels()
			.then((live) => {
				if (!cancelled) setModels(live);
			})
			.catch(() => {
				// keep static fallback
			});
		fetch("/api/v1/site-settings", { credentials: "same-origin" })
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (!cancelled && data && typeof data === "object") {
					setSiteSettings(data as SitePaymentSettings);
				}
			})
			.catch(() => {
				/* leave null → Setup required until confirmed */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const cardRail = railByKey(siteSettings, "card");
	const cardActionable = cardRail.actionable;

	const pricedModels = useMemo(() => models.map(toPricedModel), [models]);

	const lowestInputPrice = useMemo(
		() =>
			formatPricePerMillion(
				Math.min(...pricedModels.map((m) => m.inputPer1M)),
			),
		[pricedModels],
	);
	const modelCount = models.filter((model) => model.available !== false).length;

	return (
		<div className="relative overflow-x-clip bg-void">
			<BreadcrumbListJsonLd
				items={[
					{ name: "Home", url: "/" },
					{ name: "Pricing", url: "/pricing" },
				]}
			/>
			<ProductJsonLd
				name="OMA AI API Inference"
				description={`Usage-based AI inference across ${MODEL_COUNT} models. No monthly fees, no lock-in.`}
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
			</div>

			<div className="container-page">
				<div className="page-hero">
					<span className="section-eyebrow-caps">AI API pricing</span>
					<h1 className="h1-page text-text-bright max-w-4xl">Pricing for every model.</h1>
					<p className="page-intro">
						See model costs first, then choose how to pay. OMA bills from
						prepaid credits per token, with no subscriptions and no lock-in.
						Listed prices are what you pay: Venice-routed models include a
						25% platform fee; OMA-AI models are priced at 2x Gonka wholesale.
					</p>
					<div className="meta-strip">
							<span>{modelCount} available models</span>
						<span>Usage-based billing</span>
						<span>USDC · x402 · optional card</span>
					</div>
				</div>

				<InViewFade>
					<div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2">
						<m.div
							whileHover={{ y: -4 }}
							transition={springs.card}
							className="surface-card p-5 rounded-[var(--radius-xl)] border border-transparent transition-[border-color,box-shadow] duration-200 ease-out hover:border-[var(--color-accent)]/30 hover:shadow-[var(--shadow-md)]"
						>
							<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
								Starts at
							</p>
							<p className="mt-3 font-geometric text-4xl font-medium tabular-nums tracking-tight text-[var(--color-text-bright)]">
								{lowestInputPrice}
							</p>
							<p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">
								Lowest displayed price tier per 1M input tokens across the current
								catalog.
							</p>
						</m.div>
						<m.div
							whileHover={{ y: -4 }}
							transition={springs.card}
							className="surface-card p-5 rounded-[var(--radius-xl)] border border-transparent transition-[border-color,box-shadow] duration-200 ease-out hover:border-[var(--color-accent)]/30 hover:shadow-[var(--shadow-md)]"
						>
							<p className="text-[11px] font-mono uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
								Pay your way
							</p>
							<p className="mt-3 text-3xl font-semibold text-[var(--color-text-bright)]">USDC · optional card</p>
							<p className="mt-2 text-sm leading-relaxed text-[var(--color-text)]">
								Top up with USDC on Base, or buy with card via Polar when checkout is
								enabled.
							</p>
							<p className="mt-3 text-xs leading-relaxed text-[var(--color-text-muted)]">
								x402 settlement also supported for agents —{" "}
								<Link href="#x402" className="font-medium text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] transition-colors duration-200 ease-out inline-flex items-center">
									see below
								</Link>
							</p>
						</m.div>
					</div>
				</InViewFade>

				<InViewFade delay={0.1}>
					<section className="relative border-t border-border-subtle py-14 sm:py-18 lg:py-22">
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
					<section className="relative border-t border-border-subtle py-14 sm:py-18 lg:py-22" aria-labelledby="polar-tiers-heading">
						<div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
							<div>
								<span className="section-eyebrow-caps">Buy credits upfront</span>
								<h2 id="polar-tiers-heading" className="h2-page mt-3 text-text-bright">
									Pay your way.
								</h2>
							</div>
							<p className="max-w-md text-sm leading-relaxed text-text-secondary sm:text-right">
								{cardActionable
									? "Choose a credit pack instead of managing a monthly subscription or per-token invoice. Every pack is 1:1 USD."
									: "Deposit USDC on Base at 1:1 USD, or use x402 settle for agents. Card checkout shows Setup required until Polar is enabled."}
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
										className={`relative flex h-full flex-col rounded-[var(--radius-md)] border p-6 transition-[border-color,box-shadow] duration-200 ease-out shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] ${recommended ? "border-accent bg-accent/5 ring-1 ring-accent/20" : "border-border bg-surface"}`}
									>
										{tier.badge && (
											<span className="absolute -top-3 right-6 rounded-sm bg-accent px-3 py-1 text-[10px] font-mono font-semibold uppercase tracking-wider text-void shadow-sm">
												{tier.badge}
											</span>
										)}
										<p className="text-xs font-mono uppercase tracking-[0.18em] text-text-muted">
											{tier.name}
										</p>
										<p className="mt-5 font-geometric text-4xl font-semibold tabular-nums tracking-tight text-text-bright">
											{tier.price}
										</p>
										<p className="mt-2 font-mono text-sm font-medium text-accent">{tier.credits}</p>
										<p className="mt-5 min-h-12 text-sm leading-relaxed text-text-secondary">
											{tier.description}
										</p>
										{cardActionable ? (
											<>
												<Link
													href="/deposit?method=card"
													className={`${recommended ? "btn-mono btn-primary" : "btn-mono"} mt-8 w-full`}
												>
													<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
													Buy with card
												</Link>
												<Link
													href="/deposit?method=usdc"
													className="mt-2 inline-flex min-h-10 w-full items-center justify-center text-xs font-mono text-text-muted underline-offset-4 hover:text-accent hover:underline"
												>
													or deposit USDC
												</Link>
												<p className="mt-3 text-center text-[10px] font-mono uppercase tracking-wider text-text-muted">
													Card checkout by Polar · USDC direct on Base
												</p>
											</>
										) : (
											<>
												<Link
													href="/deposit?method=usdc"
													className={`${recommended ? "btn-mono btn-primary" : "btn-mono"} mt-8 w-full`}
												>
													<Coins className="h-3.5 w-3.5" aria-hidden="true" />
													Deposit USDC
												</Link>
												<p className="mt-3 text-center text-[10px] font-mono uppercase tracking-wider text-text-muted">
													Card · {cardRail.badge}
												</p>
											</>
										)}
									</m.article>
								);
							})}
						</div>
					</section>
				</InViewFade>

				<InViewFade delay={0.4}>
					<section className="relative border-t border-border-subtle py-14 sm:py-18 lg:py-22">
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

				<InViewFade>
				<section id="x402" className="relative border-t border-border-subtle py-14 sm:py-18 lg:py-22 scroll-mt-20">
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
									Native x402 support lets applications fund with USDC on Base
									without a card. Verify once, spend with an API key.
									<Link
										href="/docs#x402"
										className="ml-2 font-medium text-accent hover:text-accent-hover transition-colors duration-200 ease-out inline-flex items-center"
										aria-label="Learn more about x402"
									>
										Learn more about x402 <ArrowRight className="ml-1 h-3 w-3" />
									</Link>
								</p>
							</div>
						</div>
					</m.div>
				</section>
			</InViewFade>

			{/* ── FAQ ── */}
				<InViewFade delay={0.5}>
					<div id="faq" className="mb-12 scroll-mt-20">
					<div className="flex items-center gap-2 mb-6">
						<HelpCircle className="h-4 w-4 text-accent" />
						<h2 className="text-sm font-mono font-semibold uppercase tracking-widest text-text-secondary">
							FAQ
						</h2>
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
				<div className="relative mb-12 overflow-hidden rounded-[var(--radius-md)] py-10">
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
						<div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
							<Link
								href="/login?next=/dashboard"
								className="btn-mono btn-primary w-full sm:w-auto"
							>
								<Zap className="h-3.5 w-3.5" aria-hidden="true" />
								<span>Get API key</span>
								<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
							</Link>
							<Link
								href={cardActionable ? "/deposit?method=card" : "/deposit?method=usdc"}
								className="btn-mono w-full sm:w-auto"
							>
								{cardActionable ? (
									<CreditCard className="h-3.5 w-3.5" aria-hidden="true" />
								) : (
									<Coins className="h-3.5 w-3.5" aria-hidden="true" />
								)}
								<span>{cardActionable ? "Buy credits" : "Deposit USDC"}</span>
							</Link>
						</div>
						<Link
							href="/models"
							className="inline-flex min-h-11 items-center justify-center font-mono text-xs text-text-muted transition-colors duration-200 ease-out hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							View all models
						</Link>
					</div>
				</div>

			{/* ── Billing Notes ── */}
			<div className="mb-12 sm:mb-16 p-5 rounded-[var(--radius-xl)] border border-border bg-surface/50 shadow-sm">
					<h3 className="text-xs font-mono font-semibold uppercase tracking-widest text-text-muted mb-4">
						Billing notes
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
								<div className="mt-1.5 h-1 w-1 rounded-full bg-accent" />
								<span className="text-xs text-text-secondary">{note}</span>
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
