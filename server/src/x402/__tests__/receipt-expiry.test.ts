import { describe, expect, it, vi } from "vitest";

vi.mock("../config.js", () => ({
	config: { RECEIPT_HMAC_SECRET: "test-receipt-hmac-secret-at-least-32-chars" },
}));

import {
	createReceiptPayload,
	signReceipt,
	verifyReceipt,
} from "../facilitator-signing.js";

describe("receipt expiry enforcement", () => {
	const txHash = `0x${"ab".repeat(32)}`;
	const payee = "0x8581784D3E598cCa3482375CFF2409Ac9DD8c402";

	it("verifies a freshly issued receipt", () => {
		const settledAt = Date.now();
		const payload = createReceiptPayload(txHash, "1.00", "base", payee, settledAt);
		expect(verifyReceipt(payload, signReceipt(payload))).toBe(true);
	});

	it("rejects a receipt whose embedded expiry has passed, with no explicit expiry argument", () => {
		// createReceiptPayload derives expiry as settledAt + RECEIPT_EXPIRY_SECONDS,
		// so a settledAt far enough in the past yields an already-expired receipt.
		const settledAt = Date.now() - 400 * 24 * 60 * 60 * 1000;
		const payload = createReceiptPayload(txHash, "1.00", "base", payee, settledAt);
		const receipt = signReceipt(payload);

		// The HMAC is intact — only the clock says otherwise. This is the
		// case that used to pass: verifyReceipt only checked expiry when the
		// caller passed receiptExpiry explicitly, and the expiry is already
		// inside the signed payload, so it is authenticated and safe to read.
		expect(verifyReceipt(payload, receipt, undefined)).toBe(false);
	});

	it("still rejects a tampered receipt", () => {
		const settledAt = Date.now();
		const payload = createReceiptPayload(txHash, "1.00", "base", payee, settledAt);
		expect(verifyReceipt(payload, "0".repeat(64))).toBe(false);
	});

	it("honours an explicitly supplied expiry as before", () => {
		const settledAt = Date.now();
		const payload = createReceiptPayload(txHash, "1.00", "base", payee, settledAt);
		const receipt = signReceipt(payload);
		expect(verifyReceipt(payload, receipt, Math.floor(Date.now() / 1000) - 10)).toBe(false);
	});
});
