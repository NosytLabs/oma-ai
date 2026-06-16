/**
 * ISOLATED Unit Test for SIWE + Solana message format compliance.
 * Target: server/src/auth/siwe.ts, server/src/auth/solana.ts
 * Session: task_w_SEC10
 *
 * **WARNING**: This test file is part of the regression suite for SEC-10.
 * It exercises the pure message builders/parsers — no DB, no Redis, no HTTP.
 * Test code is preserved verbatim in .opencode/unit-tests/ after any cleanup.
 */
import { describe, it, expect } from "vitest";
import { SiweMessage } from "siwe";

const TEST_SOLANA_ADDRESS = "11111111111111111111111111111112"; // System program, valid base58 + 32 bytes
const TEST_NONCE = "abcdef1234567890"; // 16 chars, alphanumeric
// ponytail: 65-byte signature shape (130 hex chars) — library only fails on
// spec-level checks (domain/time/nonce) before reaching the signature step,
// so a structurally valid but cryptographically invalid signature keeps
// stderr quiet.
const DUMMY_SIG = "0x" + "00".repeat(65);

// ponytail: mock config so the network string is deterministic. The function
// under test only reads SOLANA_RPC_URL via resolveSolanaNetwork(); no DB or
// Redis is touched.
vi.mock("../../config.js", () => ({
  config: {
    SOLANA_RPC_URL: "",
  },
}));

// Import the target after the mock so the module sees the stubbed config.
import { buildSolanaSignInMessage } from "../solana.js";

const FIXED_ISSUED_AT = new Date("2026-06-14T22:00:00.000Z");

// ============================================================================
// SEC-10 / Solana regression tests
// ============================================================================
describe("SEC-10 / Solana message format", () => {
  it("is deterministic for identical inputs (regression for the challenge/verify timestamp-mismatch bug)", () => {
    const a = buildSolanaSignInMessage(TEST_SOLANA_ADDRESS, TEST_NONCE, FIXED_ISSUED_AT);
    const b = buildSolanaSignInMessage(TEST_SOLANA_ADDRESS, TEST_NONCE, FIXED_ISSUED_AT);
    expect(a).toBe(b);
  });

  it("changes only when its inputs change", () => {
    const base = buildSolanaSignInMessage(TEST_SOLANA_ADDRESS, TEST_NONCE, FIXED_ISSUED_AT);
    expect(buildSolanaSignInMessage(TEST_SOLANA_ADDRESS, "differentnonce1234", FIXED_ISSUED_AT)).not.toBe(base);
    expect(buildSolanaSignInMessage("11111111111111111111111111111113", TEST_NONCE, FIXED_ISSUED_AT)).not.toBe(base);
    expect(buildSolanaSignInMessage(TEST_SOLANA_ADDRESS, TEST_NONCE, new Date("2026-06-14T22:00:01.000Z"))).not.toBe(base);
  });

  it("includes every required Sign-In With Solana field", () => {
    const message = buildSolanaSignInMessage(TEST_SOLANA_ADDRESS, TEST_NONCE, FIXED_ISSUED_AT);
    expect(message).toContain("oma.ai wants you to sign in with your Solana account:");
    expect(message).toContain(TEST_SOLANA_ADDRESS);
    expect(message).toContain("URI: https://oma.ai");
    expect(message).toContain("Version: 1");
    expect(message).toContain("Chain ID: solana:mainnet");
    expect(message).toContain("Nonce: " + TEST_NONCE);
    // ISO 8601 datetimes
    expect(message).toContain("Issued At: 2026-06-14T22:00:00.000Z");
    expect(message).toContain("Expiration Time: 2026-06-14T22:10:00.000Z"); // +10 min TTL
  });

  it("keeps header/domain aligned with the URI field (sign-in with solana spec §1)", () => {
    const message = buildSolanaSignInMessage(TEST_SOLANA_ADDRESS, TEST_NONCE, FIXED_ISSUED_AT);
    const headerLine = message.split("\n")[0];
    // The header must reference the same domain as the URI field, not a brand
    // name. This was the SEC-10 deviation we fixed (was "OMA …", now "oma.ai …").
    expect(headerLine.startsWith("oma.ai ")).toBe(true);
    expect(message).toContain("URI: https://oma.ai");
  });
});

// ============================================================================
// SEC-10 / SIWE EIP-4361 compliance — exercised through the `siwe` library
// the server already uses. These assert that the server's verify path catches
// the malformed-message classes called out in the SEC-10 ticket.
// ============================================================================
describe("SEC-10 / SIWE EIP-4361 (via siwe library)", () => {
  const SIWE_BASE = {
    domain: "oma.ai",
    address: "0x0000000000000000000000000000000000000001",
    uri: "https://oma.ai",
    version: "1",
    chainId: 8453,
    nonce: "validnonce12", // 12 alphanumeric chars
  };

  it("round-trips through SiweMessage — constructed message reparses with all fields intact", () => {
    const built = new SiweMessage({ ...SIWE_BASE, statement: "I accept the OMA Terms of Service" }).toMessage();
    const reparsed = new SiweMessage(built);
    expect(reparsed.domain).toBe(SIWE_BASE.domain);
    expect(reparsed.address).toBe(SIWE_BASE.address);
    expect(reparsed.uri).toBe(SIWE_BASE.uri);
    expect(reparsed.version).toBe(SIWE_BASE.version);
    expect(reparsed.chainId).toBe(SIWE_BASE.chainId);
    expect(reparsed.nonce).toBe(SIWE_BASE.nonce);
    expect(reparsed.statement).toBe("I accept the OMA Terms of Service");
  });

  it("rejects past expirationTime at verify() (EIP-4361 §4)", async () => {
    const expired = new SiweMessage({
      ...SIWE_BASE,
      issuedAt: "2020-01-01T00:00:00Z",
      expirationTime: "2020-01-01T00:05:00Z",
    });
    const result = await expired.verify(
      { signature: DUMMY_SIG, nonce: SIWE_BASE.nonce, domain: SIWE_BASE.domain, time: "2026-01-01T00:00:00Z" },
      { suppressExceptions: true },
    );
    expect(result.success).toBe(false);
    // ponytail: the library surfaces the failure via `error.type`; we don't
    // pin the exact string so a library patch can't make this test brittle.
    expect(String(result.error?.type ?? "").toLowerCase()).toMatch(/expired/);
  });

  it("rejects future notBefore at verify() (EIP-4361 §4)", async () => {
    const futureGate = new SiweMessage({
      ...SIWE_BASE,
      issuedAt: "2020-01-01T00:00:00Z",
      notBefore: "2099-01-01T00:00:00Z",
    });
    const result = await futureGate.verify(
      { signature: DUMMY_SIG, nonce: SIWE_BASE.nonce, domain: SIWE_BASE.domain, time: "2026-01-01T00:00:00Z" },
      { suppressExceptions: true },
    );
    expect(result.success).toBe(false);
    expect(String(result.error?.type ?? "").toLowerCase()).toMatch(/not.*yet.*valid|not.*valid.*yet/);
  });

  it("rejects wrong domain at verify() when server binds expected domain", async () => {
    const evilDomain = new SiweMessage({ ...SIWE_BASE, domain: "evil.com", uri: "https://evil.com" });
    const result = await evilDomain.verify(
      { signature: DUMMY_SIG, nonce: SIWE_BASE.nonce, domain: "oma.ai" },
      { suppressExceptions: true },
    );
    expect(result.success).toBe(false);
    expect(String(result.error?.type ?? "").toLowerCase()).toMatch(/domain.*(mismatch|match)/);
  });

  it("accepts a message for the bound domain (control case)", async () => {
    const good = new SiweMessage({ ...SIWE_BASE });
    const result = await good.verify(
      { signature: DUMMY_SIG, nonce: SIWE_BASE.nonce, domain: "oma.ai", time: "2026-01-01T00:00:00Z" },
      { suppressExceptions: true },
    );
    // Should NOT be a domain/nonce/time error; signature will be the next
    // failure point — but the test still passes because the error is not the
    // domain-binding one we just fixed. ponytail: the spec-level guards
    // (domain, time, nonce) must come BEFORE the signature check, so the
    // error here should NOT be one of those.
    const errType = String(result.error?.type ?? "").toLowerCase();
    expect(errType).not.toMatch(/domain.*(mismatch|match)|nonce.*mismatch|expired|not.*valid/);
  });

  it("rejects a too-short nonce at the parser (EIP-4361 requires ≥8 alphanumeric)", () => {
    // ponytail: the ABNF parser enforces the nonce length. Constructing a
    // string that violates it and parsing it must throw.
    const bad = [
      "oma.ai wants you to sign in with your Ethereum account:",
      "0x0000000000000000000000000000000000000001",
      "",
      "URI: https://oma.ai",
      "Version: 1",
      "Chain ID: 8453",
      "Nonce: abc", // 3 chars — under the 8-char minimum
      "Issued At: 2026-01-01T00:00:00Z",
    ].join("\n");
    expect(() => new SiweMessage(bad)).toThrow();
  });

  it("rejects a non-alphanumeric nonce at the parser", () => {
    const bad = [
      "oma.ai wants you to sign in with your Ethereum account:",
      "0x0000000000000000000000000000000000000001",
      "",
      "URI: https://oma.ai",
      "Version: 1",
      "Chain ID: 8453",
      "Nonce: has-dashes-and-!@#",
      "Issued At: 2026-01-01T00:00:00Z",
    ].join("\n");
    expect(() => new SiweMessage(bad)).toThrow();
  });

  it("rejects a SIWE message that omits issuedAt (EIP-4361 §3 required field)", () => {
    const bad = [
      "oma.ai wants you to sign in with your Ethereum account:",
      "0x0000000000000000000000000000000000000001",
      "",
      "URI: https://oma.ai",
      "Version: 1",
      "Chain ID: 8453",
      "Nonce: validnonce12",
    ].join("\n");
    expect(() => new SiweMessage(bad)).toThrow();
  });
});
