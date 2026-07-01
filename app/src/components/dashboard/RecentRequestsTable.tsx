"use client";

import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import type { UsageRecord } from "@/lib/api";
import { formatTime, toDollars } from "@/lib/utils";

interface RecentRequestsTableProps {
	usage: UsageRecord[];
	loading: boolean;
	page: number;
	limit: number;
	onPageChange: (page: number) => void;
}

export function RecentRequestsTable({
	usage,
	loading,
	page,
	limit,
	onPageChange,
}: RecentRequestsTableProps) {
	const totalPages = Math.ceil(usage.length / limit);

	return (
		<div className="p-6">
			<div className="mb-4 flex items-center justify-between">
				<h2 className="text-sm font-semibold text-text-bright">
					Recent requests
				</h2>
				{!loading && usage.length > 0 && (
					<span className="text-[11px] text-text-muted">
						{usage.length} total
					</span>
				)}
			</div>
			<div className="overflow-x-auto">
				<table className="w-full min-w-[600px] text-left">
					<thead>
						<tr className="border-b border-border">
							<th
								scope="col"
								className="py-3 text-[11px] font-medium text-text-muted"
							>
								Model
							</th>
							<th
								scope="col"
								className="py-3 text-[11px] font-medium text-text-muted"
							>
								Input
							</th>
							<th
								scope="col"
								className="py-3 text-[11px] font-medium text-text-muted"
							>
								Output
							</th>
							<th
								scope="col"
								className="py-3 text-[11px] font-medium text-text-muted"
							>
								Cost
							</th>
							<th
								scope="col"
								className="py-3 text-[11px] font-medium text-text-muted"
							>
								Time
							</th>
						</tr>
					</thead>
					<tbody>
						{loading && usage.length === 0 ? (
							<tr>
								<td colSpan={5} className="px-6 py-12 text-center">
									<span className="inline-block h-4 w-4 border border-border-bright border-t-accent rounded-full animate-spin" />
								</td>
							</tr>
						) : usage.length === 0 ? (
							<tr>
								<td
									colSpan={5}
									className="px-6 py-12 text-center text-sm text-text-muted"
								>
									No inference calls yet.{" "}
									<Link
										href="/chat"
										className="text-accent hover:underline"
									>
										Try the chat →
									</Link>
								</td>
							</tr>
						) : (
							usage.slice((page - 1) * limit, page * limit).map((row, i) => (
								<motion.tr
									key={row.id}
									className="border-b border-border bg-void transition-colors hover:bg-surface"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									transition={{ delay: i * 0.03 }}
								>
									<td className="px-6 py-4 text-sm font-medium text-accent">
										{row.model}
									</td>
									<td className="px-6 py-4 text-sm text-text-secondary font-mono">
										{row.promptTokens.toLocaleString()}
									</td>
									<td className="px-6 py-4 text-sm text-text-secondary font-mono">
										{row.completionTokens.toLocaleString()}
									</td>
									<td className="px-6 py-4 text-sm text-text-secondary font-mono">
										${toDollars(row.costCents).toFixed(4)}
									</td>
									<td className="px-6 py-4 text-sm text-text-muted">
										{formatTime(row.createdAt)}
									</td>
								</motion.tr>
							))
						)}
					</tbody>
				</table>
			</div>
			{!loading && usage.length > limit && (
				<div className="flex items-center justify-between px-6 py-4 border-t border-border">
					<span className="text-[11px] text-text-muted">
						Showing {(page - 1) * limit + 1}–
						{Math.min(page * limit, usage.length)} of {usage.length}
					</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onPageChange(Math.max(1, page - 1))}
							disabled={page === 1}
							aria-label="Go to previous page"
							className="flex items-center justify-center border border-border-bright bg-surface w-8 h-8 text-text-secondary transition-colors hover:border-text-muted hover:text-text disabled:opacity-50 disabled:pointer-events-none focus-ring"
						>
							<ChevronLeft className="h-4 w-4" />
						</button>
						<span className="text-xs text-text px-2" aria-current="page">
							Page {page} of {totalPages}
						</span>
						<button
							type="button"
							onClick={() => onPageChange(Math.min(totalPages, page + 1))}
							disabled={page >= totalPages}
							aria-label="Go to next page"
							className="flex items-center justify-center border border-border-bright bg-surface w-8 h-8 text-text-secondary transition-colors hover:border-text-muted hover:text-text disabled:opacity-50 disabled:pointer-events-none focus-ring"
						>
							<ChevronRight className="h-4 w-4" />
						</button>
					</div>
				</div>
			)}
		</div>
	);
}
