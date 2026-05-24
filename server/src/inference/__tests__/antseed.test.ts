import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    ANTSEED_PROXY_URL: "https://antseed-proxy.example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("../../db/client.js", () => ({
  db: {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([{ id: "dep-1" }]),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  },
  getDb: () => ({}),
}));

vi.mock("../../lib/redis-client.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  isRedisReady: vi.fn().mockReturnValue(false),
}));

vi.mock("../provider-health.js", () => ({
  reportProviderResult: vi.fn().mockResolvedValue(undefined),
  checkProviderHealth: vi.fn().mockResolvedValue({ isUp: true, latencyMs: 10, errorRate: 0 }),
  isProviderAvailable: vi.fn().mockResolvedValue(true),
  reserveProvider: vi.fn().mockReturnValue(true),
  releaseProvider: vi.fn(),
}));

import * as antseed from "../antseed.js";

describe("AntSeed Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("chatCompletion", () => {
    it("successfully sends requests to AntSeed", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-antseed-123",
          object: "chat.completion",
          created: 1677652288,
          model: "antseed/qwen-3",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from AntSeed!",
              },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await antseed.chatCompletion({
        model: "antseed/qwen-3",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://antseed-proxy.example.com/v1/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
      });
    });

    it("throws error when proxy URL not configured", async () => {
      await expect(
        antseed.chatCompletion({
          model: "antseed/qwen-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({ status: expect.any(Number) });
    }, 10000);

    it("handles connection failure with 502", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(
        antseed.chatCompletion({
          model: "antseed/qwen-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toThrow("connection failed: Connection refused");
    }, 10000);

    it("maps 4xx error response accurately", async () => {
      const mockErrResponse = new Response(
        JSON.stringify({
          error: {
            message: "Invalid request",
            type: "invalid_request_error",
          },
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );

      globalThis.fetch = vi.fn().mockResolvedValue(mockErrResponse);

      await expect(
        antseed.chatCompletion({
          model: "antseed/qwen-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 400,
        message: "Invalid request",
      });
    });
  });

  describe("antseedHealthCheck", () => {
    it("returns down state if health check fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const status = await antseed.antseedHealthCheck();
      expect(status.isUp).toBe(false);
    });

    it("returns down state if health check returns non-ok status", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("Service unavailable", { status: 503 }));

      const status = await antseed.antseedHealthCheck();
      expect(status.isUp).toBe(false);
    });
  });

  describe("completion", () => {
    it("successfully sends legacy text completions requests", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "cmpl-antseed-123",
          object: "text_completion",
          created: 1677652288,
          choices: [{ text: " Once upon a time" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await antseed.completion({
        model: "antseed/llama-3",
        prompt: "Once upon a",
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://antseed-proxy.example.com/v1/completions");
    });
  });

  describe("streamChatCompletion", () => {
    it("successfully initiates streaming request", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-antseed-stream-123",
          object: "chat.completion.chunk",
          created: 1677652288,
          model: "antseed/qwen-3",
          choices: [
            {
              index: 0,
              delta: { role: "assistant", content: "Hello" },
              finish_reason: null,
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "text/event-stream" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await antseed.streamChatCompletion({
        model: "antseed/qwen-3",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});