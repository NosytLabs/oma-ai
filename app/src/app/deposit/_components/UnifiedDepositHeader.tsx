"use client";

import { m } from "framer-motion";
import { Coins, Hexagon } from "lucide-react";
import { blurIn } from "@/lib/motion";

export function UnifiedDepositHeader() {
	return (
		<m.div
			className="mb-8"
			variants={blurIn}
			initial="hidden"
			animate="show"
			viewport={undefined}
		>
			<div className="flex items-center gap-4 mb-3">
				<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-bright bg-surface">
					<Coins className="h-6 w-6 text-accent" />
				</div>
				<div className="flex-1">
					<h1 className="h1-utility text-text-bright">Deposit Credits</h1>
					<p className="text-text-secondary text-sm">
						Crypto-friendly credit system. Fund with USDC or swap from 100+
						cryptocurrencies via Houdini-powered flow.
					</p>
				</div>
				<m.span
					className="inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-mono font-semibold text-accent border border-accent/30 bg-accent/10"
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
