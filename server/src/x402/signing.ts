import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";

export function signReceipt(data: string): string {
  const secret = config.RECEIPT_HMAC_SECRET;
  if (!secret) {
    throw new Error("RECEIPT_HMAC_SECRET is not configured");
  }
  const hmac = createHmac("sha256", secret);
  hmac.update(data);
  return hmac.digest("hex");
}

export function verifyReceipt(data: string, receipt: string): boolean {
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

export function createMockTxHash(scheme: "evm" | "solana", signature: string): string {
  return scheme === "evm"
    ? `0x${randomBytes(32).toString("hex")}`
    : signature || randomBytes(64).toString("base64url");
}