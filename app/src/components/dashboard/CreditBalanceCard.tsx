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
		<div className="flex flex-col justify-between p-6 bg-surface border border-border/60 rounded-[12px] shadow-sm h-full relative overflow-hidden">
			{/* Accent glow on top edge */}
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-success/40 to-transparent" />
			
			<div className="mb-6 flex items-start justify-between">
				<div>
					<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
						Credit balance
					</h2>
					<p className="mt-1 text-[11px] font-mono uppercase tracking-wider text-text-muted">Available credits</p>
				</div>
				<div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-success/20 bg-success/10 text-success shadow-sm">
					<span className="text-[14px] font-mono font-bold">$</span>
				</div>
			</div>

			<div className="mb-4">
				<div className="text-[36px] font-display font-bold tracking-tight text-text-bright mb-2 leading-none">
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
							<span className="text-[14px] text-text-muted font-mono uppercase tracking-wider font-semibold">CR</span>
						</div>
					)}
				</div>
				<div className="flex items-center gap-2 text-[11px] font-mono text-text-muted/80">
					<span
						className="inline-block h-1.5 w-1.5 rounded-full bg-text-muted/50"
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
			<div className="mb-6 -mx-3 px-3 py-1 bg-void/50 rounded-md border border-border/40">
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

			<div className="flex gap-3 border-t border-border/60 pt-5 mt-auto">
				<Link
					href="/deposit"
					aria-label="Top up credits"
					className="group flex flex-1 items-center justify-center rounded-[6px] border border-border bg-void px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-all hover:border-accent hover:text-accent hover:shadow-[0_0_15px_-5px_var(--color-accent-glow)] focus-ring active:scale-[0.98]"
				>
					Top up credits
				</Link>
				<Link
					href="/deposit"
					aria-label="Deposit USDC"
					className="group flex flex-1 items-center justify-center rounded-[6px] border border-border bg-surface px-4 py-2.5 text-[11.5px] font-bold uppercase tracking-wider text-text-secondary transition-all hover:border-text-muted hover:text-text hover:bg-surface-elevated focus-ring active:scale-[0.98]"
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
