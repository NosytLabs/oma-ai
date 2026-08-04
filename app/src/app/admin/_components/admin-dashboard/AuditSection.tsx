"use client";

import {
	ChevronLeft,
	ChevronRight,
	Filter,
	Loader2,
} from "lucide-react";
import { AUDIT_ACTIONS } from "./types";
import { timeAgo } from "./api";

import { useAdminDashboard } from "./context";

export function AuditSection() {
	const {
		auditEntries,
		auditFilters,
		setAuditFilters,
		auditLoading,
		loadAudit,
		handleAuditPrev,
		auditCursor,
		auditCursorStack,
	} = useAdminDashboard();

	return (
			<section className="rounded-lg border border-border bg-surface-elevated/30 p-4 space-y-3">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<div>
						<h2 className="text-sm font-medium uppercase tracking-wide text-text-muted">
							Audit Log
						</h2>
						<p className="text-xs text-text-muted mt-0.5">
							Filterable, paginated view of every admin and operator action.
						</p>
					</div>
					<button
						type="button"
						onClick={() => void loadAudit(null, false)}
						disabled={auditLoading}
						className="inline-flex items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface disabled:opacity-50"
					>
						{auditLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Filter className="h-3 w-3" />}
						Load
					</button>
				</div>
				<div className="grid gap-2 sm:grid-cols-4">
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							Action
						</label>
						<select
							value={auditFilters.action}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, action: e.target.value }))
							}
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						>
							<option value="">All actions</option>
							{AUDIT_ACTIONS.map((a) => (
								<option key={a} value={a}>
									{a}
								</option>
							))}
						</select>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							User ID
						</label>
						<input
							type="text"
							value={auditFilters.userId}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, userId: e.target.value }))
							}
							placeholder="usr_xxx"
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							From
						</label>
						<input
							type="datetime-local"
							value={auditFilters.from}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, from: e.target.value }))
							}
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						/>
					</div>
					<div>
						<label className="mb-1 block text-[10px] uppercase tracking-wide text-text-muted">
							To
						</label>
						<input
							type="datetime-local"
							value={auditFilters.to}
							onChange={(e) =>
								setAuditFilters((prev) => ({ ...prev, to: e.target.value }))
							}
							className="w-full rounded border border-border bg-surface-elevated px-2 py-1 text-xs outline-none focus:border-accent"
						/>
					</div>
				</div>

				{auditEntries ? (
					<div className="overflow-x-auto max-h-[420px] overflow-y-auto rounded border border-border">
						<table className="w-full text-[11px] text-left">
							<thead className="border-b border-border bg-surface-elevated/40 text-[9px] uppercase text-text-muted sticky top-0">
								<tr>
									<th className="p-2">When</th>
									<th className="p-2">Action</th>
									<th className="p-2">Resource</th>
									<th className="p-2">User</th>
									<th className="p-2">Metadata</th>
								</tr>
							</thead>
							<tbody>
								{auditEntries.data.length === 0 ? (
									<tr>
										<td colSpan={5} className="p-3 text-center text-text-muted">
											No audit entries match these filters.
										</td>
									</tr>
								) : (
									auditEntries.data.map((entry) => (
										<tr
											key={entry.id}
											className="border-b border-border/20 hover:bg-surface-elevated/10"
										>
											<td className="p-2 text-text-muted">{timeAgo(entry.createdAt)}</td>
											<td className="p-2">
												<span className="rounded bg-surface-elevated px-1.5 py-0.5 font-mono text-[10px]">
													{entry.action}
												</span>
											</td>
											<td className="p-2 font-mono text-text-secondary">
												{entry.resource}
												{entry.resourceId ? (
													<span className="ml-1 text-text-muted">
														· {entry.resourceId.slice(0, 12)}…
													</span>
												) : null}
											</td>
											<td className="p-2 font-mono text-text-muted">
												{entry.userId ? entry.userId.slice(0, 12) + "…" : "—"}
											</td>
											<td className="p-2 font-mono text-[10px] text-text-muted truncate max-w-[280px]">
												{entry.metadata
													? JSON.stringify(entry.metadata).slice(0, 80) +
													  (JSON.stringify(entry.metadata).length > 80 ? "…" : "")
													: "—"}
											</td>
										</tr>
									))
								)}
							</tbody>
						</table>
					</div>
				) : (
					<p className="text-xs text-text-muted py-3">
						Click <span className="font-mono">Load</span> to fetch audit entries.
					</p>
				)}

				{auditEntries && (
					<div className="flex items-center justify-between text-xs text-text-muted">
						<span>
							{auditEntries.count} entries
							{auditEntries.filters.action ? ` · action: ${auditEntries.filters.action}` : ""}
							{auditEntries.filters.userId ? ` · user: ${auditEntries.filters.userId.slice(0, 12)}…` : ""}
						</span>
						<div className="flex items-center gap-2">
							<button
								type="button"
								onClick={() => void handleAuditPrev()}
								disabled={auditCursorStack.length === 0 || auditLoading}
								className="inline-flex items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface disabled:opacity-30"
							>
								<ChevronLeft className="h-3 w-3" /> Prev
							</button>
							<button
								type="button"
								onClick={() => void loadAudit(auditCursor, true)}
								disabled={!auditCursor || auditLoading}
								className="inline-flex items-center gap-1 rounded border border-border bg-surface-elevated px-2 py-1 text-xs hover:bg-surface disabled:opacity-30"
							>
								Next <ChevronRight className="h-3 w-3" />
							</button>
						</div>
					</div>
				)}
			</section>

	);
}
