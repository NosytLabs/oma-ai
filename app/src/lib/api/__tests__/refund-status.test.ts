import { describe, expect, it } from "vitest";
import {
	isTerminalRefundStatus,
	parseRefundStatus,
	REFUND_DECISIONS,
	REFUND_STATUS,
	REFUND_STATUSES,
	refundStatusLabel,
	refundStatusTone,
} from "../refund-status.js";

describe("refund status (client)", () => {
	it("mirrors the server vocabulary", () => {
		expect([...REFUND_STATUSES]).toEqual(["pending", "granted", "denied"]);
		expect([...REFUND_DECISIONS]).toEqual(["granted", "denied"]);
	});

	it("parses known statuses only", () => {
		expect(parseRefundStatus("granted")).toBe(REFUND_STATUS.Granted);
		expect(parseRefundStatus("approved")).toBeNull();
		expect(parseRefundStatus(undefined)).toBeNull();
	});

	it("never renders an unknown status as a decision", () => {
		expect(refundStatusLabel("mystery")).toBe("Unknown");
		expect(refundStatusTone("mystery")).toBe("muted");
		expect(refundStatusTone(null)).toBe("muted");
	});

	it("knows which statuses are terminal", () => {
		expect(isTerminalRefundStatus(REFUND_STATUS.Pending)).toBe(false);
		expect(isTerminalRefundStatus(REFUND_STATUS.Granted)).toBe(true);
		expect(isTerminalRefundStatus(REFUND_STATUS.Denied)).toBe(true);
	});
});
