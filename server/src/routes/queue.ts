import { Hono } from "hono";
import { bearerAuth } from "../auth/middleware.js";
import {
  getQueueStatus,
  getQueuePosition,
  getQueueStats,
  getQueueDepth,
  MAX_QUEUE_DEPTH,
} from "../lib/request-queue.js";
import type { OmaEnv } from "../types.js";

export const queueRoutes = new Hono<OmaEnv>();

queueRoutes.use("/status", bearerAuth);
queueRoutes.use("/stats", bearerAuth);
queueRoutes.use("/depth", bearerAuth);

queueRoutes.get("/status", async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 401);
  }

  const status = await getQueueStatus(userId);
  return c.json({
    inQueue: status.inQueue,
    position: status.userPosition,
    queueDepth: status.queueDepth,
    estimatedWaitSeconds: status.estimatedWaitSeconds,
    maxDepth: MAX_QUEUE_DEPTH,
  });
});

queueRoutes.get("/position/:requestId", async (c) => {
  const userId = c.get("userId");
  const requestId = c.req.param("requestId");

  if (!userId) {
    return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 401);
  }

  const position = await getQueuePosition(userId, requestId);
  if (position < 0) {
    return c.json({ error: { message: "Request not in queue", type: "not_found" } }, 404);
  }

  return c.json({ requestId, position, estimatedWaitSeconds: Math.ceil((position * 1000) / 1000) });
});

queueRoutes.get("/stats", async (_c) => {
  const stats = await getQueueStats();
  return _c.json(stats);
});

queueRoutes.get("/depth", async (_c) => {
  const depth = await getQueueDepth();
  return _c.json({ depth, maxDepth: MAX_QUEUE_DEPTH });
});
