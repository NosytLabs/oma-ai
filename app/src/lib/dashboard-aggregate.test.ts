import { describe, expect, it } from "vitest";
import { buildTopModels, buildUsageByDay } from "./dashboard-aggregate";
import type { UsageRecord } from "@/lib/api";

function usage(overrides: Partial<UsageRecord>): UsageRecord {
	return {
		id: "usage-1",
		requestId: "request-1",
		model: "llama-3.3-70b",
		provider: "oma-ai",
		promptTokens: 10,
		completionTokens: 20,
		costCents: "1",
		markupCents: "0",
		totalCents: "1",
		latencyMs: 100,
		status: "completed",
		createdAt: "2026-09-03T23:00:00.000Z",
		...overrides,
	};
}

describe("dashboard usage aggregation", () => {
	it("groups requests by local calendar day and converts cents to dollars", () => {
		const result = buildUsageByDay([
			usage({ id: "a", totalCents: "125" }),
			usage({ id: "b", totalCents: "0", createdAt: "2026-09-05T12:00:00.000Z" }),
		]);

		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({ requests: 1, cost: 1.25 });
		expect(result[1]).toMatchObject({ requests: 1, cost: 0 });
	});

	it("orders the model donut by billed cost and buckets the tail", () => {
		const records = [
			usage({ model: "llama-3.3-70b", totalCents: "100" }),
			usage({ model: "kimi-k3", totalCents: "300" }),
			usage({ model: "gemini-3-flash-preview", totalCents: "200" }),
			usage({ model: "mistral-small-2603", totalCents: "50" }),
			usage({ model: "deepseek-v4-pro", totalCents: "25" }),
			usage({ model: "qwen-3-8-max", totalCents: "10" }),
		];

		const result = buildTopModels(records);
		expect(result.slice(0, 3).map((item) => item.value)).toEqual([3, 2, 1]);
		expect(result.at(-1)).toMatchObject({ name: "Other (1)", value: 0.1 });
	});
});
