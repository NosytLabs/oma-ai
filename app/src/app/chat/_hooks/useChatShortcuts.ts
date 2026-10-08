"use client";

import type { Dispatch, RefObject, SetStateAction } from "react";
import { useEffect } from "react";

interface UseChatShortcutsOptions {
	sendMessageRef: RefObject<(prompt?: string) => Promise<void>>;
	input: string;
	loading: boolean;
	shortcutsOpen: boolean;
	setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
	paramsOpen: boolean;
	setParamsOpen: Dispatch<SetStateAction<boolean>>;
	compareMode: boolean;
	setCompareMode: Dispatch<SetStateAction<boolean>>;
	setSystemPromptOpen: Dispatch<SetStateAction<boolean>>;
	newConversation?: () => void;
}

/** Chat shortcuts run after focused controls have handled their own keys. */
export function useChatShortcuts({
	sendMessageRef,
	input,
	loading,
	shortcutsOpen,
	setShortcutsOpen,
	paramsOpen,
	setParamsOpen,
	compareMode,
	setCompareMode,
	setSystemPromptOpen,
	newConversation,
}: UseChatShortcutsOptions): void {
	useEffect(() => {
		const isMac =
			typeof navigator !== "undefined" &&
			/Mac|iPhone|iPad/.test(navigator.platform);
		const modKey = isMac ? "metaKey" : "ctrlKey";

		const handler = (e: KeyboardEvent) => {
			if (e.defaultPrevented || e.isComposing) return;
			const target = e.target as HTMLElement | null;
			const inTextField =
				!!target &&
				(target.tagName === "TEXTAREA" ||
					target.tagName === "INPUT" ||
					target.isContentEditable);

			if ((e.key === "?" || (e.key === "/" && e.shiftKey)) && !inTextField) {
				e.preventDefault();
				setShortcutsOpen(true);
				return;
			}

			if (e.key === "Escape") {
				if (shortcutsOpen) setShortcutsOpen(false);
				else if (paramsOpen) setParamsOpen(false);
				else if (compareMode) setCompareMode(false);
				return;
			}

			if (e[modKey] && e.key.toLowerCase() === "n") {
				if (inTextField) return;
				if (!newConversation) return;
				e.preventDefault();
				newConversation();
				return;
			}

			// Cmd/Ctrl+Shift+P → toggle the system prompt panel
			if (
				e[modKey] &&
				e.shiftKey &&
				e.key.toLowerCase() === "p"
			) {
				e.preventDefault();
				setSystemPromptOpen((v) => !v);
				return;
			}

			if (e[modKey] && e.key.toLowerCase() === "k") {
				e.preventDefault();
				document.querySelector<HTMLButtonElement>(
					'header[aria-label="Chat toolbar"] button[aria-label^="Select AI model"]',
				)?.click();
				return;
			}

			if (e[modKey] && e.key === "/") {
				e.preventDefault();
				setParamsOpen((v) => !v);
				return;
			}

			if (e[modKey] && e.key === "Enter") {
				e.preventDefault();
				if (input.trim() && !loading) {
					void sendMessageRef.current();
				}
				return;
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [
		input,
		loading,
		paramsOpen,
		compareMode,
		shortcutsOpen,
		sendMessageRef,
		setShortcutsOpen,
		setParamsOpen,
		setCompareMode,
		setSystemPromptOpen,
		newConversation,
	]);
}
