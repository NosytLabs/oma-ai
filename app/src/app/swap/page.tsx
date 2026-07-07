"use client";

import { ArrowRightLeft, Hexagon, Wallet } from "lucide-react";
import Link from "next/link";
import { ErrorBoundary } from "@/components/error-boundary";

export default function SwapPage() {
	return (
		<ErrorBoundary
			fallback={
				<div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-4">
					<h2 className="font-mono text-text text-lg">
						Something went wrong
					</h2>
					<button
						type="button"
						onClick={() => window.location.reload()}
						className="btn-primary flex items-center gap-2"
					>
						↻ Retry
					</button>
				</div>
			}
		>
			<div className="min-h-[calc(100vh-4rem)] px-4 pt-20 pb-8 bg-void">
				<div className="mx-auto max-w-md text-center">
					{/* Header */}
					<div className="mb-8">
						<div className="inline-flex items-center justify-center gap-3 mb-4">
							<div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-accent/30 bg-accent/10 shadow-lg">
								<ArrowRightLeft className="h-7 w-7 text-accent" />
							</div>
						</div>
						<h1 className="h1-utility mb-2 text-text">Swap Crypto</h1>
						<p className="text-sm text-text-muted">
							Deposit USDC directly instead
						</p>
					</div>

					{/* Card */}
					<div className="rounded-3xl border border-border bg-surface p-8 shadow-[0_8px_32px_-8px_color-mix(in_srgb,var(--color-void)_8%,transparent)]">
						<div className="mb-6 flex justify-center">
							<div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 border border-accent/20">
								<Wallet className="h-8 w-8 text-accent" />
							</div>
						</div>

						<h2 className="mb-3 text-xl font-bold text-text">
							Swap feature consolidated
						</h2>

						<p className="mb-6 text-sm text-text-secondary leading-relaxed">
							The external swap provider is no longer available. You can
							still fund your account with a direct USDC deposit on Base —
							fast, low-cost, and no third-party dependency.
						</p>

						<Link
							href="/deposit"
							className="inline-flex items-center justify-center gap-2 rounded-full bg-accent px-8 py-4 text-sm font-semibold text-void shadow-lg shadow-accent/25 transition-all hover:bg-accent-hover hover:-translate-y-0.5 hover:shadow-xl hover:shadow-accent/30 focus:outline-none focus:ring-2 focus:ring-accent focus:ring-offset-2"
						>
							<Hexagon className="h-4 w-4" aria-hidden="true" />
							Deposit USDC
						</Link>
					</div>
				</div>
			</div>
		</ErrorBoundary>
	);
}
