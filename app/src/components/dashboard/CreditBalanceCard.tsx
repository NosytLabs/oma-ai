"use client";

import Link from "next/link";
import { memo } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import type { BalanceResponse, UsageRecord } from "@/lib/api";
import { toDollars } from "@/lib/utils";

interface CreditBalanceCardProps {
	balance: BalanceResponse | null;
	loading: boolean;
	/** Last 7 days of usage, oldest → newest. Drives the inline sparkline. */
	recentUsage?: UsageRecord[];
}

function CreditBalanceCardComponent({
	balance,
	loading,
	recentUsage = [],
}: CreditBalanceCardProps) {
	// Sparkline: 7-day spend totals, oldest → newest. Group by ISO date so a
	// sparse day still produces a zero point on the line.
	const sparkPoints = (() => {
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
					byDay.get(day)! + toDollars(u.totalCents ?? u.costCents),
				);
		}
		return Array.from(byDay.values());
	})();

	return (
		<div className="flex flex-col justify-between p-6 bg-void">
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h2 className="text-sm font-semibold text-text-bright">
						Credit balance
					</h2>
					<p className="mt-0.5 text-[11px] text-text-muted">Available credits</p>
				</div>
				<div className="flex h-8 w-8 items-center justify-center border border-success/20 bg-success/10 text-success">
					<span className="text-xs font-mono">$</span>
				</div>
			</div>

			<div className="mb-4">
				<div className="text-4xl font-light tracking-tight text-text mb-2">
					{!balance && loading ? (
						// Never flash a fake $0.00 while the balance query is in flight.
						<span
							className="inline-block h-10 w-36 animate-pulse rounded bg-surface-elevated/60"
							aria-label="Loading credit balance"
							aria-busy="true"
						/>
					) : !balance ? (
						// Settled with no payload (error / empty) — show zero, not a lie mid-load.
						<span className="text-text-muted">0 credits</span>
					) : (
						<div className="flex items-baseline gap-1">
							<AnimatedNumber
								value={Math.round(parseFloat(balance.balanceCents))}
							/>
							<span className="text-base text-text-muted font-normal">credits</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-2 text-[11px] text-text-muted">
					<span
						className="inline-block h-1.5 w-1.5 bg-text-muted"
						aria-hidden="true"
					/>
					{balance
						? `Total deposited: ${Math.round(parseFloat(balance.totalDepositedCents))} credits (${(parseFloat(balance.totalDepositedCents)/100).toLocaleString(undefined, {style: 'currency', currency: 'USD'})})`
						: loading
							? "Loading credits…"
							: "Total deposited: 0 credits"}
				</div>
			</div>

			{/* 7-day spend sparkline — visual depth without competing with the
          main AreaChart in the Usage tab. Hidden if no data yet. */}
			<div className="mb-6 -mx-2">
				<Sparkline
					values={sparkPoints}
					heightClass="h-10"
					ariaLabel="7-day spend trend"
				/>
				<div className="mt-1 flex items-center justify-between text-[10px] text-text-muted">
					<span>7d ago</span>
					<span>Today</span>
				</div>
			</div>

			<div className="flex gap-3 border-t border-border pt-4">
				<Link
					href="/deposit"
					aria-label="Top up credits"
					className="group flex flex-1 items-center justify-center border border-border-bright bg-surface px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent focus-ring active:bg-surface-elevated"
				>
					Top up credits
				</Link>
				<Link
					href="/deposit"
					aria-label="Deposit USDC"
					className="group flex flex-1 items-center justify-center border border-border-bright bg-void px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-text-muted hover:text-text focus-ring active:bg-surface"
				>
					Deposit USDC
				</Link>
			</div>
		</div>
	);
}

export const CreditBalanceCard = memo(
	CreditBalanceCardComponent,
	(prev, next) => {
		return (
			prev.balance === next.balance &&
			prev.loading === next.loading &&
			prev.recentUsage === next.recentUsage
		);
	},
);
