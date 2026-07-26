"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Play, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateTime } from "@/lib/utils";

export default function AdminDlqTab() {
	const qc = useQueryClient();
	const [page, setPage] = useState(1);
	const [confirmDiscardId, setConfirmDiscardId] = useState<string | null>(null);
	const [confirmProcess, setConfirmProcess] = useState(false);

	const query = useQuery({
		queryKey: ["adminDlq", page],
		queryFn: () => api.admin.getDlq(page, 50),
		staleTime: 15_000,
	});

	const invalidate = () => qc.invalidateQueries({ queryKey: ["adminDlq", page] });

	const retryMut = useMutation({
		mutationFn: (id: string) => api.admin.retryDlq(id),
		onSuccess: invalidate,
	});
	const discardMut = useMutation({
		mutationFn: (id: string) => api.admin.discardDlq(id),
		onSuccess: () => {
			setConfirmDiscardId(null);
			invalidate();
		},
	});
	const processMut = useMutation({
		mutationFn: () => api.admin.processDlq(),
		onSuccess: () => {
			setConfirmProcess(false);
			invalidate();
		},
	});

	const entries = query.data?.entries ?? [];
	const summary = query.data?.summary;
	const pagination = query.data?.pagination;

	const mutationError = retryMut.error ?? discardMut.error ?? processMut.error;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div className="flex items-center gap-4 text-xs font-mono text-text-muted">
					{summary && (
						<>
							<span>
								Total: <span className="text-text-secondary">{summary.total}</span>
							</span>
							<span>
								Retryable: <span className="text-amber">{summary.retryable}</span>
							</span>
							<span>
								Permanent: <span className="text-error">{summary.permanentlyFailed}</span>
							</span>
						</>
					)}
				</div>
				<div className="flex items-center gap-2">
					{confirmProcess ? (
						<>
							<button
								type="button"
								disabled={processMut.isPending}
								onClick={() => processMut.mutate()}
								className="flex items-center gap-2 px-3 py-2 rounded border border-amber/40 bg-amber/10 text-amber text-sm font-mono disabled:opacity-40"
							>
								<Play className="w-3.5 h-3.5" />
								{processMut.isPending ? "Processing…" : "Confirm Process All?"}
							</button>
							<button
								type="button"
								disabled={processMut.isPending}
								onClick={() => setConfirmProcess(false)}
								className="px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono disabled:opacity-40"
							>
								Cancel
							</button>
						</>
					) : (
						<button
							type="button"
							disabled={processMut.isPending}
							onClick={() => setConfirmProcess(true)}
							className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text text-sm font-mono disabled:opacity-40"
						>
							<Play className="w-3.5 h-3.5" /> Process All
						</button>
					)}
					<button
						type="button"
						onClick={() => query.refetch()}
						className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono"
					>
						<RefreshCw className="w-3.5 h-3.5" /> Refresh
					</button>
				</div>
			</div>

			{mutationError && (
				<div className="flex items-center gap-3 p-4 rounded border border-error/30 bg-error/10 text-error">
					<AlertTriangle className="w-4 h-4 flex-shrink-0" />
					<span className="text-sm font-mono">
						{mutationError instanceof Error
							? mutationError.message
							: "Request failed"}
					</span>
				</div>
			)}

			{processMut.data && (
				<div className="rounded border border-border bg-panel px-4 py-2 text-sm font-mono text-text-muted">
					Processed {processMut.data.processed} settlement(s).
				</div>
			)}

			<div className="rounded border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-border bg-surface">
								<Th>Order</Th>
								<Th>Amount</Th>
								<Th>Chain</Th>
								<Th className="text-center">Attempts</Th>
								<Th>Status</Th>
								<Th>Error</Th>
								<Th>Created</Th>
								<Th></Th>
							</tr>
						</thead>
						<tbody>
							{entries.map((e) => (
								<tr key={e.orderId} className="border-b border-border/50 hover:bg-surface/50">
									<td className="px-4 py-3 font-mono text-text-secondary text-xs">
										{e.orderId.slice(0, 10)}…
									</td>
									<td className="px-4 py-3 font-mono text-accent text-xs">{e.amount}</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">{e.chain}</td>
									<td className="px-4 py-3 text-center font-mono text-text-muted text-xs">
										{e.attempts}
									</td>
									<td className="px-4 py-3">
										{e.status === "permanently_failed" ? (
											<span className="inline-flex items-center gap-1 text-error text-xs font-mono">
												<AlertTriangle className="w-3.5 h-3.5" /> Permanent
											</span>
										) : (
											<span className="text-amber text-xs font-mono">Retryable</span>
										)}
									</td>
									<td
										className="px-4 py-3 font-mono text-text-muted text-xs max-w-[260px] truncate"
										title={e.lastError}
									>
										{e.lastError}
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{formatDateTime(e.createdAt)}
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-1">
											<button
												type="button"
												disabled={retryMut.isPending}
												onClick={() => retryMut.mutate(e.orderId)}
												className="p-1.5 rounded hover:bg-panel text-text-muted hover:text-accent transition-colors inline-flex"
												title="Retry"
											>
												<RotateCcw className="w-4 h-4" />
											</button>
											{confirmDiscardId === e.orderId ? (
												<>
													<button
														type="button"
														disabled={discardMut.isPending}
														onClick={() => discardMut.mutate(e.orderId)}
														className="px-2 py-1 rounded border border-error/40 text-error text-xs font-mono disabled:opacity-40"
													>
														{discardMut.isPending
															? "Discarding…"
															: "Confirm Discard"}
													</button>
													<button
														type="button"
														disabled={discardMut.isPending}
														onClick={() => setConfirmDiscardId(null)}
														className="px-2 py-1 rounded border border-border text-text-muted text-xs font-mono"
													>
														Cancel
													</button>
												</>
											) : (
												<button
													type="button"
													disabled={discardMut.isPending}
													onClick={() => setConfirmDiscardId(e.orderId)}
													className="p-1.5 rounded hover:bg-panel text-text-muted hover:text-error transition-colors inline-flex"
													title="Discard"
												>
													<Trash2 className="w-4 h-4" />
												</button>
											)}
										</div>
									</td>
								</tr>
							))}
							{entries.length === 0 && !query.isLoading && (
								<tr>
									<td colSpan={8} className="px-4 py-8 text-center text-text-muted font-mono">
										DLQ is empty
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			{pagination && (
				<div className="flex items-center justify-between">
					<button
						type="button"
						onClick={() => setPage((p) => Math.max(1, p - 1))}
						disabled={page <= 1}
						className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text disabled:opacity-30 text-sm font-mono"
					>
						Previous
					</button>
					<span className="text-xs text-text-muted font-mono">
						Page {pagination.page} of {pagination.pages}
					</span>
					<button
						type="button"
						onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
						disabled={page >= pagination.pages}
						className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text disabled:opacity-30 text-sm font-mono"
					>
						Next
					</button>
				</div>
			)}
		</div>
	);
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
	return (
		<th className={`px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider ${className ?? ""}`}>
			{children}
		</th>
	);
}
