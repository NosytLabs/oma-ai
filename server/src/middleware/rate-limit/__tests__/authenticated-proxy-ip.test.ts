/**
 * Regression test: the Vercel -> Neon hop must be AUTHENTICATED before the
 * function trusts a forwarded client IP.
 *
 * THE BUG (live, 2026-09-24): production traffic reaches the Neon Function
 * through the Vercel /api proxy. `TRUSTED_PROXY_IPS` is empty, so
 * `extractClientIp()` deliberately refuses `x-forwarded-for` and falls back to
 * the TCP peer — which for every proxied request is VERCEL'S EGRESS IP.
 *
 * Consequences, both real:
 *   - every anonymous visitor shares ONE free-tier bucket
 *     (20 msgs/day for the entire internet), and
 *   - every anonymous visitor shares ONE rate-limit bucket.
 * The first 20 users to chat exhaust the quota for everyone.
 *
 * WHY NOT "just trust x-forwarded-for": the Neon Function is PUBLICLY
 * reachable, so anyone can hit it directly and set any header. Trusting a
 * forwarded IP unconditionally re-opens the H2 spoofing bypass this file's
 * sibling test guards against.
 *
 * THE FIX: the Vercel proxy authenticates itself with a shared secret
 * (`INTERNAL_PROXY_SECRET`). Only when that secret matches does the function
 * trust the forwarded client IP. A direct attacker never has the secret, so
 * they still fall back to the socket peer.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import type { OmaEnv } from "../../../types.js";

const SECRET = "test-internal-proxy-secret-abcdef0123456789";

const counts = new Map<string, number>();
const mockRedis = {
	incr: vi.fn(async (key: string) => {
		const n = (counts.get(key) ?? 0) + 1;
		counts.set(key, n);
		return n;
	}),
	expire: vi.fn(async () => 1),
	ttl: vi.fn(async () => 60),
	set: vi.fn(async () => "OK"),
	get: vi.fn(async () => null),
	del: vi.fn(async () => 1),
};
vi.mock("../../../lib/redis-client.js", () => ({
	getRedisClient: vi.fn(async () => mockRedis),
	isRedisReady: () => true,
}));
vi.mock("../../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn(), debug: vi.fn() },
}));

async function loadExtract(secret: string | undefined) {
	vi.resetModules();
	vi.stubEnv("TRUSTED_PROXY_IPS", "");
	if (secret === undefined) vi.stubEnv("INTERNAL_PROXY_SECRET", "");
	else vi.stubEnv("INTERNAL_PROXY_SECRET", secret);
	const mod = await import("../utils.js");
	return mod.extractClientIp;
}

/**
 * Build the minimal Context surface extractClientIp reads.
 *
 * One documented cast in a single factory beats scattering casts across every
 * call site. The production signature stays honest (it really does require a
 * Hono Context); only this test double is partial.
 */
function ctxWith(headers: Record<string, string>) {
	return {
		req: { header: (k: string) => headers[k.toLowerCase()] },
		env: {},
	} as unknown as Context<OmaEnv>;
}

beforeEach(() => counts.clear());
afterEach(() => vi.unstubAllEnvs());

describe("authenticated Vercel -> Neon client IP", () => {
	it("uses the forwarded client IP when the proxy secret is valid", async () => {
		const extractClientIp = await loadExtract(SECRET);
		const ip = extractClientIp(
			ctxWith({
				"x-oma-proxy-secret": SECRET,
				"x-vercel-forwarded-for": "203.0.113.7",
				"x-forwarded-for": "203.0.113.7",
			}),
		);
		expect(ip).toBe("203.0.113.7");
	});

	it("REFUSES the forwarded IP when the proxy secret is wrong", async () => {
		const extractClientIp = await loadExtract(SECRET);
		const ip = extractClientIp(
			ctxWith({
				"x-oma-proxy-secret": "attacker-guess",
				"x-forwarded-for": "203.0.113.7",
			}),
		);
		// Must NOT be the spoofed address.
		expect(ip).not.toBe("203.0.113.7");
	});

	it("REFUSES the forwarded IP when no secret is sent at all (direct hit)", async () => {
		const extractClientIp = await loadExtract(SECRET);
		const ip = extractClientIp(ctxWith({ "x-forwarded-for": "203.0.113.7" }));
		expect(ip).not.toBe("203.0.113.7");
	});

	it("ignores forwarded IPs entirely when no secret is configured", async () => {
		const extractClientIp = await loadExtract(undefined);
		const ip = extractClientIp(
			ctxWith({
				"x-oma-proxy-secret": SECRET,
				"x-forwarded-for": "203.0.113.7",
			}),
		);
		expect(ip).not.toBe("203.0.113.7");
	});

	it("does not accept an empty proxy secret as a match", async () => {
		const extractClientIp = await loadExtract(SECRET);
		const ip = extractClientIp(
			ctxWith({ "x-oma-proxy-secret": "", "x-forwarded-for": "203.0.113.7" }),
		);
		expect(ip).not.toBe("203.0.113.7");
	});

	it("gives two different visitors different buckets through the proxy", async () => {
		const extractClientIp = await loadExtract(SECRET);
		const a = extractClientIp(
			ctxWith({ "x-oma-proxy-secret": SECRET, "x-forwarded-for": "198.51.100.1" }),
		);
		const b = extractClientIp(
			ctxWith({ "x-oma-proxy-secret": SECRET, "x-forwarded-for": "198.51.100.2" }),
		);
		expect(a).not.toBe(b);
	});
});

describe("the shared-bucket bug this prevents", () => {
	it("without a proxy secret every visitor collapses to one bucket", async () => {
		// This is the CURRENT production behaviour, asserted so the regression
		// is visible: two different real visitors get the SAME key.
		const extractClientIp = await loadExtract(undefined);
		const app = new Hono();
		// A bare Hono() yields Context<BlankEnv>, so declare the env generic
		// instead of casting through `never`.
		app.get("/x", (c) => c.text(extractClientIp(c as unknown as Context<OmaEnv>)));
		const req = (ip: string) =>
			app.request("http://local/x", { headers: { "x-forwarded-for": ip } });
		const a = (await (await req("198.51.100.1")).text()).trim();
		const b = (await (await req("198.51.100.2")).text()).trim();
		expect(a).toBe(b);
	});
});
