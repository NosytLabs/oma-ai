/**
 * Account-number generation + hashing (16-digit numeric).
 *
 * Public API:
 *   - generateAccountNumber()  → "1234567890123456" (16 random digits)
 *   - hashAccountNumber(s)     → 64-char SHA-256 hex of the normalized number
 *
 * The 16-digit numeric format is inspired by Mullvad VPN's account system:
 * RNG-generated, no user-chosen identifiers, credential-as-secret.
 *
 * Entropy: 10^16 ≈ 53 bits. Combined with rate limiting (5 attempts/60s),
 * brute-force guessing is practically impossible.
 *
 * Legacy format ("OMA-XXXX-XXXX-XXXX" Crockford base32) is still accepted
 * by normalizeAccountNumber for backwards-compatible login of existing accounts.
 *
 * These functions are pure (no DB, no I/O) so they can be unit-tested in isolation
 * and reused wherever a canonical OMA account number is needed.
 */
import { createHash, randomBytes } from "node:crypto";

/** Generate a 16-digit random account number using crypto.randomBytes. */
export function generateAccountNumber(): string {
  const bytes = randomBytes(16);
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += String(bytes[i] % 10);
  }
  return result;
}

function normalizeAccountNumber(input: string): string {
  const trimmed = input.trim();
  // Canonical: 16-digit numeric (with optional spaces/dashes for readability)
  const digitsOnly = trimmed.replace(/[\s-]/g, "");
  if (/^[0-9]{16}$/.test(digitsOnly)) return digitsOnly;
  // Legacy: OMA-XXXX-XXXX-XXXX Crockford base32 format
  if (/^OMA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }
  return trimmed;
}

export function hashAccountNumber(accountNumber: string): string {
  return createHash("sha256").update(normalizeAccountNumber(accountNumber)).digest("hex");
}
