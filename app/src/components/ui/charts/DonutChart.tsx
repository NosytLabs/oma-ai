"use client";

import { m } from "@/lib/framer-motion-client";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { formatUsd } from "@/lib/utils";
import { ChartEmptyState } from "./shared";

export interface ModelData {
	name: string;
	value: number;
	color: string;
}

interface DonutChartProps {
	data: ModelData[];
	label?: string;
	/** When true (default), values are USD costs and render with `$`. */
	currency?: boolean;
}

function formatValue(value: number, currency: boolean): string {
	if (currency) return formatUsd(value);
	return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const CustomTooltip = ({
	active,
	payload,
	currency,
}: {
	active?: boolean;
	payload?: Array<{ payload: ModelData }>;
	currency?: boolean;
}) => {
	if (active && payload?.length) {
		const data = payload[0].payload;
		return (
			<div className="rounded-lg border border-border bg-surface/95 px-3 py-2 shadow-xl">
				<p className="text-xs text-text-muted">{data.name}</p>
				<p className="text-sm font-semibold text-text-bright">
					{formatValue(data.value, currency ?? true)}
				</p>
			</div>
		);
	}
	return null;
};

export function DonutChart({
	data,
	label = "Total",
	currency = true,
}: DonutChartProps) {
	const total = data.reduce((sum, item) => sum + item.value, 0);
	if (data.length === 0 || total === 0) {
		return (
			<div className="relative h-[280px] w-full">
				<ChartEmptyState />
			</div>
		);
	}
	const chartDescription = `Donut chart showing ${data.map((d) => `${d.name}: ${formatValue(d.value, currency)}`).join(", ")}. Total: ${formatValue(total, currency)}`;

	return (
		<m.div
			initial={{ opacity: 0, scale: 0.9 }}
			animate={{ opacity: 1, scale: 1 }}
			className="relative h-[280px] w-full"
		>
			<ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
				<PieChart role="img" aria-label={chartDescription}>
					<Pie
						data={data}
						cx="50%"
						cy="50%"
						innerRadius={70}
						outerRadius={110}
						paddingAngle={2}
						dataKey="value"
						animationDuration={800}
					>
						{data.map((entry, index) => (
							<Cell key={`cell-${entry.name}-${index}`} fill={entry.color} />
						))}
					</Pie>
					<Tooltip content={<CustomTooltip currency={currency} />} />
				</PieChart>
			</ResponsiveContainer>
			<div
				aria-hidden="true"
				className="absolute inset-0 flex flex-col items-center justify-center"
			>
				<span className="text-3xl font-bold text-text-bright">
					{formatValue(total, currency)}
				</span>
				<span className="text-xs text-text-muted uppercase tracking-wider">
					{label}
				</span>
			</div>
		</m.div>
	);
}
