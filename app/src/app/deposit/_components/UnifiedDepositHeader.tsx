"use client";

import { m } from "@/lib/framer-motion-client";
import { Coins, Hexagon } from "lucide-react";
import { blurIn } from "@/lib/animation";

export function UnifiedDepositHeader() {
	return (
		<m.div
			className="mb-8"
			variants={blurIn}
			initial="hidden"
			animate="show"
			viewport={undefined}
		>
			<div className="mb-3 flex flex-wrap items-start gap-3 sm:items-center sm:gap-4">
				<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--radius-lg)] border border-border-bright bg-surface">
					<Coins className="h-6 w-6 text-accent" />
				</div>
				<div className="min-w-0 flex-1">
					<h1 className="h1-utility text-text-bright">Deposit Credits</h1>
					<p className="text-sm text-text-secondary">
						Crypto-friendly credit system. Fund with USDC on Base or settle USDC via x402.
					</p>
				</div>
				<m.span
					className="inline-flex shrink-0 items-center gap-1.5 rounded-[var(--radius-sm)] border border-accent/30 bg-accent/10 px-2.5 py-1 font-mono text-xs font-semibold text-accent"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={{ delay: 0.15 }}
				>
					<Hexagon className="h-3 w-3" />
					BASE
				</m.span>
			</div>
		</m.div>
	);
}
