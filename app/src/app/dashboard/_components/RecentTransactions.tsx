"use client";

import {
	ArrowDownLeft,
	ArrowLeftRight,
	ArrowUpRight,
	Clock,
	RotateCcw,
} from "lucide-react";
import Link from "next/link";
import type { CreditTransaction } from "@/lib/api";
import { formatTime, toDollars } from "@/lib/utils";

interface RecentTransactionsProps {
	transactions: CreditTransaction[];
}

const TX_ICONS: Record<string, typeof ArrowDownLeft> = {
	deposit: ArrowDownLeft,
	usage: ArrowUpRight,
	refund: RotateCcw,
};

const TX_ICONS_BY_TYPE_COLOR: Record<string, string> = {
	deposit: "text-success",
	usage: "text-warning",
	refund: "text-accent",
};

const TX_LABELS: Record<string, string> = {
	deposit: "Deposit",
	usage: "Usage",
	refund: "Refund",
};

/**
 * Compact "last 5 credit transactions" panel.
 * Always renders — when the list is empty, shows a call-to-action instead of
 * collapsing the row (which would leave a noticeable gap on the Overview tab).
 */
export function RecentTransactions({ transactions }: RecentTransactionsProps) {
	return (
		<div className="mb-8 border border-border/60 bg-surface rounded-[12px] p-6 shadow-sm relative overflow-hidden">
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning/30 to-transparent" />
			<div className="flex items-center justify-between mb-2">
				<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
					Recent activity
				</h2>
				{transactions.length > 0 && (
					<Link
						href="/dashboard?tab=usage"
						className="text-[11px] font-mono font-bold uppercase tracking-widest text-accent hover:text-accent-bright hover:underline"
					>
						View all →
					</Link>
				)}
			</div>
			{transactions.length === 0 ? (
				<div className="mt-4 flex flex-col items-center gap-3 py-8 text-center bg-void rounded-md border border-border/50">
					<div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-border bg-surface text-text-muted">
						<ArrowLeftRight className="h-4 w-4" />
					</div>
					<p className="text-[13.5px] font-semibold tracking-wide text-text-secondary">No transactions yet</p>
					<p className="text-[11px] text-text-muted max-w-[280px] leading-relaxed">
						Deposits, usage, and refunds will appear here.{" "}
						<Link
							href="/deposit"
							className="text-accent hover:text-accent-bright transition-colors"
						>
							Make your first deposit →
						</Link>
					</p>
				</div>
			) : (
				<div className="mt-4 space-y-1">
					{transactions.slice(0, 5).map((tx) => {
						const Icon = TX_ICONS[tx.type] ?? ArrowDownLeft;
						const iconClass =
							TX_ICONS_BY_TYPE_COLOR[tx.type] ?? "text-text-muted";
						const label = TX_LABELS[tx.type] ?? tx.type;
						// Sign comes from the actual amount, not the type — a refund shows
						// as +$X (money back in), a negative usage as -$X.
						const isCredit = tx.amountCents > 0;
						const sign = isCredit ? "+" : "-";
						const amountClass = isCredit
							? "text-success"
							: "text-text-secondary";
						return (
							<div
								key={tx.id}
								className="flex items-center justify-between py-3 border-b border-border/60 last:border-0 hover:bg-void/40 px-2 -mx-2 rounded-md transition-colors"
							>
								<div className="flex items-center gap-3.5">
									<div
										className={`flex h-8 w-8 items-center justify-center rounded-[6px] border border-border bg-void shadow-sm ${iconClass}`}
									>
										<Icon className="h-3.5 w-3.5" />
									</div>
									<div>
										<span className="text-[13px] font-bold text-text-bright">
											{label}
										</span>
										{tx.model && (
											<span className="ml-2 text-[10.5px] font-mono text-text-muted">
												{tx.model}
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center gap-4">
									<span className={`text-[13.5px] font-mono tracking-tight font-bold ${amountClass}`}>
										{sign}${toDollars(Math.abs(tx.amountCents)).toFixed(2)}
									</span>
									<div className="flex items-center gap-1.5 text-[10px] font-mono text-text-muted/70 w-12 justify-end">
										<Clock className="h-3 w-3" />
										{formatTime(tx.createdAt)}
									</div>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
