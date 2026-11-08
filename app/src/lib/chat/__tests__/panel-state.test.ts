import { describe, expect, it } from "vitest";
import {
	CHAT_PANEL,
	CLOSED_CHAT_PANELS,
	anyPanelOpen,
	closeAllPanels,
	isPanelOpen,
	openPanels,
	setPanelOpen,
	togglePanel,
} from "../panel-state";

describe("chat panel machine", () => {
	it("starts with every panel closed", () => {
		expect(anyPanelOpen(CLOSED_CHAT_PANELS)).toBe(false);
		expect(openPanels(CLOSED_CHAT_PANELS)).toEqual([]);
	});

	it("toggles one panel without touching the others", () => {
		const opened = togglePanel(CLOSED_CHAT_PANELS, CHAT_PANEL.Params);
		expect(isPanelOpen(opened, CHAT_PANEL.Params)).toBe(true);
		expect(isPanelOpen(opened, CHAT_PANEL.Shortcuts)).toBe(false);

		const closed = togglePanel(opened, CHAT_PANEL.Params);
		expect(isPanelOpen(closed, CHAT_PANEL.Params)).toBe(false);
	});

	it("keeps panels independent, as the UI has always allowed", () => {
		const state = setPanelOpen(
			setPanelOpen(CLOSED_CHAT_PANELS, CHAT_PANEL.Params, true),
			CHAT_PANEL.Shortcuts,
			true,
		);
		expect(openPanels(state)).toEqual([CHAT_PANEL.Params, CHAT_PANEL.Shortcuts]);
	});

	it("returns the same object when nothing changes", () => {
		expect(setPanelOpen(CLOSED_CHAT_PANELS, CHAT_PANEL.Params, false)).toBe(
			CLOSED_CHAT_PANELS,
		);
	});

	it("closes every panel at once", () => {
		const state = togglePanel(CLOSED_CHAT_PANELS, CHAT_PANEL.Advanced);
		expect(anyPanelOpen(state)).toBe(true);
		expect(anyPanelOpen(closeAllPanels())).toBe(false);
	});
});
