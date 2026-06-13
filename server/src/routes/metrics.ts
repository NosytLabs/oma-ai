// Prometheus metrics endpoint. /metrics (no auth) + /v1/metrics.
// Counter / histogram / gauge accumulators in-memory (per-process).
// For production, swap to a real metrics library (prom-client) without changing the route surface.

import { Hono } from "hono";
import type { OmaEnv } from "../types.js";

interface Histogram {
  count: number;
  sum: number;
  buckets: number[]; // counts per bucket
  bucketBounds: number[]; // bucket upper bounds in seconds
}

const metricsStore = {
  // Counters
  httpRequestsTotal: new Map<string, number>(), // key: method|path|status
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
  // Gauges
  activeUsers: 0,
  dbConnections: 0,
  // Histograms
  httpRequestDuration: new Map<string, Histogram>(), // key: method|path
};

const histogramBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

function makeHistogram(): Histogram {
  return {
    count: 0,
    sum: 0,
    buckets: new Array(histogramBuckets.length).fill(0),
    bucketBounds: histogramBuckets,
  };
}

function _percentile(h: Histogram, p: number): number {
  if (h.count === 0) return 0;
  const target = h.count * p;
  let cumulative = 0;
  for (let i = 0; i < h.buckets.length; i++) {
    cumulative += h.buckets[i];
    if (cumulative >= target) {
      return h.bucketBounds[i];
    }
  }
  return h.bucketBounds[h.bucketBounds.length - 1];
}

// Public helpers for other modules to record metrics.
export const metrics = {
  recordHttpRequest(method: string, path: string, status: number, durationSec: number) {
    const k = `${method}|${path}|${status}`;
    metricsStore.httpRequestsTotal.set(k, (metricsStore.httpRequestsTotal.get(k) ?? 0) + 1);
    if (status >= 400) {
      metricsStore.httpRequestErrors.set(k, (metricsStore.httpRequestErrors.get(k) ?? 0) + 1);
    }
    const hk = `${method}|${path}`;
    let h = metricsStore.httpRequestDuration.get(hk);
    if (!h) {
      h = makeHistogram();
      metricsStore.httpRequestDuration.set(hk, h);
    }
    h.count++;
    h.sum += durationSec;
    for (let i = 0; i < histogramBuckets.length; i++) {
      if (durationSec <= histogramBuckets[i]) {
        h.buckets[i]++;
        break;
      }
    }
  },
  recordChatCompletion(tokensUsed: number) {
    metricsStore.chatCompletionsTotal++;
    metricsStore.chatCompletionTokens += tokensUsed;
  },
  recordDeposit(success: boolean) {
    metricsStore.depositsTotal++;
    if (success) metricsStore.depositsCompleted++;
  },
  recordRefund() {
    metricsStore.refundsTotal++;
  },
  recordSiweAuth() {
    metricsStore.siweAuthTotal++;
  },
  recordApiKeyCreated() {
    metricsStore.apiKeysCreated++;
  },
  recordRateLimitHit() {
    metricsStore.rateLimitHits++;
  },
  recordCircuitBreakerTrip() {
    metricsStore.circuitBreakerTrips++;
  },
  setActiveUsers(n: number) {
    metricsStore.activeUsers = n;
  },
  setDbConnections(n: number) {
    metricsStore.dbConnections = n;
  },
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
  for (const [k, h] of metricsStore.httpRequestDuration) {
    const [method, path] = k.split("|");
    for (let i = 0; i < h.bucketBounds.length; i++) {
      lines.push(`oma_http_request_duration_seconds_bucket{method="${method}",path="${path}",le="${h.bucketBounds[i]}"} ${h.buckets[i]}`);
    }
    lines.push(`oma_http_request_duration_seconds_bucket{method="${method}",path="${path}",le="+Inf"} ${h.count}`);
    lines.push(`oma_http_request_duration_seconds_sum{method="${method}",path="${path}"} ${h.sum.toFixed(6)}`);
    lines.push(`oma_http_request_duration_seconds_count{method="${method}",path="${path}"} ${h.count}`);
  }

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

export const metricsRoutes = new Hono<OmaEnv>();

metricsRoutes.get("/metrics", (c) => {
  c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return c.text(formatPrometheus());
});
metricsRoutes.get("/v1/metrics", (c) => {
  c.header("Content-Type", "text/plain; version=0.0.4; charset=utf-8");
  return c.text(formatPrometheus());
});
