/**
 * Unit tests for the account-number module.
 *
 * Covers:
 *   - generation (uniqueness, format, charset — 16-digit numeric)
 *   - hashing (deterministic, hex)
 *   - normalization (16-digit with optional spaces/dashes; legacy OMA- format passthrough)
 */
import { describe, it, expect } from "vitest";
import {
  generateAccountNumber,
  hashAccountNumber,
} from "../account-number.js";

const ACCOUNT_NUMBER_REGEX = /^[0-9]{16}$/;

describe("generateAccountNumber", () => {
  it("returns 16-digit numeric strings", () => {
    for (let i = 0; i < 100; i++) {
      const n = generateAccountNumber();
      expect(n).toMatch(ACCOUNT_NUMBER_REGEX);
      expect(n.length).toBe(16);
    }
  });

  it("produces statistically unique values (10k samples)", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 10_000; i++) {
      const n = generateAccountNumber();
      expect(seen.has(n)).toBe(false);
      seen.add(n);
    }
    expect(seen.size).toBe(10_000);
  });

  it("uses only digits 0-9", () => {
    for (let i = 0; i < 100; i++) {
      const n = generateAccountNumber();
      expect(n).toMatch(/^[0-9]+$/);
    }
  });
});

describe("hashAccountNumber", () => {
  it("produces deterministic 64-char hex output from 16-digit input", () => {
    const n = "1234567890123456";
    const h1 = hashAccountNumber(n);
    const h2 = hashAccountNumber(n);
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes spaces and dashes from input", () => {
    const withSpaces = "1234 5678 9012 3456";
    const withDashes = "1234-5678-9012-3456";
    const plain = "1234567890123456";
    expect(hashAccountNumber(withSpaces)).toBe(hashAccountNumber(plain));
    expect(hashAccountNumber(withDashes)).toBe(hashAccountNumber(plain));
  });

  it("produces different hashes for different inputs", () => {
    expect(hashAccountNumber("1234567890123456")).not.toBe(hashAccountNumber("6543210987654321"));
  });

  it("still hashes legacy OMA- format (backwards compatibility)", () => {
    const legacyHash = hashAccountNumber("OMA-AAAA-AAAA-AAAA");
    expect(legacyHash).toMatch(/^[a-f0-9]{64}$/);
  });
});
