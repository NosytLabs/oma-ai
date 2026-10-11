"use client";

import { useMemo } from "react";
import {
	ArrowDownLeft,
	ArrowLeftRight,
	ArrowUpRight,
	Clock,
	RotateCcw,
} from "lucide-react";
import Link from "next/link";
import type { CreditTransaction } from "@/lib/api";
import { resolveModelDisplayName } from "@/lib/dashboard-aggregate";
import { formatTime, formatUsdPrecise, toDollars } from "@/lib/utils";

interface RecentTransactionsProps {
	transactions: CreditTransaction[];
	isDemo?: boolean;
}

const TX_ICONS: Record<string, typeof ArrowDownLeft> = {
	deposit: ArrowDownLeft,
	usage: ArrowUpRight,
	refund: RotateCcw,
};

const TX_ICON_STYLES: Record<string, { text: string; hoverBorder: string }> = {
	deposit: { text: "text-success", hoverBorder: "group-hover:border-success/30" },
	usage: { text: "text-warning", hoverBorder: "group-hover:border-warning/30" },
	refund: { text: "text-accent", hoverBorder: "group-hover:border-accent/30" },
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
export function RecentTransactions({ transactions, isDemo = false }: RecentTransactionsProps) {
	// Preserve descending order for API and demo records alike.
	const sorted = useMemo(
		() =>
			[...transactions].sort(
				(a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
			),
		[transactions],
	);
	return (
		<div className="mb-8 bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] p-6 relative overflow-hidden transition-colors duration-200 ease-out hover:border-accent/40">
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning/40 via-warning/20 to-transparent" />
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
					Recent activity
				</h2>
				{transactions.length > 0 && (
					<Link
						href={isDemo ? "/dashboard?tab=usage&demo=1" : "/dashboard?tab=usage"}
						className="text-[11px] font-mono font-bold uppercase tracking-widest text-accent hover:text-accent-hover transition-colors duration-200 ease-out active:scale-[0.97]"
					>
						Usage details <span aria-hidden="true">&rarr;</span>
					</Link>
				)}
			</div>
			{transactions.length === 0 ? (
				<div className="mt-6 flex flex-col items-center gap-3 py-10 text-center bg-void rounded-[var(--radius-md)] border border-border/50 shadow-inner">
					<div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-text-muted shadow-sm">
						<ArrowLeftRight className="h-5 w-5" />
					</div>
					<p className="text-[13.5px] font-semibold tracking-wide text-text-bright mt-2">No transactions yet</p>
					<p className="text-[11px] text-text-muted max-w-[280px] leading-relaxed">
						Deposits, usage, and refunds will appear here.{" "}
						<Link
							href="/deposit"
							className="text-accent hover:text-accent-hover hover:underline transition-colors duration-200 ease-out block mt-2 font-medium"
						>
							Make your first deposit
						</Link>
					</p>
				</div>
			) : (
				<div className="mt-5 border border-border/50 rounded-[var(--radius-md)] overflow-hidden bg-void shadow-sm">
					{sorted.slice(0, 5).map((tx) => {
					const Icon = TX_ICONS[tx.type] ?? ArrowDownLeft;
					const iconStyle =
						TX_ICON_STYLES[tx.type] ?? { text: "text-text-muted", hoverBorder: "" };
					const label = (TX_LABELS[tx.type] ?? tx.type) + (tx.type === "deposit" && tx.status !== "completed" ? ` · ${tx.status}` : "");
						// Sign comes from the actual amount, not the type — a refund shows
						// as +$X (money back in), a negative usage as -$X.
						const posted = tx.type !== "deposit" || tx.status === "completed";
						const isCredit = tx.amountCents > 0 && posted;
						const sign = !posted || tx.amountCents === 0 ? "" : isCredit ? "+" : "−";
						const amountClass = isCredit
							? "text-success"
							: "text-text-secondary";
						return (
							<div
								key={tx.id}
								className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border-b border-border/40 last:border-0 hover:bg-surface/50 transition-colors duration-200 ease-out"
							>
								<div className="flex items-center gap-4 mb-2 sm:mb-0">
								<div
									className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface shadow-sm transition-colors duration-200 ease-out ${iconStyle.hoverBorder} ${iconStyle.text}`}
								>
										<Icon className="h-4 w-4" />
									</div>
									<div className="min-w-0">
										<span className="text-[13px] font-semibold text-text-bright block truncate">
											{label}
										</span>
										{tx.model && (
											<span className="text-[10.5px] font-mono text-text-muted inline-block mt-0.5 px-1.5 py-px bg-surface/50 border border-border/50 rounded-[var(--radius-sm)]">
												{resolveModelDisplayName(tx.model)}
											</span>
										)}
									</div>
								</div>
								<div className="flex items-center justify-between sm:justify-end sm:gap-6 pl-14 sm:pl-0 w-full sm:w-auto">
									<div className="flex items-center gap-1.5 text-[10.5px] font-mono text-text-muted/80 opacity-80 group-hover:opacity-100 transition-opacity duration-200 ease-out">
										<Clock className="h-3 w-3" />
										{formatTime(tx.createdAt)}
									</div>
									<span className={`text-[14px] font-mono tracking-tight font-bold ${amountClass}`}>
										{sign}{formatUsdPrecise(toDollars(Math.abs(tx.amountCents)))}
									</span>
								</div>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
