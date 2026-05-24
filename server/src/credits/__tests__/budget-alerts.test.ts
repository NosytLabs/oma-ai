import { describe, it, expect } from "vitest";
import {
  DEFAULT_THRESHOLDS,
  type BudgetThreshold,
} from "../budget-alerts.js";

describe("budget-alerts", () => {
  describe("DEFAULT_THRESHOLDS", () => {
    it("should have 50, 75, 90, 100 as default thresholds", () => {
      expect(DEFAULT_THRESHOLDS).toEqual([50, 75, 90, 100]);
    });
  });

  describe("BudgetThreshold type", () => {
    it("should accept valid threshold values", () => {
      const threshold: BudgetThreshold = 50;
      expect(threshold).toBe(50);
    });

    it("should accept all valid threshold values", () => {
      const thresholds: BudgetThreshold[] = [50, 75, 90, 100];
      expect(thresholds).toEqual([50, 75, 90, 100]);
    });
  });
});