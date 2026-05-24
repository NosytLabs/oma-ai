import { describe, expect, test } from "vitest";
import { Hono } from "hono";
import { requireRole, requireTeamRole } from "../middleware/rbac";

describe("RBAC Middleware", () => {
  test("requireRole allows access if user has required global role", async () => {
    const app = new Hono<{ Variables: { user: { id: string; role: string } } }>();
    
    app.use("*", async (c, next) => {
      c.set("user", { id: "user-1", role: "admin" });
      await next();
    });

    app.get("/admin", requireRole(["admin"]), (c) => c.json({ ok: true }));

    const res = await app.request("/admin");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as any).ok).toBe(true);
  });

  test("requireRole denies access if user lacks required global role", async () => {
    const app = new Hono<{ Variables: { user: { id: string; role: string } } }>();
    
    app.use("*", async (c, next) => {
      c.set("user", { id: "user-1", role: "member" });
      await next();
    });

    app.get("/admin", requireRole(["admin"]), (c) => c.json({ ok: true }));

    const res = await app.request("/admin");
    expect(res.status).toBe(403);
  });

  test("requireTeamRole allows access if user has required team role", async () => {
    const app = new Hono<{ Variables: { user: { id: string }, teamRole: string } }>();
    
    app.use("*", async (c, next) => {
      c.set("user", { id: "user-1" });
      c.set("teamRole", "owner");
      await next();
    });

    app.get("/team/:teamId/settings", requireTeamRole(["owner", "admin"]), (c) => c.json({ ok: true }));

    const res = await app.request("/team/team-1/settings");
    expect(res.status).toBe(200);
  });

  test("requireTeamRole denies access if user lacks required team role", async () => {
    const app = new Hono<{ Variables: { user: { id: string }, teamRole: string } }>();
    
    app.use("*", async (c, next) => {
      c.set("user", { id: "user-1" });
      c.set("teamRole", "member");
      await next();
    });

    app.get("/team/:teamId/settings", requireTeamRole(["owner", "admin"]), (c) => c.json({ ok: true }));

    const res = await app.request("/team/team-1/settings");
    expect(res.status).toBe(403);
  });
});
