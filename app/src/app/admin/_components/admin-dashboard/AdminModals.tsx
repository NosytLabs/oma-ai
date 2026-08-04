"use client";

import { Loader2 } from "lucide-react";
import { centsToDollars } from "./api";

import { useAdminDashboard } from "./context";

export function AdminModals() {
	const {
		creditAdjustModal,
		setCreditAdjustModal,
		creditAdjustReason,
		setCreditAdjustReason,
		creditAdjustAmount,
		handleConfirmCreditAdjust,
		suspendModal,
		setSuspendModal,
		suspendReason,
		setSuspendReason,
		handleConfirmSuspend,
		deleteUserModal,
		setDeleteUserModal,
		deleteUserConfirmation,
		setDeleteUserConfirmation,
		deleteUserReason,
		setDeleteUserReason,
		deletingUser,
		handleDeleteUser,
		updatingSettings,
	} = useAdminDashboard();

	return (
		<>
			{creditAdjustModal && (
				<div
					role="dialog"
					aria-modal="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
				>
					<div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-lg">
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
								className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setCreditAdjustModal(null);
									setCreditAdjustReason("");
								}}
								className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={updatingSettings || creditAdjustReason.trim().length === 0}
								onClick={() => void handleConfirmCreditAdjust()}
								className={`rounded-md px-3 py-1.5 text-xs font-medium ${
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
			)}

			{/* Admin user deletion confirmation */}
			{deleteUserModal && (
				<div role="dialog" aria-modal="true" aria-labelledby="delete-user-title" className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
					<div className="w-full max-w-md space-y-4 rounded-lg border border-error/40 bg-surface p-5 shadow-lg">
						<div>
							<h3 id="delete-user-title" className="text-sm font-semibold text-error">Delete {deleteUserModal.name}?</h3>
							<p className="mt-1 text-xs leading-relaxed text-text-muted">This preserves billing and usage rows but anonymizes identity, revokes sessions and API keys, and blocks future access. It cannot be undone.</p>
						</div>
						<label className="block text-xs text-text-muted">
							Type <code className="rounded bg-void px-1 font-mono text-error">DELETE</code> to confirm
							<input
								autoFocus
								value={deleteUserConfirmation}
								onChange={(event) => setDeleteUserConfirmation(event.target.value)}
								placeholder="DELETE"
								className="mt-1 w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-error"
							/>
						</label>
						<label className="block text-xs text-text-muted">
							Reason (required, audit-logged)
							<input
								value={deleteUserReason}
								onChange={(event) => setDeleteUserReason(event.target.value)}
								placeholder="Privacy request, abuse, duplicate account…"
								className="mt-1 w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-error"
							/>
						</label>
						<div className="flex justify-end gap-2">
							<button type="button" disabled={deletingUser} onClick={() => { setDeleteUserModal(null); setDeleteUserConfirmation(""); setDeleteUserReason(""); }} className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text">Cancel</button>
							<button type="button" disabled={deletingUser || deleteUserConfirmation !== "DELETE" || deleteUserReason.trim().length === 0} onClick={() => void handleDeleteUser()} className="inline-flex items-center gap-2 rounded-md border border-error/30 bg-error/15 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/25 disabled:opacity-50">
								{deletingUser && <Loader2 className="h-3 w-3 animate-spin" />}
								{deletingUser ? "Deleting…" : "Delete & anonymize"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Suspend / Unsuspend Confirmation Modal — Slice 6 */}
			{suspendModal && (
				<div
					role="dialog"
					aria-modal="true"
					className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
				>
					<div className="w-full max-w-md rounded-lg border border-border bg-surface p-5 space-y-4 shadow-lg">
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
								className="w-full rounded border border-border bg-surface-elevated px-3 py-2 text-sm outline-none focus:border-accent"
							/>
						</div>
						<div className="flex justify-end gap-2">
							<button
								type="button"
								onClick={() => {
									setSuspendModal(null);
									setSuspendReason("");
								}}
								className="rounded px-3 py-1.5 text-xs text-text-muted hover:text-text"
							>
								Cancel
							</button>
							<button
								type="button"
								disabled={false}
								onClick={() => void handleConfirmSuspend()}
								className={`rounded-md px-3 py-1.5 text-xs font-medium ${
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
			)}
		</>
	);
}
