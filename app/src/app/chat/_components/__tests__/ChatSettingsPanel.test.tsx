import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChatSettingsPanel } from "../ChatSettingsPanel";

vi.mock("next/dynamic", () => ({ default: () => () => null }));

function Harness() {
	const [open, setOpen] = useState(false);
	return <>
		<button onClick={() => setOpen(true)}>Open parameters</button>
		<ChatSettingsPanel paramsOpen={open} setParamsOpen={setOpen}
			temperature={0.7} setTemperature={() => {}} topP={1} setTopP={() => {}}
			freqPenalty={0} setFreqPenalty={() => {}} presPenalty={0} setPresPenalty={() => {}}
			maxTokens={2048} setMaxTokens={() => {}} topK={40} setTopK={() => {}}
			stream showAdvanced={false} setStream={() => {}} setShowAdvanced={() => {}} model="minimax-m2-7" />
	</>;
}

afterEach(() => vi.restoreAllMocks());

describe("mobile chat parameters", () => {
	it("keeps keyboard focus in the dialog and restores it after Escape", async () => {
		vi.spyOn(window, "matchMedia").mockReturnValue({ matches: true, media: "(max-width: 767px)", addEventListener: vi.fn(), removeEventListener: vi.fn() } as unknown as MediaQueryList);
		render(<Harness />);
		const trigger = screen.getByRole("button", { name: "Open parameters" });
		trigger.focus();
		fireEvent.click(trigger);
		const dialog = await screen.findByRole("dialog", { name: "Model parameters" });
		const close = within(dialog).getByRole("button", { name: "Close parameters panel" });
		await waitFor(() => expect(close).toHaveFocus());
		fireEvent.keyDown(close, { key: "Tab", shiftKey: true });
		expect(close).toHaveFocus();
		fireEvent.keyDown(close, { key: "Escape" });
		await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
		expect(trigger).toHaveFocus();
	});
});
