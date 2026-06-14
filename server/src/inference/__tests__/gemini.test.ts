import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockConfig = vi.hoisted(() => ({
  GEMINI_API_KEY: "test-gemini-key",
  NODE_ENV: "test",
  RECEIPT_HMAC_SECRET: "test-receipt-secret-at-least-32-chars!",
}));

vi.mock("../../config.js", () => ({
  config: mockConfig,
}));

import {
  toGeminiRequest,
  toOpenAIResponse,
  geminiChunkToOpenAI,
  mapGeminiError,
  chatCompletion,
  streamChatCompletion,
} from "../gemini.js";

describe("Gemini provider", () => {
  const originalFetch = globalThis.fetch;
  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig.GEMINI_API_KEY = "test-gemini-key";
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("toGeminiRequest", () => {
    it("translates OpenAI messages, system prompt, and tools", () => {
      const req = toGeminiRequest({
        model: "gemini-2.5-pro",
        messages: [
          { role: "system", content: "You are helpful." },
          { role: "user", content: "hi" },
          { role: "assistant", content: "hello" },
        ],
        tools: [
          { type: "function", function: { name: "get_weather", description: "Get weather", parameters: { type: "object" } } },
        ],
        temperature: 0.7,
        max_tokens: 100,
        top_p: 0.9,
      });
      expect(req.systemInstruction).toEqual({ parts: [{ text: "You are helpful." }] });
      expect(req.contents).toEqual([
        { role: "user", parts: [{ text: "hi" }] },
        { role: "model", parts: [{ text: "hello" }] },
      ]);
      expect((req.generationConfig as any).temperature).toBe(0.7);
      expect((req.generationConfig as any).maxOutputTokens).toBe(100);
      expect((req.generationConfig as any).topP).toBe(0.9);
      expect(req.tools).toEqual([
        {
          functionDeclarations: [
            { name: "get_weather", description: "Get weather", parameters: { type: "object" } },
          ],
        },
      ]);
    });

    it("omits systemInstruction, tools, and generationConfig when not provided", () => {
      const req = toGeminiRequest({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "ping" }],
      });
      expect(req.systemInstruction).toBeUndefined();
      expect(req.tools).toBeUndefined();
      expect(req.generationConfig).toBeUndefined();
      expect(req.contents).toEqual([{ role: "user", parts: [{ text: "ping" }] }]);
    });

    it("joins multiple system messages with newlines", () => {
      const req = toGeminiRequest({
        model: "gemini-2.5-pro",
        messages: [
          { role: "system", content: "Be brief." },
          { role: "system", content: "Be kind." },
          { role: "user", content: "ok" },
        ],
      });
      expect(req.systemInstruction).toEqual({ parts: [{ text: "Be brief.\nBe kind." }] });
    });
  });

  describe("toOpenAIResponse", () => {
    it("translates Gemini response to OpenAI shape with usage and finish_reason", () => {
      const out = toOpenAIResponse(
        {
          candidates: [{ content: { parts: [{ text: "Hello!" }] }, finishReason: "STOP" }],
          usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 3, totalTokenCount: 8 },
        },
        "gemini-2.5-pro",
      );
      const choices = out.choices as Array<{ message: { content: string }; finish_reason: string }>;
      expect(choices[0].message.content).toBe("Hello!");
      expect(choices[0].finish_reason).toBe("stop");
      expect(out.usage).toEqual({ prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 });
      expect(out.model).toBe("gemini-2.5-pro");
      expect(out.object).toBe("chat.completion");
    });

    it("translates Gemini functionCall parts to OpenAI tool_calls", () => {
      const out = toOpenAIResponse(
        {
          candidates: [
            {
              content: { parts: [{ functionCall: { name: "get_weather", args: { city: "SF" } } }] },
              finishReason: "STOP",
            },
          ],
        },
        "gemini-2.5-pro",
      );
      const message = (out.choices as Array<{ message: { tool_calls: Array<{ function: { name: string; arguments: string } }> } }>)[0].message;
      expect(message.tool_calls).toHaveLength(1);
      expect(message.tool_calls[0].function.name).toBe("get_weather");
      expect(JSON.parse(message.tool_calls[0].function.arguments)).toEqual({ city: "SF" });
    });
  });

  describe("geminiChunkToOpenAI", () => {
    it("converts a single Gemini SSE chunk into an OpenAI delta chunk", () => {
      const chunk = geminiChunkToOpenAI(
        { candidates: [{ content: { parts: [{ text: "abc" }] } }] },
        "gemini-2.5-flash",
      );
      expect(chunk).not.toBeNull();
      const delta = (chunk!.choices as Array<{ delta: { content: string } }>)[0].delta;
      expect(delta.content).toBe("abc");
      expect((chunk as any).object).toBe("chat.completion.chunk");
    });

    it("emits finish_reason=stop on STOP", () => {
      const chunk = geminiChunkToOpenAI(
        { candidates: [{ finishReason: "STOP" }] },
        "gemini-2.5-flash",
      );
      expect((chunk!.choices as Array<{ finish_reason: string | null }>)[0].finish_reason).toBe("stop");
    });
  });

  describe("mapGeminiError", () => {
    it.each([
      [400, "invalid_request"],
      [401, "invalid_key"],
      [403, "invalid_key"],
      [429, "rate_limit"],
      [500, "server_error"],
      [503, "server_error"],
    ])("maps status %i to type %s", (status, type) => {
      try {
        mapGeminiError(status, '{"error":{"message":"oops"}}');
        throw new Error("should have thrown");
      } catch (e: any) {
        expect(e.status).toBe(status);
        expect(e.type).toBe(type);
        expect(e.message).toBe("oops");
      }
    });

    it("falls back to raw body when JSON parse fails", () => {
      try {
        mapGeminiError(500, "plain text error");
        throw new Error("should have thrown");
      } catch (e: any) {
        expect(e.message).toBe("plain text error");
      }
    });
  });

  describe("streamChatCompletion", () => {
    it("emits OpenAI SSE chunks from a Gemini SSE response", async () => {
      const sse = new ReadableStream({
        start(controller) {
          controller.enqueue(
            new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"Hello "}]}}]}\n\n'),
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"candidates":[{"content":{"parts":[{"text":"world"}]}}]}\n\n'),
          );
          controller.enqueue(
            new TextEncoder().encode('data: {"candidates":[{"finishReason":"STOP"}]}\n\n'),
          );
          controller.close();
        },
      });
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }),
      );

      const res = await streamChatCompletion({
        model: "gemini-2.5-flash",
        messages: [{ role: "user", content: "hi" }],
      });
      const text = await res.text();
      expect(text).toContain("Hello ");
      expect(text).toContain("world");
      expect(text).toContain('"finish_reason":"stop"');
      expect(text).toContain("data: [DONE]");
      expect(res.headers.get("Content-Type")).toBe("text/event-stream");

      const [url] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      expect(url).toContain(":streamGenerateContent");
      expect(url).toContain("alt=sse");
      expect(url).toContain("key=test-gemini-key");
    });
  });

  describe("chatCompletion", () => {
    it("sends Gemini request and returns OpenAI-shaped response", async () => {
      const geminiResp = {
        candidates: [{ content: { parts: [{ text: "pong" }] }, finishReason: "STOP" }],
        usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1, totalTokenCount: 2 },
      };
      const fetchSpy = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(geminiResp), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      globalThis.fetch = fetchSpy;

      const res = await chatCompletion({
        model: "gemini-2.5-pro",
        messages: [{ role: "user", content: "ping" }],
      });
      const data = await res.json();
      expect((data.choices as Array<{ message: { content: string } }>)[0].message.content).toBe("pong");

      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toContain("models/gemini-2.5-pro:generateContent");
      expect(url).toContain("key=test-gemini-key");
      expect(init?.method).toBe("POST");
      const body = JSON.parse(init?.body as string);
      expect(body.contents).toEqual([{ role: "user", parts: [{ text: "ping" }] }]);
    });

    it("maps 401 upstream error to invalid_key", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response('{"error":{"message":"bad key"}}', { status: 401 }),
      );
      await expect(
        chatCompletion({
          model: "gemini-2.5-pro",
          messages: [{ role: "user", content: "x" }],
        }),
      ).rejects.toMatchObject({ status: 401, type: "invalid_key" });
    });

    it("throws 503 when API key is not configured", async () => {
      mockConfig.GEMINI_API_KEY = "";
      await expect(
        chatCompletion({
          model: "gemini-2.5-pro",
          messages: [{ role: "user", content: "x" }],
        }),
      ).rejects.toMatchObject({ status: 503 });
    });
  });
});
