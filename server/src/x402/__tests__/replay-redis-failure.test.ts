import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * consumeNonce() guards x402 payment replay. Its fallback covered only the
 * "no Redis client at all" case: getRedisClient() returning null. But a
 * configured Redis that REJECTS a command (dead token, network blip) was
 * never handled -- `redis.set()` was unguarded, so the rejection propagated
 * out of consumeNonce and failed live settlements.
 *
 * That is the exact "Redis blips, money path dies" failure the rest of the
 * codebase is explicitly written to avoid, so this test pins the policy:
 * a Redis failure must degrade enforcement, never availability.
 */
describe("consumeNonce Redis failure handling", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	it("falls back to the in-memory store when Redis rejects, not throw", async () => {
		vi.doMock("../../lib/redis-client.js", () => ({
			getRedisClient: vi.fn(async () => ({
				set: vi.fn(async () => {
					throw new Error("ERR invalid token");
				}),
			})),
		}));

		const { consumeNonce } = await import("../replay.js");
		const nonce = "a".repeat(32);

		// Must resolve, not reject -- a rejecting promise here is what breaks
		// settlement in production.
		const first = await consumeNonce(nonce);
		expect(first).toEqual({ ok: true });

		// And the fallback must still actually enforce single-use, otherwise
		// "fail open" would have quietly become "no protection at all".
		const second = await consumeNonce(nonce);
		expect(second).toEqual({ ok: false, reason: "nonce_already_used" });
	});

	it("still rejects a malformed nonce before touching Redis", async () => {
		const getRedisClient = vi.fn(async () => ({
			set: vi.fn(async () => "OK"),
		}));
		vi.doMock("../../lib/redis-client.js", () => ({ getRedisClient }));

		const { consumeNonce } = await import("../replay.js");
		expect(await consumeNonce("short")).toEqual({
			ok: false,
			reason: "invalid_nonce",
		});
		expect(getRedisClient).not.toHaveBeenCalled();
	});
});
