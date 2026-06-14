/**
 * ISOLATED Unit Test for server/src/inference/venice.ts — error mapping
 * Target: server/src/inference/venice.ts
 * Session: ses_venice_improvements
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-14T09-30Z-venice-errors.md
 *
 * Coverage:
 *   - 401  → venice_unauthorized         (not retryable)
 *   - 402  → venice_credits_exhausted    (not retryable)
 *   - 422  → venice_content_policy       (not retryable)
 *   - 429  → venice_rate_limited         (retryable)
 *   - 500  → venice_server_error         (retryable)
 *   - 524  → venice_upstream_timeout     (retryable, Cloudflare)
 *   - All error throws carry { status, code, retryable, type }
 *   - Non-JSON error bodies still produce typed errors
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../../config.js", () => ({
  config: {
    VENICE_API_KEY: "test-venice-key",
    VENICE_API_URL: "https://api.venice.ai",
    NODE_ENV: "test",
  },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("../../db/client.js", () => ({ db: {} }));
vi.mock("../cheaptokens.js", () => ({
  getActiveVeniceKey: vi.fn().mockReturnValue("test-venice-key"),
}));

// Mock the tracing module so OTel doesn't try to start a real tracer
vi.mock("@opentelemetry/api", () => ({
  trace: {
    getTracer: () => ({
      startActiveSpan: (_name: string, _opts: unknown, fn: (span: unknown) => Promise<unknown>) =>
        fn({
          setAttribute: vi.fn(),
          setStatus: vi.fn(),
          recordException: vi.fn(),
          end: vi.fn(),
        }),
    }),
  },
  SpanKind: { CLIENT: 3, SERVER: 2, INTERNAL: 0 },
  SpanStatusCode: { OK: 1, ERROR: 2 },
}));

import { veniceChatCompletion, veniceModels, videoGeneration, healthCheckVenice } from "../venice.js";

interface FetchMockInit {
  status: number;
  body?: string | object;
  ok?: boolean;
}

function mockFetchResponse({ status, body = "" }: FetchMockInit): Response {
  const bodyText = typeof body === "string" ? body : JSON.stringify(body);
  return new Response(bodyText, {
    status,
    headers: { "Content-Type": "application/json" },
  }) as Response & { ok: boolean };
}

function setFetchStatus(status: number, jsonBody: object | null = null): void {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    text: vi.fn().mockResolvedValue(jsonBody ? JSON.stringify(jsonBody) : ""),
    json: vi.fn().mockResolvedValue(jsonBody ?? {}),
  }) as unknown as typeof fetch;
}

describe("Venice error mapping — typed codes with retryable flag", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("401 → venice_unauthorized, not retryable", async () => {
    setFetchStatus(401, { error: { message: "Bad API key", type: "auth_error" } });
    try {
      await veniceChatCompletion({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean; type: string };
      expect(e.status).toBe(401);
      expect(e.code).toBe("venice_unauthorized");
      expect(e.retryable).toBe(false);
      expect(e.type).toBe("venice_unauthorized");
    }
  });

  it("402 → venice_credits_exhausted, not retryable", async () => {
    setFetchStatus(402, { error: { message: "Insufficient credits" } });
    try {
      await veniceChatCompletion({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean; type: string };
      expect(e.status).toBe(402);
      expect(e.code).toBe("venice_credits_exhausted");
      expect(e.retryable).toBe(false);
      expect(e.type).toBe("venice_credits_exhausted");
    }
  });

  it("422 → venice_content_policy, not retryable", async () => {
    setFetchStatus(422, { error: { message: "Content policy violation" } });
    try {
      await veniceChatCompletion({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean; type: string };
      expect(e.status).toBe(422);
      expect(e.code).toBe("venice_content_policy");
      expect(e.retryable).toBe(false);
      expect(e.type).toBe("venice_content_policy");
    }
  });

  it("429 → venice_rate_limited, retryable", async () => {
    setFetchStatus(429, { error: { message: "Slow down" } });
    try {
      await veniceChatCompletion({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean };
      expect(e.status).toBe(429);
      expect(e.code).toBe("venice_rate_limited");
      expect(e.retryable).toBe(true);
    }
  });

  it("500 → venice_server_error, retryable", async () => {
    setFetchStatus(500, { error: { message: "Internal error" } });
    try {
      await veniceChatCompletion({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean };
      expect(e.status).toBe(500);
      expect(e.code).toBe("venice_server_error");
      expect(e.retryable).toBe(true);
    }
  });

  it("524 → venice_upstream_timeout, retryable (Cloudflare)", async () => {
    setFetchStatus(524, { error: { message: "Origin timed out" } });
    try {
      await veniceChatCompletion({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean };
      expect(e.status).toBe(524);
      expect(e.code).toBe("venice_upstream_timeout");
      expect(e.retryable).toBe(true);
    }
  });

  it("non-JSON error body still produces typed error with all 4 fields", async () => {
    // Pass a non-JSON body that has length > 0 so the catch branch executes
    setFetchStatus(503, null);
    // Override the text() return to be a non-JSON string
    (globalThis.fetch as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      ok: false,
      status: 503,
      text: vi.fn().mockResolvedValue("upstream temporarily unavailable"),
      json: vi.fn().mockResolvedValue({}),
    });
    try {
      await veniceChatCompletion({ model: "llama-3.3-70b", messages: [{ role: "user", content: "hi" }] });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { status: number; code: string; retryable: boolean; type: string };
      expect(e.status).toBe(503);
      expect(e.code).toBe("venice_server_error");
      expect(e.retryable).toBe(true);
      expect(e.type).toBe("venice_server_error");
      expect(e.message).toContain("upstream temporarily unavailable");
    }
  });

  it("videoGeneration 402 surfaces venice_credits_exhausted", async () => {
    setFetchStatus(402, { error: { message: "No credits" } });
    try {
      await videoGeneration({ model: "seedance-2-0-text-to-video", prompt: "sunset" });
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { code: string; retryable: boolean };
      expect(e.code).toBe("venice_credits_exhausted");
      expect(e.retryable).toBe(false);
    }
  });

  it("veniceModels 524 surfaces venice_upstream_timeout", async () => {
    setFetchStatus(524);
    try {
      await veniceModels();
      throw new Error("expected throw");
    } catch (err: unknown) {
      const e = err as Error & { code: string; retryable: boolean };
      expect(e.code).toBe("venice_upstream_timeout");
      expect(e.retryable).toBe(true);
    }
  });
});

describe("Venice health check", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns ok=true with latencyMs when Venice /models is reachable", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse({ status: 200, body: { data: [] } })) as unknown as typeof fetch;
    const result = await healthCheckVenice();
    expect(result.ok).toBe(true);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
    expect(result.error).toBeUndefined();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "https://api.venice.ai/api/v1/models",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("returns ok=false with status error when Venice returns 5xx", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockFetchResponse({ status: 503, body: "" })) as unknown as typeof fetch;
    const result = await healthCheckVenice();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("503");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("returns ok=false with thrown error message when fetch fails (network error)", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("ENOTFOUND api.venice.ai")) as unknown as typeof fetch;
    const result = await healthCheckVenice();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ENOTFOUND");
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
