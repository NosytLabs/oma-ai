// @ts-nocheck — test file with complex mock typing
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@hono/node-server", () => ({
  serve: vi.fn(),
  getRequestListener: vi.fn(() => ({ on: vi.fn(), handle: vi.fn() })),
}));

const { dbChain, resetDb } = vi.hoisted(() => {
  const chain: Record<string, unknown> = {};
  const METHODS = ["select", "from", "where", "insert", "values", "update", "set", "orderBy", "offset"];
  for (const m of METHODS) chain[m] = vi.fn().mockReturnValue(chain);
  // limit() and returning() are awaited -- return Promise<rows>
  chain.limit = vi.fn().mockResolvedValue([]);
  chain.returning = vi.fn().mockResolvedValue([{ id: "wd-1" }]);
  return { dbChain: chain, resetDb: () => {
    for (const m of METHODS) (chain[m] as ReturnType<typeof vi.fn>).mockReturnValue(chain);
    // Re-bind the default resolved value. We do NOT call mockReset on `limit`
    // because the entire chain object would lose its `vi.fn` instance and the
    // test would not be able to use `mockResolvedValueOnce` afterward. The
    // queue is instead drained explicitly in each test's setWithdrawalRow.
    (chain.limit as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  } };
});

vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  isRedisReady: vi.fn().mockReturnValue(false),
}));

vi.mock("../db/client.js", () => ({ db: dbChain, getDb: () => dbChain }));

vi.mock("../auth/api-keys.js", () => ({
  shouldRecommendRotation: vi.fn().mockReturnValue(false),
  validateApiKey: vi.fn(),
  createApiKey: vi.fn(),
  listApiKeys: vi.fn().mockResolvedValue([]),
  revokeApiKey: vi.fn(),
}));

// requireAdmin is mounted on adminRoutes.use("*", ...), which Hono runs for
// every request routed through the admin sub-router (mounted at root).
// In production, the admin routes are path-scoped to /v1/admin/*, but in tests
// against the full app the middleware still fires. Stub it out so we can
// actually exercise the withdraw handler.
vi.mock("../auth/middleware.js", () => ({
  bearerAuth: async (_c: any, next: any) => next(),
  optionalAuth: async (_c: any, next: any) => next(),
  requireTeamRole: () => async (_c: any, next: any) => next(),
  requireAdmin: () => async (_c: any, next: any) => next(),
  sessionAuth: async (c: any, next: any) => {
    c.set("userId", "user-1");
    c.set("authMethod", "siwe");
    await next();
  },
  sessionOrBearerAuth: async (c: any, next: any) => {
    c.set("userId", "user-1");
    c.set("authMethod", "siwe");
    await next();
  },
}));

vi.mock("../auth/siwe.js", () => ({
  verifySiweMessage: vi.fn(),
  getOrCreateUser: vi.fn(),
  getNonce: vi.fn().mockResolvedValue("nonce_abc123"),
  generateSessionToken: vi.fn(),
  verifySessionToken: vi.fn(),
}));

vi.mock("../credits/index.js", () => ({
  getBalance: vi.fn().mockResolvedValue({ balanceCents: "100000", totalDepositedCents: "100000", totalUsedCents: "0", lastActivityAt: null }),
  getStakingDiscount: vi.fn().mockResolvedValue(0),
  addCredits: vi.fn(),
  deductCredits: vi.fn(),
  refundCredits: vi.fn(),
  preflightDeduction: vi.fn(),
  invalidateBalanceCache: vi.fn(),
}));

vi.mock("../middleware/rate-limit.js", () => ({
  rateLimit: () => async (_c: unknown, next: () => void) => next(),
  tokenBucket: () => async (_c: unknown, next: () => void) => next(),
  modelRateLimit: () => async (_c: unknown, next: () => void) => next(),
  burstRateLimit: () => async (_c: unknown, next: () => void) => next(),
  expressiveRateLimit: () => async (_c: unknown, next: () => void) => next(),
}));

vi.mock("../middleware/spend-limit.js", () => ({
  spendLimit: () => async (_c: unknown, next: () => void) => next(),
  trackSpend: vi.fn(),
}));

vi.mock("../x402/facilitator.js", () => {
  const { Hono } = require("hono") as typeof import("hono");
  return { x402Routes: new Hono() };
});

vi.mock("../config.js", () => ({
  config: {
    PORT: 3001,
    CORS_ORIGIN: "http://localhost:3000",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-chars",
    NODE_ENV: "test",
    DATABASE_URL: "postgresql://localhost:5432/oma_test",
    TREASURY_BASE_ADDRESS: "0xtreasury00000000000000000000000000000000",
    CHAIN_RPC_URL: "https://base-rpc.publicnode.com",
  },
}));

// Mock viem's createPublicClient.getTransactionReceipt
const mockGetReceipt = vi.fn();
vi.mock("viem", async () => {
  const actual = await vi.importActual<typeof import("viem")>("viem");
  return {
    ...actual,
    createPublicClient: vi.fn(() => ({
      getTransactionReceipt: mockGetReceipt,
    })),
  };
});

import app from "../index.js";
import { verifySessionToken } from "../auth/siwe.js";
import { USDC_BASE } from "../constants.js";

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const TREASURY = "0xtreasury00000000000000000000000000000000";
const RECIPIENT = "0xRecipient000000000000000000000000000000a";
// Pad an address to a 32-byte hex topic (lowercase, no 0x)
const padTopic = (addr: string) => "0x" + addr.toLowerCase().replace(/^0x/, "").padStart(64, "0");

// netAmountCents = 10000 ($100.00) requires value >= 100_000_000 base units.
// USDC has 6 decimals; 1 cent = 0.01 USDC = 10_000 base units.
const REQUIRED_VALUE = 10_000n * 10_000n; // 100 USDC in 6-decimal base units

function buildReceipt(overrides: Partial<{ to: string; logs: unknown[]; status: string }> = {}) {
  return {
    status: overrides.status ?? "success",
    to: overrides.to ?? RECIPIENT,
    logs: overrides.logs ?? [
      {
        address: USDC_BASE,
        topics: [TRANSFER_TOPIC, padTopic(TREASURY), padTopic(RECIPIENT)],
        data: "0x" + REQUIRED_VALUE.toString(16).padStart(64, "0"),
      },
    ],
  };
}

function setWithdrawalRow(row: unknown) {
  // The sessionAuth stub above does NOT touch the database (no 2FA lookup),
  // so the only db.select().limit(1) call per request is the route's own
  // withdrawal lookup.
  vi.mocked(dbChain.limit as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce([row]);
}

describe("Withdraw confirm - C-4 on-chain receipt verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDb();
  });

  it("C-4 accepts confirmation when on-chain receipt matches the withdrawal", async () => {
    vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: "user-1", authMethod: "siwe" });
    setWithdrawalRow({
      id: "wd-1",
      userId: "user-1",
      amountCents: "10100",
      netAmountCents: "10000",
      feeCents: "100",
      toAddress: RECIPIENT,
      chainId: "8453",
      status: "pending",
      txHash: null,
      createdAt: new Date(),
      completedAt: null,
    });
    const receipt = buildReceipt();
    mockGetReceipt.mockResolvedValueOnce(receipt);

    const res = await app.request("/v1/withdraw/wd-1/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer session-token" },
      body: JSON.stringify({ txHash: "0x" + "a".repeat(64) }),
    });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.status).toBe("completed");
  });

  it("C-4 accepts USDC ERC-20 transfers where receipt.to is the USDC contract (not the recipient)", async () => {
    // For ERC-20 transfers, receipt.to is the USDC contract address, not the
    // recipient. The route must NOT reject on receipt.to mismatch.
    vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: "user-1", authMethod: "siwe" });
    setWithdrawalRow({
      id: "wd-2",
      userId: "user-1",
      amountCents: "10100",
      netAmountCents: "10000",
      feeCents: "100",
      toAddress: RECIPIENT,
      chainId: "8453",
      status: "pending",
      txHash: null,
      createdAt: new Date(),
      completedAt: null,
    });
    const receipt = buildReceipt({ to: USDC_BASE });
    mockGetReceipt.mockResolvedValueOnce(receipt);

    const res = await app.request("/v1/withdraw/wd-2/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer session-token" },
      body: JSON.stringify({ txHash: "0x" + "b".repeat(64) }),
    });
    expect(res.status).toBe(200);
  });

  it("C-4 rejects when no USDC transfer from OMA treasury to recipient is found", async () => {
    vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: "user-1", authMethod: "siwe" });
    setWithdrawalRow({
      id: "wd-3",
      userId: "user-1",
      amountCents: "10100",
      netAmountCents: "10000",
      feeCents: "100",
      toAddress: RECIPIENT,
      chainId: "8453",
      status: "pending",
      txHash: null,
      createdAt: new Date(),
      completedAt: null,
    });
    // Receipt has no logs (attacker submitted an unrelated successful tx)
    mockGetReceipt.mockResolvedValueOnce(buildReceipt({ logs: [] }));

    const res = await app.request("/v1/withdraw/wd-3/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer session-token" },
      body: JSON.stringify({ txHash: "0x" + "c".repeat(64) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.type).toBe("usdc_transfer_mismatch");
  });

  it("C-4 rejects when the USDC transfer value is below netAmountCents * 10^6", async () => {
    vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: "user-1", authMethod: "siwe" });
    setWithdrawalRow({
      id: "wd-4",
      userId: "user-1",
      amountCents: "10100",
      netAmountCents: "10000",
      feeCents: "100",
      toAddress: RECIPIENT,
      chainId: "8453",
      status: "pending",
      txHash: null,
      createdAt: new Date(),
      completedAt: null,
    });
    // Transfer value is only 1 USDC = 1_000_000 base units, but netAmountCents requires 100_000_000
    mockGetReceipt.mockResolvedValueOnce(
      buildReceipt({
        logs: [
          {
            address: USDC_BASE,
            topics: [TRANSFER_TOPIC, padTopic(TREASURY), padTopic(RECIPIENT)],
            data: "0x" + (1_000_000n).toString(16).padStart(64, "0"),
          },
        ],
      }),
    );

    const res = await app.request("/v1/withdraw/wd-4/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer session-token" },
      body: JSON.stringify({ txHash: "0x" + "d".repeat(64) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.type).toBe("usdc_transfer_mismatch");
  });

  it("C-4 rejects when the USDC transfer 'from' is not the OMA treasury", async () => {
    vi.mocked(verifySessionToken).mockResolvedValueOnce({ userId: "user-1", authMethod: "siwe" });
    setWithdrawalRow({
      id: "wd-5",
      userId: "user-1",
      amountCents: "10100",
      netAmountCents: "10000",
      feeCents: "100",
      toAddress: RECIPIENT,
      chainId: "8453",
      status: "pending",
      txHash: null,
      createdAt: new Date(),
      completedAt: null,
    });
    // Transfer comes from a non-treasury address (impersonation attempt)
    mockGetReceipt.mockResolvedValueOnce(
      buildReceipt({
        logs: [
          {
            address: USDC_BASE,
            topics: [TRANSFER_TOPIC, padTopic("0xattacker00000000000000000000000000000000"), padTopic(RECIPIENT)],
            data: "0x" + REQUIRED_VALUE.toString(16).padStart(64, "0"),
          },
        ],
      }),
    );

    const res = await app.request("/v1/withdraw/wd-5/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer session-token" },
      body: JSON.stringify({ txHash: "0x" + "e".repeat(64) }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.type).toBe("usdc_transfer_mismatch");
  });
});
