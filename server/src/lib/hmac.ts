/**
 * HMAC-SHA256 verification helpers.
 *
 * Webhook handlers across the server need to verify a hex-encoded
 * HMAC-SHA256 signature of the raw request body against a shared secret.
 * This was duplicated across three routes (CCTP, LI.FI, Onramp) plus
 * an analogous receipt-verification path in x402. The helper below is
 * intentionally minimal and side-effect-free so it can be unit-tested
 * in isolation.
 *
 * Returns a boolean: true when the computed HMAC matches the provided
 * signature, false otherwise. Length-mismatched signatures are returned
 * as false rather than thrown (node:crypto.timingSafeEqual throws on
 * length mismatch; this helper pads both sides to the max length first).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Verify an HMAC-SHA256 hex signature against expected body bytes.
 *
 * @param secret          - Shared HMAC secret (must be non-empty).
 * @param rawBody         - Raw request body bytes as a UTF-8 string
 *                          (use `await c.req.raw.text()` for webhooks).
 * @param providedSignature - Caller-supplied signature, hex-encoded.
 * @returns true if signatures match (constant-time), false otherwise.
 */
export function verifyHmacSha256Hex(
	secret: string,
	rawBody: string,
	providedSignature: string,
): boolean {
	if (!secret) return false;
	const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
	const expectedBuf = Buffer.from(expected, "utf8");
	const providedBuf = Buffer.from(providedSignature, "utf8");
	// Pad to the max length so timingSafeEqual never throws on length mismatch
	// and short-circuits to false for any length difference.
	const len = Math.max(expectedBuf.length, providedBuf.length);
	const aPadded = Buffer.alloc(len);
	const bPadded = Buffer.alloc(len);
	expectedBuf.copy(aPadded);
	providedBuf.copy(bPadded);
	return timingSafeEqual(aPadded, bPadded);
}

/**
 * Compute an HMAC-SHA256 hex digest. Convenience wrapper around
 * node:crypto.createHmac so the digest format (UTF-8 input, hex output)
 * is consistent across the codebase.
 */
export function hmacSha256Hex(secret: string, payload: string): string {
	const hmac = createHmac("sha256", secret);
	hmac.update(payload);
	return hmac.digest("hex");
}
