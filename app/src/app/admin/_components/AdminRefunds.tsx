"use client";

/**
 * /admin → Refunds section.
 *
 * Operators see all pending refund requests with the requesting user's
 * id, the linked usage record id, the amount in cents, and the user-
 * supplied reason. Two CTA buttons per pending row POST
 * `/v1/admin/refunds` with `{ id, decision, adminNote? }`. Decided
 * refunds from the last 24h are shown below as an audit trail.
 *
 * Source of truth for types is the shared `api.refunds.admin.list/...`
 * wrapper. Status rendering reuses the same tones as the user-facing
 * RefundActivityPanel so pending/granted/denied read identically in
 * both surfaces.
 */

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, XCircle } from "lucide-react";
import {
	api,
	type AdminRefundRecord,
	type AdminRefundListResponse,
	type RefundStatus,
} from "@/lib/api";
import { formatUsdPrecise, toDollars } from "@/lib/utils";

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

function formatRelative(iso: string | null): string {
	if (!iso) return "—";
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return "—";
	const diffMs = Date.now() - t;
	const minutes = Math.round(diffMs / 60_000);
	if (minutes < 1) return "just now";
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.round(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.round(hours / 24);
	if (days < 30) return `${days}d ago`;
	return new Date(t).toLocaleDateString();
}

function useRefundList(status: "pending" | "decided") {
	return useQuery({
		queryKey: ["admin", "refunds", status],
		queryFn: () =>
			api.refunds.admin.list(status === "pending" ? "pending" : undefined, 200),
		staleTime: 30_000,
	});
}

export function AdminRefunds() {
	const queryClient = useQueryClient();
	const pendingQuery = useRefundList("pending");
	const allQuery = useRefundList("decided");

	const [expanded, setExpanded] = useState<string | null>(null);

	const decide = useMutation({
		mutationFn: (input: { id: string; decision: "granted" | "denied"; adminNote?: string }) =>
			api.refunds.admin.decide(input),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["admin", "refunds"] });
		},
	});

	const pending = useMemo(
		() => (pendingQuery.data as AdminRefundListResponse | undefined)?.data ?? [],
		[pendingQuery.data],
	);

	const recent = useMemo<AdminRefundRecord[]>(() => {
		const all = (allQuery.data as AdminRefundListResponse | undefined)?.data ?? [];
		const cutoff = Date.now() - 24 * 60 * 60 * 1000;
		return all
			.filter((r) => r.decidedAt && Date.parse(r.decidedAt) > cutoff)
			.slice(0, 12);
	}, [allQuery.data]);

	const lastError = decide.error as Error | null;

	return (
		<section
			id="refunds"
			className="scroll-mt-24 space-y-4"
			aria-label="Refund queue"
			aria-busy={pendingQuery.isFetching}
		>
			<header className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h2 className="text-lg font-semibold text-text-bright">Refund queue</h2>
					<p className="mt-1 text-sm text-text-muted">
						Decide pending refund requests. Granted refunds credit the user&apos;s
						balance; denied ones keep the charge in place.
					</p>
				</div>
				<button
					type="button"
					aria-pressed={pendingQuery.isFetching}
					onClick={() => {
						void pendingQuery.refetch();
						void allQuery.refetch();
					}}
					className="min-h-11 rounded-md border border-border px-3 text-sm text-text-secondary transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
				>
					{pendingQuery.isFetching ? "Refreshing…" : "Refresh"}
				</button>
			</header>

			{pendingQuery.isError ? (
				<div
					role="alert"
					className="rounded-lg border border-error/30 bg-error/5 p-4 text-sm text-error"
				>
					Pending refunds couldn&apos;t load.{" "}
					<button
						type="button"
						className="underline"
						onClick={() => void pendingQuery.refetch()}
					>
						Retry
					</button>
				</div>
			) : pendingQuery.isPending ? (
				<div className="space-y-2" role="status" aria-live="polite">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={i}
							className="h-20 animate-pulse rounded-lg border border-border bg-surface"
						/>
					))}
				</div>
			) : pending.length === 0 ? (
				<div
					className="rounded-lg border border-border bg-surface p-8 text-center"
					role="status"
				>
					<CheckCircle2 className="mx-auto h-8 w-8 text-success" aria-hidden="true" />
					<p className="mt-3 text-sm font-medium text-text-bright">No pending refunds</p>
					<p className="mt-1 text-xs text-text-muted">
						When users file a refund request, it shows up here for review.
					</p>
				</div>
			) : (
				<ul className="space-y-3">
					{pending.map((r) => {
						const tone = STATUS_TONE.pending;
						const ToneIcon = tone.icon;
						const open = expanded === r.id;
						return (
							<li
								key={r.id}
								className="rounded-lg border border-border bg-surface p-4 shadow-[var(--shadow-sm)]"
							>
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2 flex-wrap">
											<span
												className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-mono font-bold uppercase tracking-wider ${tone.classes}`}
											>
												<ToneIcon className="h-3 w-3" aria-hidden="true" />
												{tone.label}
											</span>
											<code className="font-mono text-[10.5px] text-text-muted">
												{r.id.slice(0, 12)}…
											</code>
											<span className="font-mono text-[10.5px] text-text-muted">
												· filed {formatRelative(r.createdAt)}
											</span>
										</div>
										<p className="mt-2 text-sm text-text-bright">
											<span className="font-mono text-[11.5px] text-text-secondary">
												{formatUsdPrecise(toDollars(r.amountCents))}
											</span>
											{" · request "}
											<code className="font-mono text-[11px] text-text-secondary">
												{r.usageId?.slice(0, 12) ?? "—"}…
											</code>
											{" from "}
											<code className="font-mono text-[11px] text-text-secondary break-all">
												{r.userId ?? "—"}
											</code>
										</p>
										{r.reason && (
											<blockquote className="mt-3 border-l-2 border-border pl-3 text-[12.5px] italic text-text-secondary">
												{r.reason}
											</blockquote>
										)}
									</div>
									<div className="flex shrink-0 items-center gap-2">
										<button
											type="button"
											onClick={() => setExpanded(open ? null : r.id)}
											aria-expanded={open}
											aria-controls={`refund-note-${r.id}`}
											className="inline-flex items-center gap-1 rounded-md border border-border bg-surface px-3 py-1.5 text-[11.5px] font-semibold text-text-secondary transition-colors hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
										>
											{open ? (
												<ChevronUp className="h-3 w-3" aria-hidden="true" />
											) : (
												<ChevronDown className="h-3 w-3" aria-hidden="true" />
											)}
											Add note
										</button>
										<button
											type="button"
											disabled={
												decide.isPending &&
												(decide.variables as { id: string } | undefined)?.id === r.id
											}
											onClick={() =>
												decide.mutate({
													id: r.id,
													decision: "denied",
													adminNote: undefined,
												})
											}
											className="inline-flex items-center justify-center gap-1.5 rounded-md border border-error/40 bg-error/10 px-3 py-1.5 text-[11.5px] font-semibold text-error transition-colors hover:bg-error/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
										>
											<XCircle className="h-3.5 w-3.5" aria-hidden="true" />
											Deny
										</button>
										<button
											type="button"
											disabled={
												decide.isPending &&
												(decide.variables as { id: string } | undefined)?.id === r.id
											}
											onClick={() =>
												decide.mutate({ id: r.id, decision: "granted" })
											}
											className="inline-flex items-center justify-center gap-1.5 rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-[11.5px] font-semibold text-success transition-colors hover:bg-success/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-success"
										>
											{decide.isPending &&
											(decide.variables as { id: string; decision: "granted" | "denied" } | undefined)?.id ===
												r.id ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
											) : (
												<CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
											)}
											Grant
										</button>
									</div>
								</div>
								{open && (
									<form
										id={`refund-note-${r.id}`}
										className="mt-3 border-t border-border pt-3"
										onSubmit={(e) => {
											e.preventDefault();
											const formData = new FormData(e.currentTarget);
											const adminNote = (formData.get("adminNote") as string | null) ?? "";
											decide.mutate({
												id: r.id,
												decision: "granted",
												adminNote: adminNote.trim() || undefined,
											});
											setExpanded(null);
										}}
									>
										<label
											htmlFor={`adminNote-${r.id}`}
											className="block text-[11.5px] font-medium text-text-secondary"
										>
											Note on the decision (optional, max 1000 chars)
										</label>
										<textarea
											id={`adminNote-${r.id}`}
											name="adminNote"
											rows={2}
											maxLength={1000}
											placeholder="Visible to admins; not shown to the user."
											className="mt-1.5 block w-full resize-y rounded-md border border-border bg-panel p-2 text-[12.5px] text-text-bright placeholder:text-text-muted focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
										/>
										<p className="mt-1 text-[10.5px] text-text-muted">
											This grants the refund with the supplied note. Combine the
											deny button above with the same flow to grant with a different
											outcome.
										</p>
										<div className="mt-2 flex justify-end gap-2">
											<button
												type="button"
												onClick={() => setExpanded(null)}
												className="rounded-md border border-border bg-surface px-3 py-1.5 text-[11.5px] text-text-secondary hover:bg-surface-elevated"
											>
												Cancel
											</button>
											<button
												type="submit"
												disabled={decide.isPending}
												className="rounded-md border border-success/40 bg-success/10 px-3 py-1.5 text-[11.5px] font-semibold text-success hover:bg-success/20 disabled:opacity-50"
											>
												Grant with note
											</button>
										</div>
									</form>
								)}
							</li>
						);
					})}
				</ul>
			)}

			{lastError && (
				<div
					role="alert"
					className="rounded-lg border border-error/30 bg-error/5 p-3 text-[12.5px] text-error"
				>
					Decide failed: {lastError.message}
				</div>
			)}

			{recent.length > 0 && (
				<div className="mt-6">
					<h3 className="font-mono text-[11px] uppercase tracking-wider text-text-muted">
						Recent decisions (last 24h)
					</h3>
					<ul className="mt-2 space-y-1.5">
						{recent.map((r) => {
							const tone = STATUS_TONE[r.status];
							const ToneIcon = tone.icon;
							return (
								<li
									key={r.id}
									className="flex items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 py-1.5 text-[12px]"
								>
									<div className="flex min-w-0 items-center gap-2">
										<span
											className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider ${tone.classes}`}
										>
											<ToneIcon className="h-2.5 w-2.5" aria-hidden="true" />
											{tone.label}
										</span>
										<code className="font-mono text-text-muted">
											{r.id.slice(0, 12)}…
										</code>
										<span className="text-text-muted">·</span>
										<span className="font-mono text-text-secondary">
											{formatUsdPrecise(toDollars(r.amountCents))}
										</span>
									</div>
									<span className="font-mono text-[10.5px] uppercase tracking-wider text-text-muted shrink-0">
										{formatRelative(r.decidedAt)}
									</span>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</section>
	);
}
