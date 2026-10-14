import { describe, expect, it } from "vitest";
import { MODELS } from "@/lib/models-data";
import { buildDemoTransactions, buildDemoUsage, DEMO_BALANCE } from "./demo-data";

describe("dashboard demo balance", () => {
	it("credits added minus credits spent equals the displayed balance", () => {
		expect(Number(DEMO_BALANCE.totalDepositedCents) - Number(DEMO_BALANCE.totalUsedCents))
			.toBe(Number(DEMO_BALANCE.balanceCents));
	});

	it("shows no charge or generated output for failed requests", () => {
		const failed = buildDemoUsage().filter(row => row.status === "error");
		expect(failed.length).toBeGreaterThan(0);
		for (const row of failed) {
			expect(Number(row.totalCents)).toBe(0);
			expect(row.completionTokens).toBe(0);
		}
	});

	it("uses the catalog token prices for successful sample requests", () => {
		for (const row of buildDemoUsage().filter(row => row.status === "completed")) {
			const model = MODELS.find(entry => entry.id === row.model);
			expect(model, row.model).toBeDefined();
			if (!model) continue;
			const expectedCents = (row.promptTokens * model.inputPricePer1M
				+ row.completionTokens * model.outputPricePer1M) / 10_000;
			expect(Number(row.totalCents), row.model).toBeCloseTo(expectedCents, 8);
		}
	});

	it("shows the same usage charge in recent activity and the request history", () => {
		const usage = buildDemoUsage();
		const activity = buildDemoTransactions(usage).find(row => row.type === "usage");
		expect(activity).toBeDefined();
		const request = usage.find(row => row.id === activity?.id);
		expect(request).toBeDefined();
		expect(activity?.amountCents).toBe(-Number(request?.totalCents));
		expect(activity?.createdAt).toBe(request?.createdAt);
	});

	it("recent deposits account for the credits added to the demo balance", () => {
		const added = buildDemoTransactions([]).reduce((sum, row) => sum + row.amountCents, 0);
		expect(added).toBe(Number(DEMO_BALANCE.totalDepositedCents));
	});
});
