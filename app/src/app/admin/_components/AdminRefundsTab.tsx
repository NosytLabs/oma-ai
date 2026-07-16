"use client";

import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, RefreshCw, X } from "lucide-react";
import { api } from "@/lib/api";
import { formatCents, formatDateShort } from "@/lib/utils";

const STATUSES = ["pending", "granted", "denied"] as const;
type RefundStatus = (typeof STATUSES)[number];

export default function AdminRefundsTab() {
	const qc = useQueryClient();
	const [status, setStatus] = useState<RefundStatus>("pending");
	const [denyId, setDenyId] = useState<string | null>(null);
	const [denyNotes, setDenyNotes] = useState("");

	const query = useQuery({
		queryKey: ["adminRefunds", status],
		queryFn: () => api.admin.getRefunds(status, 50, 0),
		staleTime: 15_000,
	});

	const invalidate = (s: RefundStatus) =>
		qc.invalidateQueries({ queryKey: ["adminRefunds", s] });

	const grantMut = useMutation({
		mutationFn: (id: string) => api.admin.grantRefund(id),
		onSuccess: () => invalidate("pending"),
	});
	const denyMut = useMutation({
		mutationFn: ({ id, notes }: { id: string; notes: string }) =>
			api.admin.denyRefund(id, notes),
		onSuccess: () => {
			setDenyId(null);
			setDenyNotes("");
			invalidate("pending");
		},
	});

	const refunds = query.data?.refunds ?? [];

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between flex-wrap gap-3">
				<div className="flex items-center gap-1">
					{STATUSES.map((s) => (
						<button
							key={s}
							type="button"
							onClick={() => setStatus(s)}
							className={`px-3 py-2 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
								status === s
									? "text-accent bg-accent-dim/30 ring-1 ring-accent/30"
									: "text-text-muted hover:text-text-secondary hover:bg-surface"
							}`}
						>
							{s}
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => query.refetch()}
					className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono"
				>
					<RefreshCw className="w-3.5 h-3.5" /> Refresh
				</button>
			</div>

			<div className="rounded border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-border bg-surface">
								<Th>User</Th>
								<Th className="text-right">Amount</Th>
								<Th>Reason</Th>
								<Th>Status</Th>
								<Th>Decided</Th>
								<Th>Created</Th>
								<Th></Th>
							</tr>
						</thead>
						<tbody>
							{refunds.map((r) => (
								<tr key={r.id} className="border-b border-border/50 hover:bg-surface/50 align-top">
									<td className="px-4 py-3 font-mono text-text-secondary text-xs">
										{r.userId.slice(0, 10)}…
									</td>
									<td className="px-4 py-3 text-right font-mono text-accent text-xs">
										${formatCents(r.amountCents)}
									</td>
									<td className="px-4 py-3 text-text-muted text-xs max-w-[220px]">
										{r.reason ?? "—"}
									</td>
									<td className="px-4 py-3">
										<StatusBadge status={r.status} />
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{r.decidedAt
											? `${formatDateShort(r.decidedAt)}${
													r.decidedBy ? ` by ${r.decidedBy.slice(0, 8)}` : ""
												}`
											: "—"}
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{formatDateShort(r.createdAt)}
									</td>
									<td className="px-4 py-3">
										{r.status === "pending" && (
											<div className="flex items-center gap-1">
												<button
													type="button"
													disabled={grantMut.isPending}
													onClick={() => grantMut.mutate(r.id)}
													className="p-1.5 rounded hover:bg-panel text-text-muted hover:text-success transition-colors inline-flex"
													title="Grant"
												>
													<Check className="w-4 h-4" />
												</button>
												<button
													type="button"
													disabled={denyMut.isPending}
													onClick={() => {
														setDenyId(r.id);
														setDenyNotes("");
													}}
													className="p-1.5 rounded hover:bg-panel text-text-muted hover:text-error transition-colors inline-flex"
													title="Deny"
												>
													<X className="w-4 h-4" />
												</button>
											</div>
										)}
										{denyId === r.id && (
											<div className="mt-2 flex flex-col gap-2">
												<textarea
													value={denyNotes}
													onChange={(e) => setDenyNotes(e.target.value)}
													placeholder="Reason (min 8 chars, required for audit)"
													rows={2}
													className="w-64 px-2 py-1.5 rounded border border-border bg-surface text-text text-xs focus:outline-none focus:border-error/50"
												/>
												<div className="flex items-center gap-2">
													<button
														type="button"
														disabled={denyNotes.trim().length < 8 || denyMut.isPending}
														onClick={() => denyMut.mutate({ id: r.id, notes: denyNotes.trim() })}
														className="px-2 py-1 rounded border border-error/40 text-error text-xs font-mono disabled:opacity-40"
													>
														Confirm Deny
													</button>
													<button
														type="button"
														onClick={() => setDenyId(null)}
														className="px-2 py-1 rounded border border-border text-text-muted text-xs font-mono"
													>
														Cancel
													</button>
												</div>
											</div>
										)}
									</td>
								</tr>
							))}
							{refunds.length === 0 && !query.isLoading && (
								<tr>
									<td colSpan={7} className="px-4 py-8 text-center text-text-muted font-mono">
										No {status} refunds
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}

function StatusBadge({ status }: { status: string }) {
	const cls =
		status === "granted"
			? "text-success"
			: status === "denied"
				? "text-error"
				: "text-amber";
	return <span className={`text-xs font-mono uppercase ${cls}`}>{status}</span>;
}

function Th({ children, className }: { children?: ReactNode; className?: string }) {
	return (
		<th className={`px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider ${className ?? ""}`}>
			{children}
		</th>
	);
}
