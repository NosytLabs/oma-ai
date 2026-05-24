import { Hono } from "hono";
import { db } from "../db/client.js";
import { teams, ssoConnections } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { sessionAuth, requireTeamRole } from "../auth/middleware.js";
import type { OmaEnv } from "../types.js";

export const teamsRouter = new Hono<OmaEnv>();

teamsRouter.use("*", sessionAuth);

teamsRouter.get("/", async (c) => {
  return c.json({ success: true, teams: [] });
});

teamsRouter.post("/", async (c) => {
  const body = await c.req.json();
  return c.json({ success: true, team: { id: "team-1", name: body.name } }, 201);
});

teamsRouter.get("/:teamId", requireTeamRole(["owner", "admin", "member"]), async (c) => {
  const { teamId } = c.req.param();

  const team = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);

  if (team.length === 0) {
    return c.json({ error: { message: "Team not found", code: "team_not_found" } }, 404);
  }

  return c.json({ success: true, team: team[0] });
});

teamsRouter.post("/:teamId/members", requireTeamRole(["owner", "admin"]), async (c) => {
  const body = await c.req.json();
  return c.json({ success: true, member: { address: body.address, role: body.role } }, 201);
});

teamsRouter.get("/:teamId/sso", requireTeamRole(["owner", "admin", "member"]), async (c) => {
  const { teamId } = c.req.param();

  const connections = await db.select().from(ssoConnections).where(eq(ssoConnections.teamId, teamId));

  return c.json({ success: true, connections });
});

teamsRouter.post("/:teamId/sso", requireTeamRole(["owner", "admin"]), async (c) => {
  const { teamId } = c.req.param();
  const body = await c.req.json();
  const { provider, domain, metadata } = body;

  if (!provider || !domain) {
    return c.json({ error: { message: "provider and domain are required", code: "validation_error" } }, 400);
  }

  const team = await db.select().from(teams).where(eq(teams.id, teamId)).limit(1);
  if (team.length === 0) {
    return c.json({ error: { message: "Team not found", code: "team_not_found" } }, 404);
  }

  const existing = await db.select().from(ssoConnections).where(eq(ssoConnections.domain, domain.toLowerCase())).limit(1);
  if (existing.length > 0) {
    return c.json({ error: { message: "Domain already configured for SSO", code: "domain_exists" } }, 409);
  }

  const [connection] = await db.insert(ssoConnections).values({
    teamId,
    provider,
    domain: domain.toLowerCase(),
    metadata: metadata || null,
  }).returning();

  return c.json({ success: true, connection }, 201);
});

teamsRouter.delete("/:teamId/sso/:connectionId", requireTeamRole(["owner", "admin"]), async (c) => {
  const { connectionId } = c.req.param();

  const [deleted] = await db.delete(ssoConnections).where(eq(ssoConnections.id, connectionId)).returning();

  if (!deleted) {
    return c.json({ error: { message: "Connection not found", code: "not_found" } }, 404);
  }

  return c.json({ success: true });
});