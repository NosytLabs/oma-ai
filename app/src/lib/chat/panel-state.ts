/**
 * The chat panel machine.
 *
 * The playground tracked four independent booleans — parameters, advanced
 * settings, the system prompt and the shortcut sheet — each with its own
 * `setX(!x)` toggle. Four booleans is sixteen reachable states, of which
 * several are meaningless (parameters and the shortcut sheet open at the
 * same time), and none of them could be inspected as a single value.
 *
 * This module keeps the same behaviour — panels are independent, more than
 * one may be open — while making the state explicit: one record, one
 * vocabulary, one place that knows how to toggle, open and close.
 *
 * If the product later wants mutual exclusion (opening one panel closes the
 * others), that is a change to ONE function here, not to four call sites.
 */

export const CHAT_PANEL = {
	/** Model parameters (temperature, top-p, …). */
	Params: "params",
	/** The advanced settings section. */
	Advanced: "advanced",
	/** The system prompt editor. */
	SystemPrompt: "system-prompt",
	/** The keyboard shortcut sheet. */
	Shortcuts: "shortcuts",
} as const;

export type ChatPanel = (typeof CHAT_PANEL)[keyof typeof CHAT_PANEL];

export type ChatPanelState = Record<ChatPanel, boolean>;

/** Every panel closed. */
export const CLOSED_CHAT_PANELS: ChatPanelState = {
	[CHAT_PANEL.Params]: false,
	[CHAT_PANEL.Advanced]: false,
	[CHAT_PANEL.SystemPrompt]: false,
	[CHAT_PANEL.Shortcuts]: false,
};

/** True when the panel is open. */
export function isPanelOpen(state: ChatPanelState, panel: ChatPanel): boolean {
	return state[panel];
}

/** Opens or closes one panel, leaving the others alone. */
export function setPanelOpen(
	state: ChatPanelState,
	panel: ChatPanel,
	open: boolean,
): ChatPanelState {
	if (state[panel] === open) return state;
	return { ...state, [panel]: open };
}

/** Flips one panel. */
export function togglePanel(state: ChatPanelState, panel: ChatPanel): ChatPanelState {
	return setPanelOpen(state, panel, !state[panel]);
}

/** The panels that are currently open, in a stable order. */
export function openPanels(state: ChatPanelState): ChatPanel[] {
	return (Object.keys(state) as ChatPanel[]).filter((panel) => state[panel]);
}

/** True when at least one panel is open. */
export function anyPanelOpen(state: ChatPanelState): boolean {
	return openPanels(state).length > 0;
}

/** Closes every panel. */
export function closeAllPanels(): ChatPanelState {
	return { ...CLOSED_CHAT_PANELS };
}
