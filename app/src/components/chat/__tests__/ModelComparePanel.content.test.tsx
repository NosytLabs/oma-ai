import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelComparePanel } from "../ModelComparePanel";

vi.mock("thinking-orbs", () => ({ ThinkingOrb: () => null }));

vi.mock("../chat-message-shared", async () => {
	const actual =
		await vi.importActual<typeof import("../chat-message-shared")>(
			"../chat-message-shared",
		);
	return {
		...actual,
		useSharedLiveModels: () => [
			{
				id: "compare-model",
				name: "Compare Model",
				category: "budget",
				ctx: "128K",
				inputPer1M: 0.2,
				outputPer1M: 0.4,
				provider: "oma-ai",
			},
		],
	};
});

describe("ModelComparePanel message rendering", () => {
	it("uses the shared message renderer for markdown and message actions", () => {
		const onRegenerate = vi.fn();
		render(
			<ModelComparePanel
				open
				onClose={vi.fn()}
				primaryModel="compare-model"
				compareModel="compare-model"
				setCompareModel={vi.fn()}
				prompt=""
				onSubmit={vi.fn()}
				loading={false}
				onRegenerate={onRegenerate}
				compareMessages={[
					{
						id: "compare-answer",
						role: "assistant",
						content: "A **formatted** answer",
						timestamp: Date.now(),
						model: "compare-model",
						outputTokens: 7,
					},
				]}
			/>,
		);

		expect(screen.getByText("formatted").tagName).toBe("STRONG");
		expect(
			screen.getByRole("button", { name: "Copy message" }),
		).toBeInTheDocument();
		expect(screen.getByText("TK:7")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Regenerate response" }));
		expect(onRegenerate).toHaveBeenCalledOnce();
	});

	it("locks navigation and model selection while both models are running", () => {
		render(
			<ModelComparePanel
				open
				onClose={vi.fn()}
				primaryModel="compare-model"
				compareModel="compare-model"
				setCompareModel={vi.fn()}
				prompt="Compare this"
				onSubmit={vi.fn()}
				loading
				compareMessages={[]}
			/>,
		);

		expect(
			screen.getByRole("button", { name: "Close comparison panel" }),
		).toBeDisabled();
		expect(
			screen.getByRole("button", { name: "Select AI model — Compare Model" }),
		).toBeDisabled();
	});

	it("does not render a hollow frame for a completed empty assistant message", () => {
		const { container } = render(
			<ModelComparePanel
				open
				onClose={vi.fn()}
				primaryModel="compare-model"
				compareModel="compare-model"
				setCompareModel={vi.fn()}
				prompt=""
				onSubmit={vi.fn()}
				loading={false}
				compareMessages={[
					{
						id: "empty-compare-answer",
						role: "assistant",
						content: "",
						timestamp: Date.now(),
					},
				]}
			/>,
		);

		expect(container.querySelector("[data-chat-message]")).toBeNull();
	});
});
