"use client";

import Link from "next/link";
import { memo } from "react";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { Sparkline } from "@/components/ui/Sparkline";
import type { BalanceResponse, UsageRecord } from "@/lib/api";
import { formatCents, toDollars } from "@/lib/utils";

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
				byDay.set(day, byDay.get(day)! + toDollars(u.costCents));
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
					<p className="mt-0.5 text-[11px] text-text-muted">Available funds</p>
				</div>
				<div className="flex h-8 w-8 items-center justify-center border border-success/20 bg-success/10 text-success">
					<span className="text-xs font-mono">$</span>
				</div>
			</div>

			<div className="mb-4">
				<div className="text-4xl font-light tracking-tight text-text mb-2">
					{loading && !balance ? (
						<span className="text-text-muted">$0.00</span>
					) : (
						<AnimatedNumber
							value={parseFloat(formatCents(balance?.balanceCents ?? "0"))}
						/>
					)}
				</div>
				<div className="flex items-center gap-2 text-[11px] text-text-muted">
					<span
						className="inline-block h-1.5 w-1.5 bg-text-muted"
						aria-hidden="true"
					/>
					{balance
						? `Total deposited: $${formatCents(balance.totalDepositedCents)}`
						: "Total deposited: $0.00"}
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
					href="/dashboard/credits"
					aria-label="Purchase credits"
					className="group flex flex-1 items-center justify-center border border-border-bright bg-surface px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-accent hover:text-accent focus-ring active:bg-surface-elevated"
				>
					Buy credits
				</Link>
				<Link
					href="/deposit"
					aria-label="Deposit funds"
					className="group flex flex-1 items-center justify-center border border-border-bright bg-void px-4 py-2 text-xs font-medium text-text-secondary transition-colors hover:border-text-muted hover:text-text focus-ring active:bg-surface"
				>
					Deposit
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
