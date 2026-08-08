"use client";

import { useAdminDashboard } from "../admin-dashboard/context";

export function SuspendUserModal() {
	const {
		suspendModal,
		setSuspendModal,
		suspendReason,
		setSuspendReason,
		handleConfirmSuspend,
	} = useAdminDashboard();

	if (!suspendModal) return null;

	return (
		<div
			role="dialog"
			aria-modal="true"
			className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-sm p-4"
		>
			<div className="w-full max-w-md rounded-[var(--radius-lg)] border border-border bg-surface p-5 space-y-4 shadow-lg">
				<div>
					<h3 className="text-sm font-semibold">
						{suspendModal.action === "suspend" ? "Suspend user" : "Unsuspend user"}
					</h3>
					<p className="text-xs text-text-muted mt-0.5">
						{suspendModal.action === "suspend"
							? "Suspending will reject login + API requests with 403 and revoke all active API keys for this user."
							: "Unsuspending clears the suspended flag; the user can log in again. API keys are NOT auto-reissued."}
					</p>
				</div>
				<div>
					<label className="mb-1 block text-xs text-text-muted">
						Reason (optional, audit-logged)
					</label>
					<input
						type="text"
						autoFocus
						value={suspendReason}
						onChange={(e) => setSuspendReason(e.target.value)}
						placeholder="chargeback / abuse / customer request / ..."
						className="w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
					/>
				</div>
				<div className="flex justify-end gap-2">
					<button
						type="button"
						onClick={() => {
							setSuspendModal(null);
							setSuspendReason("");
						}}
						className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs text-text-muted hover:text-text"
					>
						Cancel
					</button>
					<button
						type="button"
						onClick={() => void handleConfirmSuspend()}
						className={`rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium ${
							suspendModal.action === "suspend"
								? "bg-error/15 text-error border border-error/30 hover:bg-error/25"
								: "bg-success/15 text-success border border-success/30 hover:bg-success/25"
						} disabled:opacity-50`}
					>
						{suspendModal.action === "suspend" ? "Suspend" : "Unsuspend"}
					</button>
				</div>
			</div>
		</div>
	);
}
