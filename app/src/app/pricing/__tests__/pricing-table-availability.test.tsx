import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PricingTable } from "../_components/PricingTable";
import type { Category, PricedModel } from "../_lib/pricing-utils";

/**
 * Availability is the honesty contract of this page: 18 of 20 models are
 * currently dark upstream. The input price is muted + struck through on an
 * unavailable row, so the row cannot read as buyable -- but the OUTPUT price
 * and the context column were hardcoded to `text-text-secondary`, the exact
 * colour a LIVE value uses. Measured live at 1440px: 18/18 unavailable rows
 * struck the input price and 0/18 struck the output price, which rendered in
 * rgb(184,195,209) -- byte-identical to the available rows' secondary text.
 *
 * So half the price of a dead model read as alive. This asserts the output
 * price is treated the same as the input price, and that the two available
 * models keep their accent colour.
 */
function row(over: Partial<PricedModel>): PricedModel {
	return {
		id: "m",
		name: "M",
		provider: "Venice",
		inputPer1M: 1,
		outputPer1M: 2,
		ctx: "128K",
		category: "frontier",
		available: true,
		...over,
	} as PricedModel;
}

function renderTable(models: PricedModel[]) {
	return render(
		<PricingTable
			models={models}
			category="all"
			setCategory={() => {}}
			categories={[{ key: "all", label: "All" } as { key: Category; label: string }]}
			categoryStyles={{
				all: { active: "", inactive: "" },
				frontier: { active: "", inactive: "" },
				premium: { active: "", inactive: "" },
				mid: { active: "", inactive: "" },
				budget: { active: "", inactive: "" },
			}}
		/>
	);
}

const PRICE_COL = 2;

function priceClasses(tr: HTMLElement, col: number): string {
	return tr.querySelectorAll("td")[col]?.className ?? "";
}

describe("PricingTable availability honesty", () => {
	it("strikes the OUTPUT price on an unavailable row, not just the input", () => {
		renderTable([row({ id: "dark", name: "Dark", available: false })]);
		const tr = screen.getByText(/Dark/).closest("tr") as HTMLElement;
		expect(priceClasses(tr, PRICE_COL)).toMatch(/line-through/);
		expect(priceClasses(tr, PRICE_COL + 1)).toMatch(/line-through/);
	});

	it("mutes the context cell on an unavailable row", () => {
		renderTable([row({ id: "dark", name: "Dark", available: false })]);
		const tr = screen.getByText(/Dark/).closest("tr") as HTMLElement;
		expect(priceClasses(tr, PRICE_COL + 2)).toMatch(/text-text-muted/);
	});

	it("leaves an AVAILABLE row in the accent colour with no strike", () => {
		renderTable([row({ id: "live", name: "Live", available: true })]);
		const tr = screen.getByText(/Live/).closest("tr") as HTMLElement;
		expect(priceClasses(tr, PRICE_COL)).toMatch(/color-accent/);
		expect(priceClasses(tr, PRICE_COL)).not.toMatch(/line-through/);
		expect(priceClasses(tr, PRICE_COL + 1)).not.toMatch(/line-through/);
	});
});
