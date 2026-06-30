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
	return (
		<div className="rounded border border-border bg-surface p-5">
			<h3 className="text-xs font-bold font-mono uppercase tracking-wider text-text-secondary mb-4">
				Revenue Chart
			</h3>
			<div className="h-[260px]">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart data={monthlyRevenue?.slice(-12)}>
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
							formatter={(value) => [`${Number(value).toFixed(2)}`, "Revenue"]}
						/>
						<Bar
							dataKey="totalRevenue"
							fill="var(--color-accent)"
							radius={[4, 4, 0, 0]}
						/>
					</BarChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
