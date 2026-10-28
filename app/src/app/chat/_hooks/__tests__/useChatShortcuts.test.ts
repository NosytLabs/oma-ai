import { cleanup, fireEvent, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useChatShortcuts } from "../useChatShortcuts";

type ShortcutState = Pick<Parameters<typeof useChatShortcuts>[0],
	"input" | "loading" | "shortcutsOpen" | "paramsOpen" | "compareMode">;

function mountShortcuts(overrides: Partial<ShortcutState> = {}) {
	const composer = document.createElement("textarea");
	document.body.append(composer);
	const options = {
		sendMessageRef: { current: vi.fn(async () => {}) },
		inputRef: { current: composer },
		input: "A useful question",
		loading: false,
		shortcutsOpen: false,
		setShortcutsOpen: vi.fn(),
		paramsOpen: false,
		setParamsOpen: vi.fn(),
		compareMode: false,
		setCompareMode: vi.fn(),
		setSystemPromptOpen: vi.fn(),
		newConversation: vi.fn(),
		...overrides,
	};
	const view = renderHook(() => useChatShortcuts(options));
	return { ...options, ...view };
}

function press(key: string, options: KeyboardEventInit = {}, target: Element | Window = window) {
	return fireEvent(target, new KeyboardEvent("keydown", {
		key, bubbles: true, cancelable: true, ...options,
	}));
}

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("useChatShortcuts", () => {
	it.each([
		["Linux x86_64", "ctrlKey"],
		["MacIntel", "metaKey"],
	] as const)("opens the current chat model picker on %s", (platform, modifier) => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
		const toolbar = document.createElement("header");
		toolbar.setAttribute("aria-label", "Chat toolbar");
		const picker = document.createElement("button");
		picker.setAttribute("aria-label", "Select AI model — DeepSeek V4 Flash");
		const openPicker = vi.fn();
		picker.addEventListener("click", openPicker);
		toolbar.append(picker);
		document.body.append(toolbar);
		mountShortcuts();

		expect(press("k", { [modifier]: true })).toBe(false);
		expect(openPicker).toHaveBeenCalledOnce();
	});

	it.each([
		["Linux x86_64", "ctrlKey"],
		["MacIntel", "metaKey"],
	] as const)("toggles instructions on %s", (platform, modifier) => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue(platform);
		const { setSystemPromptOpen } = mountShortcuts();
		press("P", { [modifier]: true, shiftKey: true });
		expect(setSystemPromptOpen).toHaveBeenCalledOnce();
		const update = setSystemPromptOpen.mock.calls[0][0] as (open: boolean) => boolean;
		expect(update(false)).toBe(true);
		expect(update(true)).toBe(false);
	});

	it("keeps the parameters panel open when a menu already handled Escape", () => {
		const { setParamsOpen } = mountShortcuts({ paramsOpen: true });
		const menu = document.createElement("div");
		menu.addEventListener("keydown", (event) => event.preventDefault());
		document.body.append(menu);
		press("Escape", {}, menu);
		expect(setParamsOpen).not.toHaveBeenCalled();
	});

	it("closes only the foremost chat panel on an unhandled Escape", () => {
		const { setShortcutsOpen, setParamsOpen, setCompareMode } = mountShortcuts({
			shortcutsOpen: true, paramsOpen: true, compareMode: true,
		});
		press("Escape");
		expect(setShortcutsOpen).toHaveBeenCalledWith(false);
		expect(setParamsOpen).not.toHaveBeenCalled();
		expect(setCompareMode).not.toHaveBeenCalled();
	});

	it("starts a saved-history conversation without a destructive-clear confirmation", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
		const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
		const message = document.createElement("div");
		message.dataset.role = "chat-message";
		document.body.append(message);
		const { newConversation } = mountShortcuts();
		press("n", { ctrlKey: true });
		expect(newConversation).toHaveBeenCalledOnce();
		expect(confirm).not.toHaveBeenCalled();
	});

	it("leaves typing shortcuts and question marks in the composer", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
		const { newConversation, setShortcutsOpen } = mountShortcuts();
		const textarea = document.createElement("textarea");
		document.body.append(textarea);
		expect(press("n", { ctrlKey: true }, textarea)).toBe(true);
		expect(press("?", {}, textarea)).toBe(true);
		expect(newConversation).not.toHaveBeenCalled();
		expect(setShortcutsOpen).not.toHaveBeenCalled();
	});

	it("does not send an IME composition or a key already handled by the composer", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
		const { sendMessageRef, inputRef } = mountShortcuts();
		press("Enter", { ctrlKey: true, isComposing: true }, inputRef.current);
		const textarea = inputRef.current;
		textarea.addEventListener("keydown", (event) => event.preventDefault());
		press("Enter", { ctrlKey: true }, textarea);
		expect(sendMessageRef.current).not.toHaveBeenCalled();
	});

	it("does not send the draft when the shortcut is pressed in another field", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
		const { sendMessageRef } = mountShortcuts();
		const instructions = document.createElement("textarea");
		instructions.setAttribute("aria-label", "System prompt");
		document.body.append(instructions);
		expect(press("Enter", { ctrlKey: true }, instructions)).toBe(true);
		expect(sendMessageRef.current).not.toHaveBeenCalled();
	});

	it("sends through the latest handler and removes its listener on unmount", () => {
		vi.spyOn(navigator, "platform", "get").mockReturnValue("Linux x86_64");
		const { sendMessageRef, inputRef, unmount } = mountShortcuts();
		const latest = vi.fn(async () => {});
		sendMessageRef.current = latest;
		press("Enter", { ctrlKey: true }, inputRef.current);
		expect(latest).toHaveBeenCalledOnce();
		unmount();
		press("Enter", { ctrlKey: true }, inputRef.current);
		expect(latest).toHaveBeenCalledOnce();
	});
});
