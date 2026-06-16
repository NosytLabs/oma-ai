import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Shared mock DB ────────────────────────────────────────────────────

let _dbResponseQueue: any[] = [];
let _dbCallIdx = 0;
let _defaultDbResult: any = [];

const mockDb: Record<string, any> = {};

function setupDbChain() {
  const self = mockDb;
  self.select = vi.fn().mockReturnValue(self);
  self.from = vi.fn().mockReturnValue(self);
  self.where = vi.fn().mockReturnValue(self);
  self.limit = vi.fn().mockReturnValue(self);
  self.leftJoin = vi.fn().mockReturnValue(self);
  self.orderBy = vi.fn().mockReturnValue(self);
  self.insert = vi.fn().mockReturnValue(self);
  self.values = vi.fn().mockReturnValue(self);
  self.returning = vi.fn().mockImplementation(() => {
    const val = _dbResponseQueue[_dbCallIdx] ?? _defaultDbResult;
    if (_dbCallIdx < _dbResponseQueue.length) _dbCallIdx++;
    return Promise.resolve(val);
  });
  self.update = vi.fn().mockReturnValue(self);
  self.set = vi.fn().mockReturnValue(self);
  self.delete = vi.fn().mockReturnValue(self);
  self.then = (resolve: any) => {
    const val = _dbResponseQueue[_dbCallIdx] ?? _defaultDbResult;
    if (_dbCallIdx < _dbResponseQueue.length) _dbCallIdx++;
    resolve(val);
  };
  // Drizzle raw-SQL path. credit-expiry uses CTE UPDATE/SELECT chains that
  // can't be expressed as ORM chain calls, so it goes through `db.execute`
  // (which returns `{ rows: T[] }`). Tests that need to drive this path must
  // override `mockDb.execute` to consume from a queue of `{ rows: [...] }`.
  self.execute = vi.fn().mockImplementation(() => {
    const val = _dbResponseQueue[_dbCallIdx] ?? _defaultDbResult;
    if (_dbCallIdx < _dbResponseQueue.length) _dbCallIdx++;
    return Promise.resolve({ rows: val });
  });
}

function dbReturns(val: any) {
  _defaultDbResult = val;
  _dbResponseQueue = [];
  _dbCallIdx = 0;
  mockDb.returning = vi.fn().mockImplementation(() => Promise.resolve(val));
  mockDb.then = (resolve: any) => resolve(val);
}

/** Set a queue of responses consumed in order by db chain calls and .returning() */
function dbReturnsSequence(...vals: any[]) {
  _dbResponseQueue = vals;
  _dbCallIdx = 0;
  mockDb.then = (resolve: any) => {
    const val = _dbResponseQueue[_dbCallIdx] ?? _defaultDbResult;
    if (_dbCallIdx < _dbResponseQueue.length) _dbCallIdx++;
    resolve(val);
  };
  mockDb.returning = vi.fn().mockImplementation(() => {
    const val = _dbResponseQueue[_dbCallIdx] ?? _defaultDbResult;
    if (_dbCallIdx < _dbResponseQueue.length) _dbCallIdx++;
    return Promise.resolve(val);
  });
}

// ── Mock modules ──────────────────────────────────────────────────────

vi.mock("../db/client.js", () => ({ db: mockDb }));

const mockRedis = {
  incr: vi.fn().mockResolvedValue(1),
  expire: vi.fn().mockResolvedValue("OK"),
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
};
vi.mock("../lib/redis-client.js", () => ({
  getRedisClient: vi.fn(() => mockRedis),
}));

vi.mock("../lib/logger.js", () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

const mockGetOrder = vi.fn();
vi.mock("../credits/houdini-client.js", () => ({
  houdiniClient: { getOrder: mockGetOrder },
}));

const mockCompleteHoudiniDeposit = vi.fn();
vi.mock("../credits/deposit.js", () => ({
  completeHoudiniDeposit: mockCompleteHoudiniDeposit,
}));

const mockAddSettlementToDlq = vi.fn();
vi.mock("../lib/dlq.js", () => ({
  addSettlementToDlq: mockAddSettlementToDlq,
}));

// Mock viem — configurable per-test via mockFn instances
const mockGetBlockNumber = vi.fn().mockResolvedValue(BigInt(100));
const mockGetContractEvents = vi.fn().mockResolvedValue([]);
const mockGetBlock = vi.fn().mockResolvedValue({ timestamp: BigInt(1700000000) });
const mockGetTransactionReceipt = vi.fn().mockResolvedValue({ status: "success", logs: [] });

vi.mock("viem", () => ({
  createPublicClient: vi.fn(() => ({
    getBlockNumber: mockGetBlockNumber,
    getContractEvents: mockGetContractEvents,
    getBlock: mockGetBlock,
    getTransactionReceipt: mockGetTransactionReceipt,
  })),
  http: vi.fn(),
  formatUnits: vi.fn((val: any, _dec?: number) => {
    if (typeof val === "bigint") return String(Number(val) / 1e6);
    return String(val);
  }),
}));

vi.mock("viem/chains", () => ({
  base: { id: 8453, name: "Base" },
}));

vi.mock("../config.js", () => ({
  config: { TREASURY_BASE_ADDRESS: "0xTREASURY", CHAIN_RPC_URL: "https://mainnet.base.org" },
}));

vi.mock("../constants.js", () => ({
  USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  USDC_DECIMALS: 6,
}));

// ── Tests ─────────────────────────────────────────────────────────────

describe("credit-expiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbChain();
    dbReturns([]);
  });

  it("processExpiredCredits zeros expired batches and recalculates balances", async () => {
    let callCount = 0;
    // processExpiredCredits issues exactly two `db.execute` calls:
    //   1) the combined expired+batch_update CTE — returns the aggregate row
    //   2) the extension CTE — returns the count of extended batches
    const responses = [
      [{ expired_count: "2", expired_amount: "8000" }],
      [{ extended: "1" }],
    ];
    mockDb.execute = vi.fn().mockImplementation(() => {
      const val = responses[callCount++] ?? [];
      return Promise.resolve({ rows: val });
    });

    const { processExpiredCredits } = await import("../jobs/credit-expiry.js");
    const result = await processExpiredCredits();

    expect(result.expiredCount).toBe(2);
    expect(result.expiredAmount).toBe(8000);
    expect(result.extendedBatchCount).toBe(1);
  });

  it("returns zero counts when nothing is expired", async () => {
    let callCount = 0;
    const responses = [
      [{ expired_count: "0", expired_amount: "0" }],
      [{ extended: "0" }],
    ];
    mockDb.execute = vi.fn().mockImplementation(() => {
      const val = responses[callCount++] ?? [];
      return Promise.resolve({ rows: val });
    });

    const { processExpiredCredits } = await import("../jobs/credit-expiry.js");
    const result = await processExpiredCredits();

    expect(result.expiredCount).toBe(0);
    expect(result.expiredAmount).toBe(0);
    expect(result.extendedBatchCount).toBe(0);
  });

  it("extends batches for active users only", async () => {
    let callCount = 0;
    const responses = [
      [{ expired_count: "0", expired_amount: "0" }],
      [{ extended: "1" }],
    ];
    mockDb.execute = vi.fn().mockImplementation(() => {
      const val = responses[callCount++] ?? [];
      return Promise.resolve({ rows: val });
    });

    const { processExpiredCredits } = await import("../jobs/credit-expiry.js");
    const result = await processExpiredCredits();

    expect(result.extendedBatchCount).toBe(1);
  });

  it("scheduleCreditExpiry and stopCreditExpiry run without errors", async () => {
    vi.useFakeTimers();
    try {
      dbReturns([]);
      const { scheduleCreditExpiry, stopCreditExpiry } = await import("../jobs/credit-expiry.js");
      const handle = scheduleCreditExpiry();
      expect(handle).toBeDefined();
      stopCreditExpiry();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("subscription-cron", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbChain();
    dbReturns([]);
  });

  it("cancels subscriptions with cancelAtPeriodEnd", async () => {
    let callCount = 0;
    const responses = [
      [{ id: "sub-1", userId: "user-1", planId: "plan-1", currentPeriodEnd: new Date("2025-01-01"), cancelAtPeriodEnd: true }],
      [],
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    const { processExpiredSubscriptions } = await import("../jobs/subscription-cron.js");
    const result = await processExpiredSubscriptions();

    expect(result.expiredCount).toBe(1);
    expect(result.renewedCount).toBe(0);
  });

  it("renews subscriptions and grants credits", async () => {
    const periodEnd = new Date("2025-06-01");
    let callCount = 0;
    const responses = [
      [{ id: "sub-2", userId: "user-2", planId: "plan-pro", currentPeriodEnd: periodEnd, cancelAtPeriodEnd: false }],
      [{ id: "plan-pro", credits: 10000 }],
      [],                        // update subscription period
      [],                        // insert credit batch
      [{ userId: "user-2", balanceCents: "5000" }],
      [],                        // update balance
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    const { processExpiredSubscriptions } = await import("../jobs/subscription-cron.js");
    const result = await processExpiredSubscriptions();

    expect(result.renewedCount).toBe(1);
    expect(result.expiredCount).toBe(0);
  });

  it("skips renewal when plan not found", async () => {
    let callCount = 0;
    const responses = [
      [{ id: "sub-3", userId: "user-3", planId: "plan-missing", currentPeriodEnd: new Date("2025-01-01"), cancelAtPeriodEnd: false }],
      [],
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    const { processExpiredSubscriptions } = await import("../jobs/subscription-cron.js");
    const result = await processExpiredSubscriptions();

    expect(result.expiredCount).toBe(0);
    expect(result.renewedCount).toBe(0);
  });

  it("handles empty expired subscriptions list", async () => {
    dbReturns([]);

    const { processExpiredSubscriptions } = await import("../jobs/subscription-cron.js");
    const result = await processExpiredSubscriptions();

    expect(result.expiredCount).toBe(0);
    expect(result.renewedCount).toBe(0);
  });
});

describe("deposit-retry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbChain();
    dbReturns([]);
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue("OK");
    mockRedis.get.mockResolvedValue(null);
  });

  it("retries a pending houdini deposit successfully", async () => {
    let callCount = 0;
    mockDb.then = (resolve: any) => resolve(
      [[{ id: "dep-1", userId: "user-1", type: "houdini_swap", houdiniId: "houdini-abc", status: "pending", amountUsd: "50", txHash: null, createdAt: new Date() }]][callCount++] ?? []
    );

    mockGetOrder.mockResolvedValue({ status: "FINISHED", transactionHash: "0xtx1", toAmount: "50000000" });
    mockCompleteHoudiniDeposit.mockResolvedValue({ creditsCents: 50000000 });

    const { retryFailedDeposits } = await import("../jobs/deposit-retry.js");
    const results = await retryFailedDeposits();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].creditsProcessed).toBe(50000000);
  });

  it("marks deposit as failed when houdini order is FAILED", async () => {
    let callCount = 0;
    mockDb.then = (resolve: any) => resolve(
      [
        [{ id: "dep-2", userId: "user-1", type: "houdini_swap", houdiniId: "houdini-fail", status: "pending", amountUsd: "25", txHash: null, createdAt: new Date() }],
        [],
      ][callCount++] ?? []
    );

    mockGetOrder.mockResolvedValue({ status: "FAILED", transactionHash: null, toAmount: "0" });

    const { retryFailedDeposits } = await import("../jobs/deposit-retry.js");
    const results = await retryFailedDeposits();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("FAILED");
  });

  it("respects max retry attempts via redis", async () => {
    let callCount = 0;
    mockDb.then = (resolve: any) => resolve(
      [[{ id: "dep-3", userId: "user-1", type: "houdini_swap", houdiniId: "houdini-max", status: "pending", amountUsd: "10", txHash: null, createdAt: new Date() }]][callCount++] ?? []
    );

    mockRedis.incr.mockResolvedValue(4);

    const { retryFailedDeposits } = await import("../jobs/deposit-retry.js");
    const results = await retryFailedDeposits();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toBe("Max retry attempts exceeded");
    expect(mockGetOrder).not.toHaveBeenCalled();
  });

  it("handles houdini order still pending", async () => {
    let callCount = 0;
    mockDb.then = (resolve: any) => resolve(
      [[{ id: "dep-4", userId: "user-1", type: "houdini_swap", houdiniId: "houdini-pending", status: "pending", amountUsd: "10", txHash: null, createdAt: new Date() }]][callCount++] ?? []
    );

    mockGetOrder.mockResolvedValue({ status: "EXCHANGING", transactionHash: null, toAmount: "0" });

    const { retryFailedDeposits } = await import("../jobs/deposit-retry.js");
    const results = await retryFailedDeposits();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("still pending");
  });

  it("handles unknown deposit type", async () => {
    let callCount = 0;
    mockDb.then = (resolve: any) => resolve(
      [[{ id: "dep-5", userId: "user-1", type: "lifi_swap", houdiniId: null, status: "pending", amountUsd: "15", txHash: null, createdAt: new Date() }]][callCount++] ?? []
    );

    const { retryFailedDeposits } = await import("../jobs/deposit-retry.js");
    const results = await retryFailedDeposits();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("Unknown deposit type");
  });

  it("retries a CCTP deposit (returns pending status)", async () => {
    let callCount = 0;
    mockDb.then = (resolve: any) => resolve(
      [[{ id: "dep-6", userId: "user-1", type: "cctp_crosschain", houdiniId: null, txHash: "0xabcdef", status: "pending", amountUsd: "100", createdAt: new Date() }]][callCount++] ?? []
    );

    const { retryFailedDeposits } = await import("../jobs/deposit-retry.js");
    const results = await retryFailedDeposits();

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
    expect(results[0].error).toContain("CCTP deposit pending");
  });

  it("expireStaleDeposits marks old pending deposits as expired", async () => {
    let callCount = 0;
    const responses = [
      [
        { id: "stale-1", status: "pending", createdAt: new Date(Date.now() - 2 * 3600_000) },
        { id: "stale-2", status: "pending", createdAt: new Date(Date.now() - 2 * 3600_000) },
      ],
      [],
      [],
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    const { expireStaleDeposits } = await import("../jobs/deposit-retry.js");
    const count = await expireStaleDeposits();

    expect(count).toBe(2);
  });

  it("getDepositRetryStatus returns correct info from redis", async () => {
    mockRedis.get.mockResolvedValue("2");

    const { getDepositRetryStatus } = await import("../jobs/deposit-retry.js");
    const status = await getDepositRetryStatus("dep-1");

    expect(status).toEqual({
      attempts: 2,
      canRetry: true,
      nextRetryAt: expect.any(Date),
      status: "in_progress",
    });
  });

  it("getDepositRetryStatus returns max attempts exceeded", async () => {
    mockRedis.get.mockResolvedValue("3");

    const { getDepositRetryStatus } = await import("../jobs/deposit-retry.js");
    const status = await getDepositRetryStatus("dep-1");

    expect(status?.canRetry).toBe(false);
    expect(status?.status).toBe("max_attempts_exceeded");
  });

  it("getDepositRetryStatus returns null when redis unavailable", async () => {
    const { getRedisClient } = await import("../lib/redis-client.js");
    (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const { getDepositRetryStatus } = await import("../jobs/deposit-retry.js");
    const status = await getDepositRetryStatus("dep-1");

    expect(status).toBeNull();
  });

  it("resetDepositRetry deletes the retry key", async () => {
    const { resetDepositRetry } = await import("../jobs/deposit-retry.js");
    const result = await resetDepositRetry("dep-1");

    expect(result).toBe(true);
    expect(mockRedis.del).toHaveBeenCalledWith("deposit:retry:dep-1");
  });

  it("resetDepositRetry returns false when redis unavailable", async () => {
    const { getRedisClient } = await import("../lib/redis-client.js");
    (getRedisClient as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const { resetDepositRetry } = await import("../jobs/deposit-retry.js");
    const result = await resetDepositRetry("dep-1");

    expect(result).toBe(false);
  });
});

describe("deposit-recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbChain();
    dbReturns([]);
    mockGetTransactionReceipt.mockResolvedValue({ status: "success", logs: [] });
  });

  it("initiateRecovery returns error when user not found", async () => {
    dbReturns([]);

    const { initiateRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await initiateRecovery("user-1", "0xhash1", "0xhash2");

    expect(result.success).toBe(false);
    expect(result.error).toBe("User not found");
  });

  it("initiateRecovery succeeds with valid user and transaction", async () => {
    const USDC_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const amount50USDC = BigInt(50_000000); // 50 * 10^6
    mockGetTransactionReceipt.mockResolvedValueOnce({
      status: "success",
      logs: [
        {
          address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          topics: [USDC_TRANSFER_TOPIC],
          data: "0x" + amount50USDC.toString(16).padStart(64, "0"),
        },
      ],
    });

    // Sequence: 1) user lookup (db.then), 2) insert returning (db.returning)
    dbReturnsSequence(
      [{ id: "user-1", address: "0xaddr" }],  // select().from().where().limit(1)
      [{ id: "recovery-1" }],                   // insert().values().returning()
    );

    const { initiateRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await initiateRecovery("user-1", "0xhash1", "0xhash2");

    expect(result.success).toBe(true);
    expect(result.recoveryDepositId).toBe("recovery-1");
    expect(result.creditsRecovered).toBe(5000); // $50 * 100
  });

  it("initiateRecovery fails when receipt has zero amount", async () => {
    mockGetTransactionReceipt.mockResolvedValueOnce({ status: "success", logs: [] });
    dbReturns([{ id: "user-1", address: "0xaddr" }]);

    const { initiateRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await initiateRecovery("user-1", "0xhash1", "0xhash2");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid deposit amount");
  });

  it("initiateRecovery fails when original tx failed", async () => {
    mockGetTransactionReceipt.mockResolvedValueOnce({ status: "reverted", logs: [] });
    dbReturns([{ id: "user-1", address: "0xaddr" }]);

    const { initiateRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await initiateRecovery("user-1", "0xhash1", "0xhash2");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Original transaction failed");
  });

  it("completeRecovery fails when recovery not found", async () => {
    dbReturns([]);

    const { completeRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await completeRecovery("recovery-missing", "admin-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Recovery request not found");
  });

  it("completeRecovery fails when already processed", async () => {
    dbReturns([{ id: "recovery-1", status: "completed", amountUsd: "100" }]);

    const { completeRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await completeRecovery("recovery-1", "admin-1");

    expect(result.success).toBe(false);
    expect(result.error).toBe("Recovery already processed");
  });

  it("completeRecovery succeeds for pending recovery", async () => {
    let callCount = 0;
    const responses = [
      [{ id: "recovery-1", status: "pending", amountUsd: "50.00", userId: "user-1", recoveryTxHash: "0xrec" }],
      [{ id: "new-deposit" }],
      [],
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    const { completeRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await completeRecovery("recovery-1", "admin-1");

    expect(result.success).toBe(true);
    expect(result.creditsRecovered).toBe(5000);
  });

  it("rejectRecovery returns true when record exists", async () => {
    dbReturns([{ id: "recovery-1" }]);

    const { rejectRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await rejectRecovery("recovery-1", "invalid tx");

    expect(result).toBe(true);
  });

  it("rejectRecovery returns false when no record matched", async () => {
    dbReturns([]);

    const { rejectRecovery } = await import("../jobs/deposit-recovery.js");
    const result = await rejectRecovery("recovery-missing", "reason");

    expect(result).toBe(false);
  });

  it("scheduleWrongNetworkRecovery starts when redis available", async () => {
    vi.useFakeTimers();
    try {
      const { scheduleWrongNetworkRecovery } = await import("../jobs/deposit-recovery.js");
      await scheduleWrongNetworkRecovery();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("deposit-notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDbChain();
    dbReturns([]);
    global.fetch = vi.fn().mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifyDepositUpdate sends webhook for active subscriptions", async () => {
    let callCount = 0;
    const responses = [
      [{ id: "wh-sub-1", userId: "user-1", url: "https://example.com/hook", event: "deposit.completed", active: true, notificationCount: 0 }],
      [{ id: "dep-1", userId: "user-1", type: "houdini_swap", status: "completed", amountUsd: "100", creditsIssued: "10000", txHash: "0xabc" }],
      [],
      [],
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    const { notifyDepositUpdate } = await import("../jobs/deposit-notifications.js");
    await notifyDepositUpdate("user-1", "dep-1", "deposit.completed");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("notifyDepositUpdate does nothing when no subscriptions exist", async () => {
    dbReturns([]);

    const { notifyDepositUpdate } = await import("../jobs/deposit-notifications.js");
    await notifyDepositUpdate("user-1", "dep-1", "deposit.completed");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("notifyDepositUpdate skips when deposit not found", async () => {
    let callCount = 0;
    const responses = [
      [{ id: "wh-sub-1", userId: "user-1", url: "https://hook.test", event: "all", active: true, notificationCount: 0 }],
      [], // deposit not found
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    const { notifyDepositUpdate } = await import("../jobs/deposit-notifications.js");
    await notifyDepositUpdate("user-1", "dep-missing", "deposit.completed");

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("notifyDepositUpdate handles webhook failure gracefully", async () => {
    let callCount = 0;
    const responses = [
      [{ id: "wh-sub-2", userId: "user-1", url: "https://bad.test", event: "deposit.failed", active: true, notificationCount: 0 }],
      [{ id: "dep-2", type: "usdc_direct", status: "failed", amountUsd: "25", creditsIssued: "0", txHash: null }],
      [],
    ];
    mockDb.then = (resolve: any) => resolve(responses[callCount++] ?? []);

    // 400 = client error, no retry (500 would trigger retries with backoff)
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400 });

    const { notifyDepositUpdate } = await import("../jobs/deposit-notifications.js");
    await notifyDepositUpdate("user-1", "dep-2", "deposit.failed");

    expect(mockDb.update).toHaveBeenCalled();
  });

  it("registerWebhookSubscription creates a new subscription", async () => {
    dbReturns([{ id: "new-wh-id" }]);

    const { registerWebhookSubscription } = await import("../jobs/deposit-notifications.js");
    const result = await registerWebhookSubscription("user-1", "https://hook.test", ["deposit.completed"]);

    expect(result.id).toBe("new-wh-id");
  });

  it("deleteWebhookSubscription returns true when deleted", async () => {
    dbReturns([{ id: "wh-sub-1" }]);

    const { deleteWebhookSubscription } = await import("../jobs/deposit-notifications.js");
    const result = await deleteWebhookSubscription("user-1", "wh-sub-1");

    expect(result).toBe(true);
  });

  it("deleteWebhookSubscription returns false when no match", async () => {
    dbReturns([]);

    const { deleteWebhookSubscription } = await import("../jobs/deposit-notifications.js");
    const result = await deleteWebhookSubscription("user-1", "wh-missing");

    expect(result).toBe(false);
  });

  it("scheduleDepositNotifications starts when redis available", async () => {
    vi.useFakeTimers();
    try {
      dbReturns([]);
      const { scheduleDepositNotifications } = await import("../jobs/deposit-notifications.js");
      await scheduleDepositNotifications();
    } finally {
      vi.useRealTimers();
    }
  });
});
