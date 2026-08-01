"use client";

import { m } from "@/lib/framer-motion-client";
import nextDynamic from "next/dynamic";
import { AnimatePresence } from "@/lib/framer-motion-client";
import { useEffect, useId, useState } from "react";
import { Banknote, Coins, Zap } from "lucide-react";

import { UnifiedDepositHeader } from "./_components/UnifiedDepositHeader";

// Lazy-load the 950-line client interface. Pulls in viem + wagmi + the
// payment-link API; defer until after the header paints.
const UnifiedDepositInterface = nextDynamic(
	() =>
		import("./_components/UnifiedDepositInterface").then((m) => ({
			default: m.UnifiedDepositInterface,
		})),
	{
		ssr: false,
		loading: () => (
			<div
				role="status"
				className="h-96 w-full animate-pulse rounded-lg bg-surface/40"
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
		ssr: false,
		loading: () => (
			<div
				role="status"
				className="h-72 w-full animate-pulse rounded-lg bg-surface/40"
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
}[] = [
	{
		key: "crypto",
		label: "USDC",
		icon: Coins,
		tag: "On-chain",
		desc: "Send USDC on Base from any wallet.",
	},
	{
		key: "card",
		label: "Card",
		icon: Banknote,
		tag: "Visa · Mastercard",
		desc: "Pay with card via Polar. No wallet needed.",
	},
	{
		key: "x402",
		label: "x402",
		icon: Zap,
		tag: "Pay-per-request",
		desc: "Agents pay per request. No upfront deposit.",
	},
];

/** Payment method info displayed below the deposit form. */
function PaymentMethodsInfo() {
	const methods = [
		{
			name: "USDC (Base)",
			desc: "Direct deposit to the Base treasury. Instant credit once confirmed.",
			badge: "Available",
		},
		{
			name: "Card · Polar",
			desc: "Visa, Mastercard, Apple Pay via Polar. No wallet, no USDC required.",
			badge: "Available",
		},
		{
			name: "x402 Pay-Per-Request",
			desc: "Gasless payments with automatic fee deduction per API request. No upfront deposit required.",
			badge: "Agents",
		},
	];
	return (
		<m.div
			initial={{ opacity: 0, y: 8 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ delay: 0.2, duration: 0.3 }}
			className="mt-8 rounded-lg border border-border bg-surface/50 p-5"
		>
			<h3 className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-text-secondary mb-3">
				<Zap className="w-3.5 h-3.5 text-accent" />
				Payment Methods
			</h3>
			<div className="grid gap-3 sm:grid-cols-3">
				{methods.map((m) => (
					<div
						key={m.name}
						className="rounded border border-border bg-panel p-3"
					>
						<div className="flex items-center justify-between mb-1">
							<span className="text-sm font-semibold text-text-bright">
								{m.name}
							</span>
							<span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold text-accent bg-accent/10 border border-accent/20">
								{m.badge}
							</span>
						</div>
						<p className="text-xs text-text-secondary leading-relaxed">
							{m.desc}
						</p>
					</div>
				))}
			</div>
			<p className="mt-3 text-[10px] text-text-muted font-mono">
				Credits are applied to your account in near real-time after payment
				confirmation.
			</p>
		</m.div>
	);
}

function X402Info() {
	return (
		<div className="space-y-5">
			<div className="rounded-lg border border-accent/20 bg-accent/5 p-5">
				<div className="flex items-start gap-3">
					<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
						<Zap className="h-4 w-4" aria-hidden="true" />
					</div>
					<div className="min-w-0">
						<h3 className="text-sm font-semibold text-text-bright">
							x402 — pay per request
						</h3>
						<p className="mt-1 text-[12px] leading-relaxed text-text-secondary">
							Agents call the API with no account, no API key, no upfront
							deposit. On 402 Payment Required, the facilitator signs a
							USDC payment on Base and the request retries with a
							PAYMENT-SIGNATURE header. Gas paid by the facilitator.
						</p>
					</div>
				</div>
			</div>

			<div className="grid gap-3 sm:grid-cols-2">
				<a
					href="/docs#x402"
					className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-panel p-4 transition-colors hover:border-accent/40"
				>
					<div>
						<div className="text-sm font-semibold text-text-bright">
							Read the x402 spec
						</div>
						<div className="mt-0.5 text-[11px] text-text-muted">
							Full protocol walkthrough with curl examples
						</div>
					</div>
					<span className="text-text-muted transition-transform group-hover:translate-x-0.5">
						→
					</span>
				</a>
				<a
					href="/playground?demo=x402"
					className="group flex items-center justify-between gap-2 rounded-lg border border-border bg-panel p-4 transition-colors hover:border-accent/40"
				>
					<div>
						<div className="text-sm font-semibold text-text-bright">
							Try x402 live
						</div>
						<div className="mt-0.5 text-[11px] text-text-muted">
							Agent demo in the playground
						</div>
					</div>
					<span className="text-text-muted transition-transform group-hover:translate-x-0.5">
						→
					</span>
				</a>
			</div>
		</div>
	);
}

export default function DepositPage() {
	const [method, setMethod] = useState<MethodKey>("crypto");
	const [siteSettings, setSiteSettings] = useState<{
		maintenanceMode: boolean;
		cardPaymentsEnabled: boolean;
		cryptoPaymentsEnabled: boolean;
	} | null>(null);
	const tablistId = useId();

	// Deep-link support: /deposit?method=card|x402|crypto. Read in an effect
	// (not a useState initializer) so server and client render agree — a
	// window-branching initializer causes a hydration mismatch.
	useEffect(() => {
		const m = new URLSearchParams(window.location.search).get("method");
		if (m === "card" || m === "x402" || m === "crypto") setMethod(m);

		const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
		fetch(`${API_BASE}/v1/site-settings`)
			.then((r) => r.json())
			.then((data) => setSiteSettings(data))
			.catch((err) => console.error("Failed to fetch site settings:", err));
	}, []);

	return (
		<m.div
			className="relative mx-auto max-w-3xl px-4 py-8"
			initial={{ opacity: 0 }}
			animate={{ opacity: 1 }}
		>
			{/* Ambient depth layers */}
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
				className="mt-6 grid grid-cols-3 gap-2 rounded-lg border border-border bg-surface/40 p-1"
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
							className={`flex flex-col items-start gap-1 rounded-md px-3 py-2.5 text-left transition-all ${
								isActive
									? "bg-accent/10 text-accent shadow-[inset_0_0_0_1px_var(--color-accent)]"
									: "text-text-muted hover:bg-surface hover:text-text"
							}`}
						>
							<span className="flex items-center gap-1.5 text-[12px] font-mono font-semibold uppercase tracking-wider">
								<Icon className="h-3.5 w-3.5" aria-hidden="true" />
								{m.label}
							</span>
							<span className="text-[10px] font-mono uppercase tracking-wider opacity-80">
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
						transition={{ duration: 0.2 }}
					>
						{method === "crypto" && (
							siteSettings?.cryptoPaymentsEnabled === false ? (
								<div className="rounded-lg border border-border bg-surface/50 p-6 text-center space-y-3">
									<Coins className="mx-auto h-8 w-8 text-text-muted" />
									<h3 className="text-md font-semibold">USDC deposits are temporarily unavailable</h3>
									<p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
										On-chain deposits are currently paused for scheduled platform maintenance. Please check back later or pay with card.
									</p>
								</div>
							) : (
								<UnifiedDepositInterface />
							)
						)}
						{method === "card" && (
							siteSettings?.cardPaymentsEnabled === false ? (
								<div className="rounded-lg border border-border bg-surface/50 p-6 text-center space-y-3">
									<Banknote className="mx-auto h-8 w-8 text-text-muted" />
									<h3 className="text-md font-semibold">Card payments are temporarily unavailable</h3>
									<p className="text-xs text-text-secondary max-w-md mx-auto leading-relaxed">
										Card checkout and credit purchases are currently paused for system upgrades. Please use USDC direct deposit.
									</p>
								</div>
							) : (
								<FiatCheckoutPanel />
							)
						)}
						{method === "x402" && <X402Info />}
					</m.div>
				</AnimatePresence>
			</div>

			<PaymentMethodsInfo />
		</m.div>
	);
}
