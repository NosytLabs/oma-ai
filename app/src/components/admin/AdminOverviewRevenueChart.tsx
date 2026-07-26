"use client";

import { format } from "date-fns";
import { useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartEmptyState, makeGradientId } from "@/components/ui/charts/shared";

interface ChartDataPoint {
	date: string;
	revenue: number;
	cost: number;
}

interface AdminOverviewRevenueChartProps {
	chartData: ChartDataPoint[];
}

export function AdminOverviewRevenueChart({
	chartData,
}: AdminOverviewRevenueChartProps) {
	const gradientId = makeGradientId("adminRevenue", useId());
	return (
		<div className="rounded-xl border border-border bg-surface/50 p-5">
			<h3 className="text-sm font-medium text-text-bright mb-4">
				Revenue Overview
			</h3>
			<div className="h-[280px]">
				{chartData.length === 0 ? (
					<ChartEmptyState title="No revenue data yet" />
				) : (
				<ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
					<AreaChart
						data={chartData.slice(-30)}
						role="img"
						aria-label="Area chart of daily revenue over the last 30 days"
					>
						<defs>
							<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-accent)"
									stopOpacity={0.3}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-accent)"
									stopOpacity={0}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid
							strokeDasharray="3 3"
							stroke="var(--color-border)"
							vertical={false}
						/>
						<XAxis
							dataKey="date"
							stroke="var(--color-text-secondary)"
							fontSize={11}
							tickLine={false}
							axisLine={false}
							tickFormatter={(value) => {
								const d = new Date(value);
								return format(d, "MMM d");
							}}
						/>
						<YAxis
							stroke="var(--color-text-secondary)"
							fontSize={11}
							tickLine={false}
							axisLine={false}
							tickFormatter={(value) => `$${value}`}
						/>
						<Tooltip
							contentStyle={{
								backgroundColor: "var(--color-panel)",
								border: "1px solid var(--color-border)",
								borderRadius: "8px",
								fontSize: "12px",
							}}
							formatter={(value) => [`$${Number(value).toFixed(2)}`, "Revenue"]}
						/>
						<Area
							type="monotone"
							dataKey="revenue"
							stroke="var(--color-accent)"
							fill={`url(#${gradientId})`}
							strokeWidth={2}
						/>
					</AreaChart>
				</ResponsiveContainer>
				)}
			</div>
		</div>
	);
}
