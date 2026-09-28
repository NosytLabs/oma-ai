import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CostEstimate } from "../CostEstimate";

const { catalog } = vi.hoisted(() => ({
	catalog: {
		status: "live",
		models: [{ id: "claude-opus-5", inputPer1M: 7.5, outputPer1M: 37.5, pricingAvailable: true }, { id: "zai-org-glm-5-3", inputPer1M: 0.1, outputPer1M: 0.2, pricingAvailable: true }],
	},
}));
vi.mock("../chat-message-shared", () => ({
	useSharedLiveModels: () => catalog.models,
	useSharedLiveModelCatalog: () => catalog,
}));

describe("CostEstimate", () => {
	beforeEach(() => { catalog.status = "live"; });

	it("uses the live output price and the selected output budget", () => {
		render(<CostEstimate model="claude-opus-5" inputText="" maxTokens={2000} />);
		expect(screen.getByRole("status")).toHaveTextContent("7.50 cr");
	});

	it("does not invent a rate for a model missing from the live catalog", () => {
		render(<CostEstimate model="unknown" inputText="hello" maxTokens={2000} />);
		expect(screen.getByRole("status")).toHaveTextContent("Pricing unavailable");
	});

	it.each(["loading", "fallback"])("does not quote static prices while catalog is %s", (status) => {
		catalog.status = status;
		render(<CostEstimate model="claude-opus-5" inputText="" maxTokens={2000} />);
		expect(screen.getByRole("status")).toHaveTextContent(status === "loading" ? "Loading pricing" : "Pricing unavailable");
		expect(screen.queryByText(/7.50 cr/)).not.toBeInTheDocument();
	});

	it("labels the free website path without quoting the paid API rate", () => {
		render(<CostEstimate model="zai-org-glm-5-3" inputText="hello" freeWebsiteChat />);
		expect(screen.getByRole("status")).toHaveTextContent("Free chat");
	});
	it("keeps tiny paid estimates distinguishable from zero", () => {
		render(<CostEstimate model="zai-org-glm-5-3" inputText="" maxTokens={100} />);
		expect(screen.getByRole("status")).toHaveTextContent("<0.01 cr EST");
	});
});
