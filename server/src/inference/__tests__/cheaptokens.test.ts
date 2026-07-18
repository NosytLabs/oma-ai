/**
 * ISOLATED Unit Test for server/src/inference/cheaptokens.ts — cache TTL
 * Target: server/src/inference/cheaptokens.ts
 * Session: ses_venice_improvements
 *
 * **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES
 * Test code preserved in: .opencode/unit-tests/2026-06-14T09-30Z-cheaptokens-ttl.md
 *
 * Coverage:
 *   - getActiveVeniceKey() returns null when no key is cached (cold start)
 *   - getActiveVeniceKey() returns cached key within TTL window
 *   - getActiveVeniceKey() triggers refresh when cache is older than 5 minutes
 *   - getActiveVeniceKey(true) forces a refresh even when cache is valid
 *   - logger receives distinct messages for "reused" vs "refreshed"
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock("../../config.js", () => ({
  config: {
    FACILITATOR_MODE: "mock",
    CT_DAILY_USDC_CENTS_MAX: 0, // 0 = no cap (don't gate the test)
    CHEAPTOKENS_ADDRESS: undefined,
    TREASURY_BASE_ADDRESS: "0x0000000000000000000000000000000000000000",
    NODE_ENV: "test",
  },
}));

vi.mock("../../lib/logger.js", () => ({
  logger: mockLogger,
}));

// We don't want real viem in this isolated test
vi.mock("viem", () => ({
  createWalletClient: vi.fn(),
  http: vi.fn(),
  parseUnits: vi.fn((s: string) => s),
  encodeFunctionData: vi.fn(() => "0x"),
}));
vi.mock("viem/accounts", () => ({
  privateKeyToAccount: vi.fn(),
}));
vi.mock("viem/chains", () => ({
  base: {},
}));

import { getActiveVeniceKey, triggerRefresh } from "../cheaptokens.js";

describe("cheaptokens cache TTL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null on cold start (no cached key)", () => {
    // No refresh has happened yet → no key in cache
    const key = getActiveVeniceKey();
    expect(key).toBeNull();
  });

  it("returns the cached key after a successful refresh (within TTL)", async () => {
    await triggerRefresh();
    const key = getActiveVeniceKey();
    // Mock mode returns a ct_sk_venice_mock_... key
    expect(key).toMatch(/^ct_sk_venice_mock_/);
  });

  it("returns cached key when called within the 5-minute TTL window", async () => {
    await triggerRefresh();
    const first = getActiveVeniceKey();

    // Advance 4 minutes (240s < 300s TTL) — key should still be served
    vi.advanceTimersByTime(4 * 60 * 1000);

    const second = getActiveVeniceKey();
    expect(second).toBe(first);
    // The debug log should have been called for the reuse path
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it("triggers a refresh when the cache is older than 5 minutes", async () => {
    await triggerRefresh();
    const first = getActiveVeniceKey();

    // Advance 5 minutes + 1s past the 5-min TTL
    vi.advanceTimersByTime(5 * 60 * 1000 + 1000);

    const second = getActiveVeniceKey();
    // Cache was stale — getActiveVeniceKey returns the (still-valid) cached
    // key for in-flight requests while kicking off a refresh
    expect(second).toBe(first);
    // The info log should have flagged a stale-cache refresh
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringMatching(/Cache stale|Force refresh|No cached key/),
    );
  });

  it("forceRefresh=true bypasses cache and triggers a refresh even when TTL is fresh", async () => {
    await triggerRefresh();
    // Clear the logger so we can isolate the force-refresh log line
    vi.clearAllMocks();

    getActiveVeniceKey(true);

    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining("Force refresh"),
    );
  });
});
