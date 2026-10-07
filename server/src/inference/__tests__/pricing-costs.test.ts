import { describe, expect, it } from "vitest";
import { calculateUsageCosts } from "../pricing-costs.js";

describe("customer charges and estimated provider costs", () => {
  it("keeps wholesale costs separate from a final customer override", () => {
    expect(calculateUsageCosts({ inputPer1M: 4, outputPer1M: 8, markup: 0,
      upstream: { inputPer1M: 1, outputPer1M: 2 } }, 1_000_000, 1_000_000))
      .toEqual({ upstreamCostCents: 300, userCostCents: 1200, markupCents: 900 });
  });
  it("applies 500% markup to the GNK-derived cost, not a retail reference", () => {
    const result = calculateUsageCosts({ inputPer1M: 0.0033, outputPer1M: 0.0033, markup: 500 }, 1_000_000, 0);
    expect(result.userCostCents).toBeCloseTo(1.98);
    expect(result.markupCents).toBeCloseTo(1.65);
  });
  it("charges exactly two cents per million Gonka tokens", () => {
    const result = calculateUsageCosts({ inputPer1M: 0.02, outputPer1M: 0.02, markup: 0, upstream: { inputPer1M: 0.0033, outputPer1M: 0.0033 } }, 500_000, 500_000);
    expect(result.userCostCents).toBe(2);
    expect(result.upstreamCostCents).toBeCloseTo(0.33);
  });
  it("uses extended-context rates above the upstream threshold", () => {
    const result = calculateUsageCosts({ inputPer1M: 5, outputPer1M: 25, markup: 50,
      extended: { threshold: 272000, inputPer1M: 10, outputPer1M: 37.5 } }, 300_000, 1000);
    expect(result.upstreamCostCents).toBeCloseTo(303.75);
    expect(result.userCostCents).toBeCloseTo(455.625);
  });
});
