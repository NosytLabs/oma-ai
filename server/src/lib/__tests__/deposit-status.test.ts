import { describe, expect, it } from "vitest";
import {
	canTransitionDepositStatus,
	DEPOSIT_STATUS,
	DEPOSIT_STATUSES,
	DEPOSIT_STATUS_TRANSITIONS,
	isPendingDepositStatus,
	isTerminalDepositStatus,
	parseDepositStatus,
} from "../deposit-status.js";

describe("deposit status vocabulary", () => {
	it("lists every status the deposit_status enum allows", () => {
		expect([...DEPOSIT_STATUSES]).toEqual([
			"pending",
			"settling",
			"completed",
			"failed",
			"expired",
			"refunded",
		]);
	});

	it("parses known statuses and rejects anything else", () => {
		expect(parseDepositStatus("completed")).toBe(DEPOSIT_STATUS.Completed);
		expect(parseDepositStatus("refunded")).toBe(DEPOSIT_STATUS.Refunded);
		expect(parseDepositStatus("minted")).toBeNull();
		expect(parseDepositStatus(null)).toBeNull();
		expect(parseDepositStatus(42)).toBeNull();
	});

	it("separates decided deposits from in-flight ones", () => {
		expect(isTerminalDepositStatus(DEPOSIT_STATUS.Completed)).toBe(true);
		expect(isTerminalDepositStatus(DEPOSIT_STATUS.Refunded)).toBe(true);
		expect(isTerminalDepositStatus(DEPOSIT_STATUS.Failed)).toBe(true);
		expect(isTerminalDepositStatus(DEPOSIT_STATUS.Expired)).toBe(true);
		expect(isTerminalDepositStatus(DEPOSIT_STATUS.Pending)).toBe(false);
		expect(isPendingDepositStatus(DEPOSIT_STATUS.Settling)).toBe(true);
		expect(isPendingDepositStatus(DEPOSIT_STATUS.Completed)).toBe(false);
	});

	it("only allows a completed deposit to be refunded", () => {
		expect(canTransitionDepositStatus(DEPOSIT_STATUS.Completed, DEPOSIT_STATUS.Refunded)).toBe(true);
		expect(canTransitionDepositStatus(DEPOSIT_STATUS.Pending, DEPOSIT_STATUS.Completed)).toBe(true);
		expect(canTransitionDepositStatus(DEPOSIT_STATUS.Pending, DEPOSIT_STATUS.Refunded)).toBe(false);
		expect(canTransitionDepositStatus(DEPOSIT_STATUS.Failed, DEPOSIT_STATUS.Completed)).toBe(false);
		expect(canTransitionDepositStatus(DEPOSIT_STATUS.Refunded, DEPOSIT_STATUS.Completed)).toBe(false);
	});

	it("gives every status a transition entry", () => {
		for (const status of DEPOSIT_STATUSES) {
			expect(DEPOSIT_STATUS_TRANSITIONS[status]).toBeDefined();
		}
	});
});
