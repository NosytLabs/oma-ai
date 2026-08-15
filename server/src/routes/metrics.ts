import { Hono } from "hono";
import type { OmaEnv } from "../types.js";
import type { Context } from "hono";

export const metricsRoutes = new Hono<OmaEnv>();

// Basic in-process metrics. Prometheus-style counter map, keyed by
// "<METHOD> <routePath>". Histograms keep a bounded tail of recent
// durations per route so p95 stays fresh without unbounded growth.
const counters: Record<string, number> = {};
const errorCounters: Record<string, number> = {};
const histograms: Record<string, number[]> = {};

const MAX_SAMPLES_PER_ROUTE = 500;

function record(c: Context<OmaEnv>, durationMs: number, threw: boolean): void {
		const key = `${c.req.method} ${c.req.routePath ?? c.req.path}`;
		counters[key] = (counters[key] ?? 0) + 1;
		const status = c.res?.status ?? 0;
		if (threw || status >= 400) {
				errorCounters[key] = (errorCounters[key] ?? 0) + 1;
		}
		const bucket = (histograms[key] ??= []);
		bucket.push(durationMs);
		if (bucket.length > MAX_SAMPLES_PER_ROUTE) {
				bucket.splice(0, bucket.length - MAX_SAMPLES_PER_ROUTE);
		}
}

export function metricsMiddleware(c: Context<OmaEnv>, next: () => Promise<void>) {
		const start = Date.now();
		return next().then(
				() => {
						record(c, Date.now() - start, false);
				},
				(err) => {
						record(c, Date.now() - start, true);
						throw err;
				},
		);
}

function p95(samples: number[]): number {
		if (samples.length === 0) return 0;
		const sorted = [...samples].sort((a, b) => a - b);
		const idx = Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length));
		return Math.round(sorted[idx]);
}

export interface RouteMetric {
		route: string;
		method: string;
		requests: number;
		errors: number;
		p95ms: number;
}

export interface MetricsSnapshot {
		totalRequests: number;
		totalErrors: number;
		routes: RouteMetric[];
}

/**
	* Aggregate view of the in-process counters, sorted by request volume.
	* Used by the /metrics route (Prometheus text) and the /v1/ops/snapshot
	* endpoint (JSON).
	*/
export function getMetricsSnapshot(): MetricsSnapshot {
		let totalRequests = 0;
		let totalErrors = 0;
		const routes: RouteMetric[] = [];
		for (const [key, requests] of Object.entries(counters)) {
				totalRequests += requests;
				const errors = errorCounters[key] ?? 0;
				totalErrors += errors;
				const [method = "", ...rest] = key.split(" ");
				routes.push({
						method,
						route: rest.join(" ") || key,
						requests,
						errors,
						p95ms: p95(histograms[key] ?? []),
				});
		}
		routes.sort((a, b) => b.requests - a.requests);
		return { totalRequests, totalErrors, routes };
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
