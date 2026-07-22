"use client";

import { format, parse } from "date-fns";
import { m } from "framer-motion";
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
import { ChartEmptyState, makeGradientId } from "./shared";

/** Parse chart day keys (YYYY-MM-DD) as local dates — avoids UTC day-shift. */
function formatChartDay(value: string, pattern: string): string {
	try {
		const d = parse(value, "yyyy-MM-dd", new Date());
		if (Number.isNaN(d.getTime())) return value;
		return format(d, pattern);
	} catch {
		return value;
	}
}

export interface DataPoint {
	date: string;
	requests: number;
	cost: number;
}

interface AreaChartComponentProps {
	data: DataPoint[];
	showCostArea?: boolean;
}

const CustomTooltip = ({
	active,
	payload,
	label,
	showCost,
}: {
	active?: boolean;
	payload?: Array<{ value: number; dataKey?: string }>;
	label?: string;
	showCost?: boolean;
}) => {
	if (active && payload?.length) {
		const requestEntry = payload.find((p) => p.dataKey === "requests");
		const costEntry = showCost
			? payload.find((p) => p.dataKey === "cost")
			: undefined;
		return (
			<div className="rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-xl">
				<p className="text-xs text-text-muted">{label}</p>
				{requestEntry && (
					<p className="text-sm font-semibold text-accent">
						{requestEntry.value.toLocaleString()} requests
					</p>
				)}
				{costEntry && (
					<p className="text-sm font-semibold text-secondary">
						${costEntry.value.toFixed(2)}
					</p>
				)}
			</div>
		);
	}
	return null;
};

export function AreaChartComponent({
	data,
	showCostArea = true,
}: AreaChartComponentProps) {
	// useId() must run unconditionally (Rules of Hooks) — call it before the
	// empty-state early return. Per-instance gradient ids so multiple AreaCharts
	// on the same page don't collide on `colorRequests`/`colorCost` (recharts
	// shares the DOM, and the second chart's `fill="url(#colorRequests)"`
	// would otherwise resolve to the first chart's gradient).
	const instanceId = useId();
	const requestsGradientId = makeGradientId("colorRequests", instanceId);
	const costGradientId = makeGradientId("colorCost", instanceId);

	if (data.length === 0) {
		return (
			<ChartEmptyState
				title="No usage data"
				description="Usage data will appear once you start making requests."
			/>
		);
	}
	const totalRequests = data.reduce((sum, d) => sum + d.requests, 0);
	const totalCost = data.reduce((sum, d) => sum + d.cost, 0);
	const chartDescription = `Area chart showing ${data.length} days of usage data. Total requests: ${totalRequests.toLocaleString()}. Total cost: $${totalCost.toFixed(2)}`;

	return (
		<m.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			className="h-[300px] w-full"
		>
			{/* minWidth={1} minHeight={1} silences recharts' "width(-1)/height(-1)
          should be greater than 0" warning that fires when the parent has
          not yet been measured (first paint + initial ResizeObserver tick).
          Setting 0 is rejected by recharts; 1 is the lowest accepted value. */}
			<ResponsiveContainer
				width="100%"
				height="100%"
				minWidth={1}
				minHeight={1}
			>
				<AreaChart
					data={data}
					margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
					role="img"
					aria-label={chartDescription}
				>
					<defs>
						<linearGradient id={requestsGradientId} x1="0" y1="0" x2="0" y2="1">
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
						{showCostArea && (
							<linearGradient id={costGradientId} x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-secondary)"
									stopOpacity={0.3}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-secondary)"
									stopOpacity={0}
								/>
							</linearGradient>
						)}
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
						tickFormatter={(value) => formatChartDay(String(value), "EEE")}
					/>
					<YAxis
						stroke="var(--color-text-tertiary)"
						fontSize={11}
						tickLine={false}
						axisLine={false}
						tickFormatter={(value) =>
							value >= 1000
								? `${(value / 1000).toFixed(0)}k`
								: value.toLocaleString()
						}
					/>
					<Tooltip content={<CustomTooltip showCost={showCostArea} />} />
					<Area
						type="monotone"
						dataKey="requests"
						stroke="var(--color-accent)"
						strokeWidth={2}
						fill={`url(#${requestsGradientId})`}
						animationDuration={1000}
					/>
					{showCostArea && (
						<Area
							type="monotone"
							dataKey="cost"
							stroke="var(--color-secondary)"
							strokeWidth={2}
							fill={`url(#${costGradientId})`}
							animationDuration={1000}
						/>
					)}
				</AreaChart>
			</ResponsiveContainer>
		</m.div>
	);
}
