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
import { api, type ApiKeyWithSecret } from "@/lib/api";
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
		ownerKey: "guest:thread-a",
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
		compareModel: "llama-3.3-70b",
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
	vi.mocked(api.auth.listKeys).mockReset().mockResolvedValue({ keys: [] });
	vi.mocked(api.auth.createKey)
		.mockReset()
		.mockResolvedValue({
			id: "key-test",
			name: "Browser chat",
			prefix: "oma_sk_",
			createdAt: "2026-10-08T00:00:00.000Z",
			lastUsedAt: null,
			key: "oma_sk_test",
		});
	vi.mocked(api.auth.installKeyCookie)
		.mockReset()
		.mockResolvedValue({ success: true });
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
		(opts as { model: string }).model = "llama-3.3-70b";
		(opts as { systemPrompt: string }).systemPrompt = "SECOND PROMPT";

		await act(async () => {
			await view.result.current.sendMessage("hi");
		});

		expect(bodies).toHaveLength(1);
		expect(bodies[0].model).toBe("llama-3.3-70b");
		const messages = bodies[0].messages as { role: string; content: string }[];
		expect(messages[0].content).toBe("SECOND PROMPT");
	});
});

function deferredResponse() {
	let resolve!: (response: Response) => void;
	const promise = new Promise<Response>((complete) => { resolve = complete; });
	return { promise, resolve };
}

function deferredValue<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}

function completionResponse(content: string) {
	return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
		status: 200,
		headers: { "Content-Type": "application/json" },
	});
}

describe("useStreamingChat — request ownership", () => {
	it("stops immediately while paid-key repair is waiting and starts no next repair step", async () => {
		const repair = deferredValue<{ keys: [] }>();
		vi.mocked(api.auth.listKeys).mockImplementationOnce(
			(signal?: AbortSignal) =>
				new Promise((resolve, reject) => {
					repair.resolve = resolve;
					signal?.addEventListener(
						"abort",
						() => reject(signal.reason),
						{ once: true },
					);
				}),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(JSON.stringify({ error: "missing key" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);
		const { view, state } = mountChat({ model: "claude-sonnet-4-6" });
		let pending!: Promise<void>;
		await act(async () => {
			pending = view.result.current.sendMessage("paid question");
		});
		await vi.waitFor(() =>
			expect(api.auth.listKeys).toHaveBeenCalledOnce(),
		);
		const repairSignal = vi.mocked(api.auth.listKeys).mock.calls[0][0];

		act(() => view.result.current.abortRef.current?.abort());
		const settledBeforeRepairResolved = await Promise.race([
			pending.then(() => true),
			new Promise<false>((resolve) => setTimeout(() => resolve(false), 20)),
		]);
		repair.resolve({ keys: [] });
		await pending;

		expect(repairSignal?.aborted).toBe(true);
		expect(settledBeforeRepairResolved).toBe(true);
		expect(state.loading).toBe(false);
		expect(api.auth.createKey).not.toHaveBeenCalled();
		expect(api.auth.installKeyCookie).not.toHaveBeenCalled();
	});

	it("cancels key creation on owner change before cookie installation", async () => {
		const repair = deferredValue<ApiKeyWithSecret>();
		vi.mocked(api.auth.createKey).mockImplementationOnce(
			(_name: string, signal?: AbortSignal) =>
				new Promise((resolve, reject) => {
					repair.resolve = resolve;
					signal?.addEventListener(
						"abort",
						() => reject(signal.reason),
						{ once: true },
					);
				}),
		);
		vi.stubGlobal(
			"fetch",
			vi.fn(async () =>
				new Response(JSON.stringify({ error: "missing key" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				}),
			),
		);
		const { view, state, opts } = mountChat({ model: "claude-sonnet-4-6" });
		let pending!: Promise<void>;
		await act(async () => {
			pending = view.result.current.sendMessage("account A paid question");
		});
		await vi.waitFor(() =>
			expect(api.auth.createKey).toHaveBeenCalledOnce(),
		);
		const repairSignal = vi.mocked(api.auth.createKey).mock.calls[0][1];

		act(() => {
			opts.ownerKey = "account-b:thread-b";
			view.rerender();
		});
		const settledBeforeRepairResolved = await Promise.race([
			pending.then(() => true),
			new Promise<false>((resolve) => setTimeout(() => resolve(false), 20)),
		]);
		repair.resolve({
			id: "account-a-key",
			name: "Browser chat",
			prefix: "oma_sk_",
			createdAt: "2026-10-08T00:00:00.000Z",
			lastUsedAt: null,
			key: "oma_sk_account_a",
		});
		await pending;

		expect(repairSignal?.aborted).toBe(true);
		expect(settledBeforeRepairResolved).toBe(true);
		expect(state.loading).toBe(false);
		expect(api.auth.installKeyCookie).not.toHaveBeenCalled();
	});

	it("reuses one settled key repair when the comparison 401 arrives later", async () => {
		const delayedCompare = deferredResponse();
		const attempts = new Map<string, number>();
		vi.stubGlobal(
			"fetch",
			vi.fn(async (_url: string, init: RequestInit) => {
				const body = JSON.parse(String(init.body)) as { model: string };
				const attempt = (attempts.get(body.model) ?? 0) + 1;
				attempts.set(body.model, attempt);
				if (attempt > 1) return completionResponse(`${body.model} repaired`);
				if (body.model === "llama-3.3-70b") {
					return delayedCompare.promise;
				}
				return new Response(JSON.stringify({ error: "missing key" }), {
					status: 401,
					headers: { "Content-Type": "application/json" },
				});
			}),
		);
		const { view } = mountChat({
			model: "claude-sonnet-4-6",
			compareMode: true,
			compareModel: "llama-3.3-70b",
		});
		let pending!: Promise<void>;
		await act(async () => {
			pending = view.result.current.sendMessage("compare paid models");
		});
		await vi.waitFor(() =>
			expect(api.auth.installKeyCookie).toHaveBeenCalledOnce(),
		);

		delayedCompare.resolve(
			new Response(JSON.stringify({ error: "missing key" }), {
				status: 401,
				headers: { "Content-Type": "application/json" },
			}),
		);
		await act(async () => {
			await pending;
		});

		expect(api.auth.listKeys).toHaveBeenCalledOnce();
		expect(api.auth.createKey).toHaveBeenCalledOnce();
		expect(api.auth.installKeyCookie).toHaveBeenCalledOnce();
		expect(attempts.get("claude-sonnet-4-6")).toBe(2);
		expect(attempts.get("llama-3.3-70b")).toBe(2);
	});

	it("aborts a replaced conversation and ignores its late response and cleanup", async () => {
		const first = deferredResponse();
		const second = deferredResponse();
		const signals: AbortSignal[] = [];
		vi.stubGlobal("fetch", vi.fn((_url: string, init: RequestInit) => {
			signals.push(init.signal as AbortSignal);
			return signals.length === 1 ? first.promise : second.promise;
		}));
		const { view, state, opts } = mountChat();
		let firstSend!: Promise<void>;
		await act(async () => { firstSend = view.result.current.sendMessage("account A prompt"); });
		const accountBMessages: Message[] = [{ id: "b-note", role: "assistant", content: "Account B notes", timestamp: 1 }];
		act(() => {
			opts.ownerKey = "account-b:thread-b";
			state.messages = accountBMessages;
			opts.messagesRef.current = accountBMessages;
			view.rerender();
		});
		expect(signals[0].aborted).toBe(true);
		expect(state.loading).toBe(false);
		let secondSend!: Promise<void>;
		await act(async () => { secondSend = view.result.current.sendMessage("account B prompt"); });
		const secondController = view.result.current.abortRef.current;
		await act(async () => {
			first.resolve(completionResponse("Account A private answer"));
			await firstSend;
		});
		expect(state.messages.map((message) => message.content)).toEqual(["Account B notes", "account B prompt", ""]);
		expect(state.loading).toBe(true);
		expect(view.result.current.abortRef.current).toBe(secondController);
		await act(async () => {
			second.resolve(completionResponse("Account B answer"));
			await secondSend;
		});
		expect(state.messages.at(-1)?.content).toBe("Account B answer");
		expect(state.loading).toBe(false);
	});

	it("updates its own assistant placeholder even when another message follows it", async () => {
		const response = deferredResponse();
		vi.stubGlobal("fetch", vi.fn(() => response.promise));
		const { view, state } = mountChat();
		let pending!: Promise<void>;
		await act(async () => { pending = view.result.current.sendMessage("question"); });
		const assistantId = state.messages.at(-1)?.id;
		state.messages = [...state.messages, { id: "later-note", role: "user", content: "Keep this note", timestamp: 2 }];
		await act(async () => {
			response.resolve(completionResponse("Answer to question"));
			await pending;
		});
		expect(state.messages.find((message) => message.id === assistantId)?.content).toBe("Answer to question");
		expect(state.messages.at(-1)).toMatchObject({ id: "later-note", role: "user", content: "Keep this note" });
	});

	it("keeps the send-time model, system prompt and parameters while web search is pending", async () => {
		const search = deferredResponse();
		const bodies: Record<string, unknown>[] = [];
		vi.stubGlobal("fetch", vi.fn((url: string, init: RequestInit) => {
			if (url.startsWith("/api/v1/search")) return search.promise;
			bodies.push(JSON.parse(String(init.body)));
			return Promise.resolve(completionResponse("Answer"));
		}));
		const { view, state, opts } = mountChat({ webSearchEnabled: true, systemPrompt: "Original instructions", responseFormat: "openui" });
		let pending!: Promise<void>;
		await act(async () => { pending = view.result.current.sendMessage("question"); });
		act(() => {
			opts.model = "llama-3.3-70b";
			opts.systemPrompt = "New instructions";
			opts.temperature = 0.2;
			opts.responseFormat = "text";
			view.rerender();
		});
		await act(async () => {
			search.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
			await pending;
		});
		expect(bodies).toHaveLength(1);
		expect(bodies[0]).toMatchObject({ model: "deepseek-v4-flash-0731-openbroker", temperature: 0.7, messages: [{ role: "system", content: "Original instructions" }, { role: "user", content: "question" }] });
		expect(state.messages.at(-1)?.format).toBe("openui");
	});

	it("stops pending web search without starting a completion when the search later returns", async () => {
		const search = deferredResponse();
		const fetchMock = vi.fn((url: string, _init: RequestInit) => url.startsWith("/api/v1/search") ? search.promise : Promise.resolve(completionResponse("Should not be requested")));
		vi.stubGlobal("fetch", fetchMock);
		const { view, state } = mountChat({ webSearchEnabled: true });
		let pending!: Promise<void>;
		await act(async () => { pending = view.result.current.sendMessage("question"); });
		const searchOptions = fetchMock.mock.calls[0][1] as RequestInit | undefined;
		act(() => { view.result.current.abortRef.current?.abort(); });
		await act(async () => {
			search.resolve(new Response(JSON.stringify({ results: [] }), { status: 200 }));
			await pending;
		});
		expect(searchOptions?.signal?.aborted).toBe(true);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(state.messages).toHaveLength(1);
		expect(state.error).toBeNull();
		expect(state.loading).toBe(false);
	});
});

describe("useStreamingChat — response rendering metadata", () => {
	it("propagates a failed interactive follow-up while restoring the composer", async () => {
		vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("fetch failed"); }));
		const { view, state } = mountChat();
		await act(async () => {
			await expect(view.result.current.sendMessage("follow up", { throwOnError: true })).rejects.toThrow(/cannot reach/i);
		});
		expect(state.loading).toBe(false);
		expect(view.result.current.abortRef.current).toBeNull();
	});

	it("preserves the requested format on both replies without sending UI metadata to the API", async () => {
		const bodies: Record<string, unknown>[] = [];
		vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
			bodies.push(JSON.parse(String(init.body)));
			return new Response(JSON.stringify({ choices: [{ message: { content: 'root = Text("Hello")' } }] }), {
				status: 200, headers: { "Content-Type": "application/json" },
			});
		}));
		const { view, state } = mountChat({ compareMode: true, responseFormat: "openui" });
		await act(async () => { await view.result.current.sendMessage("show a greeting"); });
		expect(state.messages.at(-1)).toMatchObject({ role: "assistant", format: "openui" });
		expect(state.compareMessages.at(-1)).toMatchObject({ role: "assistant", format: "openui" });
		expect(bodies).toHaveLength(2);
		for (const body of bodies) {
			expect(body).not.toHaveProperty("responseFormat");
			expect(body.messages).toEqual([{ role: "user", content: "show a greeting" }]);
		}
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
				if (body.model === "llama-3.3-70b") {
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
		expect(state.compareError).toMatch(/llama-3.3-70b/);
		expect(state.loading).toBe(false);
	});
});
