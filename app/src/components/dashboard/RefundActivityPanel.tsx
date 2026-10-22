"use client";

/**
 * Refund activity panel.
 *
 * Lists the signed-in user's refund requests with their current status
 * (pending / granted / denied) and links each to the originating usage
 * record. Cached via React Query so submitting a new refund through
 * RequestRefundModal + onSubmitted query-invalidation lands the new
 * row without a manual refresh.
 *
 * Source of truth for the data is the dashboard hooks:
 * - GET /v1/refunds -> api.refunds.list (see app/src/lib/api/refunds.ts)
 *
 * Falls back to the API wrapper's "everything is fine" empty-state when
 * there are no refund requests — that means the user has never asked
 * for a refund, which is the common case and should NOT look broken.
 */

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { CheckCircle2, Clock, FileQuestion, Loader2, RotateCcw, XCircle } from "lucide-react";
import Link from "next/link";
import { api, type RefundRecord, type RefundStatus } from "@/lib/api";

const STATUS_TONE: Record<
	RefundStatus,
	{ label: string; classes: string; icon: typeof Clock }
> = {
	pending: {
		label: "Pending",
		classes: "border-warning/30 bg-warning/10 text-warning",
		icon: Clock,
	},
	granted: {
		label: "Granted",
		classes: "border-success/30 bg-success/10 text-success",
		icon: CheckCircle2,
	},
	denied: {
		label: "Denied",
		classes: "border-error/30 bg-error/10 text-error",
		icon: XCircle,
	},
};

function formatRelative(iso: string): string {
	const now = Date.now();
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return "—";
	const diffMs = now - t;
	const minutes = Math.round(diffMs / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(t).toLocaleDateString();
}

export function RefundActivityPanel({ ownerId }: { ownerId?: string }) {
	const query = useQuery({
		queryKey: ["refunds", ownerId, "list"],
		queryFn: () => api.refunds.list(),
		enabled: Boolean(ownerId),
		staleTime: 60_000,
	});

	const items = useMemo<RefundRecord[]>(
		() => (query.data?.items ?? []).slice(0, 5),
		[query.data?.items],
	);
	const canRefund = !query.isError && query.data?.creditRefundsAvailable === true;
	if (!ownerId) return null;

	return (
		<div className="mb-8 bg-surface/30 border border-border rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] p-6 relative overflow-hidden transition-colors duration-200 ease-out hover:border-accent/40">
			<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-accent/40 via-accent/20 to-transparent" />
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-[14.5px] font-bold text-text-bright tracking-tight flex items-center gap-2">
					<RotateCcw className="h-4 w-4 text-text-secondary" aria-hidden="true" />
					Refund activity
				</h2>
				<span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted hidden sm:block">
					past 5
				</span>
			</div>

			{query.isLoading && items.length === 0 ? (
				<div
					className="mt-6 flex items-center justify-center py-8 text-text-muted"
					role="status"
					aria-live="polite"
				>
					<Loader2 className="h-4 w-4 animate-spin mr-2" aria-hidden="true" />
					<span className="text-[12.5px]">Loading refund requests…</span>
				</div>
			) : query.isError ? (
				<div
					className="mt-6 flex flex-col items-center gap-2 py-8 text-center text-text-muted"
					role="alert"
				>
					<XCircle className="h-5 w-5 text-error" aria-hidden="true" />
					<p className="text-[12.5px]">
						Couldn&apos;t load refund requests. Refresh to try again.
					</p>
				</div>
			) : items.length === 0 ? (
				<div
					className="mt-6 flex flex-col items-center gap-3 py-8 text-center bg-void rounded-[var(--radius-md)] border border-border/50 shadow-inner"
					role="status"
				>
					<div className="flex h-12 w-12 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-text-muted shadow-sm">
						<FileQuestion className="h-5 w-5" aria-hidden="true" />
					</div>
					<p className="text-[13.5px] font-semibold tracking-wide text-text-bright mt-2">
						No refund requests yet
					</p>
					<p className="text-[11.5px] text-text-muted max-w-[280px] leading-relaxed">
						{canRefund ? <>Open the <span className="text-accent font-medium">Usage</span> tab and
						click <span className="text-accent font-medium">Refund</span> on a billable
						request to start one.</> : <>Contact support for help with a charge.</>}
					</p>
				</div>
			) : (
				<ul className="mt-5 border border-border/50 rounded-[var(--radius-md)] overflow-hidden bg-void shadow-sm">
					{items.map((r) => {
						const tone = STATUS_TONE[r.status] ?? STATUS_TONE.pending;
						const ToneIcon = tone.icon;
						return (
							<li
								key={r.id}
								className="group flex flex-col sm:flex-row sm:items-center justify-between p-3.5 border-b border-border/40 last:border-0 hover:bg-surface/50 transition-colors duration-200 ease-out"
							>
								<div className="flex items-start gap-3 mb-2 sm:mb-0 min-w-0">
									<div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-border bg-surface text-text-secondary shadow-sm">
										<RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
									</div>
									<div className="min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span
												className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${tone.classes}`}
											>
												<ToneIcon className="h-3 w-3" aria-hidden="true" />
												{tone.label}
											</span>
											<code className="font-mono text-[10.5px] text-text-muted truncate">
												{r.id.slice(0, 12)}…
											</code>
										</div>
										{r.reason && (
											<p
												className="mt-1 text-[12px] text-text-secondary line-clamp-2 max-w-md"
												title={r.reason}
											>
												{r.reason}
											</p>
										)}
										{r.adminNote && <p className="mt-1 text-[12px] text-text-secondary">Review: {r.adminNote}</p>}
									</div>
								</div>
								<div className="flex items-center justify-end pl-12 sm:pl-0">
									<span className="font-mono text-[10.5px] uppercase tracking-wider text-text-muted">
										{formatRelative(r.createdAt)}
									</span>
								</div>
							</li>
						);
					})}
				</ul>
			)}
			<p className="mt-3 text-[10.5px] text-text-muted">
				{canRefund
					? "An operator reviews each request. New approvals restore the full usage charge to your OMA credit balance."
					: "Credit refunds are temporarily unavailable. Contact support for help with a charge."}{" "}
				<Link href="/docs#ep-refunds-create" className="text-accent hover:underline">
					API reference
				</Link>
				.
			</p>
		</div>
	);
}
