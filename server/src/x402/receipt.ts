import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import { RECEIPT_EXPIRY_SECONDS } from "../constants.js";

export const RECEIPT_VERSION = "1";

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
