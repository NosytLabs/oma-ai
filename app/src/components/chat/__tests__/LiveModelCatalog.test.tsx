import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CostEstimate } from "../CostEstimate";
import { LiveModelsProvider } from "../chat-message-shared";

const { listModels } = vi.hoisted(() => ({ listModels: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { models: { list: listModels } } }));
let now = Date.now();
beforeEach(() => {
	now += 600_001;
	vi.spyOn(Date, "now").mockReturnValue(now);
	listModels.mockReset();
});

function renderEstimate() {
	return render(<LiveModelsProvider><CostEstimate inputText="" model="claude-opus-5" maxTokens={2000} /></LiveModelsProvider>);
}

describe("live chat pricing", () => {
	it("keeps failed catalog requests from becoming a fallback price quote", async () => {
		listModels.mockRejectedValue(new Error("offline"));
		renderEstimate();
		expect(screen.getByRole("status")).toHaveTextContent("Loading pricing");
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Pricing unavailable"));
	});

	it.each([undefined, { prompt: "7.5" }, { prompt: "NaN", completion: "37.5" }, { prompt: "7.5", completion: "37.5junk" }, { prompt: -1, completion: 37.5 }, { prompt: 7.5, completion: Number.POSITIVE_INFINITY }, { prompt: 7.5, completion: Number.NaN }, { prompt: " ", completion: "37.5" }])("does not turn absent or malformed live pricing into a zero cost", async (pricing) => {
		listModels.mockResolvedValue({ data: [{ id: "claude-opus-5", pricing }] });
		renderEstimate();
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Pricing unavailable"));
	});

	it("uses validated live rates, including fractional credits", async () => {
		listModels.mockResolvedValue({ data: [{ id: "claude-opus-5", pricing: { prompt: "7.5", completion: "37.5" } }] });
		renderEstimate();
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("7.50 cr"));
		expect(listModels).toHaveBeenCalledOnce();
	});
	it("accepts the numeric price payload returned by the production catalog", async () => {
		listModels.mockResolvedValue({ data: [{ id: "claude-opus-5", pricing: { prompt: 7.5, completion: 37.5 } }] });
		renderEstimate();
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("7.50 cr"));
	});

	it("accepts numeric zero prices without treating them as missing", async () => {
		listModels.mockResolvedValue({ data: [{ id: "claude-opus-5", pricing: { prompt: 0, completion: 0 } }] });
		renderEstimate();
		await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("0.00 cr EST"));
	});

});
