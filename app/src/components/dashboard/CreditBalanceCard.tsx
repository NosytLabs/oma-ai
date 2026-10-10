"use client";

import Link from "next/link";
import { memo } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import type { BalanceResponse, CreditBatch, UsageRecord } from "@/lib/api";
import { toDollars } from "@/lib/utils";
import { usageBilledDollars } from "@/lib/dashboard-aggregate";
import { DashboardCard } from "./DashboardCard";

interface CreditBalanceCardProps {
	balance: BalanceResponse | null;
	loading: boolean;
	/** Last 7 days of usage, oldest → newest. Drives the inline sparkline. */
	recentUsage?: UsageRecord[];
	spendTrend?: number[];
	/** Legacy compatibility only; the aggregate ledger includes every credit grant. */
	creditBatches?: CreditBatch[];
}

function CreditBalanceCardComponent({
	balance,
	loading,
	recentUsage = [],
	spendTrend,
}: CreditBalanceCardProps) {
	// All payment rails write this ledger. Legacy batches must not be added again.
	const totalDepositedCents = balance ? parseFloat(balance.totalDepositedCents) || 0 : 0;
	// Sparkline: 7-day spend totals, oldest → newest. Group by ISO date so a
	// sparse day still produces a zero point on the line.
	const sparkPoints = (() => {
		if (spendTrend) return spendTrend;
		if (recentUsage.length === 0) return [];
		const byDay = new Map<string, number>();
		for (let i = 6; i >= 0; i--) {
			const d = new Date();
			d.setDate(d.getDate() - i);
			byDay.set(d.toISOString().slice(0, 10), 0);
		}
		for (const u of recentUsage) {
			const day = new Date(u.createdAt).toISOString().slice(0, 10);
			// biome-ignore lint/style/noNonNullAssertion: value is guaranteed by preceding check
			if (byDay.has(day))
				// Billed amount (cost + markup); decimal-string cents, may be
				// sub-cent. `toDollars` returns 0 for null/undefined/garbage.
				byDay.set(
					day,
					byDay.get(day)! + usageBilledDollars(u),
				);
		}
		return Array.from(byDay.values());
	})();

	return (
		<DashboardCard
			tone="success"
			title="Credit balance"
			hint="Available credits"
			icon={
				<div className="flex h-10 w-10 items-center justify-center rounded-[var(--radius-lg)] border border-success/30 bg-[color-mix(in_srgb,var(--color-success)_10%,transparent)] text-success shadow-[0_0_15px_-5px_var(--color-success-glow)]">
					<span className="text-[16px] font-mono font-bold">$</span>
				</div>
			}
		>
			<div className="flex flex-1 flex-col">
				<div className="mb-4">
					<div className="text-[40px] font-display font-bold tracking-tight text-text-bright leading-none">
						{!balance && loading ? (
							<span
								className="inline-block h-12 w-36 animate-pulse rounded-[var(--radius-md)] bg-surface-elevated/60"
								aria-label="Loading credit balance"
								aria-busy="true"
							/>
						) : !balance ? (
							<span className="text-xl text-text-muted">Balance unavailable</span>
						) : (
							<div className="flex items-baseline gap-2">
								{/* balanceCents is integer-cent credits (1 credit = $0.01).
								  Do not dollar-prefix — that double-counts with the CR unit. */}
								<AnimatedNumber
									value={parseFloat(balance.balanceCents)}
									prefix=""
								/>
								<span className="text-[16px] font-mono font-bold uppercase tracking-wider text-text-muted">
									CR
								</span>
							</div>
						)}
					</div>
					{balance && <p className="mt-2 text-sm text-text-muted">{toDollars(balance.balanceCents).toLocaleString(undefined, { style: "currency", currency: "USD" })} USD · 1 credit = $0.01</p>}
				</div>

				<div className="mb-4 flex items-center gap-2.5 rounded-[var(--radius-sm)] border border-border/40 bg-surface/50 px-3 py-1.5 text-[11.5px] font-mono text-text-muted shadow-inner w-fit">
					<span
						className="inline-block h-2 w-2 rounded-full bg-text-muted/60"
						aria-hidden="true"
					/>
					{balance
						? `Credits added: ${Math.round(totalDepositedCents)} (${(totalDepositedCents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })})`
						: loading
							? "Loading credits…"
							: "Credit history unavailable"}
				</div>

				{/* 7-day spend sparkline — visual depth without competing with the
				  main AreaChart in the Usage tab. Hidden if no data yet. */}
				{sparkPoints.length > 0 && (
					<div className="mb-4 rounded-[var(--radius-md)] border border-border/50 bg-void/80 px-3 py-2 shadow-inner">
						<Sparkline
							values={sparkPoints}
							heightClass="h-10"
							tone="neutral"
							ariaLabel={spendTrend ? "Spend in selected range" : "7-day spend trend"}
						/>
						<div className="mt-2 flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-text-muted">
							<span>{spendTrend ? "Selected range" : "7d ago"}</span>
							<span>Now</span>
						</div>
					</div>
				)}

				<div className="mt-auto flex gap-3">
					<Link
						href="/deposit?method=card"
						aria-label="Top up credits"
						className="group flex flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-void px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease-out hover:border-accent/50 hover:bg-accent/5 hover:text-text-bright hover:shadow-[0_0_15px_-5px_var(--color-accent-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
					>
						Card
					</Link>
					<Link
						href="/deposit"
						aria-label="Deposit USDC"
						className="group flex flex-1 items-center justify-center rounded-[var(--radius-lg)] border border-border bg-surface px-4 py-3 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-[border-color,background-color,color,transform] duration-200 ease-out hover:bg-surface-elevated hover:text-text-bright hover:border-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-border active:scale-[0.97]"
					>
						USDC
					</Link>
				</div>
			</div>
		</DashboardCard>
	);
}

export const CreditBalanceCard = memo(
	CreditBalanceCardComponent,
	(prev, next) => {
		return (
			prev.balance === next.balance &&
			prev.loading === next.loading &&
			prev.recentUsage === next.recentUsage &&
			prev.spendTrend === next.spendTrend
		);
	},
);
