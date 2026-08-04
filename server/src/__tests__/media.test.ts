import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

const dbStub = vi.hoisted(() => ({
  select: vi.fn(),
  transaction: vi.fn(),
}));

// Stub the db module before importing the router so chargeFlat's
// balance read + deduction never touch a real database.
vi.mock("../db/client.js", () => ({ db: dbStub }));

// Middleware stubs: tokenBucket/requestTimeout are covered by their own
// suites; this suite exercises media routing + billing only.
vi.mock("../middleware/rate-limit.js", () => ({
  tokenBucket: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock("../middleware/timeout.js", () => ({
  requestTimeout: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

// Replace bearerAuth with a pass-through (auth itself is covered by
// dedicated auth tests — this suite exercises media routing + billing).
vi.mock("../auth/middleware.js", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../auth/middleware.js")>();
  return {
    ...mod,
    bearerAuth: vi.fn(async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
      c.set("userId", "user_1");
      c.set("apiKey", { id: "key_1", keyHash: "hash" });
      await next();
    }),
  };
});

// Stub the Venice media client so tests exercise routing + billing
// without network calls.
vi.mock("../inference/media.js", () => ({
  imageGeneration: vi.fn(async () => ({
    images: [{ url: "https://cdn.venice.ai/img/1.png" }],
  })),
  videoQuote: vi.fn(async () => ({
    price: 0.5,
    currency: "usd",
    estimated_seconds: 30,
  })),
  videoGeneration: vi.fn(async () => ({
    queueId: "q_123",
    status: "queued",
  })),
  retrieveVideo: vi.fn(async () => ({
    status: "COMPLETED",
    video_url: "https://cdn.venice.ai/vid/1.mp4",
  })),
}));

import { mediaRouter } from "../routes/media.js";

function authedRequest(
  method: "get" | "post",
  path: string,
  body?: unknown,
) {
  const app = new Hono();
  app.route("/", mediaRouter);
  const req = new Request(`http://localhost${path}`, {
    method: method.toUpperCase(),
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return app.request(req);
}

beforeEach(() => {
  vi.clearAllMocks();
  const balanceSelect = {
    from: vi.fn(() => ({
      where: vi.fn(() => ({ limit: vi.fn(async () => [] as never[]) })),
    })),
  };
  dbStub.select.mockReturnValue(balanceSelect);
  const txStub = {
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    })),
    insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
  };
  dbStub.transaction.mockImplementation(
    async (fn: (tx: unknown) => Promise<void>) => fn(txStub),
  );
});

describe("media routes", () => {
  it("rejects image generation with an invalid body", async () => {
    const res = await authedRequest("post", "/v1/images/generations", {
      prompt: "", // empty prompt fails zod
      model: "flux-2-pro",
    });
    expect(res.status).toBe(400);
  });

  it("returns 402 when the user has no balance", async () => {
    const res = await authedRequest("post", "/v1/images/generations", {
      model: "flux-2-pro",
      prompt: "a red cube",
    });
    expect(res.status).toBe(402);
    const json = (await res.json()) as { error: { type: string } };
    expect(json.error.type).toBe("insufficient_quota");
  });

  it("returns image urls in OpenAI-compatible shape", async () => {
    const balanceSelect = {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ balanceCents: "1000" }]),
        })),
      })),
    };
    dbStub.select.mockReturnValue(balanceSelect);

    const res = await authedRequest("post", "/v1/images/generations", {
      model: "flux-2-pro",
      prompt: "a red cube",
      n: 2,
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: Array<{ url: string }> };
    expect(json.data[0].url).toContain("https://");
  });

  it("queues a video and reports queued status", async () => {
    const balanceSelect = {
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => [{ balanceCents: "5000" }]),
        })),
      })),
    };
    dbStub.select.mockReturnValue(balanceSelect);

    const res = await authedRequest("post", "/v1/videos/generations", {
      model: "kling-v3-pro-text-to-video",
      prompt: "a wave crashing",
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; queue_id: string };
    expect(json.status).toBe("queued");
    expect(json.queue_id).toBe("q_123");
  });

  it("returns 400 when queue_id is missing on retrieve", async () => {
    const res = await authedRequest("get", "/v1/videos/retrieve");
    expect(res.status).toBe(400);
  });

  it("retrieves a completed video", async () => {
    const res = await authedRequest("get", "/v1/videos/retrieve?queue_id=q_123");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { status: string; video_url: string };
    expect(json.status).toBe("completed");
    expect(json.video_url).toContain("https://");
  });
});
