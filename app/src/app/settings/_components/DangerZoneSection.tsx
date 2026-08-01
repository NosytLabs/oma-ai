"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { AlertTriangle, Loader2, Trash2, History } from "lucide-react";
import { useState } from "react";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";

interface DangerZoneSectionProps {
	onDeleteAccount: () => Promise<void>;
	deleting: boolean;
}

export function DangerZoneSection({
	onDeleteAccount,
	deleting,
}: DangerZoneSectionProps) {
	const toast = useToast();
	const [showConfirm, setShowConfirm] = useState(false);
	const [confirmText, setConfirmText] = useState("");

	const [clearing, setClearing] = useState(false);
	const [showClearConfirm, setShowClearConfirm] = useState(false);

	const handleClearHistory = async () => {
		setClearing(true);
		try {
			const res = await api.auth.clearHistory();
			if (res.success) {
				toast.success(
					`Wiped ${res.deleted.usageRecords} usage records & ${res.deleted.auditLogs} logs.`
				);
				setShowClearConfirm(false);
			} else {
				toast.error("Failed to clear history");
			}
		} catch (e: unknown) {
			toast.error(e instanceof Error ? e.message : "Failed to clear history");
		} finally {
			setClearing(false);
		}
	};

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-error">Danger zone</h2>
				<p className="mt-1 text-sm text-text-muted">
					Irreversible actions. Make sure you understand the consequences.
				</p>
			</div>

			{/* Wipe History Section */}
			<div className="mt-6 rounded-lg border border-border bg-surface/30 p-4">
				<div className="flex items-start gap-3">
					<History className="h-5 w-5 shrink-0 text-text mt-0.5" />
					<div className="flex-1">
						<h3 className="text-sm font-semibold text-text-bright">Clear usage history</h3>
						<p className="mt-1 text-xs text-text-muted">
							Wipe all programmatic usage records, audit logs, and prompt telemetries
							associated with this account (GDPR Right to Forget). Your identity, API
							keys, active sessions, and credit balances are preserved.
						</p>

						<AnimatePresence mode="wait">
							{!showClearConfirm ? (
								<m.button
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									whileTap={{ scale: 0.98 }}
									onClick={() => setShowClearConfirm(true)}
									className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-void px-3 py-1.5 text-xs font-semibold text-text hover:bg-surface hover:text-text-bright transition-all"
								>
									<History className="h-3.5 w-3.5" />
									Clear usage history
								</m.button>
							) : (
								<m.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.95 }}
									className="mt-4 rounded-md border border-border bg-surface/50 p-4"
								>
									<div className="mb-3 flex items-center gap-2">
										<AlertTriangle className="h-4 w-4 text-accent" />
										<span className="text-sm font-semibold text-text-bright">
											Clear telemetry & logs?
										</span>
									</div>
									<p className="mb-4 text-xs text-text-muted">
										This action is final. While your active sessions, API keys, and credit balances remain perfectly intact, all statistics and usage histories will be permanently removed.
									</p>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={handleClearHistory}
											disabled={clearing}
											className="inline-flex items-center justify-center gap-2 rounded-md border border-accent bg-accent/10 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/20 transition-all disabled:opacity-40"
										>
											{clearing ? (
												<>
													<Loader2 className="h-3 w-3 animate-spin" /> Clearing…
												</>
											) : (
												<>
													<History className="h-3 w-3" />
													Confirm Wipe
												</>
											)}
										</button>
										<button
											type="button"
											onClick={() => setShowClearConfirm(false)}
											disabled={clearing}
											className="flex-1 rounded-md border border-border bg-void py-2 text-xs font-semibold text-text transition-all hover:bg-surface disabled:opacity-40"
										>
											Cancel
										</button>
									</div>
								</m.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</div>

			<div className="mt-4 rounded-lg border border-error/30 bg-error/5 p-4">
				<div className="flex items-start gap-3">
					<AlertTriangle className="h-5 w-5 shrink-0 text-error mt-0.5" />
					<div className="flex-1">
						<h3 className="text-sm font-semibold text-error">Delete account</h3>
						<p className="mt-1 text-xs text-text-muted">
							Permanently delete your OMA account, all API keys, credits, and
							staking positions. This action cannot be undone. Credits are
							non-redeemable and will be forfeited.
						</p>

						<AnimatePresence mode="wait">
							{!showConfirm ? (
								<m.button
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									whileTap={{ scale: 0.98 }}
									onClick={() => setShowConfirm(true)}
									className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-error bg-error px-4 py-2 text-xs font-semibold text-text-inverse transition-all hover:bg-error/90"
								>
									<Trash2 className="h-3.5 w-3.5" />
									Delete account
								</m.button>
							) : (
								<m.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.95 }}
									className="mt-4 rounded-md border border-error/40 bg-error/10 p-4"
								>
									<div className="mb-3 flex items-center gap-2">
										<AlertTriangle className="h-4 w-4 text-error" />
										<span className="text-sm font-semibold text-error">
											Final confirmation
										</span>
									</div>
									<p className="mb-3 text-xs text-text-secondary">
										Type{" "}
										<code className="rounded bg-void px-1.5 py-0.5 font-mono text-error">
											DELETE
										</code>{" "}
										below to confirm. All data will be permanently destroyed.
									</p>
									<input
										type="text"
										value={confirmText}
										onChange={(e) => setConfirmText(e.target.value)}
										placeholder="Type DELETE"
										aria-label="Confirm by typing DELETE"
										className="mb-3 w-full rounded-md border border-error/30 bg-void px-3 py-2 text-sm text-text placeholder:text-text-muted focus:border-error focus:outline-none focus:ring-1 focus:ring-error"
										disabled={deleting}
									/>
									<div className="flex gap-2">
										<button
											type="button"
											onClick={onDeleteAccount}
											disabled={deleting || confirmText !== "DELETE"}
											className="inline-flex items-center justify-center gap-2 rounded-md border border-error bg-error px-4 py-2 text-xs font-semibold text-text-inverse disabled:cursor-not-allowed disabled:opacity-40"
										>
											{deleting ? (
												<>
													<Loader2 className="h-3 w-3 animate-spin" /> Deleting…
												</>
											) : (
												<>
													<Trash2 className="h-3 w-3" />
													Delete my account
												</>
											)}
										</button>
										<button
											type="button"
											onClick={() => {
												setShowConfirm(false);
												setConfirmText("");
											}}
											disabled={deleting}
											className="flex-1 rounded-md border border-border bg-void py-2 text-xs font-semibold text-text transition-all hover:bg-surface disabled:opacity-40"
										>
											Cancel
										</button>
									</div>
								</m.div>
							)}
						</AnimatePresence>
					</div>
				</div>
			</div>
		</div>
	);
}
