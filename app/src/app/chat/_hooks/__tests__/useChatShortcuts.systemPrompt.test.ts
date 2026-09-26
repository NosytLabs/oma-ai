/**
 * BUG-C regression test: Cmd/Ctrl+Shift+P used to dispatch a
 * `oma:toggle-system-prompt` CustomEvent that nothing in the app listened
 * for, so the shortcut was dead — it ate the keystroke and toggled nothing.
 * It must now flip the real system-prompt state.
 */
import { renderHook } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useChatShortcuts } from "../useChatShortcuts";

const mounts: { unmount: () => void }[] = [];

function mountShortcuts(overrides: Partial<Parameters<typeof useChatShortcuts>[0]> = {}) {
	const setSystemPromptOpen = vi.fn();
	const options = {
		sendMessageRef: { current: vi.fn(async () => {}) } as never,
		input: "",
		loading: false,
		shortcutsOpen: false,
		setShortcutsOpen: vi.fn(),
		paramsOpen: false,
		setParamsOpen: vi.fn(),
		compareMode: false,
		setCompareMode: vi.fn(),
		setSystemPromptOpen,
		...overrides,
	};
	const view = renderHook(() => useChatShortcuts(options));
	mounts.push(view);
	return { setSystemPromptOpen };
}

/** The hook reads navigator.platform to pick metaKey (Mac) vs ctrlKey. */
function modKey(): "metaKey" | "ctrlKey" {
	return /Mac|iPhone|iPad/.test(navigator.platform) ? "metaKey" : "ctrlKey";
}

function press(init: KeyboardEventInit) {
	act(() => {
		window.dispatchEvent(new KeyboardEvent("keydown", { ...init, bubbles: true }));
	});
}

describe("useChatShortcuts — system prompt toggle", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	afterEach(() => {
		for (const m of mounts) m.unmount();
		mounts.length = 0;
	});

	it("Ctrl+Shift+P toggles the system prompt panel instead of firing a dead event", () => {
		const { setSystemPromptOpen } = mountShortcuts();
		press({ key: "P", [modKey()]: true, shiftKey: true });
		expect(setSystemPromptOpen).toHaveBeenCalledTimes(1);
		const updater = setSystemPromptOpen.mock.calls[0][0] as (v: boolean) => boolean;
		expect(updater(false)).toBe(true);
	});

	it("Meta+Shift+P toggles it on macOS", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("MacIntel");
		const { setSystemPromptOpen } = mountShortcuts();
		press({ key: "p", metaKey: true, shiftKey: true });
		expect(setSystemPromptOpen).toHaveBeenCalledTimes(1);
	});

	it("no longer dispatches the oma:toggle-system-prompt event", () => {
		const listener = vi.fn();
		window.addEventListener("oma:toggle-system-prompt", listener);
		const { setSystemPromptOpen } = mountShortcuts();
		press({ key: "P", [modKey()]: true, shiftKey: true });
		expect(setSystemPromptOpen).toHaveBeenCalled();
		expect(listener).not.toHaveBeenCalled();
		window.removeEventListener("oma:toggle-system-prompt", listener);
	});
});
