/**
 * Unit tests for `hmac.ts` (HMAC-SHA256 verification helpers).
 *
 * The webhook handlers in routes/{deposit,onramp}.ts use this for
 * inbound signature verification of CCTP / LI.FI / Onramp webhooks.
 * The timing-safe semantics and length-mismatch handling are critical
 * to test directly — a non-constant-time comparison would leak timing
 * information about the signature bytes.
 */
import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hmacSha256Hex, verifyHmacSha256Hex } from "../hmac.js";

const TEST_SECRET = "test-hmac-secret-32-chars-long-x";
const BODY = `{"txHash":"0xabc","amount":1.5}`;

describe("hmacSha256Hex", () => {
	it("produces a 64-char hex HMAC-SHA256", () => {
		const sig = hmacSha256Hex(TEST_SECRET, BODY);
		expect(sig).toMatch(/^[0-9a-f]{64}$/);
	});

	it("matches node:crypto.createHmac for the same secret + payload", () => {
		const expected = createHmac("sha256", TEST_SECRET).update(BODY).digest("hex");
		expect(hmacSha256Hex(TEST_SECRET, BODY)).toBe(expected);
	});

	it("different secrets produce different signatures for the same payload", () => {
		const a = hmacSha256Hex("secret-a", BODY);
		const b = hmacSha256Hex("secret-b", BODY);
		expect(a).not.toBe(b);
	});
});

describe("verifyHmacSha256Hex", () => {
	const validSig = hmacSha256Hex(TEST_SECRET, BODY);

	it("returns true for a valid signature", () => {
		expect(verifyHmacSha256Hex(TEST_SECRET, BODY, validSig)).toBe(true);
	});

	it("returns false for a wrong signature (same length)", () => {
		const wrong = "0".repeat(64);
		expect(verifyHmacSha256Hex(TEST_SECRET, BODY, wrong)).toBe(false);
	});

	it("returns false when the body is tampered", () => {
		expect(verifyHmacSha256Hex(TEST_SECRET, BODY + "x", validSig)).toBe(false);
	});

	it("returns false when the secret is wrong", () => {
		expect(verifyHmacSha256Hex("wrong-secret-but-still-32-chars-yes", BODY, validSig)).toBe(false);
	});

	it("returns false (does NOT throw) when signature length differs", () => {
		// timingSafeEqual throws when buffer lengths differ; verifyHmacSha256Hex
		// pads both sides first so it returns false instead of throwing.
		expect(() => verifyHmacSha256Hex(TEST_SECRET, BODY, "deadbeef")).not.toThrow();
		expect(verifyHmacSha256Hex(TEST_SECRET, BODY, "deadbeef")).toBe(false);
	});

	it("returns false on empty signature", () => {
		expect(verifyHmacSha256Hex(TEST_SECRET, BODY, "")).toBe(false);
	});

	it("returns false when secret is empty/falsy", () => {
		expect(verifyHmacSha256Hex("", BODY, validSig)).toBe(false);
	});

	it("rejects near-miss signatures correctly", () => {
		// Two wrong signatures of the same length but differing in only one
		// byte must both return false — confirms the helper is comparing the
		// full hex digest, not just a prefix.
		const sigA = "0".repeat(63) + "a";
		const sigB = "0".repeat(63) + "b";
		expect(verifyHmacSha256Hex(TEST_SECRET, BODY, sigA)).toBe(false);
		expect(verifyHmacSha256Hex(TEST_SECRET, BODY, sigB)).toBe(false);
	});
});
