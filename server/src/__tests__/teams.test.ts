import { describe, expect, test, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { teamsRouter } from "../routes/teams";

vi.mock("../db/client", () => ({
  db: new Proxy({}, {
    get(_: unknown, prop: string) {
      if (prop === 'select') {
        return () => ({
          from: (table: unknown) => ({
            where: (_pred: unknown) => {
              if (table && (table as { id?: { equals?: (v: string) => boolean } }).id) {
                return {
                  limit: () => Promise.resolve([{ id: "team-1", name: "Test Team" }])
                };
              }
              return { limit: () => Promise.resolve([]) };
            }
          })
        });
      }
      if (prop === 'insert') {
        return () => ({
          values: () => ({
            returning: () => Promise.resolve([{ id: "team-1", name: "Test Team" }])
          })
        });
      }
      return () => [];
    },
  } as Record<string, any>),
}));

vi.mock("../config", () => ({
  config: { JWT_SECRET: "test-jwt-secret-at-least-32-characters-long-for-hmac!", CORS_ORIGIN: "https://app.oma.dev", RECEIPT_HMAC_SECRET: "test-receipt-secret-at-least-32-chars!" },
}));

vi.mock("../auth/siwe", () => ({
  verifySessionToken: vi.fn().mockResolvedValue("user-1"),
}));

vi.mock("../auth/middleware", () => ({
  sessionAuth: vi.fn(async (_c: any, next: any) => await next()),
  requireTeamRole: vi.fn(() => async (_c: any, next: any) => await next()),
  requireAdmin: vi.fn(() => async (_c: any, next: any) => await next()),
}));

describe("Teams API", () => {
  let app: Hono<any>;

  beforeEach(() => {
    app = new Hono<any>();
    app.use("*", async (c, next) => {
      c.set("user", { id: "user-1" });
      await next();
    });
    app.route("/teams", teamsRouter);
  });

  test("GET /teams - returns user teams", async () => {
    const res = await app.request("/teams", { headers: { Authorization: "Bearer session-token" } });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.teams)).toBe(true);
  });

  test("POST /teams - creates a new team", async () => {
    const res = await app.request("/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer session-token" },
      body: JSON.stringify({ name: "New Team", billingEmail: "billing@newteam.com" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.team.name).toBe("New Team");
  });

  test("GET /teams/:teamId - returns team details", async () => {
    const res = await app.request("/teams/team-1", { headers: { Authorization: "Bearer session-token" } });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.team).toBeDefined();
  });

  test("POST /teams/:teamId/members - adds a member", async () => {
    const res = await app.request("/teams/team-1/members", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer session-token" },
      body: JSON.stringify({ address: "0x123", role: "member" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.member).toBeDefined();
  });
});
