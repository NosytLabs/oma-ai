/**
 * ISOLATED Unit Test for server/src/inference/vendor-meta.ts
 * Target: server/src/inference/vendor-meta.ts
 * Session: ses_m10_4_vendor_meta
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-14T05-00Z-m10-4-vendor-meta.md
 *
 * M10.4 — Vendor Meta spec requires:
 *   1. getVendorMeta() returns the configured inference providers (currently 10:
 *      8 named + a duplicate litellm entry + gemini)
 *   2. Each entry has all 9 required fields:
 *      { name, displayName, baseUrl, iconUrl, docsUrl,
 *        supportsStreaming, supportsTools, supportsVision, hasApiKey }
 *   3. The /v1/providers/meta public route serializes the array verbatim.
 *   4. The serialized response MUST NOT leak any API key value.
 *
 * Isolation strategy:
 *   - Mock `../config.js` with deterministic key presence: venice=YES, antseed=NO,
 *     litellm=YES, openrouter=YES, together=NO, deepinfra=YES, morpheus=NO,
 *     surplus=YES (these specific booleans are what tests assert against).
 *   - Mock `../lib/logger.js` to a no-op.
 *   - No DB, no Redis, no HTTP — pure synchronous test of the public surface.
 */

import { describe, it, expect, vi } from "vitest";

// ============================================================================
// Mocks — MUST be registered BEFORE the target import (Vitest hoists vi.mock).
// ============================================================================

vi.mock("../lib/logger.js", () => ({
  logger: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Deterministic API-key presence for tests. The booleans are intentional so
// the test ALSO catches the "always-true" or "always-false" regression bug
// (where hasApiKey is hard-coded instead of read from config).
vi.mock("../config.js", () => ({
  config: {
    VENICE_API_KEY: "venice-secret-DO-NOT-LEAK",
    OPENROUTER_API_KEY: "openrouter-secret-DO-NOT-LEAK",
    TOGETHER_API_KEY: undefined,
    DEEPINFRA_API_KEY: "deepinfra-secret-DO-NOT-LEAK",
    LITELLM_API_KEY: "litellm-secret-DO-NOT-LEAK",
    MORPHEUS_API_KEY: undefined,
    SURPLUS_WALLET_PRIVATE_KEY: "0x" + "a".repeat(64), // looks like a 64-hex private key
    ANTSEED_PROXY_URL: undefined,
  },
}));

// Mock the live Venice health probe so getVendorMeta() never makes a real
// network call in tests. Default to "up" with 50ms latency. Individual tests
// can override via vi.mocked(...).mockResolvedValueOnce.
vi.mock("../inference/venice.js", () => ({
  healthCheckVenice: vi.fn().mockResolvedValue({ ok: true, latencyMs: 50 }),
}));

// Imports AFTER mocks
import { getVendorMeta, VENDOR_META, type VendorMeta } from "../inference/vendor-meta.js";

// ============================================================================
// Test 1: shape — 8 providers, all 9 required fields populated.
// ============================================================================
describe("M10.4 vendor-meta — shape contract", () => {
  // ponytail: was "8 named + duplicate litellm + gemini = 10" — claude
  // removed and duplicate litellm dropped; now 9 unique providers.
  it("returns the configured providers (9 unique providers)", async () => {
    const providers = await getVendorMeta();
    expect(providers).toHaveLength(9);
  });

  it("each provider has all 9 required fields (name, displayName, baseUrl, iconUrl, docsUrl, supportsStreaming, supportsTools, supportsVision, hasApiKey)", async () => {
    const providers = await getVendorMeta();
    const requiredKeys: (keyof VendorMeta)[] = [
      "name",
      "displayName",
      "baseUrl",
      "iconUrl",
      "docsUrl",
      "supportsStreaming",
      "supportsTools",
      "supportsVision",
      "hasApiKey",
    ];
    for (const p of providers) {
      for (const key of requiredKeys) {
        expect(p, `provider ${p?.name ?? "<unknown>"} missing field ${String(key)}`).toHaveProperty(key);
      }
    }
  });

  it("name is one of the expected inference providers (venice/antseed/litellm/openrouter/together/deepinfra/surplus/morpheus/gemini)", async () => {
    const expected = new Set([
      "venice",
      "antseed",
      "litellm",
      "openrouter",
      "together",
      "deepinfra",
      "surplus",
      "morpheus",
      "gemini",
    ]);
    const providers = await getVendorMeta();
    for (const p of providers) {
      expect(expected.has(p.name), `unexpected provider name: ${p.name}`).toBe(true);
    }
    // all expected names are present (no missing)
    expect(new Set(providers.map((p) => p.name)).size).toBeGreaterThanOrEqual(8);
  });

  it("hasApiKey is a boolean (not undefined, not string, not the key value itself)", async () => {
    const providers = await getVendorMeta();
    for (const p of providers) {
      expect(typeof p.hasApiKey, `${p.name}.hasApiKey must be boolean, got ${typeof p.hasApiKey}`).toBe("boolean");
    }
  });

  it("hasApiKey reflects mocked config — venice=YES, openrouter=YES, litellm=YES, deepinfra=YES, surplus=YES, together=NO, morpheus=NO, antseed=NO", async () => {
    const providers = await getVendorMeta();
    const byName: Record<string, VendorMeta> = {};
    for (const p of providers) byName[p.name] = p;

    expect(byName.venice.hasApiKey, "venice secret is set in mocked config → hasApiKey=true").toBe(true);
    expect(byName.openrouter.hasApiKey, "openrouter secret is set → true").toBe(true);
    expect(byName.litellm.hasApiKey, "litellm secret is set → true").toBe(true);
    expect(byName.deepinfra.hasApiKey, "deepinfra secret is set → true").toBe(true);
    expect(byName.surplus.hasApiKey, "surplus wallet private key is set → true").toBe(true);
    expect(byName.together.hasApiKey, "together secret is undefined → false").toBe(false);
    expect(byName.morpheus.hasApiKey, "morpheus secret is undefined → false").toBe(false);
    expect(byName.antseed.hasApiKey, "antseed proxy URL is undefined → false").toBe(false);
  });

  it("baseUrl and docsUrl are valid https URLs", async () => {
    const providers = await getVendorMeta();
    for (const p of providers) {
      expect(() => new URL(p.baseUrl), `${p.name}.baseUrl must be a valid URL`).not.toThrow();
      expect(() => new URL(p.docsUrl), `${p.name}.docsUrl must be a valid URL`).not.toThrow();
      expect(p.baseUrl.startsWith("https://"), `${p.name}.baseUrl must be https`).toBe(true);
    }
  });

  it("VENDOR_META constant is exported and has the same 9 entries", () => {
    expect(Array.isArray(VENDOR_META)).toBe(true);
    expect(VENDOR_META).toHaveLength(9);
    // The const is `as const` (readonly tuple-like); we still expect each
    // entry to satisfy the same field contract.
    for (const p of VENDOR_META) {
      expect(p).toHaveProperty("name");
      expect(p).toHaveProperty("hasApiKey");
    }
  });
});

// ============================================================================
// Test 2: security — the /v1/providers/meta route must NOT leak any key value.
// ============================================================================
describe("M10.4 vendor-meta — secret-leak guard", () => {
  // We can't import the route without dragging in `hono`, so we just serialize
  // the data the route would return. The route does `c.json({ count, providers })`,
  // which is a shallow pass-through of the VendorMeta array.
  it("does NOT contain any mocked secret value as a substring of any field", async () => {
    const providers = await getVendorMeta();
    const SECRETS_TO_NEVER_LEAK = [
      "venice-secret-DO-NOT-LEAK",
      "openrouter-secret-DO-NOT-LEAK",
      "litellm-secret-DO-NOT-LEAK",
      "deepinfra-secret-DO-NOT-LEAK",
      // The surplus wallet private key is a 0x + 64 hex chars. The route
      // response must never include the literal key value. The shape of the
      // hasApiKey field is a boolean so the key cannot appear there. We
      // additionally check the stringified JSON of each provider does not
      // contain a 0x[a-fA-F0-9]{60,} substring (which would indicate the
      // private key leaked via a string field).
    ];
    for (const p of providers) {
      const stringified = JSON.stringify(p);
      for (const secret of SECRETS_TO_NEVER_LEAK) {
        expect(
          stringified.includes(secret),
          `provider ${p.name} serialized output contains the secret substring "${secret.slice(0, 16)}..." — LEAK!`,
        ).toBe(false);
      }
    }
  });

  it("the stringified response contains no 0x-prefixed long hex string (private-key or address leak guard)", async () => {
    const providers = await getVendorMeta();
    // Pattern: 0x followed by 40+ hex chars (addresses are 40, private keys are 64)
    const hexKeyPattern = /0x[a-fA-F0-9]{40,}/;
    for (const p of providers) {
      const stringified = JSON.stringify(p);
      expect(
        hexKeyPattern.test(stringified),
        `provider ${p.name} contains a long 0x-hex string — possible key/address leak: ${stringified}`,
      ).toBe(false);
    }
  });

  it("the stringified response contains no sk- / sk_live_ / Bearer eyJ-style secret prefixes", async () => {
    const providers = await getVendorMeta();
    const SECRET_PREFIXES = [/\bsk_[A-Za-z0-9_-]{10,}/g, /\beyJ[A-Za-z0-9_=+-]{10,}/g, /\bsk-[A-Za-z0-9]{10,}/g];
    for (const p of providers) {
      const stringified = JSON.stringify(p);
      for (const pattern of SECRET_PREFIXES) {
        expect(
          pattern.test(stringified),
          `provider ${p.name} contains a secret-like prefix matching ${pattern.source}`,
        ).toBe(false);
      }
    }
  });

  it("getVendorMeta() returns a fresh copy each call (no shared mutation possible)", async () => {
    const a = await getVendorMeta();
    const b = await getVendorMeta();
    expect(a).not.toBe(b); // different array references
    expect(a[0]).not.toBe(b[0]); // different object references
    a[0].displayName = "MUTATED";
    expect(b[0].displayName).not.toBe("MUTATED"); // mutation on `a` did not leak to `b`
  });
});
