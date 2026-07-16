"use client";

import { m } from "framer-motion";
import { ArrowRight, KeyRound, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { OmaLogo } from "@/components/ui/oma-logo";

interface ConnectWalletViewProps {
	onConnect: () => void;
}

export function ConnectWalletView({ onConnect }: ConnectWalletViewProps) {
	return (
		<m.div
			className="relative flex min-h-[70vh] items-center justify-center px-4"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.5 }}
		>
			<div className="w-full max-w-md text-center">
				<m.div
					className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-accent/25 bg-accent/8 shadow-[0_0_32px_-8px_var(--color-accent-glow)]"
					initial={{ scale: 0.9 }}
					animate={{ scale: 1 }}
					transition={{ delay: 0.15, type: "spring" }}
				>
					<OmaLogo size="md" />
				</m.div>
				<h1 className="mb-3 text-2xl font-semibold tracking-tight text-text-bright">
					Sign in to your dashboard
				</h1>
				<p className="mb-8 text-sm leading-relaxed text-text-secondary">
					View credits, usage, and API keys. Wallet (SIWE) or a private account
					number — same session either way.
				</p>
				<div className="mx-auto flex w-full max-w-xs flex-col gap-3">
					<Button
						type="button"
						variant="primary"
						size="lg"
						className="w-full"
						onClick={() => onConnect()}
						leftIcon={<Zap className="h-4 w-4" aria-hidden="true" />}
						aria-label="Connect wallet"
					>
						Connect wallet
					</Button>
					<Button
						asChild
						variant="secondary"
						size="lg"
						className="w-full"
						leftIcon={<KeyRound className="h-4 w-4" aria-hidden="true" />}
						rightIcon={<ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />}
					>
						<Link href="/login?method=account&next=/dashboard">
							Account number
						</Link>
					</Button>
					<Link
						href="/login"
						className="text-[12px] text-text-muted hover:text-accent transition-colors"
					>
						Full login options →
					</Link>
					<Link
						href="/dashboard?demo=1"
						className="text-[12px] text-text-muted hover:text-accent transition-colors"
					>
						Preview dashboard (demo) →
					</Link>
				</div>
				<p className="mt-8 inline-flex items-center gap-1.5 text-[11px] text-text-muted">
					<Sparkles className="h-3 w-3 text-accent" aria-hidden="true" />
					Low-friction signup — wallet or account number is your identity.
				</p>
			</div>
		</m.div>
	);
}
