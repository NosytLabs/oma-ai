import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardStats } from "../useDashboardStats";
import type { UsageRecord } from "@/lib/api";

function rec(model: string, daysAgo: number): UsageRecord {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	return {
		id: `u-${model}-${daysAgo}`,
		requestId: `r-${model}-${daysAgo}`,
		model,
		provider: "test",
		promptTokens: 10,
		completionTokens: 20,
		costCents: "1.00",
		markupCents: "0.15",
		totalCents: "1.15",
		latencyMs: 100,
		status: "completed",
		createdAt: d.toISOString(),
	};
}

describe("useDashboardStats", () => {
	it("applies time-range filter to activeModels (24h window)", () => {
		const usage: UsageRecord[] = [
			rec("old-model", 30),
			rec("new-model", 0),
			rec("today-model", 1),
		];
		const { result } = renderHook(() => useDashboardStats(usage, "24h"));
		// 24h window only contains new-model
		expect(result.current.activeModels).toBe(1);
	});

	it("applies time-range filter to activeModels (7d window)", () => {
		const usage: UsageRecord[] = [
			rec("old-model", 30),
			rec("new-model", 0),
			rec("week-model", 5),
		];
		const { result } = renderHook(() => useDashboardStats(usage, "7d"));
		expect(result.current.activeModels).toBe(2);
	});

	it("activeModels equals full set on 'all'", () => {
		const usage: UsageRecord[] = [
			rec("a", 60),
			rec("b", 30),
			rec("c", 0),
		];
		const { result } = renderHook(() => useDashboardStats(usage, "all"));
		expect(result.current.activeModels).toBe(3);
	});

	it("todayCost and totalTokens stay anchored to today, not the filter", () => {
		const usage: UsageRecord[] = [
			rec("a", 0),
			rec("a", 0),
			rec("b", 3),
		];
		const { result } = renderHook(() => useDashboardStats(usage, "30d"));
		expect(result.current.todayUsage.length).toBe(2);
		expect(result.current.filteredUsage.length).toBe(3);
	});
});