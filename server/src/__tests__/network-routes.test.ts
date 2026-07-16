import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
  getRequestListener: vi.fn(() => ({ on: vi.fn(), handle: vi.fn() })),
}));

// Passthrough auth that sets a userId so handlers run as an authed user.
vi.mock("../auth/middleware.js", () => ({
  sessionAuth: (c: any, next: any) => {
    c.set("userId", "u1");
    return next();
  },
  requireAdmin: (c: any, next: any) => next(),
  bearerAuth: (c: any, next: any) => next(),
}));

// Flexible drizzle chain: every builder method returns the chain; the chain
// itself is awaitable and resolves to [] (empty result set) by default.
const makeChain = vi.hoisted(() => () => {
  const chain: any = {};
  for (const m of ["select", "from", "where", "orderBy", "limit", "insert", "values", "update", "set", "groupBy", "having"]) {
    chain[m] = () => chain;
  }
  chain.returning = () => Promise.resolve([{ id: "k1", publicKey: "pk", name: "default", createdAt: new Date() }]);
  chain.then = (resolve: any) => resolve([]);
  return chain;
});

vi.mock("../db/client.js", () => {
  const chain = makeChain();
  return { db: chain, getDb: () => makeChain() };
});

vi.mock("../lib/redis-client.js", () => ({
  isRedisReady: () => false,
  getRedisClient: async () => null,
}));

vi.mock("../inference/provider-health.js", () => ({
  isProviderAvailable: async () => true,
}));

vi.mock("../inference/provider-selector.js", () => ({
  ALL_PROVIDERS: ["openai", "anthropic"],
}));

import { networkRoutes } from "../routes/network.js";

function makeApp() {
  const app = new Hono();
  app.route("/v1", networkRoutes);
  return app;
}

describe("network routes", () => {
  let app: Hono;
  beforeEach(() => {
    app = makeApp();
  });

  it("GET /v1/audit/events returns paginated shape", async () => {
    const res = await app.request("/v1/audit/events?limit=10");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("events");
    expect(Array.isArray(body.events)).toBe(true);
    expect(body).toHaveProperty("count");
    expect(body).toHaveProperty("since");
  });

  it("GET /v1/rate-limits/:key returns config + live peek", async () => {
    const res = await app.request("/v1/rate-limits/oma_test");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.key).toBe("oma_test");
    expect(body).toHaveProperty("apiKey");
    expect(body).toHaveProperty("overrides");
    expect(body).toHaveProperty("live");
    expect(body).toHaveProperty("redisReady");
    expect(body.redisReady).toBe(false);
  });

  it("POST /v1/signing/pin rejects bad body with 400", async () => {
    const res = await app.request("/v1/signing/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.type).toBe("validation_error");
  });

  it("POST /v1/signing/pin stores a key with 201", async () => {
    const res = await app.request("/v1/signing/pin", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ publicKey: "ssh-ed25519 AAAA...", name: "ci" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("k1");
    expect(body.publicKey).toBe("pk");
    expect(body.name).toBe("default");
  });

  it("GET /v1/upstream/health returns per-provider breaker state", async () => {
    const res = await app.request("/v1/upstream/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(2);
    expect(body.providers.openai).toHaveProperty("available", true);
    expect(body.providers.anthropic).toHaveProperty("isUp");
    expect(body).toHaveProperty("checkedAt");
  });

  it("GET /v1/deposit/feed is registered as a WebSocket route", async () => {
    // The ws helper only answers real WS upgrades, so it 404s under a plain
    // app.request. We verify it's wired by checking the router table instead.
    const routes = (app as any).routes as Array<{ path: string; method: string }>;
    expect(routes.some((r) => r.path === "/v1/deposit/feed" && r.method === "GET")).toBe(true);
  });
});
