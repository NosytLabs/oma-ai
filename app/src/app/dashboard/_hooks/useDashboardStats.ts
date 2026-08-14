"use client";

import { useMemo } from "react";
import type { UsageRecord } from "@/lib/api";
import { toDollars } from "@/lib/utils";
import type { TimeRangeId } from "../_constants";

/** Usage statuses that represent a successful (non-error) request. */
const SUCCESS_STATUSES = new Set(["completed", "free_tier"]);

interface UseDashboardStatsResult {
	todayUsage: UsageRecord[];
	filteredUsage: UsageRecord[];
	todayCost: number;
	totalTokens: number;
	todayErrorCount: number;
	avgLatency: number;
	activeModels: number;
}

/**
 * Derives dashboard aggregates from raw usage records.
 *
 * Splits the heavy `useMemo` chains out of `DashboardPage` so the page
 * can stay focused on data fetching + UI wiring. All memos key off the
 * same inputs (`usage`, `timeRange`) the page used before.
 */
export function useDashboardStats(
	usage: UsageRecord[],
	timeRange: TimeRangeId,
): UseDashboardStatsResult {
	// Aggregates that drive the QuickStatsCard and the recent-requests table.
	const todayUsage = useMemo(() => {
		const today = new Date().toDateString();
		return usage.filter((u) => new Date(u.createdAt).toDateString() === today);
	}, [usage]);

	// Time-range filtered usage for charts
	const filteredUsage = useMemo(() => {
		if (timeRange === "all") return usage;
		const now = new Date();
		const cutoff = new Date(now);
		switch (timeRange) {
			case "24h":
				cutoff.setHours(cutoff.getHours() - 24);
				break;
			case "7d":
				cutoff.setDate(cutoff.getDate() - 7);
				break;
			case "30d":
				cutoff.setDate(cutoff.getDate() - 30);
				break;
			default:
				return usage;
		}
		return usage.filter((u) => new Date(u.createdAt) >= cutoff);
	}, [usage, timeRange]);

	const todayCost = useMemo(
		// Billed amount (cost + markup); decimal-string cents, may be sub-cent.
		// `toDollars` returns 0 for null/undefined/garbage.
		() =>
			todayUsage.reduce(
				(sum, u) => sum + toDollars(u.totalCents ?? u.costCents),
				0,
			),
		[todayUsage],
	);

	// Count of distinct models that appear in the current usage window.
	// More meaningful than "available models" — reflects what the user
	// has actually called. Honors the time-range filter so switching
	// 24h/7d/30d/all updates the count alongside the chart.
	const activeModels = useMemo(
		() => new Set(filteredUsage.map((u) => u.model)).size,
		[filteredUsage],
	);

	const totalTokens = useMemo(
		() =>
			todayUsage.reduce(
				(sum, u) => sum + (u.promptTokens ?? 0) + (u.completionTokens ?? 0),
				0,
			),
		[todayUsage],
	);

	// Count of today's requests that ended in a non-success status. Drives
	// the error-rate metric in QuickStatsCard. "completed" and "free_tier"
	// are both successful outcomes — anything else counts as an error.
	const todayErrorCount = useMemo(
		() =>
			todayUsage.filter(
				(u) => u.status && !SUCCESS_STATUSES.has(u.status),
			).length,
		[todayUsage],
	);

	const avgLatency = useMemo(() => {
		const withLatency = todayUsage.filter(
			(u) => u.latencyMs && u.latencyMs > 0,
		);
		if (withLatency.length === 0) return 0;
		return (
			withLatency.reduce((sum, u) => sum + (u.latencyMs ?? 0), 0) /
			withLatency.length
		);
	}, [todayUsage]);

	return {
		todayUsage,
		filteredUsage,
		todayCost,
		totalTokens,
		todayErrorCount,
		avgLatency,
		activeModels,
	};
}
