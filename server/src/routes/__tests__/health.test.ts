import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const mocks = vi.hoisted(() => ({ execute: vi.fn(), error: vi.fn() }));
vi.mock("../../db/client.js", () => ({ db: { execute: mocks.execute } }));
vi.mock("../../lib/logger.js", () => ({ logger: { error: mocks.error } }));
vi.mock("../../lib/redis-client.js", () => ({
  redisHealthCheck: vi.fn().mockResolvedValue({ status: "ok", latency: 1 }),
}));

import { healthRoutes } from "../health.js";

const app = new Hono().route("/", healthRoutes);

beforeEach(() => vi.clearAllMocks());

describe("public liveness probes", () => {
  it("/health returns the ok payload", async () => {
    const response = await app.request("/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("oma-ai");
    expect(typeof body.timestamp).toBe("string");
  });

  it("/v1/health returns the same ok payload under the v1 prefix", async () => {
    const response = await app.request("/v1/health");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
    expect(body.service).toBe("oma-ai");
    expect(typeof body.timestamp).toBe("string");
  });
});

describe("public database health", () => {
  it("reports a reachable database", async () => {
    mocks.execute.mockResolvedValueOnce([]);
    const response = await app.request("/health/db");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: "ok", db: "reachable" });
  });

  it("keeps driver details in server logs when the database fails", async () => {
    const error = new Error("connection rejected for postgres://private-user:secret@internal-db");
    mocks.execute.mockRejectedValueOnce(error);
    const response = await app.request("/health/db");
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: "error", db: "unreachable" });
    expect(mocks.error).toHaveBeenCalledWith({ err: error }, "[health] database health check failed");
  });
});
