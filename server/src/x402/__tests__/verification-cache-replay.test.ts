import { beforeEach, describe, expect, it, vi } from "vitest";

const { redisSet } = vi.hoisted(() => ({ redisSet: vi.fn() }));
vi.mock("../../lib/redis-client.js", () => ({
	getRedisClient: vi.fn(async () => ({ set: redisSet })),
}));
vi.mock("../../config.js", () => ({
	config: {
		FACILITATOR_MODE: "mock",
		NODE_ENV: "test",
		RECEIPT_HMAC_SECRET: "test-receipt-hmac-secret-at-least-32-chars",
		TREASURY_BASE_ADDRESS: "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402",
	},
}));
vi.mock("../../lib/logger.js", () => ({
	logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { verifyPayment } from "../verify.js";
import { getVerificationCacheKey, settlementCache } from "../settlement-cache.js";
import type { PaymentSignature } from "../types.js";

function payment(validBeforeOffset = 300): PaymentSignature {
	const now = Math.floor(Date.now() / 1000);
	return {
		x402Version: "1",
		signature: `0x${"ab".repeat(65)}`,
		authorization: "mock",
		payload: {
			x402Version: "1", scheme: "evm", networkId: "base",
			asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
			amount: "1.00", payee: "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402",
			payFrom: `0x${"12".repeat(20)}`, maxAmountRequired: "1.00",
			validBefore: now + validBeforeOffset, validAfter: now - 1,
			nonce: `0x${"33".repeat(32)}`,
		},
	};
}

describe("x402 verification-cache replay window", () => {
	beforeEach(() => {
		settlementCache.clear();
		redisSet.mockReset();
		// consumeNonce writes with Redis SET NX and treats a non-"OK" reply as
		// "nonce already taken", so a bare vi.fn() would fail every verify.
		redisSet.mockResolvedValue("OK");
	});

	it("accepts a payment whose authorization is still inside its validity window", async () => {
		const result = await verifyPayment(payment(300));
		expect(result.valid).toBe(true);
	});

	it("does NOT honour a cached verification once the authorization has expired", async () => {
		const first = await verifyPayment(payment(300));
		expect(first.valid).toBe(true);

		// The payment verified once, so a cache entry now exists for it.
		const sig = payment(300);
		const cacheKey = getVerificationCacheKey(sig.payload, sig.signature);
		expect(settlementCache.has(cacheKey), "expected a cache entry to exist").toBe(true);

		// Re-present the identical, now-expired payment. The cache must not
		// short-circuit this: returning valid here would let one settled
		// payment authorize further paid requests for the life of the cache
		// entry, long after its own 5-minute validity window closed.
		const replayed = { ...sig, payload: { ...sig.payload, validBefore: Math.floor(Date.now() / 1000) - 1 } };
		const result = await verifyPayment(replayed);
		expect(result.valid).toBe(false);
		expect(result.error).toMatch(/expired/i);
	});

	it("does not accept a cached payment that was never valid yet", async () => {
		const sig = payment(300);
		await verifyPayment(sig);
		const cacheKey = getVerificationCacheKey(sig.payload, sig.signature);
		expect(settlementCache.has(cacheKey)).toBe(true);

		const replayed = { ...sig, payload: { ...sig.payload, validAfter: Math.floor(Date.now() / 1000) + 600 } };
		const result = await verifyPayment(replayed);
		expect(result.valid).toBe(false);
	});
});
