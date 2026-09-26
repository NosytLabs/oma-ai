import { describe, it, expect, vi } from "vitest";
import {
	issueDepositChallenge,
	verifyDepositChallenge,
} from "../lib/deposit-challenge.js";

vi.mock("../config.js", () => ({
	config: {
		ENCRYPTION_KEY: "test-encryption-key-32-chars-long!!",
	},
}));

describe("deposit-challenge", () => {
	it("issues a token that verifies for the same user + wallet", () => {
		const { token, nonce, expiresAt } = issueDepositChallenge({
			userId: "usr_abc123",
			fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
		});
		expect(token).toContain(".");
		expect(nonce.length).toBeGreaterThan(8);
		expect(expiresAt).toBeGreaterThan(Date.now());

		const res = verifyDepositChallenge({
			token,
			userId: "usr_abc123",
			fromAddress: "0xabcdef1234567890abcdef1234567890abcdef12",
		});
		expect(res.ok).toBe(true);
		if (res.ok) {
			expect(res.payload.userId).toBe("usr_abc123");
			expect(res.payload.fromAddress).toBe("0xabcdef1234567890abcdef1234567890abcdef12");
		}
	});

	it("rejects a token presented by a different user", () => {
		const { token } = issueDepositChallenge({
			userId: "usr_abc123",
			fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
		});
		const res = verifyDepositChallenge({
			token,
			userId: "usr_attacker",
			fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
		});
		expect(res.ok).toBe(false);
	});

	it("rejects a token bound to a different wallet", () => {
		const { token } = issueDepositChallenge({
			userId: "usr_abc123",
			fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
		});
		const res = verifyDepositChallenge({
			token,
			userId: "usr_abc123",
			fromAddress: "0x9999999999999999999999999999999999999999",
		});
		expect(res.ok).toBe(false);
	});

	it("rejects a tampered token", () => {
		const { token } = issueDepositChallenge({
			userId: "usr_abc123",
			fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
		});
		// Flip a char in the payload portion.
		const tampered = "A" + token.slice(1);
		const res = verifyDepositChallenge({
			token: tampered,
			userId: "usr_abc123",
			fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
		});
		expect(res.ok).toBe(false);
	});

	it("rejects an expired token", () => {
		// Can't easily fake time inside module (iat computed at call), so verify
		// the module exports a constant-TTL check by crafting a valid signed token
		// with a past exp via the public issue path can't reach it — instead rely
		// on the expiry branch by decoding: re-verify after monkeypatching Date.now.
		const realNow = Date.now;
		try {
			const { token } = issueDepositChallenge({
				userId: "usr_abc123",
				fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
			});
			// Advance the clock past expiry before verifying.
			vi.spyOn(Date, "now").mockImplementation(() => realNow() + 10 * 60 * 1000);
			const res = verifyDepositChallenge({
				token,
				userId: "usr_abc123",
				fromAddress: "0xAbCdEf1234567890AbCdEf1234567890AbCdEf12",
			});
			expect(res.ok).toBe(false);
			if (!res.ok) expect(res.reason).toBe("expired");
		} finally {
			vi.restoreAllMocks();
		}
	});
});
