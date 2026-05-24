import { describe, expect, test, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { ssoRouter } from "../routes/sso";

vi.mock("../db/client", () => {
  const selectChain = {
    from: (table: any) => {
      const name = table?.name || String(table).split('.').pop() || String(table);
      if (name === 'teams') {
        return { where: () => ({ limit: () => Promise.resolve([{ id: "team-1", name: "Test Team" }]) }) };
      }
      if (name === 'ssoConnections') {
        return { where: () => ({ limit: () => Promise.resolve([{ id: "conn-1", teamId: "team-1", provider: "okta", domain: "example.com" }]) }) };
      }
      return { where: () => ({ limit: () => Promise.resolve([]) }) };
    },
  };
  const insertChain = {
    values: () => ({ returning: () => Promise.resolve([{ id: "conn-1", teamId: "team-1", provider: "okta", domain: "example.com" }]) }),
  };
  const deleteChain = {
    where: () => ({ returning: () => Promise.resolve([{ id: "conn-1" }]) }),
  };
  const updateChain = {
    set: () => ({ where: () => ({ returning: () => Promise.resolve([{ id: "conn-1" }]) }) }),
  };
  const baseChain: any = {
    select: () => selectChain,
    insert: () => insertChain,
    delete: () => deleteChain,
    update: () => updateChain,
  };
  return { db: baseChain };
});

vi.mock("../config", () => ({
  config: { CORS_ORIGIN: "https://app.oma.dev", RECEIPT_HMAC_SECRET: "test-receipt-secret-at-least-32-chars!", JWT_SECRET: "test-jwt-secret-at-least-32-characters!" },
}));

vi.mock("../middleware/rbac", () => ({
  requireRole: vi.fn(() => async (c: any, next: any) => await next()),
  requireTeamRole: vi.fn(() => async (c: any, next: any) => await next()),
}));

describe("SSO/SAML API", () => {
  let app: Hono<any>;

  beforeEach(() => {
    app = new Hono<any>();
    app.use("*", async (c, next) => {
      c.set("user", { id: "user-1" });
      c.set("teamRole", "admin");
      await next();
    });
    app.route("/sso", ssoRouter);
  });

  test("POST /sso/saml/acs - rejects missing SAMLResponse", async () => {
    const res = await app.request("/sso/saml/acs", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "",
    });
    expect(res.status).toBe(400);
  });

  test("DELETE /sso/connections/:connectionId - deletes SSO connection", async () => {
    const res = await app.request("/sso/connections/conn-1", {
      method: "DELETE",
    });
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });
});