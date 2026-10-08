import { act, renderHook, waitFor } from "@testing-library/react";
import { StrictMode, useRef, useState, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/components/chat";
import {
	conversationHistoryStorageKey,
	conversationStorageKey,
} from "@/lib/chat-storage";
import { useConversationHistory } from "../useConversationHistory";

function message(content: string, timestamp: number): Message {
	return { role: "user", content, timestamp };
}

function useHarness(
	userId: string | null,
	enabled = true,
	preserveInitialModel = false,
	initialModel = "model-a",
	readCurrentDraft?: () => string,
) {
	const [messages, setMessages] = useState<Message[]>([]);
	const [input, setInput] = useState("");
	const [model, setModel] = useState(initialModel);
	const messagesRef = useRef<Message[]>([]);
	const history = useConversationHistory({
		enabled,
		userId,
		legacyStorageKey: conversationStorageKey(userId),
		messages,
		setMessages,
		messagesRef,
		input,
		setInput,
		readCurrentDraft,
		model,
		setModel,
		preserveInitialModel,
	});
	return {
		...history,
		messages,
		setMessages,
		input,
		setInput,
		model,
		setModel,
	};
}

describe("useConversationHistory", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.useFakeTimers({ shouldAdvanceTime: true });
	});

	afterEach(() => {
		vi.runOnlyPendingTimers();
		vi.useRealTimers();
		vi.restoreAllMocks();
		localStorage.clear();
	});

	it("migrates legacy messages and restores them after a reload", async () => {
		const legacy = [message("Legacy question", 1)];
		localStorage.setItem(conversationStorageKey(null), JSON.stringify(legacy));

		const first = renderHook(() => useHarness(null));
		await waitFor(() => expect(first.result.current.hydrated).toBe(true));
		expect(first.result.current.messages).toEqual(legacy);
		await act(async () => vi.advanceTimersByTime(450));
		expect(localStorage.getItem(conversationHistoryStorageKey(null))).toBeTruthy();
		act(() => first.unmount());

		const second = renderHook(() => useHarness(null));
		await waitFor(() => expect(second.result.current.hydrated).toBe(true));
		expect(second.result.current.messages).toEqual(legacy);
	});

	it("saves the current draft and model when switching threads", async () => {
		const { result } = renderHook(() => useHarness(null));
		await waitFor(() => expect(result.current.hydrated).toBe(true));
		const firstId = result.current.activeThreadId;

		act(() => {
			result.current.setMessages([message("First thread", 1)]);
			result.current.setInput("unfinished first draft");
			result.current.setModel("model-b");
		});
		act(() => result.current.newThread());
		const secondId = result.current.activeThreadId;
		expect(secondId).not.toBe(firstId);
		expect(result.current.messages).toEqual([]);

		act(() => {
			result.current.setMessages([message("Second thread", 2)]);
			result.current.setInput("second draft");
		});
		act(() => result.current.selectThread(firstId));

		expect(result.current.messages).toEqual([message("First thread", 1)]);
		expect(result.current.input).toBe("unfinished first draft");
		expect(result.current.model).toBe("model-b");
	});

	it("archives the live composer draft before React commits it", async () => {
		let liveComposerValue = "";
		const { result } = renderHook(() =>
			useHarness(null, true, false, "model-a", () => liveComposerValue),
		);
		await waitFor(() => expect(result.current.hydrated).toBe(true));
		const firstId = result.current.activeThreadId;
		const newThreadFromToolbarRender = result.current.newThread;

		liveComposerValue = "draft typed before React committed";
		act(() => newThreadFromToolbarRender());
		liveComposerValue = "";
		act(() => result.current.selectThread(firstId));

		expect(result.current.input).toBe("draft typed before React committed");
	});

	it("keeps an explicit initial model, then restores models on later switches", async () => {
		const stored = {
			version: 1,
			activeThreadId: "first",
			threads: [
				{
					id: "first",
					title: "First",
					customTitle: false,
					pinned: false,
					createdAt: 1,
					updatedAt: 1,
					messages: [message("First", 1)],
					draft: "",
					model: "thread-model-a",
				},
				{
					id: "second",
					title: "Second",
					customTitle: false,
					pinned: false,
					createdAt: 2,
					updatedAt: 2,
					messages: [message("Second", 2)],
					draft: "",
					model: "thread-model-b",
				},
			],
		};
		localStorage.setItem(
			conversationHistoryStorageKey(null),
			JSON.stringify(stored),
		);
		const { result } = renderHook(
			() => useHarness(null, true, true, "url-model"),
			{
				wrapper: ({ children }: { children: ReactNode }) => (
					<StrictMode>{children}</StrictMode>
				),
			},
		);
		await waitFor(() => expect(result.current.hydrated).toBe(true));

		expect(result.current.model).toBe("url-model");
		act(() => result.current.selectThread("second"));
		expect(result.current.model).toBe("thread-model-b");
		act(() => result.current.selectThread("first"));
		expect(result.current.model).toBe("url-model");
	});

	it("flushes archived threads, the selected thread, draft, and model on unmount", async () => {
		const first = renderHook(() => useHarness(null));
		await waitFor(() => expect(first.result.current.hydrated).toBe(true));
		const archivedId = first.result.current.activeThreadId;
		act(() => {
			first.result.current.setMessages([message("Archived", 1)]);
			first.result.current.setInput("archived draft");
			first.result.current.setModel("model-b");
		});
		act(() => first.result.current.newThread());
		const selectedId = first.result.current.activeThreadId;
		act(() => {
			first.result.current.setInput("selected draft");
			first.result.current.setModel("model-c");
		});
		act(() => first.unmount());

		const second = renderHook(() => useHarness(null));
		await waitFor(() => expect(second.result.current.hydrated).toBe(true));
		expect(second.result.current.activeThreadId).toBe(selectedId);
		expect(second.result.current.input).toBe("selected draft");
		expect(second.result.current.model).toBe("model-c");
		act(() => second.result.current.selectThread(archivedId));
		expect(second.result.current.messages).toEqual([message("Archived", 1)]);
		expect(second.result.current.input).toBe("archived draft");
		expect(second.result.current.model).toBe("model-b");
	});

	it("hydrates a different account before writing to its bucket", async () => {
		localStorage.setItem(
			conversationStorageKey("alice"),
			JSON.stringify([message("Alice", 1)]),
		);
		localStorage.setItem(
			conversationStorageKey("bob"),
			JSON.stringify([message("Bob", 2)]),
		);
		const { result, rerender } = renderHook(
			({ userId }) => useHarness(userId),
			{ initialProps: { userId: "alice" as string | null } },
		);
		await waitFor(() => expect(result.current.messages[0]?.content).toBe("Alice"));

		rerender({ userId: "bob" });
		await waitFor(() => expect(result.current.messages[0]?.content).toBe("Bob"));
		await act(async () => vi.advanceTimersByTime(450));

		const bobRaw = localStorage.getItem(conversationHistoryStorageKey("bob"));
		expect(bobRaw).toContain("Bob");
		expect(bobRaw).not.toContain("Alice");
	});

	it("keeps every other thread when deleting one", async () => {
		const { result } = renderHook(() => useHarness(null));
		await waitFor(() => expect(result.current.hydrated).toBe(true));
		const firstId = result.current.activeThreadId;
		act(() => result.current.newThread());
		const secondId = result.current.activeThreadId;
		act(() => result.current.newThread());
		const thirdId = result.current.activeThreadId;

		act(() => result.current.deleteThread(secondId));

		expect(result.current.threads.map((thread) => thread.id)).toEqual(
			expect.arrayContaining([firstId, thirdId]),
		);
		expect(result.current.threads.some((thread) => thread.id === secondId)).toBe(
			false,
		);
	});

	it("surfaces a storage failure and does not retry with a reduced history", async () => {
		const setItem = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(() => {
				throw new DOMException("quota", "QuotaExceededError");
			});
		const { result } = renderHook(() => useHarness(null));
		await waitFor(() => expect(result.current.hydrated).toBe(true));

		act(() => result.current.setMessages([message("Keep this", 1)]));
		await act(async () => vi.advanceTimersByTime(450));

		expect(result.current.persistenceStatus).toBe("error");
		expect(result.current.persistenceError).toMatch(/export/i);
		expect(setItem).toHaveBeenCalledTimes(1);
		expect(result.current.threads).toHaveLength(1);
		expect(result.current.threads[0]?.messages).toEqual([
			message("Keep this", 1),
		]);
	});

	it("imports into a new thread while preserving the active conversation", async () => {
		const { result } = renderHook(() => useHarness(null));
		await waitFor(() => expect(result.current.hydrated).toBe(true));
		const originalId = result.current.activeThreadId;
		act(() => {
			result.current.setMessages([message("Original", 1)]);
			result.current.setInput("original draft");
		});

		act(() => result.current.importThread([message("Imported", 2)]));

		expect(result.current.activeThreadId).not.toBe(originalId);
		expect(result.current.messages).toEqual([message("Imported", 2)]);
		expect(result.current.input).toBe("");
		const original = result.current.threads.find((thread) => thread.id === originalId);
		expect(original?.messages).toEqual([message("Original", 1)]);
		expect(original?.draft).toBe("original draft");
	});
});
