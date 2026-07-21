/**
 * x402 receipt signing + USDC amount parsing.
 *
 * Extracted from `facilitator.ts` so the payment verification core
 * (verify/settle flows, cache state) stays focused on the hot path.
 * These helpers are pure or near-pure and safe to unit-test in isolation.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import {
  USDC_DECIMALS,
  USDC_MAX_ATOMIC,
  RECEIPT_EXPIRY_SECONDS,
} from "../constants.js";

const RECEIPT_VERSION = "1";

export function signReceipt(data: string): string {
	const secret = config.RECEIPT_HMAC_SECRET;
	if (!secret) {
		throw new Error("RECEIPT_HMAC_SECRET is not configured");
	}
	const hmac = createHmac("sha256", secret);
	hmac.update(data);
	return hmac.digest("hex");
}

export function verifyReceipt(
	data: string,
	receipt: string,
	receiptExpiry?: number,
): boolean {
	if (receiptExpiry !== undefined && Date.now() > receiptExpiry * 1000) {
		return false;
	}
	const expected = signReceipt(data);
	const expectedBuf = Buffer.from(expected, "utf8");
	const receiptBuf = Buffer.from(receipt, "utf8");
	const len = Math.max(expectedBuf.length, receiptBuf.length);
	const aPadded = Buffer.alloc(len);
	const bPadded = Buffer.alloc(len);
	expectedBuf.copy(aPadded);
	receiptBuf.copy(bPadded);
	return timingSafeEqual(aPadded, bPadded);
}

export function createReceiptPayload(
	txHash: string,
	amount: string,
	networkId: string,
	payee: string,
	settledAt: number,
): string {
	const expiryTime = Math.floor(settledAt / 1000) + RECEIPT_EXPIRY_SECONDS;
	return `${RECEIPT_VERSION}:${txHash}:${amount}:${networkId}:${payee}:${settledAt}:${expiryTime}`;
}

export function parseUsdcAtomic(s: string): bigint {
	// Reject leading/trailing whitespace silently — padded input is malformed.
	if (s !== s.trim()) throw new Error("Invalid USDC amount: leading or trailing whitespace");
	if (!s) throw new Error("Invalid USDC amount: empty string");
	if (/[eE]/.test(s)) throw new Error("Invalid USDC amount: scientific notation not allowed");
	if (/[^0-9.]/.test(s)) throw new Error("Invalid USDC amount: non-numeric characters");
	if (s.startsWith("-")) throw new Error("Invalid USDC amount: negative values not allowed");
	if (s.startsWith("+")) throw new Error("Invalid USDC amount: sign-prefixed values not allowed");
	const parts = s.split(".");
	if (parts.length > 2) throw new Error("Invalid USDC amount: multi-dot format");
	if (parts[1] && parts[1].length > USDC_DECIMALS) {
		throw new Error(`Invalid USDC amount: max ${USDC_DECIMALS} decimal places`);
	}
	const [whole = "0", frac = ""] = parts;
	const padded = (frac + "0".repeat(USDC_DECIMALS)).slice(0, USDC_DECIMALS);
	const result = BigInt(whole) * 1_000_000n + BigInt(padded || "0");
	if (result > USDC_MAX_ATOMIC) {
		throw new Error("Invalid USDC amount: exceeds maximum supply");
	}
	return result;
}