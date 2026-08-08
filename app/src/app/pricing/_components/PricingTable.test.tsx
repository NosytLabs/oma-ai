import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PricingTable } from "./PricingTable";
import type { PricedModel, Category } from "../_lib/pricing-utils";

const mockModels: PricedModel[] = [
	{
		id: "model-a",
		name: "Model Alpha",
		category: "budget",
		provider: "Venice",
		inputPer1M: 0.1,
		outputPer1M: 0.2,
		ctx: "8K",
		contextTokens: 8000,
	},
	{
		id: "model-b",
		name: "Model Beta",
		category: "mid",
		provider: "OMA-AI",
		inputPer1M: 1.0,
		outputPer1M: 2.0,
		ctx: "32K",
		contextTokens: 32000,
	},
	{
		id: "model-c",
		name: "Model Gamma",
		category: "premium",
		provider: "Venice",
		inputPer1M: 5.0,
		outputPer1M: 10.0,
		ctx: "128K",
		contextTokens: 128000,
	},
	{
		id: "model-d",
		name: "Model Delta",
		category: "frontier",
		provider: "OMA-AI",
		inputPer1M: 15.0,
		outputPer1M: 30.0,
		ctx: "1M",
		contextTokens: 1000000,
	},
];

const mockCategories: { key: Category; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "frontier", label: "Frontier" },
	{ key: "premium", label: "Premium" },
	{ key: "mid", label: "Mid-Range" },
	{ key: "budget", label: "Budget" },
];

const mockCategoryStyles: Record<Category, { active: string; inactive: string }> = {
	all: { active: "active", inactive: "inactive" },
	frontier: { active: "active", inactive: "inactive" },
	premium: { active: "active", inactive: "inactive" },
	mid: { active: "active", inactive: "inactive" },
	budget: { active: "active", inactive: "inactive" },
};

describe("PricingTable Component", () => {
	it("renders all models when category is 'all'", () => {
		const setCategory = () => {};
		render(
			<PricingTable
				models={mockModels}
				category="all"
				setCategory={setCategory}
				categories={mockCategories}
				categoryStyles={mockCategoryStyles}
			/>
		);

		expect(screen.getByText("Model Alpha")).toBeInTheDocument();
		expect(screen.getByText("Model Beta")).toBeInTheDocument();
		expect(screen.getByText("Model Gamma")).toBeInTheDocument();
		expect(screen.getByText("Model Delta")).toBeInTheDocument();
	});

	it("filters models by search query", async () => {
		const setCategory = () => {};
		render(
			<PricingTable
				models={mockModels}
				category="all"
				setCategory={setCategory}
				categories={mockCategories}
				categoryStyles={mockCategoryStyles}
			/>
		);

		const searchInput = screen.getByPlaceholderText(/search models/i);
		fireEvent.change(searchInput, { target: { value: "Beta" } });

		await waitFor(() => {
			expect(screen.queryByText("Model Alpha")).not.toBeInTheDocument();
			expect(screen.getByText("Model Beta")).toBeInTheDocument();
		});
	});

	it("filters models by provider", async () => {
		const setCategory = () => {};
		render(
			<PricingTable
				models={mockModels}
				category="all"
				setCategory={setCategory}
				categories={mockCategories}
				categoryStyles={mockCategoryStyles}
			/>
		);

		const providerSelect = screen.getByLabelText(/filter.*provider/i);
		fireEvent.change(providerSelect, { target: { value: "OMA-AI" } });

		await waitFor(() => {
			expect(screen.queryByText("Model Alpha")).not.toBeInTheDocument();
			expect(screen.getByText("Model Beta")).toBeInTheDocument();
			expect(screen.queryByText("Model Gamma")).not.toBeInTheDocument();
		});
	});

	it("filters models by context window", async () => {
		const setCategory = () => {};
		render(
			<PricingTable
				models={mockModels}
				category="all"
				setCategory={setCategory}
				categories={mockCategories}
				categoryStyles={mockCategoryStyles}
			/>
		);

		const contextSelect = screen.getByLabelText(/filter.*context/i);
		fireEvent.change(contextSelect, { target: { value: "128000" } });

		await waitFor(() => {
			expect(screen.queryByText("Model Alpha")).not.toBeInTheDocument();
			expect(screen.queryByText("Model Beta")).not.toBeInTheDocument();
			expect(screen.getByText("Model Gamma")).toBeInTheDocument();
			expect(screen.getByText("Model Delta")).toBeInTheDocument();
		});
	});

	it("sorts models by input price", async () => {
		const setCategory = () => {};
		render(
			<PricingTable
				models={mockModels}
				category="all"
				setCategory={setCategory}
				categories={mockCategories}
				categoryStyles={mockCategoryStyles}
			/>
		);

		// Default sort might already be inputPrice asc, let's toggle it
		const inputPriceSortBtn = screen.getByRole("button", { name: /sort by input price/i });
		
		// First click toggles to desc
		fireEvent.click(inputPriceSortBtn);

		const rows = screen.getAllByRole("row");
		// Header row is index 0. The first data row should be the most expensive (Model Delta)
		expect(rows[1]).toHaveTextContent("Model Delta");
	});
});
