import { afterEach, describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardStats } from "../useDashboardStats";
import type { UsageRecord } from "@/lib/api";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllEnvs();
});

function rec(model: string, daysAgo: number): UsageRecord {
	const d = new Date();
	d.setDate(d.getDate() - daysAgo);
	return {
		id: `u-${model}-${daysAgo}`,
		requestId: `r-${model}-${daysAgo}`,
		apiKeyId: null,
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
	it.each([
		["2026-11-01T12:00:00-04:00", 24.5, 0],
		["2026-03-08T12:00:00-03:00", 23.5, 1],
	] as const)("keeps the chart's 24h window equal to the card across DST (%s)", (now, hoursAgo, count) => {
		vi.stubEnv("TZ", "America/Moncton");
		vi.useFakeTimers();
		vi.setSystemTime(new Date(now));
		const row = { ...rec("around-DST", 0), createdAt: new Date(Date.now() - hoursAgo * 3_600_000).toISOString() };
		const { result } = renderHook(() => useDashboardStats([row], "24h"));
		expect(result.current.filteredUsage).toHaveLength(count);
		expect(result.current.todayUsage).toHaveLength(count);
	});
	it.each(["24h", "7d", "30d"] as const)("excludes future requests from the %s chart and 24h card", range => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
		const recent = rec("recent", 0);
		const future = { ...rec("future", 0), createdAt: "2026-10-15T13:00:00Z" };
		const { result } = renderHook(() => useDashboardStats([recent, future], range));
		expect(result.current.filteredUsage.map(row => row.model)).toEqual(["recent"]);
		expect(result.current.todayUsage.map(row => row.model)).toEqual(["recent"]);
	});
	it("applies time-range filter to activeModels (24h window)", () => {
		const usage: UsageRecord[] = [
			rec("old-model", 30),
			rec("new-model", 0),
			rec("outside-window", 2),
		];
		const { result } = renderHook(() => useDashboardStats(usage, "24h"));
		// 24h window only contains new-model
		expect(result.current.activeModels).toBe(1);
	});

	it("includes the exact 24h boundary while excluding the preceding millisecond", () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-10-15T12:00:00Z"));
		const boundary = rec("boundary", 1);
		const outside = { ...rec("outside", 1), createdAt: "2026-10-14T11:59:59.999Z" };
		const { result } = renderHook(() => useDashboardStats([boundary, outside], "24h"));
		expect(result.current.todayUsage.map(row => row.model)).toEqual(["boundary"]);
		expect(result.current.filteredUsage.map(row => row.model)).toEqual(["boundary"]);
	});

	it("keeps the 24h card's model count independent of the chart range", () => {
		const usage: UsageRecord[] = [
			rec("old-model", 30),
			rec("new-model", 0),
			rec("week-model", 5),
		];
		const { result } = renderHook(() => useDashboardStats(usage, "7d"));
		expect(result.current.activeModels).toBe(1);
	});

	it("keeps the 24h card's model count independent of lifetime history", () => {
		const usage: UsageRecord[] = [
			rec("a", 60),
			rec("b", 30),
			rec("c", 0),
		];
		const { result } = renderHook(() => useDashboardStats(usage, "all"));
		expect(result.current.activeModels).toBe(1);
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
