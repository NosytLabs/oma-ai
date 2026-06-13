// Metrics middleware: records every request's duration + status into the metrics store.

import type { Context, Next } from "hono";
import { metrics } from "../routes/metrics.js";

export async function metricsMiddleware(c: Context, next: Next) {
  const start = performance.now();
  await next();
  const durationSec = (performance.now() - start) / 1000;

  // Normalize path: replace :id, :model, :teamId with {id} etc. to keep cardinality bounded
  let path = c.req.path;
  if (c.req.routePath && c.req.routePath !== "/") {
    path = c.req.routePath;
  }

  metrics.recordHttpRequest(c.req.method, path, c.res.status, durationSec);
}
