import { afterEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/components/chat";
import {
	CONVERSATION_HISTORY_VERSION,
	conversationHistoryStorageKey,
	createConversationThread,
	loadConversationHistory,
	persistConversationHistory,
} from "../chat-storage";

const legacyMessages: Message[] = [
	{
		id: "u1",
		role: "user",
		content: "Explain sparse attention",
		timestamp: 100,
	},
	{
		id: "a1",
		role: "assistant",
		content: "Sparse attention limits which tokens attend to one another.",
		timestamp: 101,
		model: "test-model",
		format: "openui",
	} as Message,
];

describe("conversation history storage", () => {
	afterEach(() => localStorage.clear());

	it("uses a separate history key for guests and every account", () => {
		expect(conversationHistoryStorageKey(null)).toBe(
			"oma_chat_history:v1:guest",
		);
		expect(conversationHistoryStorageKey("alice")).toBe(
			"oma_chat_history:v1:u:alice",
		);
		expect(conversationHistoryStorageKey("bob")).not.toBe(
			conversationHistoryStorageKey("alice"),
		);
	});

	it("migrates a legacy single conversation without deleting or narrowing its messages", () => {
		localStorage.setItem("legacy", JSON.stringify(legacyMessages));

		const result = loadConversationHistory(localStorage, {
			historyKey: "history",
			legacyKey: "legacy",
			model: "test-model",
			createId: () => "thread-1",
			now: () => 500,
		});

		expect(result.source).toBe("legacy");
		expect(result.canPersist).toBe(true);
		expect(result.history).toEqual({
			version: CONVERSATION_HISTORY_VERSION,
			activeThreadId: "thread-1",
			threads: [
				expect.objectContaining({
					id: "thread-1",
					title: "Explain sparse attention",
					messages: legacyMessages,
					model: "test-model",
				}),
			],
		});
		expect(localStorage.getItem("legacy")).toBe(JSON.stringify(legacyMessages));
	});

	it("round trips optional message fields instead of rebuilding message objects", () => {
		const thread = createConversationThread({
			id: "thread-1",
			now: 500,
			model: "test-model",
			messages: legacyMessages,
		});
		const history: Parameters<typeof persistConversationHistory>[2] = {
			version: CONVERSATION_HISTORY_VERSION,
			activeThreadId: thread.id,
			threads: [thread],
		};

		expect(persistConversationHistory(localStorage, "history", history)).toBe(
			true,
		);
		const loaded = loadConversationHistory(localStorage, {
			historyKey: "history",
			legacyKey: "legacy",
			model: "fallback",
			createId: () => "unused",
			now: () => 900,
		});

		expect(loaded.source).toBe("history");
		expect(loaded.history.threads[0]?.messages[1]).toEqual(legacyMessages[1]);
	});

	it("does not replace an unreadable history with an empty state", () => {
		localStorage.setItem("history", "{not-json");
		localStorage.setItem("legacy", JSON.stringify(legacyMessages));

		const loaded = loadConversationHistory(localStorage, {
			historyKey: "history",
			legacyKey: "legacy",
			model: "test-model",
			createId: () => "thread-1",
			now: () => 500,
		});

		expect(loaded.canPersist).toBe(false);
		expect(loaded.error).toMatch(/could not be read/i);
		expect(localStorage.getItem("history")).toBe("{not-json");
	});

	it("disables writes when browser storage cannot be read", () => {
		const setItem = vi.fn();
		const loaded = loadConversationHistory(
			{
				getItem: () => {
					throw new DOMException("blocked", "SecurityError");
				},
				setItem,
			},
			{
				historyKey: "history",
				legacyKey: "legacy",
				model: "test-model",
				createId: () => "thread-1",
				now: () => 500,
			},
		);

		expect(loaded.canPersist).toBe(false);
		expect(loaded.error).toMatch(/could not be read/i);
		expect(setItem).not.toHaveBeenCalled();
	});

	it("reports storage write failures without trimming or deleting threads", () => {
		const first = createConversationThread({
			id: "first",
			now: 1,
			model: "one",
			messages: legacyMessages,
		});
		const second = createConversationThread({
			id: "second",
			now: 2,
			model: "two",
		});
		const storage = {
			getItem: () => null,
			setItem: () => {
				throw new DOMException("quota", "QuotaExceededError");
			},
			removeItem: () => {},
		};
		const history: Parameters<typeof persistConversationHistory>[2] = {
			version: CONVERSATION_HISTORY_VERSION,
			activeThreadId: second.id,
			threads: [first, second],
		};

		expect(persistConversationHistory(storage, "history", history)).toBe(false);
		expect(history.threads).toHaveLength(2);
		expect(history.threads[0]?.messages).toEqual(legacyMessages);
	});
});
