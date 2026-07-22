import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
	localDayKey,
	mapUsageToChartData,
	mapUsageToModelData,
	type UsageRecordLike,
} from "./usage-chart";

function rec(
	partial: Partial<UsageRecordLike> & Pick<UsageRecordLike, "id" | "createdAt">,
): UsageRecordLike {
	return {
		model: "llama-3.3-70b",
		promptTokens: 10,
		completionTokens: 5,
		costCents: 100,
		...partial,
	};
}

describe("localDayKey", () => {
	it("returns empty string for invalid dates", () => {
		expect(localDayKey("not-a-date")).toBe("");
	});

	it("formats a stable local calendar day", () => {
		// Noon local avoids timezone edge ambiguity for this assertion.
		const key = localDayKey(new Date(2026, 6, 15, 12, 0, 0));
		expect(key).toBe("2026-07-15");
	});
});

describe("mapUsageToChartData", () => {
	beforeAll(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-07-21T15:00:00"));
	});
	afterAll(() => {
		vi.useRealTimers();
	});

	it("returns empty array for empty input", () => {
		expect(mapUsageToChartData([])).toEqual([]);
	});

	it("aggregates requests and cost (cents→dollars) by local day", () => {
		const usage = [
			rec({ id: "1", createdAt: "2026-07-20T10:00:00", costCents: 100 }),
			rec({ id: "2", createdAt: "2026-07-20T18:00:00", costCents: 50 }),
			rec({ id: "3", createdAt: "2026-07-21T09:00:00", costCents: "200" }),
		];
		const data = mapUsageToChartData(usage, null);
		expect(data).toHaveLength(2);
		expect(data[0]).toEqual({
			date: "2026-07-20",
			requests: 2,
			cost: 1.5,
		});
		expect(data[1]).toEqual({
			date: "2026-07-21",
			requests: 1,
			cost: 2,
		});
	});

	it("slices trailing windowDays when provided", () => {
		const usage = Array.from({ length: 10 }, (_, i) => {
			const day = String(i + 1).padStart(2, "0");
			return rec({
				id: String(i),
				createdAt: `2026-07-${day}T12:00:00`,
				costCents: 100,
			});
		});
		const data = mapUsageToChartData(usage, 3);
		expect(data).toHaveLength(3);
		expect(data.map((d) => d.date)).toEqual([
			"2026-07-08",
			"2026-07-09",
			"2026-07-10",
		]);
	});

	it("does not re-slice when windowDays is null (pre-filtered dashboard data)", () => {
		const usage = Array.from({ length: 12 }, (_, i) => {
			const day = String(i + 1).padStart(2, "0");
			return rec({
				id: String(i),
				createdAt: `2026-07-${day}T12:00:00`,
				costCents: 25,
			});
		});
		const data = mapUsageToChartData(usage, null);
		expect(data).toHaveLength(12);
		expect(data[0].date).toBe("2026-07-01");
		expect(data[11].date).toBe("2026-07-12");
	});

	it("skips invalid createdAt values", () => {
		const usage = [
			rec({ id: "bad", createdAt: "garbage", costCents: 100 }),
			rec({ id: "ok", createdAt: "2026-07-21T12:00:00", costCents: 100 }),
		];
		expect(mapUsageToChartData(usage, null)).toEqual([
			{ date: "2026-07-21", requests: 1, cost: 1 },
		]);
	});
});

describe("mapUsageToModelData", () => {
	it("returns empty for empty input", () => {
		expect(mapUsageToModelData([])).toEqual([]);
	});

	it("aggregates cost by model, top N, assigns palette colors", () => {
		const usage = [
			rec({ id: "1", createdAt: "2026-07-21T12:00:00", model: "a", costCents: 500 }),
			rec({ id: "2", createdAt: "2026-07-21T12:00:00", model: "b", costCents: 100 }),
			rec({ id: "3", createdAt: "2026-07-21T12:00:00", model: "a", costCents: 100 }),
			rec({ id: "4", createdAt: "2026-07-21T12:00:00", model: "c", costCents: 50 }),
		];
		const data = mapUsageToModelData(usage, 2);
		expect(data).toHaveLength(2);
		expect(data[0].name).toBe("a");
		expect(data[0].value).toBe(6);
		expect(data[1].name).toBe("b");
		expect(data[1].value).toBe(1);
		expect(data[0].color).toBeTruthy();
		expect(data[1].color).toBeTruthy();
	});

	it("labels blank model names as unknown", () => {
		const usage = [
			rec({
				id: "1",
				createdAt: "2026-07-21T12:00:00",
				model: "  ",
				costCents: 100,
			}),
		];
		expect(mapUsageToModelData(usage)[0].name).toBe("unknown");
	});
});
