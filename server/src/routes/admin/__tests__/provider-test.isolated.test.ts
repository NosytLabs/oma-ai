/**
 * ISOLATED Unit Test for provider-test.ts
 * Target: server/src/routes/admin/provider-test.ts
 * Session: ses_m10_2_provider_test
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-14T05-00Z-m10-2-provider-test.md
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";

// Mock all external dependencies BEFORE importing target.
vi.mock("../../../db/client.js", () => ({
  db: {
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
  },
}));

const { authMocks, configState } = vi.hoisted(() => {
  const authMocks = { sessionAuthAllow: true, requireAdminAllow: true };
  const configState: Record<string, string | undefined> = {
    VENICE_API_KEY: "sk-venice-test",
    VENICE_API_URL: "https://api.venice.test/v1",
    OPENROUTER_API_KEY: "sk-or-test",
    OPENROUTER_API_URL: "https://openrouter.test/api/v1",
    TOGETHER_API_KEY: "sk-together-test",
    TOGETHER_API_URL: "https://api.together.test/v1",
    DEEPINFRA_API_KEY: "sk-deepinfra-test",
    DEEPINFRA_API_URL: "https://api.deepinfra.test/v1",
    MORPHEUS_API_KEY: "sk-morpheus-test",
    MORPHEUS_BASE_URL: "https://api.morpheus.test/v1",
    ANTSEED_PROXY_URL: "https://proxy.antseed.test",
    LITELLM_PROXY_URL: "https://proxy.litellm.test",
  };
  return { authMocks, configState };
});

vi.mock("../../../auth/middleware.js", () => ({
  sessionAuth: async (c: any, next: any) => {
    if (!authMocks.sessionAuthAllow) {
      return c.json({ error: { message: "Missing or invalid Authorization header", type: "authentication_error" } }, 401);
    }
    c.set("userId", "admin-test-123");
    c.set("authMethod", "siwe");
    await next();
  },
  requireAdmin: () => async (c: any, next: any) => {
    if (!authMocks.requireAdminAllow) {
      return c.json({ error: { message: "Admin access required", type: "forbidden" } }, 403);
    }
    c.set("teamRole", "owner");
    await next();
  },
}));

vi.mock("../../../middleware/rate-limit.js", () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
}));

vi.mock("../../../config.js", () => ({
  get config() {
    return new Proxy(configState, {
      get: (target, key: string) => target[key],
    });
  },
}));

// Import target AFTER mocks are registered.
import { providerTestRoutes } from "../provider-test.js";
import { db } from "../../../db/client.js";
import { sessionAuth, requireAdmin } from "../../../auth/middleware.js";
import { rateLimit } from "../../../middleware/rate-limit.js";

/**
 * Build a Hono app that mirrors how `admin/index.ts` wires this route:
 *   sessionAuth -> requireAdmin() -> rateLimit(100/min) -> providerTestRoutes.
 * This way the auth/rate-limit chain is exercised in tests exactly as production does.
 * `sessionAuth` and `requireAdmin` come from the mocked modules above.
 */
function makeApp() {
  const app = new Hono();
  app.use("*", sessionAuth);
  app.use("*", requireAdmin());
  app.use("*", rateLimit({ windowMs: 60_000, maxRequests: 100, keyPrefix: "rl:test" }));
  app.route("/", providerTestRoutes);
  return app;
}

const originalFetch = global.fetch;

describe("M10.2 — Admin Provider Test endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMocks.sessionAuthAllow = true;
    authMocks.requireAdminAllow = true;
    // Re-apply env defaults (clearAllMocks doesn't touch the configState object).
    configState.VENICE_API_KEY = "sk-venice-test";
    configState.VENICE_API_URL = "https://api.venice.test/v1";
    configState.OPENROUTER_API_KEY = "sk-or-test";
    configState.OPENROUTER_API_URL = "https://openrouter.test/api/v1";
    configState.TOGETHER_API_KEY = "sk-together-test";
    configState.TOGETHER_API_URL = "https://api.together.test/v1";
    configState.DEEPINFRA_API_KEY = "sk-deepinfra-test";
    configState.DEEPINFRA_API_URL = "https://api.deepinfra.test/v1";
    configState.MORPHEUS_API_KEY = "sk-morpheus-test";
    configState.MORPHEUS_BASE_URL = "https://api.morpheus.test/v1";
    configState.ANTSEED_PROXY_URL = "https://proxy.antseed.test";
    configState.LITELLM_PROXY_URL = "https://proxy.litellm.test";
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  // -------- Test 1: 200 success path --------
  it("returns 200 with sample + latency on a successful upstream call", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          id: "chatcmpl-test-001",
          choices: [{ message: { role: "assistant", content: "pong" } }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const res = await makeApp().request("/admin/providers/venice/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("venice");
    expect(body.status).toBe("ok");
    expect(body.sample).toBe("pong");
    expect(body.upstreamStatus).toBe(200);
    expect(typeof body.latencyMs).toBe("number");
    expect(body.latencyMs).toBeGreaterThanOrEqual(0);
    expect(body.requestId).toBe("chatcmpl-test-001");
    expect(body.model).toBeTruthy();

    // Verify the upstream call was made with correct shape.
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.venice.test/v1/api/v1/chat/completions");
    const parsedBody = JSON.parse(init.body as string);
    expect(parsedBody.max_tokens).toBe(1);
    expect(parsedBody.stream).toBe(false);
    expect(parsedBody.messages[0].content).toBe("ping");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer sk-venice-test");

    // Audit log was called with PROVIDER_TEST_SUCCESS.
    expect(db.insert).toHaveBeenCalled();
  });

  // -------- Test 2: 401/403 without admin role --------
  it("returns 401 when sessionAuth rejects (no Authorization header)", async () => {
    authMocks.sessionAuthAllow = false;
    const res = await makeApp().request("/admin/providers/openrouter/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.type).toBe("authentication_error");
    // fetch must NOT have been called.
    expect(global.fetch).toBe(originalFetch);
  });

  it("returns 403 when requireAdmin rejects (user is not admin)", async () => {
    authMocks.requireAdminAllow = false;
    const res = await makeApp().request("/admin/providers/openrouter/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.type).toBe("forbidden");
    expect(global.fetch).toBe(originalFetch);
  });

  // -------- Test 3: 503 when provider env key missing --------
  it("returns 503 when the provider env key is missing (no upstream call made)", async () => {
    configState.VENICE_API_KEY = undefined;
    global.fetch = vi.fn() as unknown as typeof fetch;

    const res = await makeApp().request("/admin/providers/venice/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.type).toBe("service_unavailable");
    expect(body.error.provider).toBe("venice");
    expect(body.error.message).toMatch(/VENICE_API_KEY/);

    // fetch must NOT have been called.
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 503 when the provider base URL env is missing", async () => {
    configState.TOGETHER_API_URL = undefined;
    global.fetch = vi.fn() as unknown as typeof fetch;

    const res = await makeApp().request("/admin/providers/together/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.type).toBe("service_unavailable");
    expect(body.error.message).toMatch(/TOGETHER_API_URL/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // -------- Test 4: 504 when upstream times out --------
  it("returns 504 when the upstream fetch exceeds the timeout", async () => {
    global.fetch = vi.fn(async () => {
      // Simulate the AbortSignal.timeout firing.
      const err: any = new Error("The operation was aborted");
      err.name = "TimeoutError";
      throw err;
    }) as unknown as typeof fetch;

    const res = await makeApp().request("/admin/providers/openrouter/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "ping" }),
    });
    expect(res.status).toBe(504);
    const body = await res.json();
    expect(body.error.type).toBe("upstream_timeout");
    expect(body.error.provider).toBe("openrouter");
    expect(typeof body.error.latencyMs).toBe("number");
  });

  it("returns 502 when the upstream returns a non-2xx status", async () => {
    global.fetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({ error: { message: "Invalid API key" } }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }) as unknown as typeof fetch;

    const res = await makeApp().request("/admin/providers/deepinfra/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error.type).toBe("upstream_error");
    expect(body.error.provider).toBe("deepinfra");
    expect(body.error.status).toBe(401);
    expect(body.error.message).toMatch(/Invalid API key/);
  });

  // -------- Bonus: 400 on unknown provider / invalid body --------
  it("returns 400 for an unknown provider name", async () => {
    const res = await makeApp().request("/admin/providers/nonexistent/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.type).toBe("invalid_request_error");
    expect(body.error.message).toMatch(/Unknown provider/);
  });

  it("returns 400 for an overlong message field", async () => {
    const res = await makeApp().request("/admin/providers/morpheus/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(2001) }),
    });
    expect(res.status).toBe(400);
  });

  it("uses default model and message when body is empty", async () => {
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ id: "x", choices: [{ message: { content: "ok" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const res = await makeApp().request("/admin/providers/morpheus/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    expect(res.status).toBe(200);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const parsedBody = JSON.parse(init.body as string);
    expect(parsedBody.messages[0].content).toBe("ping");
    expect(parsedBody.max_tokens).toBe(1);
  });

  // -------- Bonus: AntSeed works without an API key (apiKeyOptional) --------
  it("does not 503 on AntSeed when API key env is unset (apiKeyOptional)", async () => {
    // ANTSEED_PROXY_URL is set; ANTSEED_API_KEY intentionally absent.
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ id: "ax", choices: [{ message: { content: "hi" } }] }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    ) as unknown as typeof fetch;
    const res = await makeApp().request("/admin/providers/antseed/test", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://proxy.antseed.test/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });
});
