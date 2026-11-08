import { describe, expect, it, vi } from "vitest";
import {
	INFERENCE_PHASE,
	USAGE_STATUS,
	USAGE_STATUSES,
	isAbortedUsageStatus,
	isBillableUsageStatus,
	isFailureUsageStatus,
	isTerminalUsageStatus,
	normalizeUsageStatus,
	parseUsageStatus,
	toStoredUsageStatus,
} from "../usage-status.js";

describe("usage status lifecycle", () => {
	it("declares every stored status exactly once", () => {
		expect(USAGE_STATUSES).toEqual(["completed", "free_tier", "error", "aborted"]);
		expect(new Set(USAGE_STATUSES).size).toBe(USAGE_STATUSES.length);
	});

	it("promotes a completed free request to free_tier, and only that", () => {
		expect(toStoredUsageStatus(INFERENCE_PHASE.Completed, { freeTier: true })).toBe(
			USAGE_STATUS.FreeTier,
		);
		expect(toStoredUsageStatus(INFERENCE_PHASE.Completed)).toBe(USAGE_STATUS.Completed);
		// A failed free request is still a failure — it must not be laundered
		// into a successful free row.
		expect(toStoredUsageStatus(INFERENCE_PHASE.Error, { freeTier: true })).toBe(
			USAGE_STATUS.Error,
		);
		expect(toStoredUsageStatus(INFERENCE_PHASE.Aborted, { freeTier: true })).toBe(
			USAGE_STATUS.Aborted,
		);
	});

	it("knows which statuses are billable, failed, or aborted", () => {
		expect(isBillableUsageStatus(USAGE_STATUS.Completed)).toBe(true);
		expect(isBillableUsageStatus(USAGE_STATUS.FreeTier)).toBe(false);
		expect(isFailureUsageStatus(USAGE_STATUS.Error)).toBe(true);
		expect(isFailureUsageStatus(USAGE_STATUS.Aborted)).toBe(false);
		expect(isAbortedUsageStatus(USAGE_STATUS.Aborted)).toBe(true);
		expect(isAbortedUsageStatus(USAGE_STATUS.Error)).toBe(false);
	});

	it("treats every status as terminal — usage rows are written once", () => {
		for (const status of USAGE_STATUSES) expect(isTerminalUsageStatus(status)).toBe(true);
	});

	it("refuses to guess an unknown status", () => {
		expect(parseUsageStatus("completed")).toBe("completed");
		expect(parseUsageStatus("paid")).toBeNull();
		expect(parseUsageStatus(null)).toBeNull();
		expect(parseUsageStatus(7)).toBeNull();
	});

	it("reports an unknown status as an error and tells the caller", () => {
		const onUnknown = vi.fn();
		expect(normalizeUsageStatus("mystery", onUnknown)).toBe(USAGE_STATUS.Error);
		expect(onUnknown).toHaveBeenCalledWith("mystery");
		expect(normalizeUsageStatus("completed", onUnknown)).toBe(USAGE_STATUS.Completed);
		expect(onUnknown).toHaveBeenCalledTimes(1);
	});
});
