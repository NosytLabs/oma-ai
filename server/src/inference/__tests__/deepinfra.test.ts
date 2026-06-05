import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    DEEPINFRA_API_KEY: "sk-deepinfra-test-key",
    DEEPINFRA_API_URL: "https://api.deepinfra.com/v1/openai",
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

vi.mock("../base.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../base.js")>();
  return {
    ...actual,
    withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  };
});

import * as deepinfra from "../deepinfra.js";

describe("DeepInfra Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("chatCompletion", () => {
    it("successfully sends requests to DeepInfra", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-deepinfra-123",
          object: "chat.completion",
          created: 1677652288,
          model: "deepinfra/meta-llama-3",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from DeepInfra!",
              },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await deepinfra.chatCompletion({
        model: "deepinfra/meta-llama-3",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.deepinfra.com/v1/openai/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer sk-deepinfra-test-key",
      });
    });

    it("throws error when API key not configured", async () => {
      const { config } = await import("../../config.js");
      const originalKey = config.DEEPINFRA_API_KEY;
      (config as any).DEEPINFRA_API_KEY = "";
      try {
        await expect(
          deepinfra.chatCompletion({
            model: "deepinfra/meta-llama-3",
            messages: [{ role: "user", content: "hello" }],
          })
        ).rejects.toMatchObject({ status: 503 });
      } finally {
        (config as any).DEEPINFRA_API_KEY = originalKey;
      }
    });

    it("handles connection failure with 502", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(
        deepinfra.chatCompletion({
          model: "deepinfra/meta-llama-3",
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
        deepinfra.chatCompletion({
          model: "deepinfra/meta-llama-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid API Key",
      });
    });

    it("maps server error with 500 status", async () => {
      const mockErrResponse = new Response(
        JSON.stringify({
          error: {
            message: "Internal server error",
            type: "internal_error",
          },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );

      globalThis.fetch = vi.fn().mockResolvedValue(mockErrResponse);

      await expect(
        deepinfra.chatCompletion({
          model: "deepinfra/meta-llama-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 500,
      });
    });
  });
});
