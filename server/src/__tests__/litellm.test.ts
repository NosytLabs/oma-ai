import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock hono node serve
vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
}));

const { mockLimit, dbChain } = vi.hoisted(() => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockFrom = vi.fn().mockReturnThis();
  const mockWhere = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockResolvedValue([]);
  const mockInsert = vi.fn().mockReturnThis();
  const mockValues = vi.fn().mockReturnThis();
  const mockReturning = vi.fn().mockResolvedValue([{ id: "dep-1" }]);
  const mockUpdate = vi.fn().mockReturnThis();
  const mockSet = vi.fn().mockReturnThis();
  const mockOrderBy = vi.fn().mockReturnThis();

  const dbChain = {
    select: mockSelect,
    from: mockFrom,
    where: mockWhere,
    limit: mockLimit,
    insert: mockInsert,
    values: mockValues,
    returning: mockReturning,
    update: mockUpdate,
    set: mockSet,
    orderBy: mockOrderBy,
  };

  mockSelect.mockReturnValue(dbChain);
  mockFrom.mockReturnValue(dbChain);
  mockWhere.mockReturnValue(dbChain);
  mockLimit.mockResolvedValue([]);
  mockInsert.mockReturnValue(dbChain);
  mockValues.mockReturnValue(dbChain);
  mockReturning.mockResolvedValue([{ id: "dep-1" }]);
  mockUpdate.mockReturnValue(dbChain);
  mockSet.mockReturnValue(dbChain);
  mockOrderBy.mockReturnValue(dbChain);

  return { mockLimit, dbChain };
});

vi.mock("../db/client.js", () => ({
  db: dbChain,
  getDb: () => dbChain,
}));

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  isRedisReady: vi.fn().mockReturnValue(false),
}));

// Mock config with LiteLLM proxy settings
vi.mock("../config.js", () => ({
  config: {
    PORT: 3001,
    CORS_ORIGIN: "http://localhost:3000",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars",
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://localhost:5432/oma_test",
    REDIS_URL: "redis://localhost:6379",
    LITELLM_PROXY_URL: "http://localhost:4000",
    LITELLM_API_KEY: "sk-litellm-test-key",
  },
}));

import * as litellm from "../inference/litellm.js";
import { checkProviderHealth, isProviderAvailable, reportProviderResult } from "../inference/provider-health.js";
import { selectProvider, getModelPricing } from "../inference/router.js";

describe("LiteLLM Provider client", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("chatCompletion", () => {
    it("successfully sends requests to LiteLLM proxy URL", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-123",
          object: "chat.completion",
          created: 1677652288,
          model: "gpt-4o",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from LiteLLM!",
              },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await litellm.chatCompletion({
        model: "litellm/gpt-4o",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("http://localhost:4000/v1/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer sk-litellm-test-key",
      });
      const parsedBody = JSON.parse(init?.body as string);
      expect(parsedBody.model).toBe("litellm/gpt-4o");
    });

    it("handles connection failure by reporting failure and throwing 502", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(
        litellm.chatCompletion({
          model: "litellm/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toThrow("litellm connection failed: Connection refused");
    }, 10000);

    it("maps 4xx error response from LiteLLM accurately", async () => {
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
        litellm.chatCompletion({
          model: "litellm/gpt-4o",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid API Key",
        type: "invalid_request_error",
      });
    });
  });

  describe("completion", () => {
    it("successfully sends legacy text completions requests", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "cmpl-123",
          object: "text_completion",
          created: 1677652288,
          choices: [{ text: " Once upon a time" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await litellm.completion({
        model: "litellm/llama-3",
        prompt: "Once upon a",
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledOnce();
      const [url] = fetchSpy.mock.calls[0];
      expect(url).toBe("http://localhost:4000/v1/completions");
    });
  });

  describe("litellmHealthCheck", () => {
    it("returns active health and latency under normal conditions", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("OK", { status: 200 }));

      const status = await litellm.litellmHealthCheck();
      expect(status.isUp).toBe(true);
      expect(status.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it("returns down state if health check fails or times out", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Timeout"));

      const status = await litellm.litellmHealthCheck();
      expect(status.isUp).toBe(false);
    });
  });
});

describe("LiteLLM Circuit Breaker and Routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLimit.mockResolvedValue([]);
  });

  it("monitors provider health and handles availability checks for litellm", async () => {
    // Standard check returns true by default when no health check record exists
    const available = await isProviderAvailable("litellm");
    expect(available).toBe(true);

    const health = await checkProviderHealth("litellm");
    expect(health.isUp).toBe(true);
  });

  it("reports successes and failures to update circuit breaker state for litellm", async () => {
    vi.useFakeTimers();

    // Report 5 failures in a row (above failure threshold of 5)
    for (let i = 0; i < 5; i++) {
      await reportProviderResult("litellm", false, 100);
    }

    const availableAfterFailures = await isProviderAvailable("litellm");
    expect(availableAfterFailures).toBe(false);

    // Fast-forward past 60-second recovery timeout - circuit moves to HALF_OPEN
    vi.advanceTimersByTime(60_000 + 1000);

    // In HALF_OPEN state, provider is available for probing
    const availableInHalfOpen = await isProviderAvailable("litellm");
    expect(availableInHalfOpen).toBe(true);

    // Report success to close the circuit
    await reportProviderResult("litellm", true, 50);
    const availableAfterSuccess = await isProviderAvailable("litellm");
    expect(availableAfterSuccess).toBe(true);

    vi.useRealTimers();
  });

  describe("router integration", () => {
    it("infers provider as litellm when model has litellm/ prefix", async () => {
      const { provider, providerModelId } = await selectProvider("litellm/anthropic/claude-3");
      expect(provider).toBe("litellm");
      expect(providerModelId).toBe("anthropic/claude-3");
    });

    it("routes fallback correctly if litellm is preferred but down", async () => {
      // Mark litellm as down (5 failures)
      for (let i = 0; i < 5; i++) {
        await reportProviderResult("litellm", false, 100);
      }

      // We ask to select litellm/anthropic/claude-3 (which prefers litellm)
      // Since it's down, it should fall back to Venice or AntSeed (both are mock-available)
      const choice = await selectProvider("litellm/anthropic/claude-3");
      expect(choice.provider).not.toBe("litellm");
      expect(choice.provider).toBe("venice"); // preferred fallback is venice/antseed
    });

    it("calculates appropriate model pricing for custom litellm models", () => {
      const pricing = getModelPricing("litellm/my-custom-model");
      expect(pricing.provider).toBe("litellm");
      expect(pricing.inputPer1k).toBe(0.0015);
      expect(pricing.outputPer1k).toBe(0.002);
      expect(pricing.markup).toBe(5); // proprietary fallback markup
    });
  });
});
