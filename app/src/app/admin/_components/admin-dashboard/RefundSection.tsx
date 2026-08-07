"use client";

import { Loader2, RefreshCcw } from "lucide-react";

import { useAdminDashboard } from "./context";

export function RefundSection() {
	const {
		refundForm,
		setRefundForm,
		refundSubmitting,
		handleRefundSubmit,
	} = useAdminDashboard();

	return (
			<section className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated/30 p-4 space-y-4">
				<div>
					<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
						Issue Refund
					</h2>
					<p className="text-xs text-text-muted mt-0.5">
						Refund a Polar payment and drain the corresponding credits from the
						user&rsquo;s balance. Every refund writes a REFUND_ISSUED audit entry.
					</p>
				</div>
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<label className="mb-1 block text-xs text-text-muted">
							Payment / Order ID
						</label>
						<input
							type="text"
							value={refundForm.paymentId}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, paymentId: e.target.value }))}
							placeholder="pay_xxx / ord_xxx"
							className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-text-muted">
							Amount (cents)
						</label>
						<input
							type="number"
							min={1}
							value={refundForm.amountCents}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, amountCents: e.target.value }))}
							placeholder="500 = $5.00"
							className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div className="sm:col-span-2">
						<label className="mb-1 block text-xs text-text-muted">
							Reason (required)
						</label>
						<input
							type="text"
							value={refundForm.reason}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, reason: e.target.value }))}
							placeholder="customer request, fraud, ..."
							className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
						/>
					</div>
					<div className="sm:col-span-2">
						<label className="mb-1 block text-xs text-text-muted">
							User ID (optional — pin refund to a specific user)
						</label>
						<input
							type="text"
							value={refundForm.userId}
							onChange={(e) => setRefundForm((prev) => ({ ...prev, userId: e.target.value }))}
							placeholder="usr_xxx (leave blank to auto-resolve from Polar)"
							className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm font-mono outline-none focus:border-accent"
						/>
					</div>
				</div>
				<div className="flex justify-end">
					<button
						type="button"
						onClick={() => void handleRefundSubmit()}
						disabled={refundSubmitting}
						className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-warning/40 bg-warning/10 px-4 py-2 text-sm font-medium text-warning hover:bg-warning/20 disabled:opacity-50"
					>
						{refundSubmitting ? (
							<Loader2 className="h-4 w-4 animate-spin" />
						) : (
							<RefreshCcw className="h-4 w-4" />
						)}
						Issue refund
					</button>
				</div>
			</section>

	);
}
