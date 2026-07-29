import { describe, it, expect, beforeEach } from "vitest";
import {
  recordFailover,
  getRouterStats,
  __resetRouterStatsForTests,
} from "../inference/cross-provider-router.js";

describe("recordFailover + getRouterStats", () => {
  beforeEach(() => {
    __resetRouterStatsForTests();
  });

  it("starts at zero across all providers after reset", () => {
    const stats = getRouterStats();
    expect(stats.totalRequests).toBe(0);
    expect(stats.failoverCount).toBe(0);
    // venice + surplus + gonka seeded at zero
    expect(stats.byProvider.venice.attempts).toBe(0);
    expect(stats.byProvider.venice.failovers).toBe(0);
    expect(stats.byProvider.surplus.attempts).toBe(0);
    expect(stats.byProvider.gonka.attempts).toBe(0);
  });

  it("single failover: bumps totalRequests + failoverCount by 1 each", () => {
    recordFailover({
      modelId: "m1",
      fromProvider: "venice",
      toProvider: "surplus",
      latencyMs: 100,
    });
    const stats = getRouterStats();
    expect(stats.totalRequests).toBe(1);
    expect(stats.failoverCount).toBe(1);
    expect(stats.byProvider.venice.attempts).toBe(1);
    expect(stats.byProvider.venice.failovers).toBe(1);
    // toProvider increments attempts (it'll be retried), not failovers
    expect(stats.byProvider.surplus.attempts).toBe(1);
    expect(stats.byProvider.surplus.failovers).toBe(0);
    // untouched providers stay zero
    expect(stats.byProvider.gonka.attempts).toBe(0);
  });

  it("multiple failovers accumulate correctly", () => {
    recordFailover({ modelId: "a", fromProvider: "venice", toProvider: "surplus", latencyMs: 50 });
    recordFailover({ modelId: "b", fromProvider: "venice", toProvider: "gonka", latencyMs: 60 });
    recordFailover({ modelId: "c", fromProvider: "surplus", toProvider: "gonka", latencyMs: 70 });
    const stats = getRouterStats();
    expect(stats.totalRequests).toBe(3);
    expect(stats.failoverCount).toBe(3);
    expect(stats.byProvider.venice.attempts).toBe(2);
    expect(stats.byProvider.venice.failovers).toBe(2);
    expect(stats.byProvider.surplus.attempts).toBe(2); // once as from, once as to
    expect(stats.byProvider.surplus.failovers).toBe(1);
    expect(stats.byProvider.gonka.attempts).toBe(2);
    // gonka was never the from-provider, so its failovers counter is 0
    // even though it was the destination of two failovers.
    expect(stats.byProvider.gonka.failovers).toBe(0);
  });

  it("getRouterStats returns a defensive copy — mutating result doesn't leak", () => {
    recordFailover({ modelId: "x", fromProvider: "venice", toProvider: "surplus", latencyMs: 10 });
    const snap = getRouterStats();
    const snapVeniceAttempts = snap.byProvider.venice.attempts;
    // Mutate the snapshot
    snap.byProvider.venice.attempts = 9999;
    snap.totalRequests = 9999;
    // Next snapshot is unaffected
    const next = getRouterStats();
    expect(next.byProvider.venice.attempts).toBe(snapVeniceAttempts);
    expect(next.totalRequests).toBe(1);
  });

  it("__resetRouterStatsForTests clears all counters", () => {
    recordFailover({ modelId: "a", fromProvider: "venice", toProvider: "surplus", latencyMs: 10 });
    recordFailover({ modelId: "b", fromProvider: "surplus", toProvider: "gonka", latencyMs: 10 });
    expect(getRouterStats().totalRequests).toBe(2);
    __resetRouterStatsForTests();
    const stats = getRouterStats();
    expect(stats.totalRequests).toBe(0);
    expect(stats.failoverCount).toBe(0);
    expect(stats.byProvider.venice.attempts).toBe(0);
    expect(stats.byProvider.venice.failovers).toBe(0);
    expect(stats.byProvider.surplus.attempts).toBe(0);
    expect(stats.byProvider.gonka.attempts).toBe(0);
  });
});