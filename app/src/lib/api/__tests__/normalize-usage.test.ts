import { describe, expect, it } from "vitest";
import { collectUsagePages } from "../collect-usage";
import { normalizeUsageRecord } from "../resources";
import type { UsageRecord } from "../types";

describe("normalizeUsageRecord", () => {
	it("maps input/output tokens onto dashboard field names", () => {
		const rec = normalizeUsageRecord({
			id: "1",
			requestId: "r1",
			model: "mistral-small-2603",
			provider: "venice",
			promptTokens: 0,
			completionTokens: 0,
			inputTokens: 12,
			outputTokens: 34,
			costCents: "1",
			markupCents: "0",
			totalCents: "1",
			latencyMs: 240,
			status: "completed",
			createdAt: "2026-08-15T00:00:00.000Z",
		});
		expect(rec.promptTokens).toBe(12);
		expect(rec.completionTokens).toBe(34);
		expect(rec.latencyMs).toBe(240);
	});

	it("keeps already-normalized prompt/completion tokens", () => {
		const rec = normalizeUsageRecord({
			id: "2",
			requestId: "r2",
			model: "llama-3.3-70b",
			provider: "venice",
			promptTokens: 8,
			completionTokens: 16,
			costCents: "2",
			markupCents: "0",
			totalCents: "2",
			latencyMs: null,
			status: "completed",
			createdAt: "2026-08-15T00:00:00.000Z",
		});
		expect(rec.promptTokens).toBe(8);
		expect(rec.completionTokens).toBe(16);
		expect(rec.latencyMs).toBeNull();
	});
});

function fakeRecord(id: string): UsageRecord {
	return {
		id,
		requestId: id,
		model: "deepseek-v4-flash-openbroker",
		provider: "oma-ai",
		promptTokens: 1,
		completionTokens: 1,
		costCents: "0",
		markupCents: "0",
		totalCents: "0",
		latencyMs: 10,
		status: "completed",
		createdAt: "2026-08-15T00:00:00.000Z",
	};
}

describe("collectUsagePages", () => {
	it("walks cursors until the last page", async () => {
		const pages = [
			{ records: [fakeRecord("a"), fakeRecord("b")], nextCursor: "c1" },
			{ records: [fakeRecord("c")], nextCursor: null },
		];
		let calls = 0;
		const rows = await collectUsagePages(async (cursor) => {
			const page = pages[calls] ?? { records: [], nextCursor: null };
			calls += 1;
			if (calls === 1) expect(cursor).toBeUndefined();
			if (calls === 2) expect(cursor).toBe("c1");
			return page;
		});
		expect(rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
		expect(calls).toBe(2);
	});

	it("stops at maxRecords even if more pages exist", async () => {
		const rows = await collectUsagePages(
			async () => ({
				records: [fakeRecord("1"), fakeRecord("2"), fakeRecord("3")],
				nextCursor: "more",
			}),
			{ maxRecords: 4 },
		);
		expect(rows).toHaveLength(4);
	});
});
