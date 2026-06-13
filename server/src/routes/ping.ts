// Cheap ping endpoint for uptime monitors (UptimeRobot, BetterUptime, etc.).
// Returns 200 with minimal payload and a no-cache header.

import { Hono } from "hono";
import type { OmaEnv } from "../types.js";

export const pingRoutes = new Hono<OmaEnv>();

pingRoutes.get("/ping", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ pong: true, ts: Date.now() });
});

pingRoutes.get("/v1/ping", (c) => {
  c.header("Cache-Control", "no-store");
  return c.json({ pong: true, ts: Date.now() });
});
