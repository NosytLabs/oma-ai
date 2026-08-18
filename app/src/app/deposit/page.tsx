"use client";



import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import nextDynamic from "next/dynamic";
import { AnimatePresence } from "@/lib/framer-motion-client";
import { useEffect, useId, useState } from "react";
import { Banknote, Coins, Zap } from "lucide-react";

import { UnifiedDepositHeader } from "./_components/UnifiedDepositHeader";
import {
	railByKey,
	railStatuses,
	type SitePaymentSettings,
} from "@/lib/payment-rails";

// Lazy-load the client interface. Pulls in viem + the payment-link API.
const UnifiedDepositInterface = nextDynamic(
	() =>
		import("./_components/UnifiedDepositInterface").then((m) => ({
			default: m.UnifiedDepositInterface,
		})),
	{
		ssr: true,
		loading: () => (
			<div
				role="status"
				className="h-96 w-full animate-pulse rounded-[var(--radius-lg)] bg-surface/40"
				aria-label="Loading deposit interface"
			/>
		),
	},
);

const FiatCheckoutPanel = nextDynamic(
	() =>
		import("./_components/FiatCheckoutPanel").then((m) => ({
			default: m.FiatCheckoutPanel,
		})),
	{
		ssr: true,
		loading: () => (
			<div
				role="status"
				className="h-72 w-full animate-pulse rounded-[var(--radius-lg)] bg-surface/40"
				aria-label="Loading card checkout"
			/>
		),
	},
);

type MethodKey = "crypto" | "card" | "x402";

const METHODS: {
	key: MethodKey;
	label: string;
	icon: typeof Coins;
	tag: string;
	desc: string;
	rail: "usdc" | "card" | "x402";
}[] = [
	{
		key: "crypto",
		label: "USDC",
		icon: Coins,
		tag: "Wallet",
		desc: "Connect your wallet and send USDC on Base — credited automatically.",
		rail: "usdc",
	},
	{
		key: "card",
		label: "Card",
		icon: Banknote,
		tag: "Visa · Mastercard",
		desc: "Pay with card via Polar. No wallet needed.",
		rail: "card",
	},
	{
		key: "x402",
		label: "x402",
		icon: Zap,
		tag: "Pay-per-request",
		desc: "Agents pay per request. No upfront deposit.",
		rail: "x402",
	},
];

function PaymentMethodsInfo({
	siteSettings,
}: {
	siteSettings: SitePaymentSettings | null;
}) {
	const methods = railStatuses(siteSettings).map((r) => ({
		name: r.label,
		desc:
			r.key === "usdc"
				? "Pay with your wallet — USDC sent directly to the Base treasury. Instant credit once confirmed."
				: r.key === "card"
					? "Visa, Mastercard, Apple Pay via Polar. No wallet, no USDC required."
					: "Gasless payments with automatic fee deduction per API request. No upfront deposit required.",
		badge: r.badge,
		reason: r.reason,
	}));

	return (
		<m.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.15, ...springs.card }}
			className="mt-8 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-5"
		>
			<h3 className="mb-3 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-text-secondary">
				<Zap className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
				Payment methods
			</h3>
			<div className="grid gap-3 sm:grid-cols-3">
				{methods.map((m) => (
					<div
						key={m.name}
						className="rounded-[var(--radius-sm)] border border-border bg-panel p-3"
					>
						<div className="mb-1 flex items-center justify-between gap-2">
							<span className="text-sm font-semibold text-text-bright">
								{m.name}
							</span>
							<span
								className={`shrink-0 rounded-[var(--radius-sm)] border px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums ${
									m.badge === "Available" || m.badge === "Agents"
										? "border-accent/20 bg-accent/10 text-accent"
										: m.badge === "Paused"
											? "border-warning/30 bg-warning/10 text-warning"
											: "border-border bg-surface text-text-muted"
								}`}
							>
								{m.badge}
							</span>
						</div>
						<p className="text-xs leading-relaxed text-text-secondary">
							{m.desc}
						</p>
						{m.reason && (
							<p className="mt-1.5 text-[11px] leading-relaxed text-text-muted">
								{m.reason}
							</p>
						)}
					</div>
				))}
			</div>
			<p className="mt-3 font-mono text-[10px] text-text-muted">
				Credits apply after payment confirmation. x402 settles per request on
				Base without a pre-deposit.
			</p>
		</m.div>
	);
}

function RailUnavailable({
	icon: Icon,
	title,
	reason,
	fallback,
}: {
	icon: typeof Coins;
	title: string;
	reason: string;
	fallback: string;
}) {
	return (
		<div className="space-y-3 rounded-[var(--radius-lg)] border border-border bg-surface/50 p-6 text-center">
			<Icon className="mx-auto h-8 w-8 text-text-muted" aria-hidden="true" />
			<h3 className="text-md font-semibold text-text-bright">{title}</h3>
			<p className="mx-auto max-w-md text-xs leading-relaxed text-text-secondary">
				{reason}
			</p>
			<p className="mx-auto max-w-md text-[11px] text-text-muted">{fallback}</p>
		</div>
	);
}

function X402Info() {
	return (
		<div className="space-y-5">
			<div className="rounded-[var(--radius-lg)] border border-accent/20 bg-accent/5 p-5">
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-accent/10 text-accent">
						<Zap className="h-4 w-4" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<h3 className="text-sm font-semibold text-text-bright">
							x402 — pay per request
						</h3>
						<p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
							Agents call the API with no account, no API key, and no upfront
							deposit. On 402 Payment Required, the client signs a USDC payment
							on Base and retries with a PAYMENT-SIGNATURE header. Gas is paid
							by the facilitator.
						</p>
					</div>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<a
					href="/docs#x402"
					className="group flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-border bg-panel p-4 transition-colors duration-200 ease-out hover:border-accent/40"
				>
					<div>
						<div className="text-sm font-semibold text-text-bright">
							Read the x402 docs
						</div>
						<div className="mt-0.5 text-[11px] text-text-muted">
							Protocol walkthrough with curl examples
						</div>
					</div>
				</a>
				<a
					href="/chat"
					className="group flex items-center justify-between gap-2 rounded-[var(--radius-lg)] border border-border bg-panel p-4 transition-colors duration-200 ease-out hover:border-accent/40"
				>
					<div>
						<div className="text-sm font-semibold text-text-bright">
							Open chat
						</div>
						<div className="mt-0.5 text-[11px] text-text-muted">
							Try the playground surface
						</div>
					</div>
				</a>
			</div>
		</div>
	);
}

export default function DepositPage() {
	const [method, setMethod] = useState<MethodKey>("crypto");
	const [siteSettings, setSiteSettings] = useState<SitePaymentSettings | null>(
		null,
	);
	const tablistId = useId();

	useEffect(() => {
		const requested = new URLSearchParams(window.location.search).get(
			"method",
		);
		const normalized =
			requested === "usdc" ? "crypto" : requested;
		const hasExplicitMethod =
			normalized === "card" ||
			normalized === "x402" ||
			normalized === "crypto";
		if (hasExplicitMethod) setMethod(normalized);

		fetch("/api/v1/site-settings", { credentials: "same-origin" })
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (!data || typeof data !== "object") return;
				const settings = data as SitePaymentSettings;
				setSiteSettings(settings);
				// When the URL did not pin a rail, open the first actionable one
				// so local/dev without USDC_DEPOSIT_ADDRESS lands on card/x402
				// instead of a dead "USDC not available" panel.
				if (hasExplicitMethod) return;
				const preferred = METHODS.find((m) => {
					const rail = railByKey(settings, m.rail);
					return rail.actionable;
				});
				if (preferred) setMethod(preferred.key);
			})
			.catch(() => {
				/* leave null → optimistic Available until next visit */
			});
	}, []);

	const usdc = railByKey(siteSettings, "usdc");
	const card = railByKey(siteSettings, "card");

	return (
		<m.div
			className="relative mx-auto max-w-3xl lg:max-w-4xl px-4 py-14 sm:px-6 sm:py-18 lg:py-22"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
		>
			<div
				aria-hidden
				className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
			>
				<div className="absolute inset-0 bg-grid-animated opacity-[0.12] mask-radial" />
			</div>

			<UnifiedDepositHeader />

			<div
				role="tablist"
				id={tablistId}
				aria-label="Choose a payment method"
				className="mt-6 grid grid-cols-3 gap-2 rounded-[var(--radius-lg)] border border-border bg-surface/40 p-1"
			>
				{METHODS.map((m) => {
					const Icon = m.icon;
					const isActive = method === m.key;
					return (
						<button
							key={m.key}
							type="button"
							role="tab"
							id={`${tablistId}-tab-${m.key}`}
							aria-selected={isActive}
							aria-controls={`${tablistId}-panel-${m.key}`}
							tabIndex={isActive ? 0 : -1}
							onClick={() => setMethod(m.key)}
							className={`flex flex-col items-start gap-1 rounded-[var(--radius-md)] px-3 py-2.5 text-left transition-[background-color,color,box-shadow] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void ${
								isActive
									? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]"
									: "text-text-muted hover:bg-surface hover:text-text"
							}`}
						>
							<span className="flex items-center gap-1.5 font-mono text-[12px] font-semibold uppercase tracking-wider">
								<Icon className="h-3.5 w-3.5" aria-hidden="true" />
								{m.label}
							</span>
							<span className="font-mono text-[10px] uppercase tracking-wider opacity-80">
								{m.tag}
							</span>
						</button>
					);
				})}
			</div>

			<div
				className="mt-5"
				role="tabpanel"
				id={`${tablistId}-panel-${method}`}
				aria-labelledby={`${tablistId}-tab-${method}`}
			>
				<AnimatePresence mode="wait">
					<m.div
						key={method}
						initial={{ opacity: 0, y: 6 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -6 }}
						transition={springs.tab}
					>
						{method === "crypto" &&
							(usdc.actionable ? (
								<UnifiedDepositInterface />
							) : (
								<RailUnavailable
									icon={Coins}
									title={
										usdc.badge === "Paused"
											? "USDC deposits are paused"
											: "USDC deposits are not available"
									}
									reason={
										usdc.reason ??
										"This payment rail is not available right now."
									}
									fallback="Use card checkout or x402 pay-per-request instead."
								/>
							))}
						{method === "card" &&
							(card.actionable ? (
								<FiatCheckoutPanel />
							) : (
								<RailUnavailable
									icon={Banknote}
									title={
										card.badge === "Paused"
											? "Card payments are paused"
											: "Card checkout is not available"
									}
									reason={
										card.reason ??
										"This payment rail is not available right now."
									}
									fallback="Use USDC on Base or x402 pay-per-request instead."
								/>
							))}
						{method === "x402" && <X402Info />}
					</m.div>
				</AnimatePresence>
			</div>

			<PaymentMethodsInfo siteSettings={siteSettings} />
		</m.div>
	);
}
