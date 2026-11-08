import { describe, expect, it } from "vitest";
import {
	USAGE_STATUS,
	USAGE_STATUSES,
	isBillableUsageStatus,
	isFailureUsageStatus,
	parseUsageStatus,
	usageStatusLabel,
	usageStatusTone,
} from "../usage-status";

describe("usage status vocabulary", () => {
	it("knows exactly four statuses", () => {
		expect(USAGE_STATUSES).toEqual(["completed", "free_tier", "error", "aborted"]);
	});

	it("parses known statuses and rejects unknown ones", () => {
		expect(parseUsageStatus("completed")).toBe(USAGE_STATUS.Completed);
		expect(parseUsageStatus("free_tier")).toBe(USAGE_STATUS.FreeTier);
		expect(parseUsageStatus("nonsense")).toBeNull();
		expect(parseUsageStatus(undefined)).toBeNull();
		expect(parseUsageStatus(42)).toBeNull();
	});

	it("treats only a completed request as billable", () => {
		expect(isBillableUsageStatus(USAGE_STATUS.Completed)).toBe(true);
		expect(isBillableUsageStatus(USAGE_STATUS.FreeTier)).toBe(false);
		expect(isBillableUsageStatus(USAGE_STATUS.Error)).toBe(false);
		expect(isBillableUsageStatus(USAGE_STATUS.Aborted)).toBe(false);
	});

	it("separates a failure from a cancel", () => {
		expect(isFailureUsageStatus(USAGE_STATUS.Error)).toBe(true);
		expect(isFailureUsageStatus(USAGE_STATUS.Aborted)).toBe(false);
	});

	it("labels every known status and never claims an unknown one succeeded", () => {
		expect(usageStatusLabel(USAGE_STATUS.Completed)).toBe("Completed");
		expect(usageStatusLabel(USAGE_STATUS.FreeTier)).toBe("Free chat");
		expect(usageStatusLabel(USAGE_STATUS.Error)).toBe("Error");
		expect(usageStatusLabel(USAGE_STATUS.Aborted)).toBe("Canceled");
		expect(usageStatusLabel("something_new")).toBe("Unknown");
	});

	it("gives every known status a tone", () => {
		expect(usageStatusTone(USAGE_STATUS.Completed)).toBe("success");
		expect(usageStatusTone(USAGE_STATUS.Error)).toBe("danger");
		expect(usageStatusTone(USAGE_STATUS.Aborted)).toBe("muted");
		expect(usageStatusTone(USAGE_STATUS.FreeTier)).toBe("muted");
	});
});
