"use client";

import { Download } from "lucide-react";
import dynamic from "next/dynamic";
import { formatUsd } from "@/lib/utils";
import type { ExportCSV, RevenueStats } from "./types";

const AdminRevenueChart = dynamic(
	() =>
		import("@/components/admin/AdminRevenueCharts").then((m) => ({
			default: m.AdminRevenueCharts,
		})),
	{ ssr: false },
);

export type AdminRevenueTabProps = {
	revenueStats: RevenueStats | null;
	revenuePeriod: string;
	setRevenuePeriod: (p: string) => void;
	exportCSV: ExportCSV;
};

const PERIOD_OPTIONS = ["7d", "30d", "90d", "all"] as const;

export default function AdminRevenueTab({
	revenueStats,
	revenuePeriod,
	setRevenuePeriod,
	exportCSV,
}: AdminRevenueTabProps) {
	return (
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<span className="text-xs text-text-muted font-mono uppercase tracking-wider">
					Period:
				</span>
				{PERIOD_OPTIONS.map((p) => (
					<button
						type="button"
						key={p}
						onClick={() => {
							setRevenuePeriod(p);
						}}
						className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
							revenuePeriod === p
								? "bg-accent-dim text-accent border border-accent/30"
								: "bg-surface text-text-muted border border-border hover:text-text"
						}`}
					>
						{p}
					</button>
				))}
			</div>

			{revenueStats && (
				<>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								Total Revenue
							</p>
							<p className="text-2xl font-bold font-mono text-success">
								{formatUsd(revenueStats.summary.totalRevenue)}
							</p>
						</div>
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								Total Deposits
							</p>
							<p className="text-2xl font-bold font-mono text-text-bright">
								{formatUsd(revenueStats.summary.totalDeposits)}
							</p>
							<p className="text-[10px] text-text-muted font-mono mt-1">
								{revenueStats.summary.depositCount} transactions
							</p>
						</div>
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								Gross Profit
							</p>
							<p className="text-2xl font-bold font-mono text-accent">
								{formatUsd(revenueStats.summary.grossProfit)}
							</p>
						</div>
						<div className="rounded border border-border bg-surface p-5">
							<p className="text-[11px] text-text-muted font-mono uppercase tracking-wider mb-2">
								New Users
							</p>
							<p className="text-2xl font-bold font-mono text-text-bright">
								{revenueStats.summary.newUsers.toLocaleString()}
							</p>
						</div>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<AdminRevenueChart
							monthlyRevenue={revenueStats?.monthlyRevenue}
						/>

						<div className="rounded border border-border bg-surface overflow-hidden">
							<div className="px-4 py-3 border-b border-border bg-panel flex items-center justify-between">
								<h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
									Monthly Breakdown
								</h3>
								<button
									type="button"
									onClick={() =>
										exportCSV(
											revenueStats.monthlyRevenue,
											`revenue-${revenuePeriod}`,
										)
									}
									className="flex items-center gap-2 px-3 py-1.5 rounded border border-border bg-surface text-text-muted hover:text-text text-[11px] font-mono"
								>
									<Download className="w-3 h-3" /> Export
								</button>
							</div>
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border bg-surface/50">
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted">
											Month
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Revenue
										</th>
										<th className="px-4 py-2 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right">
											Deposits
										</th>
									</tr>
								</thead>
								<tbody>
									{revenueStats.monthlyRevenue?.map((m) => (
										<tr
											key={m.month}
											className="border-b border-border/50"
										>
											<td className="px-4 py-2 font-medium text-text-bright text-sm">
												{m.month}
											</td>
											<td className="px-4 py-2 text-right font-mono text-success">
												{formatUsd(m.totalRevenue)}
											</td>
											<td className="px-4 py-2 text-right font-mono text-text-muted">
												{m.depositCount}
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