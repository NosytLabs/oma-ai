import { beforeEach, expect, it, vi } from "vitest";
vi.mock("../billing.js", () => ({ recordUsage: vi.fn() }));
import { recordUsage } from "../billing.js";
import { createStreamingProxy, parseNonStreamingResponse } from "../streaming.js";
import { estimateTokens } from "../token-utils.js";
const args = { userId: "test", model: "test-model", provider: "venice" as const, promptTokens: 20, pricing: { inputPer1M: 1, outputPer1M: 1, markup: 50 }, requestId: "stream-test" };
beforeEach(() => vi.clearAllMocks());
it("meters fragmented SSE content as one response", async () => {
  const frames = [..."hello world"].map(content => `data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`).join("") + "data: [DONE]\n\n";
  await new Response(createStreamingProxy(new Response(frames), args)).text();
  expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ outputTokens: estimateTokens("hello world") }));
});
it("honors reported zero token counts instead of substituting estimates", async () => {
  const frames = 'data: {"choices":[],"usage":{"prompt_tokens":0,"completion_tokens":0}}\n\ndata: [DONE]\n\n';
  await new Response(createStreamingProxy(new Response(frames), args)).text();
  expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ promptTokens: 0, outputTokens: 0 }));
});
it("handles structured non-streaming text content without crashing metering", async () => {
  await parseNonStreamingResponse(Response.json({ choices: [{ message: { content: [{ type: "text", text: "hello" }] } }] }), args);
  expect(recordUsage).toHaveBeenCalledWith(expect.objectContaining({ outputTokens: estimateTokens("hello") }));
});
