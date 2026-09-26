/**
 * BUG-H regression test: a compare-only stream failure used to be written
 * into the primary `error` state, which renders in the main ChatErrorBanner
 * above the composer — so a healthy primary conversation showed an error
 * belonging to an unrelated side stream. The compare panel now owns that
 * state and renders it in its own slot.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelComparePanel } from "../ModelComparePanel";

vi.mock("../chat-message-shared", async () => {
	const actual =
		await vi.importActual<typeof import("../chat-message-shared")>(
			"../chat-message-shared",
		);
	return {
		...actual,
		useSharedLiveModels: () => [
			{
				id: "deepseek-v4-flash-0731-openbroker",
				name: "DeepSeek V4 Flash",
				category: "budget",
				ctx: "400K",
				inputPer1M: 0.5,
				provider: "oma-ai",
			},
		],
	};
});

describe("ModelComparePanel — compare error surface (BUG-H)", () => {
	const baseProps = {
		open: true,
		onClose: vi.fn(),
		primaryModel: "deepseek-v4-flash-0731-openbroker",
		compareModel: "deepseek-v4-flash-0731-openbroker",
		setCompareModel: vi.fn(),
		prompt: "",
		onSubmit: vi.fn(),
		loading: false,
		compareMessages: [],
	};

	it("renders nothing extra when there is no compare error", () => {
		render(<ModelComparePanel {...baseProps} />);
		expect(screen.queryByTestId("compare-error")).toBeNull();
	});

	it("surfaces a compare failure inside the panel and can dismiss it", () => {
		const onDismissError = vi.fn();
		render(
			<ModelComparePanel
				{...baseProps}
				error="claude-opus-5 failed — 402 insufficient credits"
				onDismissError={onDismissError}
			/>,
		);
		const banner = screen.getByTestId("compare-error");
		expect(banner).toHaveTextContent("claude-opus-5 failed");
		// It lives inside the compare aside, not in the primary page.
		expect(
			screen.getByRole("complementary", { name: /model comparison panel/i }),
		).toContainElement(banner);
		fireEvent.click(
			screen.getByRole("button", { name: /dismiss comparison error/i }),
		);
		expect(onDismissError).toHaveBeenCalledTimes(1);
	});
});
