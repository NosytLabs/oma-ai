import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    OPENROUTER_API_KEY: "sk-or-test-key",
    OPENROUTER_API_URL: "https://openrouter.ai/api/v1",
    OPENROUTER_REFERRER: "test-referrer",
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

import * as openrouter from "../openrouter.js";

describe("OpenRouter Provider", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe("chatCompletion", () => {
    it("successfully sends requests to OpenRouter", async () => {
      const mockResponse = new Response(
        JSON.stringify({
          id: "chatcmpl-openrouter-123",
          object: "chat.completion",
          created: 1677652288,
          model: "openrouter/anthropic/claude-3",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: "Hello from OpenRouter!",
              },
              finish_reason: "stop",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );

      const fetchSpy = vi.fn().mockResolvedValue(mockResponse);
      globalThis.fetch = fetchSpy;

      const res = await openrouter.chatCompletion({
        model: "openrouter/anthropic/claude-3",
        messages: [{ role: "user", content: "hello" }],
      });

      expect(res.status).toBe(200);
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0];
      expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
      expect(init?.method).toBe("POST");
      expect(init?.headers).toMatchObject({
        "Content-Type": "application/json",
        Authorization: "Bearer sk-or-test-key",
        "X-Title": "test-referrer",
      });
    });

    it("throws error when API key not configured", async () => {
      const { config } = await import("../../config.js");
      const originalKey = config.OPENROUTER_API_KEY;
      (config as any).OPENROUTER_API_KEY = "";
      try {
        await expect(
          openrouter.chatCompletion({
            model: "openrouter/anthropic/claude-3",
            messages: [{ role: "user", content: "hello" }],
          })
        ).rejects.toMatchObject({ status: 503 });
      } finally {
        (config as any).OPENROUTER_API_KEY = originalKey;
      }
    });

    it("handles connection failure with 502", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Connection refused"));

      await expect(
        openrouter.chatCompletion({
          model: "openrouter/anthropic/claude-3",
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
        openrouter.chatCompletion({
          model: "openrouter/anthropic/claude-3",
          messages: [{ role: "user", content: "hello" }],
        })
      ).rejects.toMatchObject({
        status: 401,
        message: "Invalid API Key",
      });
    });
  });

  describe("BYOK functions", () => {
    it("createBYOKKey creates a key successfully", async () => {
      const mockKey = { id: "byok-123", provider: "venice", name: "Venice AI (BYOK)", createdAt: "2024-01-01" };
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockKey), { status: 200 })
      );

      const result = await openrouter.createBYOKKey("venice", "sk-venice-key", "Venice AI (BYOK)");
      expect(result).toEqual(mockKey);
    });

    it("createBYOKKey throws on failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Internal error", { status: 500 })
      );

      await expect(openrouter.createBYOKKey("venice", "sk-venice-key", "Venice AI (BYOK)"))
        .rejects.toThrow("Failed to create BYOK key");
    });

    it("listBYOKKeys returns keys successfully", async () => {
      const mockKeys = [{ id: "byok-123", provider: "venice", name: "Venice AI (BYOK)", createdAt: "2024-01-01" }];
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(mockKeys), { status: 200 })
      );

      const result = await openrouter.listBYOKKeys();
      expect(result).toEqual(mockKeys);
    });

    it("deleteBYOKKey deletes successfully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));

      await expect(openrouter.deleteBYOKKey("byok-123")).resolves.toBeUndefined();
    });

    it("deleteBYOKKey throws on failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response("Not found", { status: 404 })
      );

      await expect(openrouter.deleteBYOKKey("byok-invalid")).rejects.toThrow("Failed to delete BYOK key");
    });
  });

  describe("addVeniceAsBYOK", () => {
    it("returns existing key if already present", async () => {
      const existingKey = { id: "byok-existing", provider: "venice", name: "Venice AI (BYOK)", createdAt: "2024-01-01" };
      globalThis.fetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify([existingKey]), { status: 200 })
      );

      const result = await openrouter.addVeniceAsBYOK("sk-venice-key");
      expect(result.success).toBe(true);
      expect(result.byokKey).toEqual(existingKey);
    });

    it("creates new key if none exists", async () => {
      const newKey = { id: "byok-new", provider: "venice", name: "Venice AI (BYOK)", createdAt: "2024-01-02" };
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve(new Response(JSON.stringify([]), { status: 200 }));
        }
        return Promise.resolve(new Response(JSON.stringify(newKey), { status: 200 }));
      });

      const result = await openrouter.addVeniceAsBYOK("sk-venice-key");
      expect(result.success).toBe(true);
      expect(result.byokKey).toEqual(newKey);
    });

    it("returns error on failure", async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

      const result = await openrouter.addVeniceAsBYOK("sk-venice-key");
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("configureBYOKOrdering", () => {
    it("configures ordering successfully", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));

      const result = await openrouter.configureBYOKOrdering(true, ["venice", "openrouter"]);
      expect(result.success).toBe(true);
    });

    it("returns error on failure", async () => {
      globalThis.fetch = vi.fn().mockResolvedValue(new Response("Server error", { status: 500 }));

      const result = await openrouter.configureBYOKOrdering(false, ["openrouter"]);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
