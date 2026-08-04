/**
 * Ensures empty conversation clears storage key (no resurrect-after-clear race).
 */
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef, useState } from "react";
import type { Message } from "@/components/chat";
import { useChatPersistence } from "../useChatPersistence";

const KEY = "oma_chat_conversation_test_clear";
const PROMPT_KEY = "oma_chat_system_prompt_test_clear";

function useHarness() {
	const [messages, setMessages] = useState<Message[]>([]);
	const [systemPrompt, setSystemPrompt] = useState("");
	const [, setSystemPromptOpen] = useState(false);
	const messagesRef = useRef<Message[]>([]);
	useChatPersistence({
		messages,
		setMessages,
		systemPrompt,
		setSystemPrompt,
		setSystemPromptOpen,
		messagesRef,
		storageKey: KEY,
		systemPromptKey: PROMPT_KEY,
	});
	return { messages, setMessages };
}

describe("useChatPersistence clear path", () => {
	beforeEach(() => {
		localStorage.clear();
	});
	afterEach(() => {
		localStorage.clear();
	});

	it("removes conversation key when messages become empty", () => {
		// Seed storage as if a prior session wrote a thread
		localStorage.setItem(
			KEY,
			JSON.stringify([
				{ role: "user", content: "hello", timestamp: Date.now() },
			]),
		);
		expect(localStorage.getItem(KEY)).toBeTruthy();

		const { result } = renderHook(() => useHarness());

		// Hydrate may load messages; force clear like clearChat does
		act(() => {
			result.current.setMessages([]);
		});

		expect(localStorage.getItem(KEY)).toBeNull();
	});
});
