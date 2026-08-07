"use client";

import {
	ChevronRight,
	Filter,
	Lock,
	Loader2,
	Search,
	Unlock,
} from "lucide-react";
import { centsToDollars, timeAgo } from "./api";

import { useAdminDashboard } from "./context";

export function UsersSection() {
	const {
		users,
		userSearch,
		setUserSearch,
		selectedUserId,
		selectedUserHistory,
		loadingHistory,
		handleViewUserHistory,
		creditAdjustAmount,
		setCreditAdjustAmount,
		handleCreditAdjust,
		handleSuspendAction,
		setDeleteUserModal,
		refreshAll,
		loading,
		updatingSettings,
		deletingUser,
		setSelectedUserId,
		setSelectedUserHistory,
	} = useAdminDashboard();

	return (
			<section className="rounded-[var(--radius-lg)] border border-border bg-surface-elevated/30 p-4 space-y-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
								User Directory
							</h2>
							<p className="text-xs text-text-muted mt-0.5">
								Manage permissions, edit Credits, and audit individual user request logs.
							</p>
						</div>
						<div className="flex items-center gap-2">
							<div className="relative">
								<Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-muted" />
								<input
									type="text"
									value={userSearch}
									onChange={(e) => setUserSearch(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter") void refreshAll();
									}}
									placeholder="email / wallet / id / account #"
									className="w-56 rounded-[var(--radius-sm)] border border-border bg-surface-elevated pl-7 pr-2 py-1 text-xs focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								/>
							</div>
							<button
								type="button"
								onClick={() => void refreshAll()}
								disabled={loading}
								className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							>
								<Filter className="h-3 w-3" />
								Filter
							</button>
							<span className="text-xs text-text-muted">
								{users.length} {userSearch.trim() ? "match" : "registered accounts"}
							</span>
						</div>
					</div>

					{users.length === 0 ? (
						<p className="py-6 text-center text-sm text-text-muted">
							{userSearch.trim()
								? `No users match "${userSearch.trim()}".`
								: "No users yet."}
						</p>
					) : (
					<>
					<div className="overflow-x-auto">
						<table className="w-full text-xs text-left">
							<thead className="border-b border-border text-text-muted uppercase tracking-wider text-[10px]">
								<tr>
									<th className="px-4 py-2 text-left">User details</th>
									<th className="px-4 py-2 text-center">Status</th>
<th className="px-4 py-2 text-right">Deposited</th>
								<th className="px-4 py-2 text-right">Used</th>
								<th className="px-4 py-2 text-right">Credits</th>
								<th className="px-4 py-2 text-center">Credit Adjust (USD)</th>
								<th className="px-4 py-2 text-right">Actions</th>
								</tr>
							</thead>
							<tbody>
								{users.map((u) => {
									const isTargetHistory = selectedUserId === u.id;
									return (
										<tr key={u.id} className="border-b border-border/30 hover:bg-surface-elevated/20 transition-colors duration-200 ease-out">
											<td className="px-4 py-3">
												<div className="font-semibold text-text-bright flex items-center gap-1.5">
													{u.name || "Anonymous User"}
													{u.role === "admin" && (
														<span className="bg-accent/15 text-accent border border-accent/20 rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[9px] font-mono uppercase">
															Admin
														</span>
													)}
												</div>
												<div className="text-text-muted font-mono text-[10px] mt-0.5 space-y-0.5">
													{u.email && <div>email: {u.email}</div>}
													{u.evmAddress && <div className="break-all">wallet: {u.evmAddress}</div>}
													<div className="text-[9px]">ID: {u.id} · joined {new Date(u.createdAt).toLocaleDateString()}</div>
												</div>
											</td>
											<td className="px-4 py-3 text-center">
												<span className={`inline-flex rounded-[var(--radius-sm)] px-1.5 py-0.5 text-[10px] font-medium ${
													u.suspended || u.banned
														? "bg-error/15 text-error border border-error/25"
														: "bg-success/15 text-success border border-success/25"
												}`}>
													{u.suspended ? "Suspended (admin)" : u.banned ? "Suspended" : "Active"}
												</span>
											</td>
											<td className="px-4 py-3 text-right font-mono font-medium">
												{centsToDollars(u.totalDepositedCents)}
											</td>
											<td className="px-4 py-3 text-right font-mono text-text-secondary">
												{centsToDollars(u.totalUsedCents)}
											</td>
											<td className="px-4 py-3 text-right font-mono font-semibold text-text-bright">
												{centsToDollars(u.balanceCents)}
											</td>
											<td className="px-4 py-3">
												<div className="flex items-center justify-center gap-1 max-w-[160px] mx-auto">
													<input
														type="number"
														step="0.1"
														min="0.01"
														placeholder="$5.00"
														aria-label={`Credit adjustment amount in USD for ${u.name || u.evmAddress || u.id}`}
														value={creditAdjustAmount[u.id] || ""}
														onChange={(e) => setCreditAdjustAmount((prev) => ({ ...prev, [u.id]: e.target.value }))}
														className="w-16 rounded-[var(--radius-sm)] border border-border bg-surface-elevated px-2 py-1 text-right text-xs focus:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
													/>
													<button
														type="button"
														disabled={updatingSettings}
														onClick={() => handleCreditAdjust(u.id, true)}
														className="rounded-[var(--radius-sm)] border border-success/30 bg-success/10 px-1.5 py-1 text-[10px] font-semibold text-success hover:bg-success/20"
													>
														+
													</button>
													<button
														type="button"
														disabled={updatingSettings}
														onClick={() => handleCreditAdjust(u.id, false)}
														className="rounded-[var(--radius-sm)] border border-error/30 bg-error/10 px-1.5 py-1 text-[10px] font-semibold text-error hover:bg-error/20"
													>
														-
													</button>
												</div>
											</td>
											<td className="px-4 py-3 text-right space-y-1.5">
												<div className="flex justify-end gap-1.5">
													<button
														type="button"
														disabled={updatingSettings}
														onClick={() => handleSuspendAction(u.id, !u.suspended)}
														title={u.suspended ? "Unsuspend user" : "Suspend user (revokes API keys)"}
														className={`inline-flex items-center gap-1 rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] font-medium border transition-colors duration-200 ease-out ${
															u.suspended
																? "bg-success/10 border-success/30 text-success hover:bg-success/20"
																: "bg-error/10 border-error/30 text-error hover:bg-error/20"
														}`}
													>
														{u.suspended ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
														{u.suspended ? "Unsuspend" : "Suspend"}
													</button>
													<button
														type="button"
														disabled={updatingSettings || loadingHistory}
														onClick={() => handleViewUserHistory(u.id)}
														className={`rounded-[var(--radius-sm)] px-2.5 py-1 text-[10px] font-medium border border-border bg-surface hover:bg-surface-elevated transition-colors duration-200 ease-out ${
															isTargetHistory ? "border-accent text-accent" : "text-text"
														}`}
													>
														History
													</button>
													{u.role !== "admin" && (
														<button
															type="button"
															disabled={updatingSettings || deletingUser}
															onClick={() => setDeleteUserModal({ userId: u.id, name: u.name || "this user" })}
															title="Anonymize account and revoke access"
															className="rounded-[var(--radius-sm)] border border-error/30 bg-error/5 px-2.5 py-1 text-[10px] font-medium text-error hover:bg-error/15 transition-colors duration-200 ease-out"
														>
															Delete
														</button>
													)}
												</div>
											</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Individual User History Portal */}
					{selectedUserId && (
						<div className="border-t border-border pt-4 mt-2 space-y-3">
							<div className="flex items-center justify-between">
								<h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-1.5">
									<ChevronRight className="w-3.5 h-3.5" />
									History logs for user: <span className="font-mono text-[10px] text-accent font-normal bg-accent/10 px-1.5 py-0.5 rounded-[var(--radius-sm)]">{selectedUserId}</span>
								</h3>
								<button
									type="button"
									onClick={() => {
										setSelectedUserId(null);
										setSelectedUserHistory(null);
									}}
									className="text-xs text-text-muted hover:text-text"
								>
									Close history
								</button>
							</div>

							{loadingHistory ? (
								<div className="flex items-center gap-1.5 text-xs text-text-muted py-2">
									<Loader2 className="h-3.5 w-3.5 animate-spin" /> Fetching logs...
								</div>
							) : selectedUserHistory === null || selectedUserHistory.length === 0 ? (
								<p className="text-xs text-text-muted py-2">
									No request history found for this user in the specified limit.
								</p>
							) : (
								<div className="overflow-x-auto max-h-[250px] overflow-y-auto rounded-[var(--radius-sm)] border border-border bg-panel/30">
									<table className="w-full text-[11px] text-left">
										<thead className="border-b border-border bg-surface-elevated/40 text-[9px] uppercase text-text-muted">
											<tr>
												<th className="p-2">When</th>
												<th className="p-2">Request ID</th>
												<th className="p-2">Model</th>
												<th className="p-2 text-right">Tokens</th>
												<th className="p-2 text-right">Cost</th>
												<th className="p-2">Status</th>
											</tr>
										</thead>
										<tbody>
											{selectedUserHistory.map((h) => (
												<tr key={h.id} className="border-b border-border/20 hover:bg-surface-elevated/10">
													<td className="p-2 text-text-muted">{timeAgo(h.createdAt)}</td>
													<td className="p-2 font-mono text-[9px] text-text-secondary">{h.requestId.slice(0, 16)}…</td>
													<td className="p-2 font-mono">{h.model}</td>
													<td className="p-2 text-right font-mono">
														{h.inputTokens.toLocaleString()}/{h.outputTokens.toLocaleString()}
													</td>
													<td className="p-2 text-right font-mono">{centsToDollars(Number(h.totalCents))}</td>
													<td className="p-2">
														<span className={`rounded-[var(--radius-sm)] px-1 py-0.2 text-[9px] ${
															h.status === "completed" || h.status === "free_tier"
																? "bg-accent/15 text-accent"
																: "bg-error/15 text-error"
														}`}>
															{h.status}
														</span>
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							)}
						</div>
					)}
					</>
					)}
				</section>

	);
}
