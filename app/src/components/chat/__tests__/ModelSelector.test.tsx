import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelSelector } from "../ModelSelector";

const { liveModels } = vi.hoisted(() => ({
	liveModels: [
		{
			id: "deepseek-v4-flash-0731-openbroker",
			name: "DeepSeek V4 Flash",
			category: "budget",
			ctx: "400K",
			inputPer1M: 0.5,
			provider: "oma-ai",
		},
		{
			id: "claude-opus-5",
			name: "Claude Opus 5",
			category: "frontier",
			ctx: "1M",
			inputPer1M: 7.5,
			provider: "venice",
		},
	],
}));

vi.mock("../chat-message-shared", () => ({
	useSharedLiveModels: () => liveModels,
}));

vi.mock("@/components/ui/model-logo", () => ({
	ModelLogo: () => null,
}));

describe("ModelSelector", () => {
	it("shows guests only usable models and a single sign-in route", () => {
		render(
			<ModelSelector
				model="deepseek-v4-flash-0731-openbroker"
				setModel={vi.fn()}
				isAuthenticated={false}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: /select ai model/i }));

		expect(screen.getByRole("menu", { name: /available ai models/i })).toBeVisible();
		expect(
			screen.getByRole("menuitemradio", { name: /deepseek v4 flash/i }),
		).toBeVisible();
		expect(
			screen.queryByRole("menuitemradio", { name: /claude opus 5/i }),
		).not.toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: /sign in to browse all models/i }),
		).toHaveAttribute("href", "/login");
	});

	it("BUG-G: the count summary reflects the AVAILABLE set, not the catalog", () => {
		render(
			<ModelSelector
				model="deepseek-v4-flash-0731-openbroker"
				setModel={vi.fn()}
				isAuthenticated={false}
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /select ai model/i }));
		// Guest sees 1 of the 2 live models (the paid one is gated).
		expect(screen.getByTestId("model-count-summary")).toHaveTextContent(
			"1 model available to you",
		);
	});

	it("BUG-G: the count summary shrinks as the search narrows the set", () => {
		render(
			<ModelSelector
				model="claude-opus-5"
				setModel={vi.fn()}
				isAuthenticated
			/>,
		);
		fireEvent.click(screen.getByRole("button", { name: /select ai model/i }));
		expect(screen.getByTestId("model-count-summary")).toHaveTextContent(
			"2 models available",
		);
		fireEvent.change(screen.getByLabelText("Search models"), {
			target: { value: "claude" },
		});
		expect(screen.getByTestId("model-count-summary")).toHaveTextContent(
			"1 model available",
		);
	});

	it("BUG-G: a stale saved id is flagged instead of showing an empty pill", () => {
		render(
			<ModelSelector
				model="model-that-was-retired"
				setModel={vi.fn()}
				isAuthenticated
			/>,
		);
		expect(screen.getByText("MODEL UNAVAILABLE")).toBeInTheDocument();
	});
});
