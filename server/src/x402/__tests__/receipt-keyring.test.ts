import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../config.js", () => ({
	config: {
		RECEIPT_HMAC_SECRET: "primary-secret",
		RECEIPT_HMAC_SECRET_PREVIOUS: "",
	},
}));

import { config } from "../../config.js";
import { signReceipt, verifyReceipt } from "../facilitator-signing.js";

const PAYLOAD = "v1|sig|data|9999999999";

function signWith(secret: string, data = PAYLOAD): string {
	// Sign with a specific key the way a node running an older secret would
	// have, so verification has to actually consult the keyring.
	const { createHmac } = require("node:crypto") as typeof import("node:crypto");
	return createHmac("sha256", secret).update(data).digest("hex");
}

const FUTURE = Math.floor(Date.now() / 1000) + 3600;

describe("receipt HMAC keyring", () => {
	beforeEach(() => {
		config.RECEIPT_HMAC_SECRET = "primary-secret";
		config.RECEIPT_HMAC_SECRET_PREVIOUS = "";
	});

	it("signs and verifies with the primary key", () => {
		const receipt = signReceipt(PAYLOAD);
		expect(verifyReceipt(PAYLOAD, receipt, FUTURE)).toBe(true);
	});

	it("still verifies receipts signed before a rotation", () => {
		// The reason for a keyring: rotating RECEIPT_HMAC_SECRET must not
		// invalidate every receipt already issued, or every unsettled receipt
		// in flight becomes unredeemable.
		const oldReceipt = signWith("retired-secret");
		config.RECEIPT_HMAC_SECRET_PREVIOUS = "retired-secret";
		expect(verifyReceipt(PAYLOAD, oldReceipt, FUTURE)).toBe(true);
	});

	it("accepts any key in a multi-key retirement list", () => {
		const r1 = signWith("retired-one");
		const r2 = signWith("retired-two");
		config.RECEIPT_HMAC_SECRET_PREVIOUS = "retired-one, retired-two";
		expect(verifyReceipt(PAYLOAD, r1, FUTURE)).toBe(true);
		expect(verifyReceipt(PAYLOAD, r2, FUTURE)).toBe(true);
	});

	it("rejects a receipt signed by a key that was never ours", () => {
		const forged = signWith("attacker-secret");
		config.RECEIPT_HMAC_SECRET_PREVIOUS = "retired-secret";
		expect(verifyReceipt(PAYLOAD, forged, FUTURE)).toBe(false);
	});

	it("is unchanged when no retired keys are configured", () => {
		expect(verifyReceipt(PAYLOAD, signWith("some-other"), FUTURE)).toBe(false);
	});

	it("ignores blank entries in the retirement list", () => {
		const old = signWith("retired-secret");
		config.RECEIPT_HMAC_SECRET_PREVIOUS = " , retired-secret , ";
		expect(verifyReceipt(PAYLOAD, old, FUTURE)).toBe(true);
	});

	it("still enforces expiry for a retired-key receipt", () => {
		// Rotation must not become an expiry bypass: a retired key is still
		// subject to the signed expiry.
		const old = signWith("retired-secret");
		config.RECEIPT_HMAC_SECRET_PREVIOUS = "retired-secret";
		const past = Math.floor(Date.now() / 1000) - 10;
		expect(verifyReceipt(PAYLOAD, old, past)).toBe(false);
	});
});
