"use client";

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";

interface DangerZoneSectionProps {
	onDeleteAccount: () => Promise<void>;
	deleting: boolean;
}

export function DangerZoneSection({
	onDeleteAccount,
	deleting,
}: DangerZoneSectionProps) {
	const [showConfirm, setShowConfirm] = useState(false);
	const [confirmText, setConfirmText] = useState("");

	return (
		<div>
			<div className="mb-1">
				<h2 className="text-lg font-semibold text-error">Danger zone</h2>
				<p className="mt-1 text-sm text-text-muted">
					Irreversible actions. Make sure you understand the consequences.
				</p>
			</div>

			<div className="mt-6 rounded-lg border border-error/30 bg-error/5 p-4">
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
