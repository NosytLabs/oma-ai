import { describe, expect, it, vi } from "vitest";
import type { Context } from "hono";
import type { OmaEnv } from "../../../types.js";

vi.mock("../../../config.js", () => ({
	config: { TRUSTED_PROXY_IPS: "10.0.0.1,10.0.0.2", INTERNAL_PROXY_SECRET: "", NODE_ENV: "test" },
}));
vi.mock("../../../lib/logger.js", () => ({ logger: { warn: vi.fn() } }));

import { extractClientIp } from "../utils.js";

function context(peer: string | undefined, headers: Record<string, string>) {
	return {
		req: { header: (name: string) => headers[name.toLowerCase()] },
		env: peer ? { incoming: { socket: { remoteAddress: peer, remotePort: 1, remoteFamily: "IPv4" } } } : {},
	} as unknown as Context<OmaEnv>;
}

describe("configured proxy IP trust", () => {
	it("refuses an attacker-appended trusted proxy in a direct request", () => {
		expect(extractClientIp(context("203.0.113.8", {
			"x-forwarded-for": "198.51.100.99, 10.0.0.1", "x-real-ip": "198.51.100.100",
		}))).toBe("203.0.113.8");
	});

	it("refuses asserted IPs when no socket peer authenticates the proxy", () => {
		expect(extractClientIp(context(undefined, { "x-forwarded-for": "198.51.100.99, 10.0.0.1" }))).toBe("unknown");
	});

	it("uses the last untrusted hop instead of a prepended spoofed address", () => {
		expect(extractClientIp(context("10.0.0.1", {
			"x-forwarded-for": "198.51.100.99, 203.0.113.8, 10.0.0.2",
		}))).toBe("203.0.113.8");
	});

	it("accepts an actual client's address from a trusted socket peer", () => {
		expect(extractClientIp(context("::ffff:10.0.0.1", { "x-forwarded-for": "203.0.113.8" }))).toBe("203.0.113.8");
	});

	it("uses x-real-ip only for a trusted peer without a forwarded chain", () => {
		expect(extractClientIp(context("10.0.0.1", { "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.8");
		expect(extractClientIp(context("203.0.113.9", { "x-real-ip": "203.0.113.8" }))).toBe("203.0.113.9");
	});

	it("does not create rate-limit identities from malformed forwarded values", () => {
		expect(extractClientIp(context("10.0.0.1", { "x-forwarded-for": "made-up-client" }))).toBe("10.0.0.1");
		expect(extractClientIp(context("10.0.0.1", { "x-real-ip": "made-up-client" }))).toBe("10.0.0.1");
	});
});
