"use client";

import { memo } from "react";
import { m } from "@/lib/framer-motion-client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { UsageRecord } from "@/lib/api";
import { formatTime, formatUsdPrecise, toDollars } from "@/lib/utils";

interface RecentRequestsTableProps {
	usage: UsageRecord[];
	loading: boolean;
	page: number;
	limit: number;
	onPageChange: (page: number) => void;
}

export const RecentRequestsTable = memo(function RecentRequestsTable({
	usage,
	loading,
	page,
	limit,
	onPageChange,
}: RecentRequestsTableProps) {
	const totalPages = Math.ceil(usage.length / limit);

	return (
		<div className="flex flex-col h-full bg-void/50 border border-border bg-surface/30 rounded-[var(--radius-lg)] shadow-[0_4px_24px_-10px_rgba(0,0,0,0.3)] transition-colors hover:border-accent/40">
			<div className="p-6 sm:p-7 border-b border-border/50">
				<div className="flex items-center justify-between">
					<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight">
						Recent requests
					</h2>
					{!loading && usage.length > 0 && (
						<span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
							{usage.length} total
						</span>
					)}
				</div>
			</div>
			<div className="overflow-x-auto flex-1">
				<table className="w-full min-w-[600px] text-left">
					<thead>
						<tr className="border-b border-border/50 bg-surface/20">
							<th
								scope="col"
								className="px-6 sm:px-7 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider"
							>
								Model
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Input
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Output
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Cost
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Latency
							</th>
							<th
								scope="col"
								className="px-6 sm:px-7 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider"
							>
								Time
							</th>
						</tr>
					</thead>
					<tbody className="bg-void/30">
						{loading && usage.length === 0 ? (
							<tr>
								<td colSpan={6} className="px-6 py-12 text-center">
									<span className="inline-block h-5 w-5 border-2 border-border border-t-accent rounded-full animate-spin shadow-[0_0_8px_var(--color-accent)]" />
								</td>
							</tr>
						) : usage.length === 0 ? (
							<tr>
								<td
									colSpan={6}
									className="px-6 py-16 text-center transition-colors hover:bg-surface/30"
								>
									<p className="text-[13px] text-text-secondary font-semibold">No inference calls yet.</p>
									<Link
										href="/chat"
										className="inline-block mt-3 text-[11px] font-bold uppercase tracking-widest text-accent hover:text-accent-hover transition-colors active:scale-[0.97]"
									>
										Try the chat <span aria-hidden="true">&rarr;</span>
									</Link>
								</td>
							</tr>
						) : (
							usage.slice((page - 1) * limit, page * limit).map((row, i) => (
								<m.tr
									key={row.id}
									className="group border-b border-border/40 transition-colors hover:bg-surface/60 last:border-0"
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: i * 0.03, ease: [0.23, 1, 0.32, 1] }}
								>
									<td className="px-6 sm:px-7 py-4 text-[13px] font-bold text-accent font-mono transition-colors group-hover:text-accent-hover">
										{row.model}
									</td>
									<td className="px-6 py-4 text-[13px] text-text-secondary text-right font-mono transition-colors group-hover:text-text-bright">
										{(row.promptTokens ?? 0).toLocaleString()}
									</td>
									<td className="px-6 py-4 text-[13px] text-text-secondary text-right font-mono transition-colors group-hover:text-text-bright">
										{(row.completionTokens ?? 0).toLocaleString()}
									</td>
									<td className="px-6 py-4 text-[13px] font-bold text-text-bright text-right font-mono">
										{/* Billed amount (cost + markup); decimal-string cents, may be sub-cent.
										    Guard against NaN so a malformed cost row never renders "$NaN". */}
										{(() => {
											const dollars = toDollars(row.totalCents ?? row.costCents);
											return Number.isFinite(dollars)
												? formatUsdPrecise(dollars)
												: "—";
										})()}
									</td>
									<td className="px-6 py-4 text-[12.5px] text-text-secondary text-right font-mono transition-colors group-hover:text-text-bright">
										{typeof row.latencyMs === "number" &&
										Number.isFinite(row.latencyMs)
											? `${Math.round(row.latencyMs)}ms`
											: "—"}
									</td>
									<td className="px-6 sm:px-7 py-4 text-[11.5px] font-mono text-text-muted/80 transition-colors group-hover:text-text-secondary">
										{formatTime(row.createdAt)}
									</td>
								</m.tr>
							))
						)}
					</tbody>
				</table>
			</div>
			{!loading && usage.length > limit && (
				<div className="flex items-center justify-between px-6 sm:px-7 py-4 border-t border-border/50 bg-surface/20">
					<span className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
						Showing {(page - 1) * limit + 1}–
						{Math.min(page * limit, usage.length)} of {usage.length}
					</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onPageChange(Math.max(1, page - 1))}
							disabled={page === 1}
							aria-label="Go to previous page"
							className="flex items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface w-8 h-8 text-text-secondary transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-accent/40 hover:text-text-bright hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<span className="text-[11px] font-mono text-text-secondary px-2 uppercase tracking-wider" aria-current="page">
							Page <span className="font-bold text-text-bright">{page}</span> of {totalPages}
						</span>
						<button
							type="button"
							onClick={() => onPageChange(Math.min(totalPages, page + 1))}
							disabled={page >= totalPages}
							aria-label="Go to next page"
							className="flex items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface w-8 h-8 text-text-secondary transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-accent/40 hover:text-text-bright hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
});