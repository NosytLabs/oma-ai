/**
 * BUG-I regression test: when a parameter save fails, the panel must say so
 * (and offer a dismiss) instead of silently showing a value the browser
 * never stored.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsPanel } from "../SettingsPanel";

vi.mock("../chat-message-shared", () => ({
	useSharedLiveModels: () => [
		{
			id: "deepseek-v4-flash-0731-openbroker",
			name: "DeepSeek V4 Flash",
			category: "budget",
			ctx: "400K",
			inputPer1M: 0.5,
			outputPer1M: 1.5,
			provider: "oma-ai",
		},
	],
}));

const baseProps = {
	temperature: 0.7,
	setTemperature: vi.fn(),
	topP: 1,
	setTopP: vi.fn(),
	maxTokens: 2048,
	setMaxTokens: vi.fn(),
	topK: 40,
	setTopK: vi.fn(),
	freqPenalty: 0,
	setFreqPenalty: vi.fn(),
	presPenalty: 0,
	setPresPenalty: vi.fn(),
	stream: true,
	setStream: vi.fn(),
	showAdvanced: false,
	setShowAdvanced: vi.fn(),
	model: "deepseek-v4-flash-0731-openbroker",
};

describe("SettingsPanel — save failure (BUG-I)", () => {
	it("renders no error banner when there is no save error", () => {
		render(<SettingsPanel {...baseProps} />);
		expect(screen.queryByTestId("settings-save-error")).toBeNull();
	});

	it("surfaces the save error and dismisses it", () => {
		const onDismissSaveError = vi.fn();
		render(
			<SettingsPanel
				{...baseProps}
				saveError="Couldn't save this setting in your browser — change reverted"
				onDismissSaveError={onDismissSaveError}
			/>,
		);
		const banner = screen.getByTestId("settings-save-error");
		expect(banner).toHaveTextContent(/couldn't save this setting/i);
		fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
		expect(onDismissSaveError).toHaveBeenCalledTimes(1);
	});
});
