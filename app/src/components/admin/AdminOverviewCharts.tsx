"use client";

import { format } from "date-fns";
import dynamic from "next/dynamic";

const AdminOverviewRevenueChart = dynamic(
	() =>
		import("./AdminOverviewRevenueChart").then(
			(m) => m.AdminOverviewRevenueChart,
		),
	{
		ssr: false,
		loading: () => (
			<div className="h-[280px] animate-pulse rounded-xl border border-border bg-surface/50" />
		),
	},
);

interface ChartDataPoint {
	date: string;
	revenue: number;
	cost: number;
}

interface DailyUsage {
	date: string;
	totalRequests: number;
	totalRevenue: number;
}

interface AdminOverviewChartsProps {
	chartData: ChartDataPoint[];
	dailyUsage: DailyUsage[] | undefined;
}

export function AdminOverviewCharts({
	chartData,
	dailyUsage,
}: AdminOverviewChartsProps) {
	return (
		<>
			<AdminOverviewRevenueChart chartData={chartData} />

			<div className="rounded-xl border border-border overflow-hidden">
				<div className="px-4 py-3 border-b border-border bg-surface/50 flex items-center justify-between">
					<h3 className="font-medium text-text-bright">Daily Revenue</h3>
				</div>
				<div className="divide-y divide-border/50">
					{dailyUsage && dailyUsage.length > 0 ? (
						dailyUsage
							.slice(-10)
							.reverse()
							.map((day) => (
								<div
									key={day.date}
									className="px-4 py-3 flex items-center justify-between"
								>
									<div>
										<p className="text-sm text-text-bright">
											{format(new Date(day.date), "MMM d, yyyy")}
										</p>
										<p className="text-xs text-text-muted">
											{day.totalRequests.toLocaleString()} requests
										</p>
									</div>
									<p className="text-sm font-mono text-accent">
										${day.totalRevenue.toFixed(2)}
									</p>
								</div>
							))
					) : (
						<div className="px-4 py-8 text-center text-text-muted">
							No revenue recorded yet
						</div>
					)}
				</div>
			</div>
		</>
	);
}
