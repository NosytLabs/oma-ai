import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import { config } from "../config.js";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";

export const healthRoutes = new Hono<OmaEnv>();

healthRoutes.get("/health", async (c) => {
  return c.json({
    status: "ok",
    service: "oma-ai",
    version: "2.1.0",
    timestamp: new Date().toISOString(),
    env: config.NODE_ENV,
  });
});

healthRoutes.get("/health/db", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ status: "ok", db: "reachable" });
  } catch (err) {
    return c.json(
      { status: "error", db: "unreachable", error: (err as Error).message },
      503,
    );
  }
});

healthRoutes.get("/ready", async (c) => {
  try {
    await db.execute(sql`select 1`);
    return c.json({ status: "ready" });
  } catch {
    return c.json({ status: "not_ready" }, 503);
  }
});

healthRoutes.get("/live", (c) => c.json({ status: "live" }));

healthRoutes.get("/version", (c) =>
  c.json({ version: "2.1.0", service: "oma-ai" }),
);
