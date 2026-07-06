// Prometheus metrics endpoint. /metrics (no auth) + /v1/metrics.
// Counter / gauge accumulators in-memory (per-process).
// For production, swap to a real metrics library (prom-client) without changing the route surface.

import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { OmaEnv } from "../types.js";

// ponytail: simple in-memory counters. prom-client if scrape performance matters.
export const metricsStore = {
  httpRequestsTotal: new Map<string, number>(),
  httpRequestErrors: new Map<string, number>(),
  chatCompletionsTotal: 0,
  chatCompletionTokens: 0,
  depositsTotal: 0,
  depositsCompleted: 0,
  refundsTotal: 0,
  siweAuthTotal: 0,
  apiKeysCreated: 0,
  rateLimitHits: 0,
  circuitBreakerTrips: 0,
  activeUsers: 0,
  dbConnections: 0,
};

function formatPrometheus(): string {
  const lines: string[] = [];
  const now = Date.now();
  lines.push(`# HELP oma_ai_build_info Build information`);
  lines.push(`# TYPE oma_ai_build_info gauge`);
  lines.push(`oma_ai_build_info{version="2.0.0"} 1`);

  lines.push(`# HELP oma_http_requests_total Total HTTP requests`);
  lines.push(`# TYPE oma_http_requests_total counter`);
  for (const [k, v] of metricsStore.httpRequestsTotal) {
    const [method, path, status] = k.split("|");
    lines.push(`oma_http_requests_total{method="${method}",path="${path}",status="${status}"} ${v}`);
  }

  lines.push(`# HELP oma_http_request_errors_total Total HTTP errors (4xx/5xx)`);
  lines.push(`# TYPE oma_http_request_errors_total counter`);
  for (const [k, v] of metricsStore.httpRequestErrors) {
    const [method, path, status] = k.split("|");
    lines.push(`oma_http_request_errors_total{method="${method}",path="${path}",status="${status}"} ${v}`);
  }

  lines.push(`# HELP oma_http_request_duration_seconds HTTP request duration`);
  lines.push(`# TYPE oma_http_request_duration_seconds histogram`);

  lines.push(`# HELP oma_chat_completions_total Total chat completions served`);
  lines.push(`# TYPE oma_chat_completions_total counter`);
  lines.push(`oma_chat_completions_total ${metricsStore.chatCompletionsTotal}`);

  lines.push(`# HELP oma_chat_completion_tokens_total Total tokens processed`);
  lines.push(`# TYPE oma_chat_completion_tokens_total counter`);
  lines.push(`oma_chat_completion_tokens_total ${metricsStore.chatCompletionTokens}`);

  lines.push(`# HELP oma_deposits_total Total deposit attempts`);
  lines.push(`# TYPE oma_deposits_total counter`);
  lines.push(`oma_deposits_total ${metricsStore.depositsTotal}`);
  lines.push(`# HELP oma_deposits_completed_total Total successful deposits`);
  lines.push(`# TYPE oma_deposits_completed_total counter`);
  lines.push(`oma_deposits_completed_total ${metricsStore.depositsCompleted}`);

  lines.push(`# HELP oma_refunds_total Total refunds issued`);
  lines.push(`# TYPE oma_refunds_total counter`);
  lines.push(`oma_refunds_total ${metricsStore.refundsTotal}`);

  lines.push(`# HELP oma_siwe_auth_total Total SIWE authentications`);
  lines.push(`# TYPE oma_siwe_auth_total counter`);
  lines.push(`oma_siwe_auth_total ${metricsStore.siweAuthTotal}`);

  lines.push(`# HELP oma_api_keys_created_total Total API keys created`);
  lines.push(`# TYPE oma_api_keys_created_total counter`);
  lines.push(`oma_api_keys_created_total ${metricsStore.apiKeysCreated}`);

  lines.push(`# HELP oma_rate_limit_hits_total Total rate limit hits`);
  lines.push(`# TYPE oma_rate_limit_hits_total counter`);
  lines.push(`oma_rate_limit_hits_total ${metricsStore.rateLimitHits}`);

  lines.push(`# HELP oma_circuit_breaker_trips_total Total circuit breaker trips`);
  lines.push(`# TYPE oma_circuit_breaker_trips_total counter`);
  lines.push(`oma_circuit_breaker_trips_total ${metricsStore.circuitBreakerTrips}`);

  lines.push(`# HELP oma_active_users Active users in the last 5 minutes`);
  lines.push(`# TYPE oma_active_users gauge`);
  lines.push(`oma_active_users ${metricsStore.activeUsers}`);

  lines.push(`# HELP oma_db_connections Active DB connections`);
  lines.push(`# TYPE oma_db_connections gauge`);
  lines.push(`oma_db_connections ${metricsStore.dbConnections}`);

  lines.push(`# HELP oma_ai_scrape_timestamp_seconds Scrape timestamp`);
  lines.push(`# TYPE oma_ai_scrape_timestamp_seconds gauge`);
  lines.push(`oma_ai_scrape_timestamp_seconds ${(now / 1000).toFixed(3)}`);

  return lines.join("\n") + "\n";
}

// Middleware: count every HTTP request. Mount BEFORE all other routes.
export async function metricsMiddleware(c: Context<OmaEnv>, next: Next) {
  await next();
  const method = c.req.method;
  const path = c.req.path;
  const status = c.res.status;
  const key = `${method}|${path}|${status}`;
  metricsStore.httpRequestsTotal.set(key, (metricsStore.httpRequestsTotal.get(key) ?? 0) + 1);
  if (status >= 400) {
    metricsStore.httpRequestErrors.set(key, (metricsStore.httpRequestErrors.get(key) ?? 0) + 1);
  }
}

export const metricsRoutes = new Hono<OmaEnv>();

metricsRoutes.get("/metrics", (c) => {
  c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return c.text(formatPrometheus());
});
metricsRoutes.get("/v1/metrics", (c) => {
  c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return c.text(formatPrometheus());
});
