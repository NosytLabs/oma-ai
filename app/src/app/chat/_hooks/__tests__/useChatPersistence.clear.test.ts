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

function storage(): Storage {
	// Prefer window (jsdom) then global — Node 26 bare `localStorage` can be a
	// broken host getter unless setup.ts has rebound it.
	const s =
		(typeof window !== "undefined" ? window.localStorage : undefined) ??
		globalThis.localStorage;
	if (!s || typeof s.clear !== "function") {
		throw new Error("localStorage is not available in this test environment");
	}
	return s;
}

describe("useChatPersistence clear path", () => {
	beforeEach(() => {
		storage().clear();
	});
	afterEach(() => {
		storage().clear();
	});

	it("removes conversation key when messages become empty", () => {
		// Seed storage as if a prior session wrote a thread
		storage().setItem(
			KEY,
			JSON.stringify([
				{ role: "user", content: "hello", timestamp: Date.now() },
			]),
		);
		expect(storage().getItem(KEY)).toBeTruthy();

		const { result } = renderHook(() => useHarness());

		// Hydrate may load messages; force clear like clearChat does
		act(() => {
			result.current.setMessages([]);
		});

		expect(storage().getItem(KEY)).toBeNull();
	});
});
