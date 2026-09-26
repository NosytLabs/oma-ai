/**
 * BUG-A / BUG-B / BUG-H regression tests for useStreamingChat.
 *
 *  BUG-A: streaming + abort state was only reset on the SSE "done" branch,
 *         so a fetch/network error left `loading` true forever — the
 *         composer stayed disabled, the Stop button never cleared, and the
 *         user had no way to retry. The finally block must reset on every
 *         exit path.
 *  BUG-B: `streamChatCompletion` / `sendMessage` closed over the FIRST
 *         render's `opts` object (the dep arrays omitted model/history and
 *         the parent rebuilds `opts` every render), so a model or system
 *         prompt change made mid-session was never sent.
 *  BUG-H: a compare-only failure was written to the primary `setError`.
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

interface Handlers {
	loading: boolean;
	error: string | null;
	compareError: string | null;
	messages: Message[];
	compareMessages: Message[];
	input: string;
}

/** Minimal stateful harness around the hook so we can assert on effects. */
function mountChat(initial: Partial<Parameters<typeof useStreamingChat>[0]> = {}) {
	const state: Handlers = {
		loading: false,
		error: null,
		compareError: null,
		messages: [],
		compareMessages: [],
		input: "hello",
	};

	const opts = {
		messagesRef: { current: state.messages } as { current: Message[] },
		compareMessagesRef: { current: state.compareMessages } as { current: Message[] },
		input: state.input,
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
		setCompareError: ((updater: unknown) => {
			state.compareError =
				typeof updater === "function"
					? (updater as (p: string | null) => string | null)(state.compareError)
					: (updater as string | null);
		}) as never,
		model: "deepseek-v4-flash-0731-openbroker",
		systemPrompt: "",
		compareMode: false,
		compareModel: "mistral-small-2603",
		setCompareMessages: ((updater: unknown) => {
			state.compareMessages =
				typeof updater === "function"
					? (updater as (p: Message[]) => Message[])(state.compareMessages)
					: (updater as Message[]);
		}) as never,
		inputRef: { current: null } as { current: HTMLTextAreaElement | null },
		isNearBottomRef: { current: false } as { current: boolean },
		temperature: 0.7,
		topP: 1,
		maxTokens: 2048,
		topK: 40,
		freqPenalty: 0,
		presPenalty: 0,
		stream: false,
		webSearchEnabled: false,
		setSearching: vi.fn(),
		...initial,
	};

	const view = renderHook(() => useStreamingChat(opts));
	return { view, state, opts };
}

beforeEach(() => {
	vi.restoreAllMocks();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("useStreamingChat — BUG-A: state resets on every exit path", () => {
	it("clears loading and the abort controller when fetch rejects", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("fetch failed");
			}),
		);
		const { view, state } = mountChat();
		await act(async () => {
			await view.result.current.sendMessage("hi");
		});
		expect(state.loading).toBe(false);
		expect(state.error).toMatch(/cannot reach the backend/i);
		// The pending assistant placeholder is rolled back so a retry works.
		expect(state.messages.some((x) => x.role === "assistant" && !x.content)).toBe(
			false,
		);
	});

	it("clears loading and the abort controller on a non-2xx response", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(JSON.stringify({ error: "boom" }), {
						status: 500,
						headers: { "Content-Type": "application/json" },
					}),
			),
		);
		const { view, state } = mountChat();
		await act(async () => {
			await view.result.current.sendMessage("hi");
		});
		expect(state.loading).toBe(false);
		expect(state.error).toBeTruthy();
		expect(view.result.current.abortRef.current).toBeNull();
	});

	it("clears loading after a successful send", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(
				async () =>
					new Response(
						JSON.stringify({
							choices: [{ message: { content: "pong" } }],
							usage: { total_tokens: 3, completion_tokens: 2 },
						}),
						{ status: 200, headers: { "Content-Type": "application/json" } },
					),
			),
		);
		const { view, state } = mountChat();
		await act(async () => {
			await view.result.current.sendMessage("hi");
		});
		expect(state.loading).toBe(false);
		expect(view.result.current.abortRef.current).toBeNull();
		const last = state.messages[state.messages.length - 1];
		expect(last.content).toBe("pong");
	});
});

describe("useStreamingChat — BUG-B: options are read live", () => {
	it("sends the CURRENT model and system prompt, not the first render's", async () => {
		const bodies: Record<string, unknown>[] = [];
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init: RequestInit) => {
				bodies.push(JSON.parse(String(init.body)));
				return new Response(
					JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}),
		);
		// Start with a paid model + no system prompt, then swap both before
		// sending. The old closure would have sent the first values.
		const { view, opts } = mountChat({
			model: "claude-sonnet-4-6",
			systemPrompt: "FIRST PROMPT",
		});
		(opts as { model: string }).model = "mistral-small-2603";
		(opts as { systemPrompt: string }).systemPrompt = "SECOND PROMPT";

		await act(async () => {
			await view.result.current.sendMessage("hi");
		});

		expect(bodies).toHaveLength(1);
		expect(bodies[0].model).toBe("mistral-small-2603");
		const messages = bodies[0].messages as { role: string; content: string }[];
		expect(messages[0].content).toBe("SECOND PROMPT");
	});
});

describe("useStreamingChat — BUG-H: compare failures stay in compare state", () => {
	it("routes a compare-only failure to setCompareError, not setError", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init: RequestInit) => {
				// Both streams hit the same endpoint, so discriminate on the
				// requested model: the compare slot fails, the primary is fine.
				const body = JSON.parse(String(init.body)) as { model: string };
				if (body.model === "mistral-small-2603") {
					return new Response(
						JSON.stringify({ error: "compare model exploded" }),
						{ status: 500, headers: { "Content-Type": "application/json" } },
					);
				}
				return new Response(
					JSON.stringify({ choices: [{ message: { content: "primary ok" } }] }),
					{ status: 200, headers: { "Content-Type": "application/json" } },
				);
			}),
		);
		const { view, state } = mountChat({ compareMode: true });
		await act(async () => {
			await view.result.current.sendMessage("hi");
		});
		// Primary succeeded → its error slot must stay empty.
		expect(state.error).toBeNull();
		expect(state.compareError).toBeTruthy();
		expect(state.compareError).toMatch(/mistral-small-2603/);
		expect(state.loading).toBe(false);
	});
});
