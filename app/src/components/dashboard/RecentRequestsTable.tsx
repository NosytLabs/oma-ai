"use client";

import { memo, useState } from "react";
import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { UsageRecord } from "@/lib/api";
import { formatTime, formatUsdPrecise } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";
import { resolveModelDisplayName, usageBilledDollars } from "@/lib/dashboard-aggregate";
import { RequestRefundModal } from "./RequestRefundModal";
import { useQueryClient } from "@tanstack/react-query";

interface RecentRequestsTableProps {
	usage: UsageRecord[];
	loading: boolean;
	page: number;
	limit: number;
	onPageChange: (page: number) => void;
	totalCount?: number;
	hasMore?: boolean;
	loadingMore?: boolean;
}

export const RecentRequestsTable = memo(function RecentRequestsTable({
	usage,
	loading,
	page,
	limit,
	onPageChange,
	totalCount = usage.length,
	hasMore = false,
	loadingMore = false,
}: RecentRequestsTableProps) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const [refundTarget, setRefundTarget] = useState<UsageRecord | null>(null);
	const totalPages = Math.ceil(totalCount / limit);
	const currentPage = Math.min(page, Math.max(1, Math.ceil(usage.length / limit)));

	return (
		<div className="flex flex-col h-full border border-border bg-surface/30 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] transition-colors duration-200 ease-out hover:border-accent/40">
			<div className="p-6 border-b border-border/50">
				<div className="flex items-center justify-between">
					<h2 className="font-sans text-[14.5px] font-bold text-text-bright tracking-tight">
						Recent requests
					</h2>
					{!loading && usage.length > 0 && (
						<span className="text-[11px] font-mono uppercase tracking-wider text-text-muted">
							{totalCount.toLocaleString()} in range
						</span>
					)}
				</div>
			</div>
			<div className="min-w-0 max-w-full flex-1 overflow-x-auto overscroll-x-contain">
				<table className="w-full min-w-[680px] text-left">
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
								Charge / outcome
							</th>
							<th
								scope="col"
								className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
							>
								Latency
							</th>
						<th
							scope="col"
							className="px-6 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider"
						>
							Source
						</th>
						<th
							scope="col"
							className="px-6 sm:px-7 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider"
						>
							Time
						</th>
						<th
							scope="col"
							className="px-4 py-4 text-[10.5px] font-bold text-text-muted uppercase tracking-wider text-right"
						>
							<span className="sr-only">Actions</span>
						</th>
						</tr>
					</thead>
					<tbody className="bg-void/30">
						{loading && usage.length === 0 ? (
						<tr>
							<td colSpan={8} className="px-6 py-12 text-center">
									<span className="inline-block h-5 w-5 border-2 border-border border-t-accent rounded-full animate-spin shadow-[0_0_8px_var(--color-accent)]" />
								</td>
							</tr>
						) : usage.length === 0 ? (
						<tr>
							<td
								colSpan={8}
								className="px-6 py-16 text-center transition-colors duration-200 ease-out hover:bg-surface/30"
								>
									<p className="text-[13px] text-text-secondary font-semibold">No requests in this range.</p>
									<p className="mt-1 text-xs text-text-muted">Try another date range, or send a request.</p>
									<Link
										href="/chat"
										className="inline-block mt-3 text-[11px] font-bold uppercase tracking-widest text-accent hover:text-accent-hover transition-colors duration-200 ease-out active:scale-[0.97]"
									>
										Try the chat <span aria-hidden="true">&rarr;</span>
									</Link>
								</td>
							</tr>
						) : (
							usage.slice((currentPage - 1) * limit, currentPage * limit).map((row, i) => (
								<m.tr
									key={row.id}
									className="group border-b border-border/40 transition-colors duration-200 ease-out hover:bg-surface/60 last:border-0"
									initial={{ opacity: 0, y: 5 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ delay: i * 0.03, ...springs.soft }}
								>
									<td className="px-6 sm:px-7 py-4 text-[13px] font-bold text-accent font-mono transition-colors duration-200 ease-out group-hover:text-accent-hover">
										<details className="min-w-[10rem] max-w-[18rem]">
											<summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">{resolveModelDisplayName(row.model)}</summary>
											<div className="mt-3 space-y-2 text-xs font-normal text-text-secondary">
												<p>Request ID <code className="block break-all select-all text-text-bright">{row.requestId}</code></p>
												<button type="button" className="min-h-9 rounded border border-border px-2 text-accent" onClick={() => {
													void navigator.clipboard.writeText(row.requestId).then(() => toast.success("Request ID copied"), () => toast.error("Could not copy. Select the request ID to copy it."));
												}}>Copy request ID</button>
												{row.requestedModel && row.requestedModel !== row.model && <p>Requested: <span className="break-all">{row.requestedModel}</span></p>}
												<p>Served: <span className="break-all">{row.model}</span></p>
												<p>Provider: {row.provider || "Unknown"}</p>
												<p><time dateTime={row.createdAt}>{new Date(row.createdAt).toLocaleString()}</time></p>
											</div>
										</details>
									</td>
									<td className="px-6 py-4 text-[13px] text-text-secondary text-right font-mono transition-colors duration-200 ease-out group-hover:text-text-bright">
										{(row.promptTokens ?? 0).toLocaleString()}
									</td>
									<td className="px-6 py-4 text-[13px] text-text-secondary text-right font-mono transition-colors duration-200 ease-out group-hover:text-text-bright">
										{(row.completionTokens ?? 0).toLocaleString()}
									</td>
									<td className="px-6 py-4 text-[13px] font-bold text-text-bright text-right font-mono">
										{/* Billed amount (cost + markup); decimal-string cents, may be sub-cent.
										 Guard against NaN so a malformed cost row never renders "$NaN". */}
										{(() => {
											const dollars = usageBilledDollars(row);
											return Number.isFinite(dollars)
												? formatUsdPrecise(dollars)
												: "—";
										})()}
										<span className="mt-1 block text-[10px] font-normal text-text-muted">{row.refundedAt ? "Refunded" : row.status === "free_tier" ? "Free chat" : row.status === "aborted" ? "Canceled" : row.status === "error" ? "Error" : "Completed"}</span>
									</td>
									<td className="px-6 py-4 text-[12.5px] text-text-secondary text-right font-mono transition-colors duration-200 ease-out group-hover:text-text-bright">
										{typeof row.latencyMs === "number" &&
										Number.isFinite(row.latencyMs)
											? row.latencyMs >= 1000 ? `${(row.latencyMs / 1000).toFixed(1)}s` : `${Math.round(row.latencyMs)}ms`
											: "—"}
									</td>
								<td className="px-6 py-4 text-[11.5px] font-mono text-text-muted/80 transition-colors duration-200 ease-out group-hover:text-text-secondary">
									{row.apiKeyId ? (
										<span
											title={`API key ${row.apiKeyId}`}
											className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent"
										>
											Key
										</span>
									) : (
										<span className="inline-flex items-center rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-text-muted">
											Web
										</span>
									)}
								</td>
								<td className="px-6 sm:px-7 py-4 text-[11.5px] font-mono text-text-muted/80 transition-colors duration-200 ease-out group-hover:text-text-secondary">
									<time dateTime={row.createdAt} title={new Date(row.createdAt).toLocaleString()}>{formatTime(row.createdAt)}</time>
								</td>
								<td className="px-4 py-4 text-right">
									{!row.refundedAt && row.status === "completed" ? (
										<button
											type="button"
											aria-label={`Request a refund for this ${row.model} request`}
											onClick={() => setRefundTarget(row)}
											className="inline-flex items-center gap-1 rounded-[var(--radius-md)] border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold text-text-secondary transition-colors duration-150 ease-out hover:border-accent/40 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97]"
											>
												<RotateCcw className="h-3 w-3" aria-hidden="true" />
											Refund
										</button>
									) : null}
								</td>
								</m.tr>
							))
						)}
					</tbody>
				</table>
			</div>
			{!loading && (usage.length > limit || hasMore) && (
				<div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-7 py-4 border-t border-border/50 bg-surface/20">
					<span className="text-[11px] font-mono text-text-muted uppercase tracking-wider">
						Showing {(currentPage - 1) * limit + 1}–
						{Math.min(currentPage * limit, usage.length)} of {totalCount.toLocaleString()}
					</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onPageChange(Math.max(1, currentPage - 1))}
							disabled={currentPage === 1 || loadingMore}
							aria-label="Go to previous page"
							className="flex items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface w-8 h-8 text-text-secondary transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-accent/40 hover:text-text-bright hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<span className="text-[11px] font-mono text-text-secondary px-2 uppercase tracking-wider" aria-current="page">
							Page <span className="font-bold text-text-bright">{currentPage}</span> of {totalPages}
						</span>
						<button
							type="button"
							onClick={() => onPageChange(currentPage + 1)}
							disabled={loadingMore || (currentPage * limit >= usage.length && !hasMore)}
							aria-label="Go to next page"
							className="flex items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface w-8 h-8 text-text-secondary transition-[color,background-color,border-color,transform] duration-200 ease-out hover:border-accent/40 hover:text-text-bright hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
			<RequestRefundModal
				record={refundTarget}
				onDismiss={() => setRefundTarget(null)}
				onSubmitted={() => {
					void queryClient.invalidateQueries({ queryKey: ["usage"] });
					void queryClient.invalidateQueries({ queryKey: ["balance"] });
				}}
			/>
		</div>
	);
});
