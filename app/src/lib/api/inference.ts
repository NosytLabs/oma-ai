/**
	* Health namespace: backend readiness probe (DB + Redis + dependency checks).
	*
	* Hits `GET /ready` for the rich dependency check map and `/health` for
	* the simple liveness ping.
	*/

import { request } from "./client.js";
import type { HealthResponse } from "./types.js";

/** Raw shape from Hono GET /ready (ok boolean) or richer provider checks. */
type ReadyCheck = {
	ok?: boolean;
	status?: string;
	latencyMs?: number;
	latency?: number;
	cooldownMs?: number;
	error?: string;
};

type ReadyResponse = {
	status?: string;
	version?: string;
	service?: string;
	uptimeSec?: number;
	uptime?: number;
	correlationId?: string;
	checks?: Record<string, ReadyCheck>;
	dbLatencyMs?: number;
	error?: string;
};

function normalizeHealth(raw: ReadyResponse): HealthResponse {
	const checks: HealthResponse["checks"] = {};
	if (raw.checks) {
		for (const [id, c] of Object.entries(raw.checks)) {
			const ok = c.ok === true || c.status === "ok";
			const degraded = c.ok === false || c.status === "degraded";
			let status = c.status;
			if (!status) {
				// Redis "not_configured" is still ok: true with an error note
				if (c.error && c.error !== "not_configured" && c.ok === false) {
					status = "outage";
				} else if (ok) {
					status = "ok";
				} else if (degraded) {
					status = "degraded";
				} else {
					status = "outage";
				}
			}
			checks[id] = {
				status,
				latency: c.latencyMs ?? c.latency,
				cooldownMs: c.cooldownMs,
			};
		}
	} else if (raw.dbLatencyMs != null || raw.status) {
		// Fallback: plain /ready or /health payload without a checks map.
		// Treat "ok" / "ready" / "healthy" as operational.
		const ok =
			raw.status === "ok" ||
			raw.status === "ready" ||
			raw.status === "healthy";
		checks.api = {
			status: ok ? "ok" : "degraded",
			latency: raw.dbLatencyMs,
		};
	}

	return {
		status: (raw.status as HealthResponse["status"]) ?? "ok",
		version: raw.version ?? "unknown",
		service: raw.service ?? "oma-ai",
		uptime: raw.uptimeSec ?? raw.uptime ?? 0,
		correlationId: raw.correlationId ?? "",
		checks,
	};
}

export const health = {
	get() {
		// Browser: hit the Next.js /api/health stub directly. SSR/Node: also
		// resolves the same relative path which is rewritten to the backend by
		// the dev proxy. `/ready` (richer backend response) is queried directly
		// by the dashboard via the useHealthQuery hook for the deep widget.
		return request<ReadyResponse>("/ready").then(normalizeHealth);
	},
	/**
	 * Lightweight liveness probe for the navbar/login banner status chip.
	 * Resolves to `true` on HTTP 2xx and `false` on anything else.
	 */
	ping(): Promise<boolean> {
		return request<{ status: string }>("/health")
			.then(() => true)
			.catch(() => false);
	},
};
