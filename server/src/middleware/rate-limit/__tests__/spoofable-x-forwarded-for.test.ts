/**
	* H2 — Regression test: x-forwarded-for is IGNORED when TRUSTED_PROXY_IPS is empty.
	*
	* Exploit (pre-fix):
	*   1. Attacker sends POST /auth/account/login with body {accountNumber}
	*      and header `x-forwarded-for: <random ip>`.
	*   2. The rate-limit key uses extractClientIp(c), which reads x-forwarded-for
	*      as the client IP even when no proxy is configured. The attacker can
	*      rotate IPs freely and bypass the 5-attempts-per-60s cap on /auth/account/login.
	*
	* Fix: when TRUSTED_PROXY_IPS is empty (default), REFUSE to read x-forwarded-for.
	* Fall back to x-real-ip (set by some proxies) or "unknown". To use
	* x-forwarded-for in production, the operator MUST set TRUSTED_PROXY_IPS to
	* the proxy's egress IP(s) AND ensure x-forwarded-for is `client, proxy`
	* (the last entry must be a trusted proxy).
	*/

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Stub the env so the module loads with no trusted proxies.
vi.stubEnv("TRUSTED_PROXY_IPS", "");

// In-memory redis for the rate-limit counter. Real atomic semantics.
const counts = new Map<string, { count: number; ttl: number }>();
const mockRedis = {
		incr: vi.fn(async (key: string) => {
				const cur = counts.get(key);
				if (!cur) {
						counts.set(key, { count: 1, ttl: 60 });
						return 1;
				}
				cur.count += 1;
				return cur.count;
		}),
		expire: vi.fn(async (_key: string, ttl: number) => {
				const cur = counts.get(_key);
				if (cur) cur.ttl = ttl;
				return 1;
		}),
		ttl: vi.fn(async (key: string) => counts.get(key)?.ttl ?? -1),
		set: vi.fn(async () => "OK"),
		get: vi.fn(async () => null),
		del: vi.fn(async () => 1),
};

vi.mock("../../db/client.js", () => ({
		db: {
				insert: vi.fn().mockReturnThis(),
				values: vi.fn().mockReturnThis(),
		},
}));

vi.mock("../../lib/redis-client.js", () => ({
		getRedisClient: vi.fn(async () => mockRedis),
		isRedisReady: vi.fn(() => true),
}));

vi.mock("../../lib/logger.js", () => ({
		logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("../../config.js", () => ({
		config: {
				PORT: 3001,
				CORS_ORIGIN: "http://localhost:3000",
				BETTER_AUTH_SECRET: "test-better-auth-secret-that-is-at-least-32-chars-long",
				NODE_ENV: "test",
				DATABASE_URL: "postgresql://localhost:5432/oma_test",
				REDIS_URL: "redis://localhost:6379",
				SESSION_COOKIE_TTL_MS: 60 * 60 * 1000,
				// H2: TRUSTED_PROXY_IPS is empty — the production-safe default.
				TRUSTED_PROXY_IPS: "",
		},
}));

import { extractClientIp } from "../utils.js";

describe("H2 — extractClientIp ignores x-forwarded-for when TRUSTED_PROXY_IPS is empty", () => {
		beforeEach(() => {
				counts.clear();
				vi.clearAllMocks();
		});

		function buildCtx(headers: Record<string, string>) {
				const app = new Hono();
				app.get("/_extract", (c) => {
						return c.json({ ip: extractClientIp(c as never) });
				});
				return app.request("/_extract", { headers });
		}

		it("returns x-real-ip when present and no trusted proxies", async () => {
				const res = await buildCtx({
						"x-forwarded-for": "1.2.3.4",
						"x-real-ip": "5.6.7.8",
				});
				const body = (await res.json()) as { ip: string };
				expect(body.ip).toBe("5.6.7.8");
		});

		it("returns 'unknown' when only x-forwarded-for is sent and no trusted proxies", async () => {
				const res = await buildCtx({ "x-forwarded-for": "1.2.3.4" });
				const body = (await res.json()) as { ip: string };
				expect(body.ip).toBe("unknown");
		});

		it("returns 'unknown' when no IP headers are sent", async () => {
				const res = await buildCtx({});
				const body = (await res.json()) as { ip: string };
				expect(body.ip).toBe("unknown");
		});

		it("does NOT collapse different x-forwarded-for values to the same key", async () => {
				// The H2 attack: an attacker sends 100 logins with x-forwarded-for: <random>
				// hoping each attempt lands in a different rate-limit bucket. After the
				// fix, every attempt without TRUSTED_PROXY_IPS collapses to "unknown",
				// so all 100 attempts hit the same bucket and the cap (5/60s) trips.
				const ips = new Set<string>();
				for (let i = 0; i < 100; i++) {
						const res = await buildCtx({ "x-forwarded-for": `${i}.${i}.${i}.${i}` });
						const body = (await res.json()) as { ip: string };
						ips.add(body.ip);
				}
				expect(ips.size).toBe(1);
				expect([...ips][0]).toBe("unknown");
		});

		it("uses the TCP peer address when headers are absent (direct Node connection)", () => {
				// Regression: without socket fallback every direct guest shared
				// daily:ip:unknown — one exhausted free tier for the whole host.
				const c = {
						req: { header: () => undefined },
						env: {
								incoming: {
										socket: {
												remoteAddress: "203.0.113.50",
												remotePort: 54321,
												remoteFamily: "IPv4",
										},
								},
						},
				};
				expect(extractClientIp(c as never)).toBe("203.0.113.50");
		});

		it("strips IPv6-mapped IPv4 prefixes from the socket address", () => {
				const c = {
						req: { header: () => undefined },
						env: {
								incoming: {
										socket: {
												remoteAddress: "::ffff:127.0.0.1",
												remotePort: 1,
												remoteFamily: "IPv6",
										},
								},
						},
				};
				expect(extractClientIp(c as never)).toBe("127.0.0.1");
		});

		it("prefers x-real-ip over the socket peer when both exist", () => {
				const c = {
						req: {
								header: (name: string) =>
										name.toLowerCase() === "x-real-ip" ? "198.51.100.9" : undefined,
						},
						env: {
								incoming: {
										socket: {
												remoteAddress: "203.0.113.50",
												remotePort: 1,
												remoteFamily: "IPv4",
										},
								},
						},
				};
				expect(extractClientIp(c as never)).toBe("198.51.100.9");
		});
});
