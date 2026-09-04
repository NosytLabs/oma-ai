import { afterEach, describe, expect, it } from "vitest";
import {
	conversationStorageKey,
	MAX_PERSISTED_MESSAGES,
	persistMessages,
	systemPromptStorageKey,
} from "../chat-storage";

describe("chat-storage", () => {
	afterEach(() => {
		localStorage.clear();
	});

	it("scopes keys per identity", () => {
		expect(conversationStorageKey(null)).toBe("oma_chat_conversation:guest");
		expect(conversationStorageKey("abc")).toBe("oma_chat_conversation:u:abc");
		expect(systemPromptStorageKey("abc")).toBe("oma_chat_system_prompt:u:abc");
	});

	it("caps persisted threads", () => {
		const msgs = Array.from({ length: MAX_PERSISTED_MESSAGES + 25 }, (_, i) => ({
			i,
		}));
		expect(persistMessages("k", msgs)).toBe(true);
		const stored = JSON.parse(localStorage.getItem("k") ?? "[]") as { i: number }[];
		expect(stored).toHaveLength(MAX_PERSISTED_MESSAGES);
		expect(stored[0]?.i).toBe(25);
	});
});