"use client";

import { useAdminDashboard } from "../admin-dashboard/context";
import { centsToDollars } from "../admin-dashboard/api";

export function CreditAdjustmentModal() {
	const {
		creditAdjustModal,
		setCreditAdjustModal,
		creditAdjustReason,
		setCreditAdjustReason,
		creditAdjustAmount,
		handleConfirmCreditAdjust,
		updatingSettings,
	} = useAdminDashboard();

	if (!creditAdjustModal) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-sm p-4"
		>
			<div className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-4 shadow-lg">
				<div className="flex items-start justify-between">
					<div>
						<h3 className="text-sm font-semibold">
							{creditAdjustModal.direction === "add" ? "Add credits" : "Drain credits"}
						</h3>
						<p className="text-xs text-text-muted mt-0.5">
							{creditAdjustModal.direction === "add"
								? `Adds ${centsToDollars(parseFloat(creditAdjustAmount[creditAdjustModal.userId] || "0") * 100)} to this user's balance and bumps totalDeposited.`
								: `Drains up to ${centsToDollars(parseFloat(creditAdjustAmount[creditAdjustModal.userId] || "0") * 100)} from this user's balance (capped at current balance).`}
						</p>
					</div>
				</div>
				<div>
					<label className="mb-1 block text-xs text-text-muted">
						Reason (required, audit-logged)
					</label>
					<input
						type="text"
						autoFocus
						value={creditAdjustReason}
						onChange={(e) => setCreditAdjustReason(e.target.value)}
						placeholder="Promo top-up, good-faith dispute, ..."
						className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
					/>
				</div>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={() => {
							setCreditAdjustModal(null);
							setCreditAdjustReason("");
						}}
						className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs text-text-muted hover:text-text"
					>
						Cancel
					</button>
					<button
						type="button"
						disabled={updatingSettings || creditAdjustReason.trim().length === 0}
						onClick={() => void handleConfirmCreditAdjust()}
						className={`rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium ${
							creditAdjustModal.direction === "add"
								? "bg-success/15 text-success border border-success/30 hover:bg-success/25"
								: "bg-error/15 text-error border border-error/30 hover:bg-error/25"
						} disabled:opacity-50`}
					>
						{creditAdjustModal.direction === "add" ? "Add credits" : "Drain credits"}
					</button>
				</div>
			</div>
		</div>
	);
}
