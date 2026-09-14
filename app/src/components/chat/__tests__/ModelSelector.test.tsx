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
});
