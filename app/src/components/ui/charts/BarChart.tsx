"use client";

import { format } from "date-fns";
import { m } from "@/lib/framer-motion-client";
import { useId } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartEmptyState, makeGradientId } from "./shared";

export interface CostData {
	date: string;
	cost: number;
}

interface BarChartComponentProps {
	data: CostData[];
	showCostLabels?: boolean;
}

const CustomTooltip = ({
	active,
	payload,
	label,
	showCost,
}: {
	active?: boolean;
	payload?: Array<{ value: number }>;
	label?: string;
	showCost?: boolean;
}) => {
	if (active && payload?.length) {
		return (
			<div className="rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-xl">
				<p className="text-xs text-text-muted">{label}</p>
				<p className="text-sm font-semibold text-amber">
					{showCost
						? `$${payload[0].value.toFixed(2)}`
						: payload[0].value.toLocaleString()}
				</p>
			</div>
		);
	}
	return null;
};

export function BarChartComponent({
	data,
	showCostLabels = true,
}: BarChartComponentProps) {
	// useId() must run unconditionally (Rules of Hooks) — call it before the
	// empty-state early return. Per-instance gradient id so multiple BarCharts
	// on the same page don't collide on `costGradient` (recharts shares the
	// DOM, and the second chart's `fill="url(#costGradient)"` would otherwise
	// resolve to the first chart's gradient).
	const instanceId = useId();
	const costGradientId = makeGradientId("costGradient", instanceId);

	if (data.length === 0) {
		return (
			<ChartEmptyState
				title="No cost data"
				description="Cost data will appear once you start making requests."
			/>
		);
	}
	const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
	const chartDescription = `Bar chart showing ${data.length} days of cost data. Total cost: $${totalCost.toFixed(2)}`;

	return (
		<m.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			className="h-[280px] w-full"
		>
			{/* minWidth={1} minHeight={1} silences recharts' "width(-1)/height(-1)
          should be greater than 0" warning on first paint (see AreaChart.tsx). */}
			<ResponsiveContainer
				width="100%"
				height="100%"
				minWidth={1}
				minHeight={1}
			>
				<BarChart
					data={data}
					margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
					role="img"
					aria-label={chartDescription}
				>
					<defs>
						<linearGradient id={costGradientId} x1="0" y1="0" x2="0" y2="1">
							<stop
								offset="5%"
								stopColor="var(--color-secondary)"
								stopOpacity={0.8}
							/>
							<stop
								offset="95%"
								stopColor="var(--color-secondary)"
								stopOpacity={0.2}
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
						stroke="var(--color-text-tertiary)"
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value) => format(new Date(value), "MMM d")}
					/>
					<YAxis
						stroke="var(--color-text-tertiary)"
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value) =>
							showCostLabels ? `$${value}` : value.toLocaleString()
						}
					/>
					<Tooltip
						content={<CustomTooltip showCost={showCostLabels} />}
						cursor={{ fill: "var(--color-surface-elevated)" }}
					/>
					<Bar
						dataKey="cost"
						fill={`url(#${costGradientId})`}
						radius={[4, 4, 0, 0]}
						animationDuration={1000}
					/>
				</BarChart>
			</ResponsiveContainer>
		</m.div>
	);
}
