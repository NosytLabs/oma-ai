/**
 * Account-number generation + hashing (Mullvad-style, OMA-flavored).
 *
 * Public API:
 *   - generateAccountNumber()  → "OMA-XXXX-XXXX-XXXX" (Crockford base32, 60-bit entropy)
 *   - hashAccountNumber(s)     → 64-char SHA-256 hex of the uppercased number
 *   - isValidAccountNumber(s)  → boolean (regex against the public format)
 *   - ACCOUNT_NUMBER_REGEX     → exported for use in zod schemas / validation
 *
 * These functions are pure (no DB, no I/O) so they can be unit-tested in isolation
 * and reused wherever a canonical OMA account number is needed.
 *
 * The alphabet is the **Crockford base32** subset (no I, O, 0, 1) so the number is
 * easy to read aloud and easy to copy from a screen without ambiguity. 12 characters
 * from this 32-symbol alphabet = 60 bits of entropy (~1.15 × 10^18 possibilities),
 * which is more than Mullvad's 16 decimal digits (~5.2 × 10^15) and well above the
 * threshold where online guessing becomes infeasible (rate-limit is 5/min per IP).
 */
import { createHash, randomBytes } from "node:crypto";

/**
 * Crockford base32 — 32 symbols, no I/O/0/1.
 * https://www.crockford.com/base32.html
 */
export const ACCOUNT_NUMBER_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/**
 * 3 segments × 4 chars, separated by `-`, with the `OMA-` prefix.
 * Examples that pass: OMA-9H3K-2P4Q-7WXZ, OMA-AAAA-AAAA-AAAA, OMA-2222-2222-2222.
 * Examples that fail: oma-9h3k-2p4q-7wxz (lowercase), OMA-9H3K 2P4Q 7WXZ (spaces),
 *                     OMA-9H3K-2P4Q (too short), OMA-9H3K-2P4Q-7WXZA (too long).
 */
export const ACCOUNT_NUMBER_REGEX = /^OMA-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/;

export function generateAccountNumber(): string {
  const segments: string[] = [];
  for (let i = 0; i < 3; i++) {
    let segment = "";
    // 8 bytes (64 bits) of entropy per segment, with 2 bytes per character to
    // avoid modulo bias when reducing into a 32-symbol alphabet.
    const bytes = randomBytes(8);
    for (let j = 0; j < 4; j++) {
      const combined = bytes[j * 2] * 256 + bytes[j * 2 + 1];
      segment += ACCOUNT_NUMBER_ALPHABET[combined % ACCOUNT_NUMBER_ALPHABET.length];
    }
    segments.push(segment);
  }
  return `OMA-${segments.join("-")}`;
}

export function hashAccountNumber(accountNumber: string): string {
  return createHash("sha256").update(accountNumber.toUpperCase()).digest("hex");
}

export function isValidAccountNumber(value: string): boolean {
  return ACCOUNT_NUMBER_REGEX.test(value);
}
