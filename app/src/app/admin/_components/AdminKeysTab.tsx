"use client";

import { Download, Key } from "lucide-react";
import { formatAddress, formatDateShort, formatUsd } from "@/lib/utils";
import type { ApiKey, ExportCSV } from "./types";

export type AdminKeysTabProps = {
	apiKeys: ApiKey[];
	exportCSV: ExportCSV;
};

export default function AdminKeysTab({
	apiKeys,
	exportCSV,
}: AdminKeysTabProps) {
	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-xs text-text-muted font-mono">
					<Key className="w-3.5 h-3.5" />
					<span>{apiKeys.length} API keys</span>
				</div>
				<button
					type="button"
					onClick={() => exportCSV(apiKeys, "api-keys")}
					className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text text-sm font-mono transition-colors"
				>
					<Download className="w-3.5 h-3.5" /> Export CSV
				</button>
			</div>

			<div className="rounded border border-border bg-surface overflow-hidden">
				<div className="overflow-x-auto">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-b border-border bg-panel">
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
									Key
								</th>
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
									User
								</th>
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
									Name
								</th>
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
									Status
								</th>
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
									Requests
								</th>
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
									Total Spend
								</th>
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
									Created
								</th>
								<th className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted">
									Last Used
								</th>
							</tr>
						</thead>
						<tbody>
							{apiKeys.map((key) => (
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
										{key.lastUsedAt
											? formatDateShort(key.lastUsedAt)
											: "Never"}
									</td>
								</tr>
							))}
							{apiKeys.length === 0 && (
								<tr>
									<td
										colSpan={8}
										className="px-4 py-8 text-center text-text-muted font-mono"
									>
										No API keys found
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}