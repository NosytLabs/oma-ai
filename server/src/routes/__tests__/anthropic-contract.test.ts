import { Hono } from "hono";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OmaEnv } from "../../types.js";

const mocks = vi.hoisted(() => ({ route: vi.fn(), parse: vi.fn(), record: vi.fn(), balance: vi.fn() }));
vi.mock("../../auth/middleware.js", () => ({ sessionOrBearerAuth: async (c: { set: (key: string, value: unknown) => void }, next: () => Promise<void>) => {
	c.set("userId", "account-a"); c.set("apiKey", { id: "key-a" }); await next();
} }));
vi.mock("../../middleware/rate-limit.js", () => ({ rateLimit: () => (_c: unknown, next: () => Promise<void>) => next(), modelRateLimit: () => (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../../inference/models.js", () => ({ getModelById: () => ({ id: "minimax-m2-7", provider: "oma-ai" }), listAllModels: () => [] }));
vi.mock("../../inference/billing-service.js", () => ({ getModelPricing: () => ({ inputPer1M: 0.02, outputPer1M: 0.02 }) }));
vi.mock("../../inference/billing.js", () => ({ recordUsage: mocks.record }));
vi.mock("../../inference/proxy.js", () => ({
	routeRequestWithFallback: mocks.route, parseNonStreamingResponse: mocks.parse, assertSufficientBalance: mocks.balance,
	estimateTokens: () => 2, flattenMessageContent: (value: unknown) => String(value),
	ProviderError: class extends Error { status: number; constructor(message: string, status: number) { super(message); this.status = status; } },
}));
import { anthropicRoutes } from "../anthropic/index.js";

const body = { model: "minimax-m2-7", messages: [{ role: "user", content: "Hello" }], max_tokens: 32 };
function send(value: unknown) { const app = new Hono<OmaEnv>(); app.route("/", anthropicRoutes); return app.request("/v1/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) }); }
beforeEach(() => { vi.resetAllMocks(); mocks.route.mockResolvedValue({ response: Response.json({}), actualModelId: body.model, attemptCount: 1 }); mocks.parse.mockResolvedValue({ data: { choices: [{ message: { content: "Hi" }, finish_reason: "stop" }], usage: { prompt_tokens: 2, completion_tokens: 1 } } }); });

describe("Anthropic customer contract", () => {
	it("attributes nonstreaming usage to the authenticating API key", async () => {
		const response = await send(body);
		expect(response.status).toBe(200);
		const requestId = (await response.json()).id;
		expect(response.headers.get("X-OMA-Request-ID")).toBe(requestId);
		expect(mocks.parse).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ userId: "account-a", apiKeyId: "key-a", requestId }));
	});
	it("checks the prepaid balance before inference", async () => {
		await send(body); expect(mocks.balance).toHaveBeenCalledWith("account-a", expect.anything(), 2, 32);
	});
	it("returns the same estimated token totals that were used for billing when upstream usage is absent", async () => {
		mocks.parse.mockResolvedValue({ data: { choices: [{ message: { content: "Hi" }, finish_reason: "stop" }] }, promptTokens: 8, outputTokens: 3 });
		expect((await (await send(body)).json()).usage).toEqual({ input_tokens: 8, output_tokens: 3 });
	});
	it("rejects insufficient credits without calling a provider", async () => {
		const { ProviderError } = await import("../../inference/proxy.js");
		mocks.balance.mockRejectedValue(new ProviderError("Insufficient credits", 402));
		expect((await send(body)).status).toBe(402); expect(mocks.route).not.toHaveBeenCalled();
	});
	it("returns real tool IDs and parsed inputs, rejecting malformed upstream arguments", async () => {
		const tool = { id: "call-a", function: { name: "read_file", arguments: '{"path":"app.ts"}' } };
		mocks.parse.mockResolvedValue({ data: { choices: [{ message: { tool_calls: [tool] }, finish_reason: "tool_calls" }] } });
		expect((await (await send(body)).json()).content).toEqual([{ type: "tool_use", id: "call-a", name: "read_file", input: { path: "app.ts" } }]);
		tool.function.arguments = "malformed JSON";
		expect((await send(body)).status).toBe(502);
	});
	it.each([["stop", "end_turn"], ["length", "max_tokens"], ["tool_calls", "tool_use"]])("maps finish reason %s to %s", async (finish_reason, expected) => {
		mocks.parse.mockResolvedValue({ data: { choices: [{ message: { content: "Hi" }, finish_reason }] } });
		expect((await (await send(body)).json()).stop_reason).toBe(expected);
	});
	it("converts tool definitions, assistant tool uses, and user tool results for a coding continuation", async () => {
		const response = await send({ ...body, tools: [{ name: "read_file", input_schema: { type: "object", properties: { path: { type: "string" } } } }], tool_choice: { type: "tool", name: "read_file" }, messages: [
			{ role: "assistant", content: [{ type: "tool_use", id: "call-a", name: "read_file", input: { path: "app.ts" } }] },
			{ role: "user", content: [{ type: "tool_result", tool_use_id: "call-a", content: "file contents" }] },
		] });
		expect(response.status).toBe(200);
		expect(mocks.route).toHaveBeenCalledWith(expect.objectContaining({
			tools: [{ type: "function", function: { name: "read_file", parameters: { type: "object", properties: { path: { type: "string" } } } } }],
			tool_choice: { type: "function", function: { name: "read_file" } },
			messages: [{ role: "assistant", content: null, tool_calls: [{ id: "call-a", type: "function", function: { name: "read_file", arguments: '{"path":"app.ts"}' } }] }, { role: "tool", tool_call_id: "call-a", content: "file contents" }],
		}));
	});
	it("preserves fragmented text and late usage, emits one stop, and attributes streaming billing", async () => {
		const sse = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {"choices":[{"delta":{},"finish_reason":"length"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":3}}\n\ndata: [DONE]\n\n';
		const bytes = new TextEncoder().encode(sse);
		mocks.route.mockResolvedValue({ actualModelId: body.model, response: new Response(new ReadableStream({ start(controller) { for (let i = 0; i < bytes.length; i += 7) controller.enqueue(bytes.slice(i, i + 7)); controller.close(); } })) });
		const response = await send({ ...body, stream: true });
		const requestId = response.headers.get("X-OMA-Request-ID");
		expect(requestId).toMatch(/^msg_/);
		const text = await response.text();
		expect(text).toContain('"text":"Hello"'); expect(text).toContain('"stop_reason":"max_tokens"'); expect(text).toContain('"output_tokens":3');
		expect(text.match(/event: message_stop/g)).toHaveLength(1);
		await vi.waitFor(() => expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ apiKeyId: "key-a", requestId, promptTokens: 8, outputTokens: 3, status: "completed" })));
	});
	it("streams tool arguments with a real ID and preserves explicit zero usage", async () => {
		const chunks = [
			{ choices: [{ delta: { tool_calls: [{ index: 0, id: "call-a", function: { name: "read_file", arguments: '{"path":' } }] } }] },
			{ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"app.ts"}' } }] }, finish_reason: "tool_calls" }] },
			{ choices: [], usage: { prompt_tokens: 0, completion_tokens: 0 } },
		];
		mocks.route.mockResolvedValue({ actualModelId: body.model, response: new Response(chunks.map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n") });
		const text = await (await send({ ...body, stream: true })).text();
		expect(text).toContain('"type":"tool_use","id":"call-a","name":"read_file"');
		expect(text.match(/event: content_block_start/g)).toHaveLength(1);
		expect(text.match(/event: content_block_stop/g)).toHaveLength(1);
		expect(text).toContain('"type":"input_json_delta"'); expect(text).toContain('"stop_reason":"tool_use"');
		expect(text).toContain('"output_tokens":0');
		await vi.waitFor(() => expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ promptTokens: 0, outputTokens: 0, apiKeyId: "key-a" })));
	});
	it("continues past malformed upstream events without losing text, final usage or the stop event", async () => {
		const sse = 'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: {broken JSON}\n\ndata: null\n\ndata: {"choices":[{"delta":{"content":" world"},"finish_reason":"stop"}]}\n\ndata: {"choices":[],"usage":{"prompt_tokens":8,"completion_tokens":3}}\n\ndata: [DONE]\n\n';
		mocks.route.mockResolvedValue({ actualModelId: body.model, response: new Response(sse) });
		const text = await (await send({ ...body, stream: true })).text();
		expect(text).toContain('"text":"Hello"');
		expect(text).toContain('"text":" world"');
		expect(text).toContain('"output_tokens":3');
		expect(text).not.toContain("event: error");
		expect(text.match(/event: message_stop/g)).toHaveLength(1);
		expect(mocks.record).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ promptTokens: 8, outputTokens: 3, status: "completed" }));
	});
	it("cancels the provider and records an aborted API-key request exactly once", async () => {
		const cancel = vi.fn();
		mocks.route.mockResolvedValue({ actualModelId: body.model, response: new Response(new ReadableStream({
			start(controller) { controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')); },
			cancel,
		})) });
		const reader = (await send({ ...body, stream: true })).body!.getReader();
		await reader.read();
		await reader.cancel("Customer stopped generation");
		await vi.waitFor(() => expect(cancel).toHaveBeenCalledOnce());
		expect(mocks.record).toHaveBeenCalledOnce();
		expect(mocks.record).toHaveBeenCalledWith(expect.objectContaining({ apiKeyId: "key-a", status: "aborted" }));
	});
});
