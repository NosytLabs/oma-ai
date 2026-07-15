"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { api } from "@/lib/api";
import { formatDateShort } from "@/lib/utils";

const PAGE_SIZE = 50;

export default function AdminAuditLogsTab() {
	const [userId, setUserId] = useState("");
	const [action, setAction] = useState("");
	const [resource, setResource] = useState("");
	const [startDate, setStartDate] = useState("");
	const [endDate, setEndDate] = useState("");
	const [offset, setOffset] = useState(0);

	const filters = useMemo(
		() => ({
			limit: PAGE_SIZE,
			offset,
			userId: userId || undefined,
			action: action || undefined,
			resource: resource || undefined,
			startDate: startDate || undefined,
			endDate: endDate || undefined,
		}),
		[userId, action, resource, startDate, endDate, offset],
	);

	const query = useQuery({
		queryKey: ["adminAuditLogs", filters],
		queryFn: () => api.admin.getAuditLogs(filters),
		staleTime: 15_000,
	});

	const logs = query.data?.logs ?? [];
	const total = query.data?.pagination.total ?? 0;
	const pages = Math.ceil(total / PAGE_SIZE) || 1;
	const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

	const resetFilters = () => {
		setUserId("");
		setAction("");
		setResource("");
		setStartDate("");
		setEndDate("");
		setOffset(0);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-end gap-3">
				<FilterInput label="User ID" value={userId} onChange={setUserId} />
				<FilterInput label="Action" value={action} onChange={setAction} />
				<FilterInput label="Resource" value={resource} onChange={setResource} />
				<div className="flex flex-col gap-1">
					<label className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
						Start
					</label>
					<input
						type="date"
						value={startDate}
						onChange={(e) => setStartDate(e.target.value)}
						className="px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-none focus:border-accent/50"
					/>
				</div>
				<div className="flex flex-col gap-1">
					<label className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
						End
					</label>
					<input
						type="date"
						value={endDate}
						onChange={(e) => setEndDate(e.target.value)}
						className="px-3 py-2 rounded border border-border bg-surface text-text text-sm focus:outline-none focus:border-accent/50"
					/>
				</div>
				<button
					type="button"
					onClick={resetFilters}
					className="px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono"
				>
					Clear
				</button>
				<button
					type="button"
					onClick={() => query.refetch()}
					className="flex items-center gap-2 px-3 py-2 rounded border border-border bg-surface text-text-muted hover:text-text text-sm font-mono"
				>
					<RefreshCw className="w-3.5 h-3.5" /> Refresh
				</button>
			</div>

			{query.isError && (
				<div className="rounded border border-error/30 bg-error-dim px-4 py-3 text-sm text-error font-mono">
					{(query.error as Error)?.message ?? "Failed to load audit logs"}
				</div>
			)}

			<div className="rounded border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-border bg-surface">
								<Th>Action</Th>
								<Th>Resource</Th>
								<Th>User</Th>
								<Th>IP</Th>
								<Th>Meta</Th>
								<Th>Date</Th>
							</tr>
						</thead>
						<tbody>
							{logs.map((log) => (
								<tr key={log.id} className="border-b border-border/50 hover:bg-surface/50">
									<td className="px-4 py-3 font-mono text-accent text-xs">{log.action}</td>
									<td className="px-4 py-3 font-mono text-text-secondary text-xs">
										{log.resource}
										{log.resourceId ? `:${log.resourceId.slice(0, 8)}` : ""}
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{log.userId ? log.userId.slice(0, 8) : "system"}
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{log.ipAddress ?? "—"}
									</td>
									<td
										className="px-4 py-3 font-mono text-text-muted text-xs max-w-[280px] truncate"
										title={log.metadata ? JSON.stringify(log.metadata) : ""}
									>
										{log.metadata ? JSON.stringify(log.metadata) : "—"}
									</td>
									<td className="px-4 py-3 font-mono text-text-muted text-xs">
										{formatDateShort(log.createdAt)}
									</td>
								</tr>
							))}
							{logs.length === 0 && !query.isLoading && (
								<tr>
									<td colSpan={6} className="px-4 py-8 text-center text-text-muted font-mono">
										No audit logs
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="flex items-center justify-between">
				<button
					type="button"
					onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
					disabled={currentPage <= 1}
					className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text disabled:opacity-30 text-sm font-mono"
				>
					Previous
				</button>
				<span className="text-xs text-text-muted font-mono">
					Page {currentPage} of {pages} · {total} total
				</span>
				<button
					type="button"
					onClick={() => setOffset(offset + PAGE_SIZE)}
					disabled={currentPage >= pages}
					className="px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text disabled:opacity-30 text-sm font-mono"
				>
					Next
				</button>
			</div>
		</div>
	);
}

function FilterInput({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	return (
		<div className="flex flex-col gap-1">
			<label className="text-[10px] font-mono uppercase tracking-wider text-text-muted">
				{label}
			</label>
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={label}
				className="w-40 px-3 py-2 rounded border border-border bg-surface text-text placeholder:text-text-muted text-sm focus:outline-none focus:border-accent/50"
			/>
		</div>
	);
}

function Th({ children }: { children: ReactNode }) {
	return (
		<th className="px-4 py-3 font-medium text-text-muted text-xs font-mono uppercase tracking-wider">
			{children}
		</th>
	);
}
