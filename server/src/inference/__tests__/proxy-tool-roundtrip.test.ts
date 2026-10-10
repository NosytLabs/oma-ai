import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config.js", () => ({ config: {
	OPENBROKER_API_KEY: "test-openbroker-key-123456789",
	OPENBROKER_API_URL: "https://api.openbroker.gonka.gg",
} }));
vi.mock("../../lib/logger.js", () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock("../billing.js", () => ({ assertSufficientBalance: vi.fn(), recordUsage: vi.fn() }));
vi.mock("../streaming.js", () => ({ createStreamingProxy: vi.fn(), parseNonStreamingResponse: vi.fn() }));

import { routeRequestWithFallback } from "../proxy.js";

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("upstream tool round trip", () => {
	it("requests upstream token totals for streamed billing", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('data: [DONE]\n\n', { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		await routeRequestWithFallback({ modelId: "minimax-m2-7", messages: [{ role: "user", content: "Hello" }], stream: true, userId: "test-user", requestId: "test-stream-usage" });
		expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({ stream: true, stream_options: { include_usage: true } });
	});
	it("preserves assistant calls and tool result IDs in the actual provider payload", async () => {
		const fetchMock = vi.fn().mockResolvedValue(new Response('{"choices":[]}', { status: 200 }));
		vi.stubGlobal("fetch", fetchMock);
		const messages = [
			{ role: "user", content: "Add 17 and 25 using the tool." },
			{ role: "assistant", content: null, tool_calls: [{ id: "call_add", type: "function", function: { name: "add", arguments: '{"a":17,"b":25}' } }] },
			{ role: "tool", content: "42", tool_call_id: "call_add", name: "add" },
		];
		await routeRequestWithFallback({ modelId: "minimax-m2-7", messages, stream: false, userId: "test-user", requestId: "test-roundtrip" });
		const [, request] = fetchMock.mock.calls[0]!;
		expect(JSON.parse(request.body as string).messages).toEqual(messages);
	});

	it("rejects a paused primary before sending any provider request", async () => {
		const fetchMock = vi.fn();
		vi.stubGlobal("fetch", fetchMock);
		await expect(routeRequestWithFallback({ modelId: "deepseek-v4-flash-0731-openbroker", messages: [{ role: "user", content: "Hello" }], stream: false, userId: "test-user", requestId: "test-paused" })).rejects.toMatchObject({ status: 503 });
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("cancels the upstream without retries or fallback when the caller disconnects", async () => {
		const caller = new AbortController();
		const fetchMock = vi.fn((_url: string, request: RequestInit) => new Promise<Response>((_resolve, reject) => {
			request.signal!.addEventListener("abort", () => reject(request.signal!.reason), { once: true });
		}));
		vi.stubGlobal("fetch", fetchMock);
		const pending = routeRequestWithFallback({ modelId: "minimax-m2-7", messages: [{ role: "user", content: "Hello" }], stream: false, userId: "test-user", requestId: "test-cancel", signal: caller.signal });
		const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
		caller.abort();
		await assertion;
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it("bounds the entire retry chain and allows OpenBroker a longer host-selection wait", async () => {
		const deadline = new AbortController();
		const timeouts: number[] = [];
		vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
			timeouts.push(ms);
			return ms === 240_000 ? deadline.signal : new AbortController().signal;
		});
		const fetchMock = vi.fn((_url: string, request: RequestInit) => new Promise<Response>((_resolve, reject) => {
			request.signal!.addEventListener("abort", () => reject(request.signal!.reason), { once: true });
		}));
		vi.stubGlobal("fetch", fetchMock);
		const pending = routeRequestWithFallback({ modelId: "minimax-m2-7", messages: [{ role: "user", content: "Hello" }], stream: false, userId: "test-user", requestId: "test-deadline" });
		const assertion = expect(pending).rejects.toMatchObject({ status: 504 });
		deadline.abort(new DOMException("Request timed out", "TimeoutError"));
		await assertion;
		expect(timeouts).toEqual([240_000, 180_000]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
