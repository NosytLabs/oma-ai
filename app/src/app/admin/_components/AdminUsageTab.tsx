"use client";

import { Download } from "lucide-react";
import { formatUsd } from "@/lib/utils";
import type { ExportCSV, UsageStats } from "./types";

export type AdminUsageTabProps = {
	usageStats: UsageStats | null;
	usagePeriod: string;
	setUsagePeriod: (p: string) => void;
	exportCSV: ExportCSV;
};

const PERIOD_OPTIONS = ["7d", "30d", "90d"] as const;

export default function AdminUsageTab({
	usageStats,
	usagePeriod,
	setUsagePeriod,
	exportCSV,
}: AdminUsageTabProps) {
	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<span className="text-xs text-text-muted font-mono uppercase tracking-wider">
						Period:
					</span>
					{PERIOD_OPTIONS.map((p) => (
						<button
							type="button"
							key={p}
							onClick={() => {
								setUsagePeriod(p);
							}}
							className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
								usagePeriod === p
									? "bg-accent-dim text-accent border border-accent/30"
									: "bg-surface text-text-muted border border-border hover:text-text"
							}`}
						>
							{p}
						</button>
					))}
				</div>
				{usageStats && (
					<button
						type="button"
						onClick={() =>
							exportCSV(usageStats.dailyUsage, `usage-${usagePeriod}`)
						}
						className="flex items-center gap-2 px-4 py-2 rounded border border-border bg-surface text-text-secondary hover:text-text text-sm font-mono transition-colors"
					>
						<Download className="w-3.5 h-3.5" /> Export CSV
					</button>
				)}
			</div>

			{usageStats && (
				<>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								Total Requests
							</p>
							<p className="text-2xl font-bold font-mono text-text-bright">
								{usageStats.summary.totalRequests.toLocaleString()}
							</p>
						</div>
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								Total Revenue
							</p>
							<p className="text-2xl font-bold font-mono text-success">
								{formatUsd(usageStats.summary.totalRevenue)}
							</p>
						</div>
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								Total Cost
							</p>
							<p className="text-2xl font-bold font-mono text-amber">
								{formatUsd(usageStats.summary.totalCost)}
							</p>
						</div>
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								Gross Profit
							</p>
							<p className="text-2xl font-bold font-mono text-accent">
								{formatUsd(usageStats.summary.grossProfit)}
							</p>
							<p className="text-[10px] text-text-muted font-mono mt-1">
								Margin: {usageStats.summary.margin}
							</p>
						</div>
					</div>

					<div className="rounded border border-border bg-surface overflow-hidden">
						<div className="px-4 py-3 border-b border-border bg-panel">
							<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
								By Provider
							</h3>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border bg-surface/50">
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Provider
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Requests
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Revenue
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Cost
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Profit
										</th>
									</tr>
								</thead>
								<tbody>
									{usageStats.byProvider.map((p) => (
										<tr
											key={p.provider}
											className="border-b border-border/50"
										>
											<td className="px-4 py-2 font-medium text-text-bright capitalize text-sm">
												{p.provider}
											</td>
											<td className="px-4 py-2 text-right font-mono text-text-muted">
												{p.totalRequests.toLocaleString()}
											</td>
											<td className="px-4 py-2 text-right font-mono text-success">
												{formatUsd(p.totalRevenue)}
											</td>
											<td className="px-4 py-2 text-right font-mono text-amber">
												{formatUsd(p.totalCost)}
											</td>
											<td className="px-4 py-2 text-right font-mono text-accent">
												{formatUsd(p.profit)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>

					<div className="rounded border border-border bg-surface overflow-hidden">
						<div className="px-4 py-3 border-b border-border bg-panel">
							<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
								Top Models
							</h3>
						</div>
						<div className="overflow-x-auto">
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border bg-surface/50">
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Model
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Requests
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Input Tokens
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Output Tokens
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Revenue
										</th>
									</tr>
								</thead>
								<tbody>
									{usageStats.byModel.map((m) => (
										<tr
											key={m.model}
											className="border-b border-border/50"
										>
											<td className="px-4 py-2">
												<div className="font-mono text-sm text-text-bright">
													{m.model}
												</div>
												<div className="text-[10px] text-text-muted capitalize">
													{m.provider}
												</div>
											</td>
											<td className="px-4 py-2 text-right font-mono text-text-muted">
												{m.totalRequests.toLocaleString()}
											</td>
											<td className="px-4 py-2 text-right font-mono text-text-muted">
												{m.totalInputTokens.toLocaleString()}
											</td>
											<td className="px-4 py-2 text-right font-mono text-text-muted">
												{m.totalOutputTokens.toLocaleString()}
											</td>
											<td className="px-4 py-2 text-right font-mono text-success">
												{formatUsd(m.totalRevenue)}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				</>
			)}
		</div>
	);
}