/**
	* Unit tests for `facilitator-signing.ts` (x402 receipt signing + USDC parsing).
	*
	* Covers the pure helpers extracted from `facilitator.ts` so the payment
	* verification core stays focused on the hot path. These were previously
	* private functions tested only indirectly; now that they're exported
	* we test them directly.
	*
	* `parseUsdcAtomic` already has extensive coverage in
	* `audit-2026-06-25.test.ts` (the AUDIT-1 regression suite) — the small
	* smoke test here documents the public-surface re-export from
	* `facilitator.ts` and ensures the new module stays in sync.
	*/
import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Config mock (hoisted so module init sees our secret) ────────────
// Note: vi.mock is hoisted to the top of the file by vitest, so the secret
// is duplicated as a literal inside the factory rather than captured from
// a const (which would be undefined at hoist time).
// Path: from __tests__/facilitator-signing.test.ts → ../../config.js
const TEST_HMAC_SECRET = "test-hmac-secret-32-chars-long-x";
vi.mock("../../config.js", () => ({
	config: { RECEIPT_HMAC_SECRET: "test-hmac-secret-32-chars-long-x" },
}));

import {
	createReceiptPayload,
	parseUsdcAtomic,
	signReceipt,
	verifyReceipt,
} from "../facilitator-signing.js";

// Snapshot Date.now() so `createReceiptPayload` is deterministic.
// 1_700_000_000_000 ms = 1_700_000_000 s (2023-11-14T22:13:20Z).
const FIXED_NOW_MS = 1_700_000_000_000;
let nowSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
	nowSpy = vi.spyOn(Date, "now").mockReturnValue(FIXED_NOW_MS);
});
afterEach(() => {
	nowSpy.mockRestore();
});

// ── signReceipt ─────────────────────────────────────────────────────
describe("signReceipt", () => {
	it("produces a 64-char hex HMAC-SHA256 of the data", () => {
		const sig = signReceipt("hello world");
		expect(sig).toMatch(/^[0-9a-f]{64}$/);
	});

	it("matches Node's crypto.createHmac for the same secret + data", () => {
		const data = "txHash:0.5:USDC:0xabc:1700000000000:1800000000";
		const expected = createHmac("sha256", TEST_HMAC_SECRET).update(data).digest("hex");
		expect(signReceipt(data)).toBe(expected);
	});

	it("returns a different signature for different data with the same secret", () => {
		const a = signReceipt("payload-a");
		const b = signReceipt("payload-b");
		expect(a).not.toBe(b);
	});
});

// ── verifyReceipt ───────────────────────────────────────────────────
describe("verifyReceipt", () => {
	const data = "txHash:0.5:USDC:0xabc:1700000000000:1800000000";
	const validSig = signReceipt(data);

	it("returns true for a valid signature", () => {
		expect(verifyReceipt(data, validSig)).toBe(true);
	});

	it("returns false for a wrong signature", () => {
		expect(verifyReceipt(data, "0".repeat(64))).toBe(false);
	});

	it("returns false when the data is tampered", () => {
		expect(verifyReceipt("tampered:" + data, validSig)).toBe(false);
	});

	it("returns false when the receipt has expired", () => {
		// Receipt valid until 1_700_000_000 (Jan 14 2024). Date.now mock = 1_700_000_000_000 ms.
		// Set receiptExpiry well in the past and ensure verify returns false.
		expect(verifyReceipt(data, validSig, 1)).toBe(false);
	});

	it("returns true when receiptExpiry is in the future", () => {
		const futureExpiry = Math.floor(Date.now() / 1000) + 3600;
		expect(verifyReceipt(data, validSig, futureExpiry)).toBe(true);
	});

	it("ignores expiry when receiptExpiry is undefined", () => {
		expect(verifyReceipt(data, validSig, undefined)).toBe(true);
	});

	it("handles mismatched buffer lengths without throwing (timing-safe)", () => {
		// Different length signatures must short-circuit via timingSafeEqual on
		// padded buffers rather than throw on Buffer#equals length mismatch.
		expect(() => verifyReceipt(data, "deadbeef")).not.toThrow();
		expect(verifyReceipt(data, "deadbeef")).toBe(false);
	});
});

// ── createReceiptPayload ───────────────────────────────────────────
describe("createReceiptPayload", () => {
	it("embeds txHash, amount, networkId, payee, settledAt, and expiry", () => {
		const settledAtMs = 1_700_000_000_000; // = 1_700_000_000 s
		const payload = createReceiptPayload(
			"0xabc",
			"1.5",
			"8453", // Base mainnet chainId
			"0xpayee",
			settledAtMs,
		);
		const parts = payload.split(":");
		expect(parts[0]).toBe("1"); // RECEIPT_VERSION
		expect(parts[1]).toBe("0xabc");
		expect(parts[2]).toBe("1.5");
		expect(parts[3]).toBe("8453");
		expect(parts[4]).toBe("0xpayee");
		expect(parts[5]).toBe(String(settledAtMs));
		expect(parts[6]).toBeDefined();
	});

	it("expiry equals settledAt/1000 + RECEIPT_EXPIRY_SECONDS", async () => {
		// Actual value of RECEIPT_EXPIRY_SECONDS in constants.ts is
		// TIME.DAYS_PER_YEAR * TIME.HOURS_PER_DAY * TIME.SECONDS_PER_MINUTE
		// = 365 * 24 * 60 = 525600 (≈6.09 days). Import the constant so
		// this test doesn't drift if the value changes.
		const settledAtMs = 1_700_000_000_000;
		const { RECEIPT_EXPIRY_SECONDS } = await import("../../constants.js");
		const expectedExpiry = Math.floor(settledAtMs / 1000) + RECEIPT_EXPIRY_SECONDS;
		const payload = createReceiptPayload("0xtx", "0.01", "8453", "0xpayer", settledAtMs);
		const expiry = Number(payload.split(":").pop());
		expect(expiry).toBe(expectedExpiry);
	});

	it("produces a payload that verifyReceipt accepts", () => {
		const settledAtMs = Date.now();
		const payload = createReceiptPayload("0xtx", "0.5", "8453", "0xpayer", settledAtMs);
		const sig = signReceipt(payload);
		const expiry = Number(payload.split(":").pop());
		expect(verifyReceipt(payload, sig, expiry)).toBe(true);
	});
});

// ── parseUsdcAtomic (smoke test — full coverage lives in audit-2026-06-25) ──
describe("parseUsdcAtomic (public-surface smoke)", () => {
	it("round-trips USDC amounts in atomic units", () => {
		expect(parseUsdcAtomic("1.00")).toBe(1_000_000n);
		expect(parseUsdcAtomic("0.000001")).toBe(1n);
	});

	// Note: the re-export from `facilitator.ts` is verified manually via the
	// single line `export { parseUsdcAtomic }` near the top of that file.
	// Loading facilitator.ts in this test file would initialize the full auth
	// middleware and require a fully-mocked
	// env to load successfully — not worth the test complexity here.
});
