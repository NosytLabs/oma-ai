/**
 * Maps raw usage records to the data shapes consumed by the dashboard chart
 * components (`<AreaChartComponent>` and `<DonutChart>` in
 * `app/src/components/ui/charts/`).
 *
 * Extracted from `app/src/app/dashboard/page.tsx` so the pure mapping logic
 * is unit-testable without a React render harness.
 */
import { CHART_PALETTE } from "@/components/ui/charts/shared";
import { toDollars } from "@/lib/utils";

/** Raw shape returned by `api.usage.get()` — mirrors `UsageRecord`. */
export interface UsageRecordLike {
	id: string;
	model: string;
	promptTokens: number;
	completionTokens: number;
	/** Backend stores cents as a string (decimal numeric). */
	costCents: string | number;
	createdAt: string;
}

/** Shape consumed by `<AreaChartComponent>` (date, requests, cost). */
export interface ChartDataPoint {
	date: string;
	requests: number;
	cost: number;
}

/** Shape consumed by `<DonutChart>` (name, value, color). */
export interface ChartModelDatum {
	name: string;
	value: number;
	color: string;
}

/**
 * Local calendar day (YYYY-MM-DD) for a timestamp. Avoids UTC day-shift that
 * `toISOString().slice(0, 10)` causes for evening times in negative offsets.
 */
export function localDayKey(isoOrDate: string | Date): string {
	const d = typeof isoOrDate === "string" ? new Date(isoOrDate) : isoOrDate;
	if (Number.isNaN(d.getTime())) return "";
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

/**
 * Group usage records by local calendar date (YYYY-MM-DD) and aggregate
 * request count + total cost (cents → dollars) per day.
 *
 * When `windowDays` is a positive number, returns the last N day-buckets of
 * the sorted series (useful if the caller passes unfiltered history).
 * When `windowDays` is `null` or `<= 0`, no trailing slice is applied —
 * callers that already filter by time range (dashboard `filteredUsage`)
 * should pass `null` so 30d / all-time selections are not re-truncated to 7d.
 *
 * Empty input → empty output. The chart components render a zero-state in
 * that case (or show the loading skeleton via `LazyUsageChart`).
 */
export function mapUsageToChartData(
	usage: readonly UsageRecordLike[],
	windowDays: number | null = 7,
): ChartDataPoint[] {
	if (usage.length === 0) return [];
	const byDay = new Map<string, { requests: number; cost: number }>();
	for (const u of usage) {
		const day = localDayKey(u.createdAt);
		if (!day) continue;
		const prev = byDay.get(day) ?? { requests: 0, cost: 0 };
		prev.requests += 1;
		prev.cost += toDollars(u.costCents);
		byDay.set(day, prev);
	}
	const sorted = Array.from(byDay.entries()).sort(([a], [b]) =>
		a < b ? -1 : a > b ? 1 : 0,
	);
	const windowed =
		windowDays == null || windowDays <= 0
			? sorted
			: sorted.slice(-windowDays);
	return windowed.map(([date, v]) => ({
		date,
		requests: v.requests,
		cost: v.cost,
	}));
}

/**
 * Group usage records by model and aggregate total cost per model
 * (cents → dollars). Returns the top `topN` models sorted by cost
 * descending, each assigned a stable color from `CHART_PALETTE`.
 *
 * Empty input → empty output.
 */
export function mapUsageToModelData(
	usage: readonly UsageRecordLike[],
	topN = 5,
): ChartModelDatum[] {
	if (usage.length === 0) return [];
	const byModel = new Map<string, number>();
	for (const u of usage) {
		const model = u.model?.trim() || "unknown";
		byModel.set(model, (byModel.get(model) ?? 0) + toDollars(u.costCents));
	}
	return Array.from(byModel.entries())
		.sort(([, a], [, b]) => b - a)
		.slice(0, topN)
		.map(([name, value], i) => ({
			name,
			value,
			color: CHART_PALETTE[i % CHART_PALETTE.length],
		}));
}
