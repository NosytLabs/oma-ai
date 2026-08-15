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
import { atomicCacheSet, getSettlementCacheKey, settlementCache } from "../settlement-cache.js";
import type { PaymentSignature } from "../types.js";

function payment(): PaymentSignature {
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
						validBefore: now + 300, validAfter: now - 1, nonce: `0x${"33".repeat(32)}`,
				},
		};
}

describe("x402 launch hardening", () => {
		beforeEach(() => { settlementCache.clear(); redisSet.mockReset(); });

		it("rejects the same signature replay when verification cache is absent", async () => {
				redisSet.mockResolvedValueOnce("OK").mockResolvedValueOnce(null);
				const first = await verifyPayment(payment());
				settlementCache.clear();
				const replay = await verifyPayment(payment());
				expect(first.valid).toBe(true);
				expect(replay).toMatchObject({ valid: false });
				expect(replay.error).toMatch(/replay|nonce/i);
		});

		it("returns one consistent verified result for an exact retry", async () => {
				redisSet.mockResolvedValue("OK");
				const first = await verifyPayment(payment());
				const retry = await verifyPayment(payment());
				expect(retry).toEqual(first);
				expect(redisSet).toHaveBeenCalledTimes(1);
		});

		it("normalizes settlement tx hashes in cache keys", () => {
				const txHash = `0x${"AB".repeat(32)}`;
				atomicCacheSet(getSettlementCacheKey("base", txHash), {
						txHash, amount: "1.00", networkId: "base", payee: "treasury", settledAt: Date.now(),
				});
				expect(settlementCache.get(getSettlementCacheKey("base", txHash.toLowerCase()))?.amount).toBe("1.00");
		});
});
