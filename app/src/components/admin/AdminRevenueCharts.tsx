"use client";

import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartEmptyState } from "@/components/ui/charts/shared";

interface MonthlyRevenue {
	month: string;
	totalRevenue: number;
	depositCount: number;
}

export function AdminRevenueCharts({
	monthlyRevenue,
}: {
	monthlyRevenue: MonthlyRevenue[] | undefined;
}) {
	const data = monthlyRevenue?.slice(-12) ?? [];
	return (
		<div className="rounded border border-border bg-surface p-5">
			<h3 className="text-xs font-bold font-mono uppercase tracking-wider text-text-secondary mb-4">
				Revenue Chart
			</h3>
			<div className="h-[260px]">
				{data.length === 0 ? (
					<ChartEmptyState title="No revenue data yet" />
				) : (
				<ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
					<BarChart
						data={data}
						role="img"
						aria-label="Bar chart of monthly revenue for the last 12 months"
					>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="var(--color-border)"
							vertical={false}
						/>
						<XAxis
							dataKey="month"
							stroke="var(--color-text-secondary)"
							fontSize={10}
							tickLine={false}
							axisLine={false}
						/>
						<YAxis
							stroke="var(--color-text-secondary)"
							fontSize={10}
							tickLine={false}
							axisLine={false}
							tickFormatter={(value) => `$${value}`}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: "var(--color-panel)",
								border: "1px solid var(--color-border)",
								borderRadius: "6px",
								fontSize: "11px",
							}}
							formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
						/>
						<Bar
							dataKey="totalRevenue"
							fill="var(--color-accent)"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
				)}
			</div>
		</div>
	);
}
