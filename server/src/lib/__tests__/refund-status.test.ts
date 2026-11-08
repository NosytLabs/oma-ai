import { describe, expect, it } from "vitest";
import {
	canTransitionRefundStatus,
	isTerminalRefundStatus,
	parseRefundStatus,
	REFUND_DECISIONS,
	REFUND_STATUS,
	REFUND_STATUSES,
} from "../refund-status.js";

describe("refund status vocabulary", () => {
	it("matches the refund_status enum", () => {
		expect([...REFUND_STATUSES]).toEqual(["pending", "granted", "denied"]);
		expect([...REFUND_DECISIONS]).toEqual(["granted", "denied"]);
	});

	it("parses known statuses only", () => {
		expect(parseRefundStatus("granted")).toBe(REFUND_STATUS.Granted);
		expect(parseRefundStatus("approved")).toBeNull();
	});

	it("treats a decision as terminal", () => {
		expect(isTerminalRefundStatus(REFUND_STATUS.Pending)).toBe(false);
		expect(isTerminalRefundStatus(REFUND_STATUS.Granted)).toBe(true);
		expect(isTerminalRefundStatus(REFUND_STATUS.Denied)).toBe(true);
	});

	it("only allows a pending refund to be decided, once", () => {
		expect(canTransitionRefundStatus(REFUND_STATUS.Pending, REFUND_STATUS.Granted)).toBe(true);
		expect(canTransitionRefundStatus(REFUND_STATUS.Pending, REFUND_STATUS.Denied)).toBe(true);
		expect(canTransitionRefundStatus(REFUND_STATUS.Granted, REFUND_STATUS.Denied)).toBe(false);
		expect(canTransitionRefundStatus(REFUND_STATUS.Denied, REFUND_STATUS.Granted)).toBe(false);
	});
});
