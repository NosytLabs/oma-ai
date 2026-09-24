import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingTable } from "../_components/PricingTable";
import type { PricedModel } from "../_lib/pricing-utils";

const base: PricedModel = {
	id: "claude-opus-5",
	name: "Claude Opus 5",
	category: "frontier",
	provider: "Venice",
	inputPer1M: 7.5,
	outputPer1M: 30,
	ctx: "1M",
	contextTokens: 1_000_000,
};

/**
 * The pricing page is where a visitor commits to buying, so an unavailable
 * model there is the most misleading place to stay silent. `available:false`
 * reaches PricedModel via toPricedModel(); this pins that the row says so.
 */
function renderTable(model: PricedModel) {
	const categories = [
		{ key: "all", label: "All" },
		{ key: "frontier", label: "Frontier" },
		{ key: "premium", label: "Premium" },
		{ key: "mid", label: "Mid" },
		{ key: "budget", label: "Budget" },
	] as const;
	const categoryStyles = Object.fromEntries(
		categories.map((c) => [c.key, { active: "", inactive: "" }]),
	) as Record<string, { active: string; inactive: string }>;

	return render(
		<PricingTable
			models={[model]}
			category="all"
			setCategory={() => {}}
			categories={categories as unknown as Parameters<typeof PricingTable>[0]["categories"]}
			categoryStyles={categoryStyles as Parameters<typeof PricingTable>[0]["categoryStyles"]}
		/>,
	);
}

describe("PricingTable availability", () => {
	it("marks an unavailable row", () => {
		renderTable({ ...base, available: false });
		expect(screen.getAllByText(/unavailable/i).length).toBeGreaterThan(0);
	});

	it("leaves an available row unmarked", () => {
		renderTable({ ...base, available: true });
		expect(screen.queryAllByText(/unavailable/i)).toHaveLength(0);
	});

	it("treats an omitted flag as available", () => {
		renderTable({ ...base });
		expect(screen.queryAllByText(/unavailable/i)).toHaveLength(0);
	});
});
