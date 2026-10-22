"use client";

/**
 * Request refund modal.
 *
 * For a single billable usage record, collect a reason (10–1000 chars per
 * the createRefundSchema server constraint) and POST it to `/v1/refunds`.
 * The actual settlement is decided by an operator via `/v1/admin/refunds`
 * after the request is filed — this modal never handles real money itself,
 * it just submits an intake form.
 *
 * The full URL of the targeted row is rendered in the modal so the user
 * always knows which exact line they're asking about.
 */

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2, RotateCcw, X } from "lucide-react";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { useToast } from "@/components/ui/Toast";
import { api, type UsageRecord } from "@/lib/api";
import { formatUsdPrecise, toDollars } from "@/lib/utils";
import { resolveModelDisplayName } from "@/lib/dashboard-aggregate";

const MIN_REASON_LEN = 10;
const MAX_REASON_LEN = 1000;

interface RequestRefundModalProps {
	record: UsageRecord | null;
	onDismiss: () => void;
	/** Called after a successful submission so the parent can invalidate its query cache. */
	onSubmitted?: () => void;
}

function billedCentsString(record: UsageRecord | null): string {
	if (!record) return "0";
	const raw = record.billedCents ?? record.totalCents ?? "0";
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) return "0";
	return n.toString();
}

export function RequestRefundModal({
	record,
	onDismiss,
	onSubmitted,
}: RequestRefundModalProps) {
	const panelRef = useRef<HTMLDivElement>(null);
	const toast = useToast();
	const [reason, setReason] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useFocusTrap({ active: !!record, containerRef: panelRef, onClose: onDismiss });

	// Reset state every time we open for a new record so we don't carry the
	// previous row's reason / error into the next open.
	useEffect(() => {
		if (record) {
			setReason("");
			setError(null);
			setSubmitting(false);
		}
	}, [record?.id]);

	if (!record) return null;

	const trimmed = reason.trim();
	const tooShort = trimmed.length > 0 && trimmed.length < MIN_REASON_LEN;
	const tooLong = trimmed.length > MAX_REASON_LEN;
	const canSubmit = trimmed.length >= MIN_REASON_LEN && !tooLong && !submitting;

	const handleSubmit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!canSubmit) return;
		setSubmitting(true);
		setError(null);
		try {
			await api.refunds.create({ usageId: record.id, reason: trimmed });
			toast.success("Refund request submitted. Check Refund activity for the decision.");
			onSubmitted?.();
			onDismiss();
		} catch (e) {
			const msg = e instanceof Error ? e.message : "Request failed. Try again in a moment.";
			setError(msg);
			toast.error(msg);
		} finally {
			setSubmitting(false);
		}
	};

	const billDollars = toDollars(Number(billedCentsString(record)));

	return (
		<AnimatePresence>
			<m.div
				className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/80 backdrop-blur-sm p-4"
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				role="presentation"
				onClick={(e) => {
					if (e.target === e.currentTarget) onDismiss();
				}}
			>
				<m.div
					ref={panelRef}
					role="dialog"
					aria-modal="true"
					aria-labelledby="request-refund-title"
					aria-describedby="request-refund-desc"
					className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-[var(--radius-xl)] border border-border bg-void shadow-[var(--shadow-md)]"
					initial={{ opacity: 0, y: 12, scale: 0.98 }}
					animate={{ opacity: 1, y: 0, scale: 1 }}
					exit={{ opacity: 0, y: 8, scale: 0.99 }}
					transition={{ duration: 0.18, ease: [0.23, 1, 0.32, 1] }}
				>
					<header className="flex items-start justify-between gap-4 border-b border-border/60 p-5">
						<div className="flex items-start gap-3">
							<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-accent/30 bg-accent/10 text-accent">
								<RotateCcw className="h-5 w-5" aria-hidden="true" />
							</div>
							<div>
								<h2 id="request-refund-title" className="text-[15px] font-semibold tracking-tight text-text-bright">
									Request a refund
								</h2>
								<p id="request-refund-desc" className="mt-1 text-[12.5px] leading-relaxed text-text-secondary">
									For this one request only. An operator will review it. Approved refunds return the full charge to your OMA credit balance.
								</p>
							</div>
						</div>
						<button
							type="button"
							onClick={onDismiss}
							aria-label="Close refund dialog"
							className="rounded-[var(--radius-sm)] p-1.5 text-text-muted transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>
					</header>

					<form onSubmit={handleSubmit} className="p-5 space-y-4">
						<dl className="grid grid-cols-3 gap-y-2 rounded-[var(--radius-md)] border border-border/60 bg-surface/40 p-3 text-[12.5px]">
							<dt className="text-text-muted">Model</dt>
							<dd className="col-span-2 font-mono text-text-bright">{resolveModelDisplayName(record.model)}</dd>
							<dt className="text-text-muted">Charge</dt>
							<dd className="col-span-2 font-mono text-text-bright">{formatUsdPrecise(billDollars)}</dd>
							<dt className="text-text-muted">Request ID</dt>
							<dd className="col-span-2 font-mono text-[11.5px] text-text-secondary break-all">{record.requestId}</dd>
						</dl>

						<div>
							<label htmlFor="refund-reason" className="block text-[12.5px] font-medium text-text-bright">
								Why are you requesting this refund?
							</label>
							<textarea
								id="refund-reason"
								name="reason"
								value={reason}
								onChange={(e) => setReason(e.target.value)}
								required
								minLength={MIN_REASON_LEN}
								maxLength={MAX_REASON_LEN}
								rows={5}
								placeholder="Tell us what went wrong. Specifics (model, prompt, expected vs. actual output) help us resolve faster."
								className="mt-2 block w-full resize-y rounded-[var(--radius-md)] border border-border bg-panel p-3 font-sans text-[13px] leading-relaxed text-text-bright placeholder:text-text-muted focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
								disabled={submitting}
								aria-describedby="refund-reason-help"
							/>
							<div id="refund-reason-help" className="mt-1.5 flex items-center justify-between text-[11px] text-text-muted">
								<span>
									{MIN_REASON_LEN}–{MAX_REASON_LEN} chars
								</span>
								<span
									className={`tabular-nums font-mono ${
										tooShort
											? "text-warning"
											: tooLong
												? "text-error"
												: "text-text-muted"
									}`}
								>
									{trimmed.length}/{MAX_REASON_LEN}
								</span>
							</div>
						</div>

						{error && (
							<div
								role="alert"
								className="flex items-start gap-2 rounded-[var(--radius-md)] border border-error/30 bg-error/10 p-3 text-[12.5px] text-error"
							>
								<AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
								<span>{error}</span>
							</div>
						)}

						<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
							<button
								type="button"
								onClick={onDismiss}
								disabled={submitting}
								className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 text-[12.5px] font-semibold text-text-secondary transition-colors hover:bg-surface-elevated hover:text-text-bright disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								Cancel
							</button>
							<button
								type="submit"
								disabled={!canSubmit}
								className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent/40 bg-accent px-4 py-2 text-[12.5px] font-semibold text-[var(--color-accent-fg)] transition-colors hover:bg-accent-hover disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								{submitting ? (
									<>
										<Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
										Sending…
									</>
								) : (
									"Submit refund request"
								)}
							</button>
						</div>
					</form>
				</m.div>
			</m.div>
		</AnimatePresence>
	);
}
