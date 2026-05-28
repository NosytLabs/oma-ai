import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    TOGETHER_API_KEY: "sk-together-test-key",
    TOGETHER_API_URL: "https://api.together.xyz/v1",
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

import * as together from "../together.js";

describe("Together AI Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("chatCompletion", () => {
    it("successfully sends requests to Together AI", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-together-123",
          object: "chat.completion",
          created: 1677652288,
          model: "together/meta-llama-3",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from Together AI!",
              },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await together.chatCompletion({
        model: "together/meta-llama-3",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.together.xyz/v1/v1/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer sk-together-test-key",
      });
    });

    it("throws error when API key not configured", async () => {
      const { config } = await import("../../config.js");
      const originalKey = config.TOGETHER_API_KEY;
      (config as any).TOGETHER_API_KEY = "";
      try {
        await expect(
          together.chatCompletion({
            model: "together/meta-llama-3",
            messages: [{ role: "user", content: "hello" }],
          })
        ).rejects.toMatchObject({ status: 503 });
      } finally {
        (config as any).TOGETHER_API_KEY = originalKey;
      }
    });

    it("handles connection failure with 502", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(
        together.chatCompletion({
          model: "together/meta-llama-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toThrow("connection failed: Connection refused");
    }, 10000);

    it("maps 4xx error response accurately", async () => {
      const mockErrResponse = new Response(
        JSON.stringify({
          error: {
            message: "Invalid API Key",
            type: "invalid_request_error",
          },
        }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );

      globalThis.fetch = vi.fn().mockResolvedValue(mockErrResponse);

      await expect(
        together.chatCompletion({
          model: "together/meta-llama-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid API Key",
      });
    });

    it("maps rate limit error with 429 status", async () => {
      const mockErrResponse = new Response(
        JSON.stringify({
          error: {
            message: "Rate limit exceeded",
            type: "rate_limit_error",
          },
        }),
        { status: 429, headers: { "Content-Type": "application/json" } }
      );

      globalThis.fetch = vi.fn().mockResolvedValue(mockErrResponse);

      await expect(
        together.chatCompletion({
          model: "together/meta-llama-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 429,
      });
    });
  });

  describe("togetherHealthCheck", () => {
    it("returns down state if health check fails", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      const status = await together.togetherHealthCheck();
      expect(status.isUp).toBe(false);
    });

    it("returns down state if health check returns non-ok status", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("{}", { status: 500 }));

      const status = await together.togetherHealthCheck();
      expect(status.isUp).toBe(false);
    });
  });

  describe("completion", () => {
    it("successfully sends legacy text completions requests", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "cmpl-together-123",
          object: "text_completion",
          created: 1677652288,
          choices: [{ text: " Once upon a time" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await together.completion({
        model: "together/llama-3",
        prompt: "Once upon a",
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.together.xyz/v1/v1/completions");
    });
  });
});