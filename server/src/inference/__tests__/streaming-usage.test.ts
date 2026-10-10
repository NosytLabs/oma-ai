import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("../billing.js", () => ({ recordUsage: vi.fn() }));
vi.mock("../../lib/logger.js", () => ({ logger: { warn: vi.fn() } }));
import { recordUsage } from "../billing.js";
import { createStreamingProxy, parseNonStreamingResponse } from "../streaming.js";
import { estimateTokens } from "../token-utils.js";

const args = { userId: "test", model: "minimax-m2-7", provider: "oma-ai" as const, promptTokens: 99,
	pricing: { inputPer1M: 0.02, outputPer1M: 0.02, markup: 0 }, requestId: "stream-test" };
const frame = (value: unknown, newline = true) => `data: ${JSON.stringify(value)}${newline ? "\n\n" : ""}`;
async function stream(frames: string[]) {
	const encoder = new TextEncoder();
	const upstream = new Response(new ReadableStream({ start(controller) {
		for (const value of frames) controller.enqueue(encoder.encode(value));
		controller.close();
	} }));
	await new Response(createStreamingProxy(upstream, args)).text();
	await vi.waitFor(() => expect(recordUsage).toHaveBeenCalledTimes(1));
}
beforeEach(() => vi.clearAllMocks());
describe("upstream usage metering", () => {
	it("uses final usage even when the final SSE line lacks a newline", async () => {
		const usage = frame({ choices: [], usage: { prompt_tokens: 21, completion_tokens: 80 } }, false);
		await stream([frame({ choices: [{ delta: { content: "4" } }] }), usage.slice(0, 25), usage.slice(25)]);
		expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ promptTokens: 21, outputTokens: 80 }));
	});
	it("accepts real zero token totals", async () => {
		await stream([frame({ choices: [{ delta: { content: "ignored estimate" } }], usage: { prompt_tokens: 0, completion_tokens: 0 } })]);
		expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ promptTokens: 0, outputTokens: 0 }));
	});
	it("estimates complete text rather than rounding each token fragment, includes reasoning and tools once", async () => {
		await stream([
			frame({ choices: [{ delta: { content: "", reasoning_content: "think", reasoning: "think" } }] }),
			frame({ choices: [{ delta: { content: "hel" } }] }),
			frame({ choices: [{ delta: { content: "lo", tool_calls: [{ function: { arguments: '{"a":2}' } }] } }] }),
			frame({ usage: { prompt_tokens: "21", completion_tokens: -1 } }),
		]);
		expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ promptTokens: 99,
			outputTokens: estimateTokens("hello") + estimateTokens("think") + estimateTokens('{"a":2}') }));
	});
	it("preserves zero counts in non-streaming responses and rejects invalid counts", async () => {
		const first = await parseNonStreamingResponse(Response.json({ choices: [{ message: { content: "hello" } }], usage: { prompt_tokens: 0, completion_tokens: 0 } }), args);
		expect(first).toMatchObject({ promptTokens: 0, outputTokens: 0 });
		const second = await parseNonStreamingResponse(Response.json({ choices: [{ message: { content: "", reasoning_content: "think", tool_calls: [{ function: { arguments: '{"a":2}' } }] } }], usage: { prompt_tokens: "21", completion_tokens: -1 } }), args);
		expect(second).toMatchObject({ promptTokens: 99, outputTokens: estimateTokens("think") + estimateTokens('{"a":2}') });
	});
});
