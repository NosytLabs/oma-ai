"use client";

import { m } from "@/lib/framer-motion-client";
import { springs } from "@/lib/animation";
import dynamic from "next/dynamic";
import { DashboardCard } from "@/components/dashboard/DashboardCard";
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
	loading?: boolean;
	bucket?: "day" | "month";
	timezone?: string;
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
	loading = false,
	bucket = "day",
	timezone,
}: UsageChartProps) {
	const hasUsageData = !loading && usageData.some(p => (p.requests ?? 0) > 0);
	const hasModelData = !loading && modelData.some(p => p.value > 0);
	const areaLabel = buildAreaLabel(usageData, timeRange);
	const donutLabel = buildDonutLabel(modelData);
	const rangeLabel = TIME_LABELS[timeRange] || timeRange;

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<m.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...springs.card, delay: 0.3 }}
			>
				<DashboardCard
					tone="accent"
					title={`Usage (${rangeLabel})`}
					hint={`Requests per ${bucket}${timezone ? ` · ${timezone.replaceAll("_", " ")}` : ""}`}
					flush
				>
					{hasUsageData ? (
						<div role="img" aria-label={areaLabel} className="rounded-[var(--radius-md)] border border-border/50 bg-void p-4">
							<AreaChartComponent data={usageData} tickPattern={bucket === "month" ? "MMM yyyy" : "MMM d"} />
						</div>
					) : (
						<div
							role="img"
							aria-label="Usage chart placeholder. No data yet."
							className="flex h-48 flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border/60 bg-void px-6 text-center"
						>
							<p className="text-[13.5px] font-semibold text-text-secondary">
								{loading
									? "Loading usage…"
									: `No requests in this ${rangeLabel}`}
							</p>
							<p className="mt-2 font-mono text-[11px] text-text-muted">
								{loading
									? "Fetching your request history."
									: "Try another range, or send a request from chat."}
							</p>
						</div>
					)}
				</DashboardCard>
			</m.div>

			<m.div
				initial={{ opacity: 0, y: 20 }}
				animate={{ opacity: 1, y: 0 }}
				transition={{ ...springs.card, delay: 0.4 }}
			>
				<DashboardCard
					tone="info"
					title="Spend by model"
					hint="Top models by cost"
					flush
				>
					{hasModelData ? (
						<div role="img" aria-label={donutLabel} className="flex h-full flex-col">
							<div className="flex-1 rounded-[var(--radius-md)] border border-border/50 bg-void p-4">
								<DonutChart data={modelData} currency />
							</div>
							<div className="mt-4 flex flex-wrap justify-center gap-3 rounded-[var(--radius-md)] border border-border/50 bg-surface-elevated p-3">
								{modelData.map((model) => (
									<div key={model.name} className="flex items-center gap-2">
										<div
											className="h-2 w-2 rounded-full"
											style={{ backgroundColor: model.color }}
											aria-hidden="true"
										/>
										<span className="font-mono text-[11px] text-text-secondary">{model.name}</span>
									</div>
								))}
							</div>
						</div>
					) : (
						<div
							role="img"
							aria-label="Spend by model. No billed spend in this range."
							className="flex h-48 flex-col items-center justify-center rounded-[var(--radius-md)] border border-dashed border-border/60 bg-void px-6 text-center"
						>
							<p className="text-[13.5px] font-semibold text-text-secondary">
								{loading ? "Loading models…" : "No billed spend in this range"}
							</p>
							<p className="mt-2 font-mono text-[11px] text-text-muted">
								{loading
									? "Fetching model breakdown."
									: "Top models by spend will appear here."}
							</p>
						</div>
					)}
				</DashboardCard>
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
	return `Spend by model, ${data.length} slices. Top ${top.name} at ${pct}% of $${total.toFixed(2)}.`;
}
