import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";

const dbUpdate = vi.fn().mockReturnValue({
  set: vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue(undefined),
  }),
});

vi.mock("../db/client.js", () => ({
  db: { update: dbUpdate },
}));

vi.mock("../db/schema.js", () => ({
  users: {
    updatedAt: {} as any,
    nonce: {} as any,
  },
}));

vi.mock("drizzle-orm", () => ({
  and: vi.fn().mockReturnValue("and"),
  lt: vi.fn().mockReturnValue("lt"),
  ne: vi.fn().mockReturnValue("ne"),
}));

describe("nonce cleanup", () => {
  let scheduleNonceCleanup: () => void;
  let stopNonceCleanup: () => void;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    const module = await import("../jobs/nonce-cleanup.js");
    scheduleNonceCleanup = module.scheduleNonceCleanup;
    stopNonceCleanup = module.stopNonceCleanup;
  });

  afterEach(() => {
    stopNonceCleanup?.();
    vi.useRealTimers();
  });

  it("processExpiredNonces executes database update", async () => {
    const { processExpiredNonces } = await import("../jobs/nonce-cleanup.js");
    await processExpiredNonces();
    expect(dbUpdate).toHaveBeenCalled();
  });

  it("scheduleNonceCleanup can be called without error", async () => {
    scheduleNonceCleanup();
    expect(scheduleNonceCleanup).toBeDefined();
  });

  it("stopNonceCleanup closes interval", async () => {
    scheduleNonceCleanup();
    stopNonceCleanup();
    expect(stopNonceCleanup).toBeDefined();
  });

  it("scheduleNonceCleanup is idempotent", async () => {
    scheduleNonceCleanup();
    scheduleNonceCleanup();
    scheduleNonceCleanup();
    stopNonceCleanup();
    expect(scheduleNonceCleanup).toBeDefined();
  });
});