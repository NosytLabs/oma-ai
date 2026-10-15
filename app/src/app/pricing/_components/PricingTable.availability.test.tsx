import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingTable } from "./PricingTable";
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
	it.each([false, true, undefined])("marks prices and context consistently when availability is %s", (available) => {
		renderTable({ ...base, available });
		const cells = screen.getByRole("row", { name: /Claude Opus 5/ }).querySelectorAll("td");
		if (available === false) {
			expect(screen.getByText("Unavailable")).toBeInTheDocument();
			expect(cells[2]).toHaveClass("line-through");
			expect(cells[3]).toHaveClass("line-through");
			expect(cells[4]).toHaveClass("text-text-muted");
		} else {
			expect(screen.queryByText("Unavailable")).not.toBeInTheDocument();
			expect(cells[2]).not.toHaveClass("line-through");
			expect(cells[3]).not.toHaveClass("line-through");
			expect(cells[4]).not.toHaveClass("text-text-muted");
		}
	});
});
