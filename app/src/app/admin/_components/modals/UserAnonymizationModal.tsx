"use client";

import { Loader2 } from "lucide-react";
import { useAdminDashboard } from "../admin-dashboard/context";

export function UserAnonymizationModal() {
	const {
		deleteUserModal,
		setDeleteUserModal,
		deleteUserConfirmation,
		setDeleteUserConfirmation,
		deleteUserReason,
		setDeleteUserReason,
		deletingUser,
		handleDeleteUser,
	} = useAdminDashboard();

	if (!deleteUserModal) return null;

	return (
		<div role="dialog" aria-modal="true" aria-labelledby="delete-user-title" className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/70 backdrop-blur-sm p-4">
			<div className="w-full max-w-md space-y-4 rounded-[var(--radius-lg)] border border-error/40 bg-surface p-5 shadow-lg">
				<div>
					<h3 id="delete-user-title" className="text-sm font-semibold text-error">Delete {deleteUserModal.name}?</h3>
					<p className="mt-1 text-xs leading-relaxed text-text-muted">This preserves billing and usage rows but anonymizes identity, revokes sessions and API keys, and blocks future access. It cannot be undone.</p>
				</div>
				<label className="block text-xs text-text-muted">
					Type <code className="rounded-[var(--radius-sm)] bg-void px-1 font-mono text-error">DELETE</code> to confirm
					<input
						autoFocus
						value={deleteUserConfirmation}
						onChange={(event) => setDeleteUserConfirmation(event.target.value)}
						placeholder="DELETE"
						className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-error"
					/>
				</label>
				<label className="block text-xs text-text-muted">
					Reason (required, audit-logged)
					<input
						value={deleteUserReason}
						onChange={(event) => setDeleteUserReason(event.target.value)}
						placeholder="Privacy request, abuse, duplicate account…"
						className="mt-1 w-full rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-3 py-2 text-sm text-text outline-none focus:border-error"
					/>
				</label>
				<div className="flex justify-end gap-2">
					<button type="button" disabled={deletingUser} onClick={() => { setDeleteUserModal(null); setDeleteUserConfirmation(""); setDeleteUserReason(""); }} className="rounded-[var(--radius-sm)] px-3 py-1.5 text-xs text-text-muted hover:text-text">Cancel</button>
					<button type="button" disabled={deletingUser || deleteUserConfirmation !== "DELETE" || deleteUserReason.trim().length === 0} onClick={() => void handleDeleteUser()} className="inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-error/30 bg-error/15 px-3 py-1.5 text-xs font-medium text-error hover:bg-error/25 disabled:opacity-50">
						{deletingUser && <Loader2 className="h-3 w-3 animate-spin" />}
						{deletingUser ? "Deleting…" : "Delete & anonymize"}
					</button>
				</div>
			</div>
		</div>
	);
}
