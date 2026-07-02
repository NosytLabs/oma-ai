"use client";

import { m } from "framer-motion";
import dynamic from "next/dynamic";

import { UnifiedDepositHeader } from "./_components/UnifiedDepositHeader";

// Lazy-load the 950-line client interface. Pulls in viem + wagmi + the
// payment-link API; defer until after the header paints.
const UnifiedDepositInterface = dynamic(
	() =>
		import("./_components/UnifiedDepositInterface").then((m) => ({
			default: m.UnifiedDepositInterface,
		})),
	{
		ssr: false,
		loading: () => (
			<div
				className="h-96 w-full animate-pulse rounded-lg bg-surface/40"
				aria-label="Loading deposit interface"
			/>
		),
	},
);

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
				<div className="absolute inset-0 aurora opacity-25" />
			</div>

			<UnifiedDepositHeader />
			<UnifiedDepositInterface />
		</m.div>
	);
}
