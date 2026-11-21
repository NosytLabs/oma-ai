/**
 * Stall / stop behaviour for useStreamingChat (audit 2026-11-20).
 *
 * Live, the guest free chat sat on "STREAMING…" with 0 tokens and no
 * error for over two minutes when the provider went silent, and pressing
 * Stop deleted the empty assistant bubble so the attempt vanished. These
 * tests pin the fix:
 *   1. A stream that produces no data inside the watchdog window fails
 *      with a visible error and keeps the attempt, marked interrupted.
 *   2. A user Stop keeps the user message AND the assistant placeholder,
 *      marked interrupted, instead of erasing the attempt.
 *
 * The watchdog windows are shortened via a partial mock of chat-stream;
 * createStreamWatchdog itself stays the real implementation.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/components/chat";
import { useStreamingChat } from "../useStreamingChat";

const { toastMock } = vi.hoisted(() => {
	const toast = {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
	};
	return { toastMock: { toast, useToast: () => toast } };
});

vi.mock("@/components/ui/Toast", () => toastMock);

vi.mock("@/lib/api", () => ({
	api: {
		auth: {
			listKeys: vi.fn(async () => ({})),
			createKey: vi.fn(async () => ({ key: "oma_sk_test" })),
			installKeyCookie: vi.fn(async () => ({ success: true })),
		},
	},
}));

vi.mock("@/lib/chat-stream", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@/lib/chat-stream")>();
	return {
		...actual,
		createStreamWatchdog: (
			parent: AbortSignal,
			opts?: { firstDataMs?: number; idleMs?: number },
		) => actual.createStreamWatchdog(parent, { firstDataMs: 250, idleMs: 250, ...opts }),
	};
});

/** A fetch whose response body never emits and errors when aborted. */
function hangingFetch() {
	return vi.fn(async (_url: unknown, init?: { signal?: AbortSignal }) =>
		new Response(
			new ReadableStream<Uint8Array>({
				start(controller) {
					init?.signal?.addEventListener("abort", () => {
						try {
							controller.error(new DOMException("The operation was aborted", "AbortError"));
						} catch {
							// stream already closed
						}
					});
				},
			}),
			{ status: 200, headers: { "Content-Type": "text/event-stream" } },
		),
	);
}

interface Handlers {
	loading: boolean;
	error: string | null;
	messages: Message[];
}

function mountChat() {
	const state: Handlers = { loading: false, error: null, messages: [] };
	const opts = {
		ownerKey: "guest:stall-thread",
		messagesRef: { current: state.messages } as { current: Message[] },
		compareMessagesRef: { current: [] as Message[] } as { current: Message[] },
		input: "hello",
		loading: false,
		setInput: vi.fn(),
		setMessages: ((updater: unknown) => {
			state.messages =
				typeof updater === "function"
					? (updater as (p: Message[]) => Message[])(state.messages)
					: (updater as Message[]);
		}) as never,
		setLoading: ((updater: unknown) => {
			state.loading =
				typeof updater === "function"
					? (updater as (p: boolean) => boolean)(state.loading)
					: (updater as boolean);
		}) as never,
		setError: ((updater: unknown) => {
			state.error =
				typeof updater === "function"
					? (updater as (p: string | null) => string | null)(state.error)
					: (updater as string | null);
		}) as never,
		setCompareError: vi.fn(),
		model: "minimax-m2-7",
		systemPrompt: "",
		compareMode: false,
		compareModel: "llama-3.3-70b",
		setCompareMessages: vi.fn(),
		inputRef: { current: null } as { current: HTMLTextAreaElement | null },
		isNearBottomRef: { current: false } as { current: boolean },
		temperature: 0.7,
		topP: 1,
		maxTokens: 2048,
		topK: 40,
		freqPenalty: 0,
		presPenalty: 0,
		stream: true,
		webSearchEnabled: false,
		setSearching: vi.fn(),
	};
	const view = renderHook(() => useStreamingChat(opts));
	return { view, state };
}

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useStreamingChat — stall watchdog and stop trace", () => {
	it("fails a stream that never returns headers with a visible error and keeps the attempt", async () => {
		// The fetch itself hangs (upstream host selection never answers);
		// it only settles when the watchdog aborts the request signal.
		vi.stubGlobal(
			"fetch",
			vi.fn(
				(_url: unknown, init?: { signal?: AbortSignal }) =>
					new Promise<Response>((_, reject) => {
						init?.signal?.addEventListener("abort", () => {
							reject(new DOMException("The operation was aborted", "AbortError"));
						});
					}),
			),
		);
		const { view, state } = mountChat();
		await act(async () => {
			await view.result.current.sendMessage("hello");
		});
		expect(state.error).toMatch(/did not respond in time/i);
		expect(state.loading).toBe(false);
		const assistant = state.messages.find((m) => m.role === "assistant");
		expect(assistant, "assistant placeholder must be kept").toBeTruthy();
		expect(assistant!.interrupted).toBe(true);
	});

	it("fails a silent stream with a visible error and keeps the attempt marked interrupted", async () => {
		vi.stubGlobal("fetch", hangingFetch());
		const { view, state } = mountChat();
		await act(async () => {
			await view.result.current.sendMessage("hello");
		});
		// Headers arrived, then the body went silent: an idle stall.
		expect(state.error).toMatch(/stalled before it finished/i);
		expect(state.loading).toBe(false);
		const user = state.messages.find((m) => m.role === "user");
		expect(user?.content).toBe("hello");
		const assistant = state.messages.find((m) => m.role === "assistant");
		expect(assistant, "assistant placeholder must be kept").toBeTruthy();
		expect(assistant!.interrupted).toBe(true);
		expect(assistant!.content).toBe("");
	});

	it("keeps the attempt, marked interrupted, when the user stops a silent stream", async () => {
		vi.stubGlobal("fetch", hangingFetch());
		const { view, state } = mountChat();
		let sendPromise: Promise<void> | undefined;
		await act(async () => {
			sendPromise = view.result.current.sendMessage("hello");
			await new Promise((resolve) => setTimeout(resolve, 10));
		});
		await act(async () => {
			view.result.current.abortRef.current?.abort();
		});
		await act(async () => {
			await sendPromise;
		});
		// A stop is a cancellation, not a failure: no error banner.
		expect(state.error).toBeNull();
		expect(state.loading).toBe(false);
		const user = state.messages.find((m) => m.role === "user");
		expect(user?.content).toBe("hello");
		const assistant = state.messages.find((m) => m.role === "assistant");
		expect(assistant, "assistant placeholder must be kept").toBeTruthy();
		expect(assistant!.interrupted).toBe(true);
	});
});
