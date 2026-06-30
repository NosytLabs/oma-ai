"use client";

import { AlertTriangle, Key, RefreshCw } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { formatAddress, formatDateShort, formatUsd } from "@/lib/utils";
import { DataTable } from "./DataTable";
import { ExportButton } from "./ExportButton";

type ApiKey = {
	id: string;
	userId: string;
	userAddress: string;
	keyPrefix: string;
	name: string;
	active: boolean;
	createdAt: string;
	totalRequests: number;
	totalSpend: number;
	lastUsedAt: string | null;
};

type KeysTabProps = {
	apiKeys: ApiKey[];
	exportCSV: (data: unknown[], filename: string) => void;
	isLoading?: boolean;
	isError?: boolean;
	onRetry?: () => void;
};

function SkeletonRow({ cols }: { cols: number }) {
	return (
		<tr className="border-b border-border/50 animate-pulse">
			{Array.from({ length: cols }).map((_, j) => (
				<td key={j} className="px-4 py-3">
					<div
						className="h-4 bg-border rounded"
						style={{
							width: j === 4 || j === 5 ? "60%" : j === 0 ? "40%" : "70%",
						}}
					/>
				</td>
			))}
		</tr>
	);
}

export function KeysTab({
	apiKeys,
	exportCSV,
	isLoading,
	isError,
	onRetry,
}: KeysTabProps) {
	if (isError && apiKeys.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center py-16 gap-4">
				<div className="w-12 h-12 rounded-xl border border-error/30 bg-error/5 flex items-center justify-center">
					<AlertTriangle className="w-6 h-6 text-error" aria-hidden="true" />
				</div>
				<div className="text-center">
					<p className="text-sm font-semibold text-text-bright mb-1">
						Failed to load data
					</p>
					<p className="text-xs text-text-muted font-mono">
						An error occurred while fetching API keys.
					</p>
				</div>
				<button
					type="button"
					onClick={onRetry}
					className="flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-surface text-text-muted hover:text-text hover:border-border-bright transition-colors text-sm font-mono"
				>
					<RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
					Retry
				</button>
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-xs text-text-muted font-mono">
					<Key className="w-3.5 h-3.5" aria-hidden="true" />
					<span>{apiKeys.length} API keys</span>
				</div>
				{apiKeys.length > 0 && (
					<ExportButton onClick={() => exportCSV(apiKeys, "api-keys")} />
				)}
			</div>

			<DataTable>
				<table className="w-full text-left text-sm">
					<thead>
						<tr className="border-b border-border bg-panel">
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"
							>
								Key
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"
							>
								User
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"
							>
								Name
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"
							>
								Status
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right"
							>
								Requests
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right"
							>
								Total Spend
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"
							>
								Created
							</th>
							<th
								scope="col"
								className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"
							>
								Last Used
							</th>
						</tr>
					</thead>
					<tbody>
						{isLoading && apiKeys.length === 0 ? (
							Array.from({ length: 5 }).map((_, i) => (
								<SkeletonRow key={i} cols={8} />
							))
						) : apiKeys.length === 0 ? (
							<tr>
								<td colSpan={8} className="px-4 py-8 text-center">
									<EmptyState
										variant="table"
										icon={Key}
										title="No API keys found"
									/>
								</td>
							</tr>
						) : (
							apiKeys.map((key) => (
								<tr
									key={key.id}
									className="border-b border-border/50 hover:bg-surface/50"
								>
									<td className="px-4 py-3">
										<span className="font-mono text-sm text-accent">
											{key.keyPrefix}***
										</span>
									</td>
									<td className="px-4 py-3">
										<span className="font-mono text-sm text-text-secondary">
											{formatAddress(key.userAddress)}
										</span>
									</td>
									<td className="px-4 py-3 text-text-secondary text-sm">
										{key.name}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
												key.active
													? "bg-success-dim text-success"
													: "bg-surface text-text-muted"
											}`}
										>
											{key.active ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-3 text-right font-mono text-text-muted">
										{key.totalRequests.toLocaleString()}
									</td>
									<td className="px-4 py-3 text-right font-mono text-amber">
										{formatUsd(key.totalSpend)}
									</td>
									<td className="px-4 py-3 text-text-muted font-mono text-xs">
										{formatDateShort(key.createdAt)}
									</td>
									<td className="px-4 py-3 text-text-muted font-mono text-xs">
										{key.lastUsedAt ? formatDateShort(key.lastUsedAt) : "Never"}
									</td>
								</tr>
							))
						)}
					</tbody>
				</table>
			</DataTable>
		</div>
	);
}
