import { afterEach, describe, expect, it, vi } from "vitest";
import { MODELS } from "@/lib/models-data";

afterEach(() => {
	vi.doUnmock("@/lib/models-data");
	vi.resetModules();
});

describe("dashboard tour catalog changes", () => {
	it("keeps working when one sample model is retired", async () => {
		vi.doMock("@/lib/models-data", () => ({ MODELS: MODELS.filter(model => model.id !== "minimax-m2-7") }));
		const { buildDemoUsage } = await import("./demo-data");
		const usage = buildDemoUsage();
		expect(usage.length).toBeGreaterThan(0);
		expect(usage.some(row => row.model === "minimax-m2-7")).toBe(false);
	});

	it("renders an empty sample history when no sample model remains", async () => {
		vi.doMock("@/lib/models-data", () => ({ MODELS: [] }));
		const { buildDemoUsage, buildDemoTransactions } = await import("./demo-data");
		expect(buildDemoUsage()).toEqual([]);
		expect(buildDemoTransactions([]).every(row => row.type === "deposit")).toBe(true);
	});
});
