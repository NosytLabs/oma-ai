"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import dynamic from "next/dynamic";
import type { DataPoint } from "@/components/ui/charts/AreaChart";
import type { ModelData } from "@/components/ui/charts/DonutChart";

const AreaChartComponent = dynamic(
	() => import("@/components/ui/charts").then((m) => m.AreaChartComponent),
	{
		ssr: false,
		loading: () => <div className="h-48 animate-pulse bg-surface" />,
	},
);

const DonutChart = dynamic(
	() => import("@/components/ui/charts").then((m) => m.DonutChart),
	{
		ssr: false,
		loading: () => <div className="h-48 animate-pulse bg-surface" />,
	},
);

interface UsageChartProps {
	usageData: DataPoint[];
	modelData: ModelData[];
	timeRange?: string;
}

const TIME_LABELS: Record<string, string> = {
	"24h": "24 hours",
	"7d": "7 days",
	"30d": "30 days",
	all: "all time",
};

export function UsageChart({
	usageData,
	modelData,
	timeRange = "7d",
}: UsageChartProps) {
	const hasUsageData = usageData.length > 0;
	const hasModelData = modelData.length > 0;
	const areaLabel = buildAreaLabel(usageData, timeRange);
	const donutLabel = buildDonutLabel(modelData);

	return (
		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			<m.div
				className="bg-[var(--color-surface)]/30 border border-[var(--color-border)] p-6 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative overflow-hidden h-full transition-[border-color,background-color] hover:border-[var(--color-accent)]/40 hover:bg-[var(--color-surface)]/50"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...springs.card, delay: 0.3 }}
			>
				{/* Accent glow on top edge */}
				<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-accent)]/40 to-transparent" />
				<div className="flex items-center justify-between mb-6">
					<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight">
						Usage ({TIME_LABELS[timeRange] || timeRange})
					</h3>
				</div>
				{hasUsageData ? (
					<div role="img" aria-label={areaLabel} className="bg-[var(--color-void)] p-4 rounded-[var(--radius-md)] border border-[var(--color-border)]/50">
						<AreaChartComponent data={usageData} />
					</div>
				) : (
					<div
						role="img"
						aria-label="Usage chart placeholder. No data yet."
						className="flex flex-col items-center justify-center h-48 border border-dashed border-[var(--color-border)]/60 rounded-[var(--radius-md)] bg-[var(--color-void)] px-6 text-center"
					>
						<p className="text-[13.5px] font-semibold text-text-secondary">No usage data yet</p>
						<p className="mt-2 text-[11px] font-mono text-text-muted">
							Start making API calls to see your activity here.
						</p>
					</div>
				)}
			</m.div>

			<m.div
				className="bg-[var(--color-surface)]/30 border border-[var(--color-border)] p-6 rounded-[var(--radius-xl)] shadow-[var(--shadow-md)] relative overflow-hidden h-full transition-[border-color,background-color] hover:border-[var(--color-tertiary)]/40 hover:bg-[var(--color-surface)]/50"
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...springs.card, delay: 0.4 }}
			>
				{/* Accent glow on top edge */}
				<div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--color-tertiary)]/40 to-transparent" />
				<div className="flex items-center justify-between mb-6">
					<h3 className="text-[14.5px] font-bold text-text-bright tracking-tight">
						Model Breakdown
					</h3>
				</div>
				{hasModelData ? (
					<div role="img" aria-label={donutLabel} className="flex flex-col h-[calc(100%-2rem)]">
						<div className="bg-[var(--color-void)] p-4 rounded-[var(--radius-md)] border border-[var(--color-border)]/50 flex-1">
							<DonutChart data={modelData} />
						</div>
						<div className="mt-5 flex flex-wrap gap-3 p-3 bg-[var(--color-surface-elevated)] rounded-[var(--radius-md)] border border-[var(--color-border)]/50 justify-center">
							{modelData.map((model) => (
								<div key={model.name} className="flex items-center gap-2">
									<div
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: model.color }}
										aria-hidden="true"
									/>
									<span className="text-[11px] font-mono text-text-secondary">{model.name}</span>
								</div>
							))}
						</div>
					</div>
				) : (
					<div
						role="img"
						aria-label="Model breakdown chart placeholder. No data yet."
						className="flex flex-col items-center justify-center h-48 border border-dashed border-[var(--color-border)]/60 rounded-[var(--radius-md)] bg-[var(--color-void)] px-6 text-center"
					>
						<p className="text-[13.5px] font-semibold text-text-secondary">No model usage data yet</p>
						<p className="mt-2 text-[11px] font-mono text-text-muted">
							Top models by cost will appear here.
						</p>
					</div>
				)}
			</m.div>
		</div>
	);
}

/** Build a short, descriptive label for the area chart from the data. */
function buildAreaLabel(
	data: DataPoint[],
	timeRange: string,
): string {
	const range = TIME_LABELS[timeRange] || timeRange;
	if (data.length === 0) return `Usage chart for ${range}. No data yet.`;
	const peak = data.reduce(
		(best, d) => (d.requests > best.requests ? d : best),
		data[0],
	);
	const totalRequests = data.reduce((sum, d) => sum + d.requests, 0);
	return `Usage over the last ${range}, ${data.length} data points. Peak ${peak.requests.toLocaleString()} requests on ${peak.date}. Total ${totalRequests.toLocaleString()} requests.`;
}

/** Build a short, descriptive label for the donut chart from the data. */
function buildDonutLabel(data: ModelData[]): string {
	if (data.length === 0) return "Model breakdown chart. No data yet.";
	const total = data.reduce((sum, d) => sum + d.value, 0);
	const top = [...data].sort((a, b) => b.value - a.value)[0];
	if (!top) return "Model breakdown chart.";
	const pct = total > 0 ? Math.round((top.value / total) * 100) : 0;
	return `Model breakdown donut chart, ${data.length} models. Top model ${top.name} at ${pct}% of ${total.toLocaleString()} requests.`;
}
