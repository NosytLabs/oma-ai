"use client";

import { AlertTriangle, Download, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { formatUsd } from "@/lib/utils";
import { StatCard } from "./StatCard";

const AdminRevenueChart = dynamic(
	() =>
		import("@/components/admin/AdminRevenueCharts").then((m) => ({
			default: m.AdminRevenueCharts,
		})),
	{ ssr: false },
);

type RevenueStats = {
	period: string;
	summary: {
		totalRevenue: number;
		totalCost: number;
		grossProfit: number;
		totalDeposits: number;
		depositCount: number;
		newUsers: number;
	};
	monthlyRevenue: Array<{
		month: string;
		totalRevenue: number;
		depositCount: number;
	}>;
	dailyRevenue?: Array<{ date: string; revenue: number; cost: number }>;
};

type RevenueTabProps = {
	revenueStats: RevenueStats | null;
	revenuePeriod: string;
	setRevenuePeriod: (period: string) => void;
	exportCSV: (data: unknown[], filename: string) => void;
	isError?: boolean;
	onRetry?: () => void;
};

export function RevenueTab({
	revenueStats,
	revenuePeriod,
	setRevenuePeriod,
	exportCSV,
	isError,
	onRetry,
}: RevenueTabProps) {
	if (isError && !revenueStats) {
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
						An error occurred while fetching revenue statistics.
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
		<div className="space-y-6">
			<div className="flex items-center gap-4">
				<span className="text-xs text-text-muted font-mono uppercase tracking-wider">
					Period:
				</span>
				{["7d", "30d", "90d", "all"].map((p) => (
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

			{!revenueStats ? (
				<>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						{Array.from({ length: 4 }).map((_, i) => (
							<div
								key={i}
								className="rounded border border-border bg-surface p-5 animate-pulse"
							>
								<div className="h-3 w-20 bg-border rounded mb-3" />
								<div className="h-7 w-24 bg-border rounded" />
							</div>
						))}
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<div className="rounded border border-border bg-surface p-5 animate-pulse">
							<div className="h-48 bg-border rounded" />
						</div>
						<div className="rounded border border-border bg-surface overflow-hidden animate-pulse">
							<div className="px-4 py-3 border-b border-border bg-panel">
								<div className="h-4 w-32 bg-border rounded" />
							</div>
							<div className="p-4 space-y-3">
								{Array.from({ length: 4 }).map((_, ri) => (
									<div key={ri} className="h-6 bg-border rounded" />
								))}
							</div>
						</div>
					</div>
				</>
			) : (
				<>
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<StatCard
							className="p-5"
							label="Total Revenue"
							value={formatUsd(revenueStats.summary.totalRevenue)}
							valueClassName="text-success"
						/>
						<StatCard
							className="p-5"
							label="Total Deposits"
							value={formatUsd(revenueStats.summary.totalDeposits)}
							subtitle={`${revenueStats.summary.depositCount} transactions`}
						/>
						<StatCard
							className="p-5"
							label="Gross Profit"
							value={formatUsd(revenueStats.summary.grossProfit)}
							valueClassName="text-accent"
						/>
						<StatCard
							className="p-5"
							label="New Users"
							value={revenueStats.summary.newUsers.toLocaleString()}
						/>
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
						<AdminRevenueChart monthlyRevenue={revenueStats?.monthlyRevenue} />

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
									<Download className="w-3 h-3" aria-hidden="true" /> Export
								</button>
							</div>
							<table className="w-full text-left text-sm">
								<thead>
									<tr className="border-b border-border bg-panel">
										<th
											scope="col"
											className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted"
										>
											Month
										</th>
										<th
											scope="col"
											className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right"
										>
											Revenue
										</th>
										<th
											scope="col"
											className="px-4 py-3 text-[11px] font-mono uppercase tracking-wider text-text-muted text-right"
										>
											Deposits
										</th>
									</tr>
								</thead>
								<tbody>
									{revenueStats.monthlyRevenue?.map((m) => (
										<tr
											key={m.month}
											className="border-b border-border/50 hover:bg-surface/50"
										>
											<td className="px-4 py-3 font-medium text-text-bright text-sm">
												{m.month}
											</td>
											<td className="px-4 py-3 text-right font-mono text-success">
												{formatUsd(m.totalRevenue)}
											</td>
											<td className="px-4 py-3 text-right font-mono text-text-muted">
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
