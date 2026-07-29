import { Hono } from "hono";
import type { OmaEnv } from "../types.js";

export const metricsRoutes = new Hono<OmaEnv>();

// Basic in-process metrics. Prometheus-style counter map.
const counters: Record<string, number> = {};
const histograms: Record<string, number[]> = {};

export function metricsMiddleware(c: any, next: any) {
  const start = Date.now();
  return next().then(() => {
    const duration = Date.now() - start;
    const key = `${c.req.method} ${c.req.routePath ?? c.req.path}`;
    counters[key] = (counters[key] ?? 0) + 1;
    (histograms[key] ??= []).push(duration);
  });
}

metricsRoutes.get("/metrics", (c) => {
  const lines: string[] = [];
  for (const [key, count] of Object.entries(counters)) {
    lines.push(`# HELP http_requests_total Total HTTP requests`);
    lines.push(`# TYPE http_requests_total counter`);
    lines.push(`http_requests_total{key="${key}"} ${count}`);
  }
  return c.text(lines.join("\n"));
});
