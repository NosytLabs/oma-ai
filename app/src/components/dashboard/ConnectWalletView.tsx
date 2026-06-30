"use client";

import { m } from "framer-motion";
import { Wallet, Zap } from "lucide-react";
import Link from "next/link";

interface ConnectWalletViewProps {
	onConnect: () => void;
}

export function ConnectWalletView({ onConnect }: ConnectWalletViewProps) {
	return (
		<m.div
			className="relative flex min-h-screen items-center justify-center"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
		>
			<Link
				href="/"
				className="absolute top-6 left-6 flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
			>
				← Home
			</Link>
			<div className="text-center max-w-md px-4">
				<m.div
					className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-accent/20 bg-accent/5"
					initial={{ scale: 0.9 }}
					animate={{ scale: 1 }}
					transition={{ delay: 0.2, type: "spring" }}
				>
					<Wallet className="h-10 w-10 text-accent" />
				</m.div>
				<h2 className="mb-3 text-2xl font-bold tracking-tight text-text-bright">
					Connect your wallet
				</h2>
				<p className="mb-6 text-sm text-text-secondary">
					Sign in to view your credits, usage stats, and manage API keys.
				</p>
				<button
					type="button"
					onClick={() => onConnect()}
					aria-label="Connect wallet"
					className="group inline-flex items-center justify-center mx-auto gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-void shadow-lg shadow-accent/20 transition-all hover:bg-accent/90 focus-ring active:translate-y-[1px]"
				>
					<Zap className="h-4 w-4" />
					Connect wallet
				</button>
				<p className="mt-4 text-[11px] text-text-muted">
					No email, no signup — your wallet is your account.
				</p>
			</div>
		</m.div>
	);
}
