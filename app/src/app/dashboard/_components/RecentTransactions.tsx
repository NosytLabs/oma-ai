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
		<div className="mb-6 border border-border bg-void p-4">
			<div className="flex items-center justify-between">
				<h2 className="text-sm font-semibold text-text-bright">
					Recent activity
				</h2>
				{transactions.length > 0 && (
					<Link
						href="/dashboard/credits"
						className="text-[11px] text-accent hover:underline"
					>
						View all →
					</Link>
				)}
			</div>
			{transactions.length === 0 ? (
				<div className="mt-3 flex flex-col items-center gap-2 py-6 text-center">
					<div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface text-text-muted">
						<ArrowLeftRight className="h-4 w-4" />
					</div>
					<p className="text-sm text-text-secondary">No transactions yet</p>
					<p className="text-[11px] text-text-muted">
						Deposits, usage, and refunds will appear here.{" "}
						<Link
							href="/deposit"
							className="text-accent underline underline-offset-2 hover:no-underline"
						>
							Make your first deposit →
						</Link>
					</p>
				</div>
			) : (
				<div className="mt-3 space-y-1">
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
								className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
							>
								<div className="flex items-center gap-2.5">
									<div
										className={`flex h-6 w-6 items-center justify-center rounded border border-border bg-surface ${iconClass}`}
									>
										<Icon className="h-3 w-3" />
									</div>
									<div>
										<span className="text-sm font-medium text-text">
											{label}
										</span>
										{tx.model && (
											<span className="ml-1.5 text-[10px] text-text-muted">
												{tx.model}
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center gap-3">
									<span className={`text-sm font-mono ${amountClass}`}>
										{sign}${toDollars(Math.abs(tx.amountCents)).toFixed(2)}
									</span>
									<div className="flex items-center gap-1 text-[10px] text-text-muted">
										<Clock className="h-2.5 w-2.5" />
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
