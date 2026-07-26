"use client";

import { m } from "@/lib/framer-motion-client";
import nextDynamic from "next/dynamic";
import { Zap } from "lucide-react";

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

/** Payment method info displayed below the deposit form. */
function PaymentMethodsInfo() {
	const methods = [
		{
			name: "USDC (Base)",
			desc: "Direct deposit to the Base treasury. Instant credit once confirmed.",
			badge: "Available",
		},
		{
			name: "x402 Pay-Per-Request",
			desc: "Gasless payments with automatic fee deduction per API request. No upfront deposit required.",
			badge: "Available",
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
			<div className="grid gap-3 sm:grid-cols-2">
				{methods.map((m) => (
					<div
						key={m.name}
						className="rounded border border-border bg-panel p-3"
					>
						<div className="flex items-center justify-between mb-1">
							<span className="text-sm font-semibold text-text-bright">
								{m.name}
							</span>
							<span className="rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold text-success bg-success/10 border border-success/20">
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
				Credits are applied to your account in near real-time after on-chain
				confirmation.
			</p>
		</m.div>
	);
}

export default function DepositPage() {
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
			<UnifiedDepositInterface />
			<PaymentMethodsInfo />
		</m.div>
	);
}
