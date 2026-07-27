// Log ingestion endpoint for the Next.js app (and any other upstream services).
// Receives structured JSON log entries and writes them into the server's pino
// stream so all logs end up in one place (stdout → Docker → monitoring stack).

import { Hono } from "hono";
import { logger } from "../lib/logger.js";
import { rateLimit } from "../middleware/rate-limit.js";
import type { OmaEnv } from "../types.js";

export const logRoutes = new Hono<OmaEnv>();

const VALID_LEVELS = new Set(["error", "warn", "info", "debug"]);

interface InboundLogEntry {
  level?: unknown;
  msg?: unknown;
  ctx?: unknown;
  timestamp?: unknown;
  service?: unknown;
  env?: unknown;
}

logRoutes.post("/v1/log", rateLimit({ windowMs: 60_000, maxRequests: 60 }), async (c) => {
  // Basic service-header gate to prevent casual log injection.
  if (c.req.header("X-Service-Name") !== "oma-app") {
    return c.json({ error: { message: "Forbidden", type: "forbidden" } }, 403);
  }

  let body: InboundLogEntry;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: { message: "Invalid JSON", type: "bad_request" } }, 400);
  }

  const level = typeof body.level === "string" ? body.level : "info";
  const msg = typeof body.msg === "string" ? body.msg : "[no message]";

  if (!VALID_LEVELS.has(level)) {
    return c.json({ error: { message: "Invalid log level", type: "bad_request" } }, 400);
  }

  const meta: Record<string, unknown> = {
    source: "upstream",
    upstreamService: body.service,
    upstreamEnv: body.env,
    upstreamTs: body.timestamp,
  };

  if (body.ctx !== undefined) {
    meta.ctx = body.ctx;
  }

  switch (level) {
    case "error":
      logger.error(meta, msg);
      break;
    case "warn":
      logger.warn(meta, msg);
      break;
    case "debug":
      logger.debug(meta, msg);
      break;
    default:
      logger.info(meta, msg);
  }

  return c.body(null, 204);
});
