import { afterEach, describe, expect, it } from "vitest";
import {
	conversationStorageKey,
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

});
