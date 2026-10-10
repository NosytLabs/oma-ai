"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, History, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { AnimatePresence, m } from "@/lib/framer-motion-client";

interface DangerZoneSectionProps {
	onDeleteAccount: () => Promise<void>;
	deleting: boolean;
	readOnly?: boolean;
}

/**
	* Irreversible account actions. Clear history is confirmed in-place;
	* account deletion requires typing DELETE before the parent handler runs.
	*/
export function DangerZoneSection({
	onDeleteAccount,
	deleting,
	readOnly = false,
}: DangerZoneSectionProps) {
	const toast = useToast();
	const queryClient = useQueryClient();
	const balanceQuery = useQuery({
		queryKey: ["balance"],
		queryFn: () => api.balance.get(),
		staleTime: 30_000,
		enabled: !readOnly,
	});
	const balanceDollars = readOnly ? Number.NaN : Number(balanceQuery.data?.balanceCents ?? Number.NaN) / 100;
	const [showConfirm, setShowConfirm] = useState(false);
	const [confirmText, setConfirmText] = useState("");
	const [clearing, setClearing] = useState(false);
	const [showClearConfirm, setShowClearConfirm] = useState(false);

	const handleClearHistory = async () => {
		if (readOnly || clearing) return;
		setClearing(true);
		try {
			const res = await api.auth.clearHistory();
			if (res.success) {
				toast.success(
					`Wiped ${res.deleted.usageRecords} usage records & ${res.deleted.auditLogs} logs.`,
				);
				void queryClient.invalidateQueries({ queryKey: ["usage"] });
				void queryClient.invalidateQueries({ queryKey: ["balance"] });
				void queryClient.invalidateQueries({ queryKey: ["recentTransactions"] });
				void queryClient.invalidateQueries({ queryKey: ["creditBatches"] });
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

	const handleConfirmDelete = async () => {
		if (readOnly || confirmText !== "DELETE" || deleting) return;
		await onDeleteAccount();
	};

	return (
		<div>
			<div className="mb-4">
				<h2 className="font-sans text-lg font-semibold text-error">
					Danger zone
				</h2>
				<p className="mt-1 text-sm text-text-muted">
					Irreversible actions. Export your data first if you might need it later.
				</p>
			</div>

			<p className="rounded-[var(--radius-md)] border border-border bg-surface/30 px-5 py-3 text-xs text-text-muted">
				Export your data above first if you might need it later. Deletion forfeits remaining credits.
			</p>

			{/* Wipe History */}
			<div className="mt-6 rounded-[var(--radius-md)] border border-border bg-surface/30 p-5 transition-colors duration-200 ease-out hover:border-accent/30">
				<div className="flex items-start gap-4">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-border bg-surface-elevated">
						<History
							className="h-5 w-5 text-text-secondary"
							aria-hidden="true"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="text-sm font-semibold text-text-bright">
							Clear usage history
						</h3>
						<p className="mt-1 text-xs text-text-muted">
							Remove usage records and your audit history. A record of this action is kept. Your
							identity, API keys, sessions, and credit balances are preserved.
						</p>

						<AnimatePresence mode="wait">
							{!showClearConfirm ? (
								<m.button
									type="button"
									key="clear-open"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									whileTap={{ scale: 0.98 }}
									onClick={() => setShowClearConfirm(true)}
									disabled={readOnly}
									className="disabled:cursor-not-allowed disabled:opacity-40 mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-secondary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:border-accent/40 hover:bg-surface-elevated hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									<History className="h-3.5 w-3.5" aria-hidden="true" />
									Clear usage history
								</m.button>
							) : (
								<m.div
									key="clear-confirm"
									initial={{ opacity: 0, scale: 0.98 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.98 }}
									className="mt-4 rounded-[var(--radius-md)] border border-border bg-surface-elevated p-4"
								>
									<div className="mb-3 flex items-center gap-2">
										<AlertTriangle
											className="h-4 w-4 text-accent"
											aria-hidden="true"
										/>
										<span className="text-sm font-semibold text-text-bright">
											Clear usage history &amp; logs?
										</span>
									</div>
									<p className="mb-4 text-xs text-text-muted">
										This cannot be undone. Sessions, API keys, and credits stay
										intact; statistics and usage history are permanently
										removed.
									</p>
									<div className="flex flex-wrap gap-3">
										<button
											type="button"
											onClick={handleClearHistory}
											disabled={readOnly || clearing}
											className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-accent bg-accent/10 px-4 py-2 text-xs font-semibold text-accent transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-accent/20 active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
										>
											{clearing ? (
												<>
													<Loader2
														className="h-3.5 w-3.5 animate-spin"
														aria-hidden="true"
													/>
													Clearing…
												</>
											) : (
												<>
													<History className="h-3.5 w-3.5" aria-hidden="true" />
													Confirm wipe
												</>
											)}
										</button>
										<button
											type="button"
											onClick={() => setShowClearConfirm(false)}
											disabled={readOnly || clearing}
											className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-primary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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

			{/* Delete account */}
			<div className="mt-6 rounded-[var(--radius-md)] border border-error/30 bg-error/5 p-5 transition-colors duration-200 ease-out hover:border-error/50 hover:bg-error/10">
				<div className="flex items-start gap-4">
					<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-md)] border border-error/30 bg-error/10">
						<AlertTriangle
							className="h-5 w-5 text-error"
							aria-hidden="true"
						/>
					</div>
					<div className="min-w-0 flex-1">
						<h3 className="text-sm font-semibold text-error">
							Delete account
						</h3>
						<p className="mt-1 text-xs text-text-muted">
							Permanently delete your OMA account, API keys, and credits. This
							cannot be undone and requires a sign-in within the last 24 hours. Payment-security audit records are retained with your account ID detached. Credits are non-redeemable and will be
							forfeited
							{Number.isFinite(balanceDollars)
								? ` (about $${balanceDollars.toFixed(2)} remaining)`
								: ""}
							.
						</p>

						<AnimatePresence mode="wait">
							{!showConfirm ? (
								<m.button
									type="button"
									key="delete-open"
									initial={{ opacity: 0 }}
									animate={{ opacity: 1 }}
									exit={{ opacity: 0 }}
									whileTap={{ scale: 0.98 }}
									onClick={() => setShowConfirm(true)}
									disabled={readOnly}
									className="disabled:cursor-not-allowed disabled:opacity-40 mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-[var(--radius-md)] border border-error/40 bg-error/10 px-4 py-2 text-xs font-semibold text-error transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-error/20 hover:border-error/60 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
								>
									<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
									Delete account
								</m.button>
							) : (
								<m.div
									key="delete-confirm"
									initial={{ opacity: 0, scale: 0.98 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.98 }}
									className="mt-4 rounded-[var(--radius-md)] border border-error/40 bg-error/10 p-5"
								>
									<div className="mb-3 flex items-center gap-2">
										<AlertTriangle
											className="h-4 w-4 text-error"
											aria-hidden="true"
										/>
										<span className="text-sm font-semibold text-error">
											Final confirmation
										</span>
									</div>
									<p className="mb-3 text-xs text-text-secondary">
										Type{" "}
										<code className="rounded-[var(--radius-sm)] bg-void px-1.5 py-0.5 font-mono text-error border border-error/30">
											DELETE
										</code>
										{" "}
										below to confirm account deletion. Remaining credits are forfeited. Payment-security records are retained without your account ID.
									</p>
									<input
										type="text"
										value={confirmText}
										onChange={(e) => setConfirmText(e.target.value)}
										onKeyDown={(e) => {
											if (e.key === "Enter") void handleConfirmDelete();
										}}
										placeholder="Type DELETE"
										aria-label="Confirm by typing DELETE"
										autoComplete="off"
										autoFocus
										className="mb-4 w-full rounded-[var(--radius-md)] border border-error/30 bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-error focus:outline-none focus:ring-2 focus:ring-error/50 transition-shadow"
										disabled={readOnly || deleting}
									/>
									<div className="flex flex-wrap gap-3">
										<button
											type="button"
											onClick={handleConfirmDelete}
											disabled={readOnly || deleting || confirmText !== "DELETE"}
											className="inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] border border-error bg-error px-4 py-2 text-xs font-semibold text-text-inverse disabled:cursor-not-allowed disabled:opacity-40 transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-error/90 active:scale-[0.97]"
										>
											{deleting ? (
												<>
													<Loader2
														className="h-3.5 w-3.5 animate-spin"
														aria-hidden="true"
													/>
													Deleting…
												</>
											) : (
												<>
													<Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
											disabled={readOnly || deleting}
											className="rounded-[var(--radius-md)] border border-border bg-surface px-4 py-2 text-xs font-semibold text-text-primary transition-[background-color,border-color,box-shadow,color,transform] duration-200 hover:bg-surface-elevated active:scale-[0.97] disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-border)]"
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
