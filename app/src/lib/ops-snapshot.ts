/**
 * Server-side ops snapshot for the public observability marketing page.
 * Pulls Prometheus text from the Hono API `/metrics` and JSON from `/health`.
 */

import { DEFAULT_API_URL } from "@/lib/config";

export type OpsSnapshot = {
	ok: boolean;
	fetchedAt: string;
	apiStatus: "ok" | "degraded" | "down";
	version: string;
	uptimeSec: number | null;
	dbLatencyMs: number | null;
	httpRequestsTotal: number;
	httpErrorsTotal: number;
	chatCompletionsTotal: number;
	chatTokensTotal: number;
	depositsCompleted: number;
	rateLimitHits: number;
	circuitBreakerTrips: number;
	apiKeysCreated: number;
	error: string | null;
};

function parsePromGauge(text: string, name: string): number {
	// Match bare metric lines: name 123 or name{labels} 123
	const re = new RegExp(
		`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)\\s*$`,
		"m",
	);
	const m = text.match(re);
	return m ? Number(m[1]) : 0;
}

function sumPromCounter(text: string, name: string): number {
	const re = new RegExp(
		`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)\\s*$`,
		"gm",
	);
	let total = 0;
	for (const m of text.matchAll(re)) {
		total += Number(m[1]) || 0;
	}
	return total;
}

const EMPTY: OpsSnapshot = {
	ok: false,
	fetchedAt: new Date().toISOString(),
	apiStatus: "down",
	version: "—",
	uptimeSec: null,
	dbLatencyMs: null,
	httpRequestsTotal: 0,
	httpErrorsTotal: 0,
	chatCompletionsTotal: 0,
	chatTokensTotal: 0,
	depositsCompleted: 0,
	rateLimitHits: 0,
	circuitBreakerTrips: 0,
	apiKeysCreated: 0,
	error: null,
};

export async function fetchOpsSnapshot(): Promise<OpsSnapshot> {
	const base = DEFAULT_API_URL;
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), 4_000);

	try {
		const [healthRes, metricsRes] = await Promise.all([
			fetch(`${base}/health`, {
				signal: ctrl.signal,
				cache: "no-store",
				headers: { accept: "application/json" },
			}),
			fetch(`${base}/metrics`, {
				signal: ctrl.signal,
				cache: "no-store",
				headers: { accept: "text/plain" },
			}),
		]);

		let apiStatus: OpsSnapshot["apiStatus"] = "down";
		let version = "—";
		let uptimeSec: number | null = null;
		let dbLatencyMs: number | null = null;

		if (healthRes.ok) {
			const h = (await healthRes.json()) as {
				status?: string;
				version?: string;
				uptimeSec?: number;
				dbLatencyMs?: number;
			};
			apiStatus = h.status === "ok" ? "ok" : "degraded";
			version = h.version ?? "—";
			uptimeSec = typeof h.uptimeSec === "number" ? h.uptimeSec : null;
			dbLatencyMs = typeof h.dbLatencyMs === "number" ? h.dbLatencyMs : null;
		}

		let metricsText = "";
		if (metricsRes.ok) {
			metricsText = await metricsRes.text();
		}

		const httpRequestsTotal = sumPromCounter(metricsText, "oma_http_requests_total");
		const httpErrorsTotal = sumPromCounter(
			metricsText,
			"oma_http_request_errors_total",
		);

		return {
			ok: healthRes.ok,
			fetchedAt: new Date().toISOString(),
			apiStatus,
			version,
			uptimeSec,
			dbLatencyMs,
			httpRequestsTotal,
			httpErrorsTotal,
			chatCompletionsTotal: parsePromGauge(
				metricsText,
				"oma_chat_completions_total",
			),
			chatTokensTotal: parsePromGauge(
				metricsText,
				"oma_chat_completion_tokens_total",
			),
			depositsCompleted: parsePromGauge(
				metricsText,
				"oma_deposits_completed_total",
			),
			rateLimitHits: parsePromGauge(metricsText, "oma_rate_limit_hits_total"),
			circuitBreakerTrips: parsePromGauge(
				metricsText,
				"oma_circuit_breaker_trips_total",
			),
			apiKeysCreated: parsePromGauge(metricsText, "oma_api_keys_created_total"),
			error: null,
		};
	} catch (err) {
		return {
			...EMPTY,
			fetchedAt: new Date().toISOString(),
			error: err instanceof Error ? err.message : "unreachable",
		};
	} finally {
		clearTimeout(timer);
	}
}

export function formatUptime(sec: number | null): string {
	if (sec == null || sec < 0) return "—";
	if (sec < 60) return `${Math.floor(sec)}s`;
	if (sec < 3600) return `${Math.floor(sec / 60)}m`;
	const h = Math.floor(sec / 3600);
	const m = Math.floor((sec % 3600) / 60);
	return `${h}h ${m}m`;
}
