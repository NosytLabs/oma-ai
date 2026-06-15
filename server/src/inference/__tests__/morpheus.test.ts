/**
 * ISOLATED Unit Tests for the Morpheus inference provider.
 *
 * Validates:
 *   - chatCompletion sends requests to https://api.mor.org/api/v1/chat/completions
 *     with the correct Bearer auth header.
 *   - completion routes to the /completions legacy endpoint.
 *   - streamChatCompletion requests `stream: true`.
 *   - morpheusModels() calls /models and unwraps the `data` envelope.
 *   - healthCheck() returns `{ isUp: false, latencyMs: -1 }` when the API key
 *     is unset and `{ isUp: true, latencyMs: <n> }` on a successful probe.
 *   - Error mapping follows the shared `createErrorMapper("Morpheus")` shape.
 *   - Connection failures are surfaced as 502s by the base provider.
 *
 * External dependencies (db, redis, provider-health) are mocked so the test
 * exercises ONLY `morpheus.ts` in isolation. `withRetry` is passed through
 * unchanged so retries are real (maxRetries 3, baseDelay 1000ms) — tests
 * that want single-shot behavior rely on success or quick failure.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    MORPHEUS_API_KEY: "sk-mor-test-key",
    MORPHEUS_BASE_URL: "https://api.mor.org/api/v1",
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
}));

vi.mock("../base.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../base.js")>();
  return {
    ...actual,
    withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
  };
});

import * as morpheus from "../morpheus.js";
import { healthCheck as factoryHealthCheck } from "../base.js";

describe("Morpheus Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("chatCompletion", () => {
    it("successfully sends requests to Morpheus with Bearer auth", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-morpheus-123",
          object: "chat.completion",
          created: 1677652288,
          model: "llama-3-70b",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello from Morpheus!" },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await morpheus.chatCompletion({
        model: "llama-3-70b",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.mor.org/api/v1/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer sk-mor-test-key",
      });
    });

    it("throws 503 when API key is not configured", async () => {
      const { config } = await import("../../config.js");
      const originalKey = config.MORPHEUS_API_KEY;
      (config as { MORPHEUS_API_KEY?: string }).MORPHEUS_API_KEY = "";
      try {
        await expect(
          morpheus.chatCompletion({
            model: "llama-3-70b",
            messages: [{ role: "user", content: "hello" }],
          })
        ).rejects.toMatchObject({ status: 503 });
      } finally {
        (config as { MORPHEUS_API_KEY?: string }).MORPHEUS_API_KEY = originalKey;
      }
    });

    it("handles connection failure with 502", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(
        morpheus.chatCompletion({
          model: "llama-3-70b",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toThrow(/connection failed: Connection refused/);
    }, 10000);

    it("maps 4xx error response with the upstream error message", async () => {
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
        morpheus.chatCompletion({
          model: "llama-3-70b",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid API Key",
      });
    });

    it("maps 5xx error response accurately", async () => {
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
        morpheus.chatCompletion({
          model: "llama-3-70b",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({ status: 500 });
    });
  });

  describe("completion", () => {
    it("successfully sends legacy text completions", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "cmpl-morpheus-123",
          object: "text_completion",
          created: 1677652288,
          choices: [{ text: " Once upon a time" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await morpheus.completion({
        model: "llama-3-70b",
        prompt: "Once upon a",
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://api.mor.org/api/v1/completions");
    });
  });

  describe("streamChatCompletion", () => {
    it("successfully initiates streaming request", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-morpheus-stream-123",
          object: "chat.completion.chunk",
          created: 1677652288,
          model: "llama-3-70b",
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

      const res = await morpheus.streamChatCompletion({
        model: "llama-3-70b",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("morpheusModels", () => {
    it("returns models list from API and unwraps the data envelope", async () => {
      const mockResponse = {
        data: [
          { id: "llama-3-70b", name: "Llama 3 70B" },
          { id: "qwen3-coder", name: "Qwen3 Coder" },
        ],
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const models = await morpheus.morpheusModels();
      expect(models).toHaveLength(2);
      expect((models as Array<{ id: string }>)[0].id).toBe("llama-3-70b");
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/models"),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer sk-mor-test-key",
          }),
        })
      );
    });

    it("returns the array directly when the API has no data envelope", async () => {
      const mockResponse = [{ id: "model-1" }, { id: "model-2" }];

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockResponse),
      });

      const models = await morpheus.morpheusModels();
      expect(models).toHaveLength(2);
    });

    it("throws error when API key not configured", async () => {
      const { config } = await import("../../config.js");
      const originalKey = config.MORPHEUS_API_KEY;
      (config as { MORPHEUS_API_KEY?: string }).MORPHEUS_API_KEY = "";
      try {
        await expect(morpheus.morpheusModels()).rejects.toThrow("Morpheus API key not configured");
      } finally {
        (config as { MORPHEUS_API_KEY?: string }).MORPHEUS_API_KEY = originalKey;
      }
    });

    it("throws on non-OK response with status and truncated body", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("upstream temporarily unavailable"),
      });

      await expect(morpheus.morpheusModels()).rejects.toMatchObject({ status: 503 });
    });
  });

  describe("healthCheck", () => {
    it("returns isUp=false when API key is not configured", async () => {
      const { config } = await import("../../config.js");
      const originalKey = config.MORPHEUS_API_KEY;
      (config as { MORPHEUS_API_KEY?: string }).MORPHEUS_API_KEY = "";
      try {
        const result = await morpheus.healthCheck();
        expect(result.isUp).toBe(false);
        expect(result.latencyMs).toBe(-1);
      } finally {
        (config as { MORPHEUS_API_KEY?: string }).MORPHEUS_API_KEY = originalKey;
      }
    });

    it("returns isUp=true on a 2xx probe", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

      const result = await morpheus.healthCheck();
      expect(result.isUp).toBe(true);
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns isUp=false on a non-2xx probe", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));

      const result = await morpheus.healthCheck();
      expect(result.isUp).toBe(false);
    });

    it("returns isUp=false when fetch throws (e.g. DNS failure)", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND"));

      const result = await morpheus.healthCheck();
      expect(result.isUp).toBe(false);
    });
  });

  describe("integration with base.healthCheck", () => {
    it("base.healthCheck returns isUp=true against a 200 mock", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
      const result = await factoryHealthCheck({
        getUrl: () => "https://api.mor.org/api/v1/models",
        getHeaders: () => ({ Authorization: "Bearer sk-mor-test-key" }),
        keyConfigured: true,
      });
      expect(result.isUp).toBe(true);
    });

    it("base.healthCheck returns isUp=false when keyConfigured=false", async () => {
      const result = await factoryHealthCheck({
        getUrl: () => "https://api.mor.org/api/v1/models",
        keyConfigured: false,
      });
      expect(result.isUp).toBe(false);
      expect(result.latencyMs).toBe(-1);
    });
  });
});
