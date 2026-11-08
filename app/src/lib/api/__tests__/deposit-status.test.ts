import { describe, expect, it } from "vitest";
import {
	DEPOSIT_STATUS,
	DEPOSIT_STATUSES,
	depositStatusLabel,
	depositStatusTone,
	isPendingDepositStatus,
	isTerminalDepositStatus,
	parseDepositStatus,
} from "../deposit-status.js";

describe("deposit status (client)", () => {
	it("mirrors the server vocabulary", () => {
		expect([...DEPOSIT_STATUSES]).toEqual([
			"pending",
			"settling",
			"completed",
			"failed",
			"expired",
			"refunded",
		]);
	});

	it("never renders an unknown status as a success", () => {
		expect(depositStatusLabel("minted")).toBe("Unknown");
		expect(depositStatusTone("minted")).toBe("muted");
		expect(depositStatusLabel(null)).toBe("Unknown");
		expect(depositStatusTone(undefined)).toBe("muted");
	});

	it("labels and tones every known status", () => {
		expect(depositStatusLabel(DEPOSIT_STATUS.Completed)).toBe("Completed");
		expect(depositStatusLabel(DEPOSIT_STATUS.Settling)).toBe("Confirming");
		expect(depositStatusTone(DEPOSIT_STATUS.Completed)).toBe("success");
		expect(depositStatusTone(DEPOSIT_STATUS.Pending)).toBe("warning");
		expect(depositStatusTone(DEPOSIT_STATUS.Failed)).toBe("error");
		expect(depositStatusTone(DEPOSIT_STATUS.Refunded)).toBe("muted");
	});

	it("parses known statuses only", () => {
		expect(parseDepositStatus("expired")).toBe(DEPOSIT_STATUS.Expired);
		expect(parseDepositStatus("settled")).toBeNull();
	});

	it("separates decided deposits from in-flight ones", () => {
		expect(isTerminalDepositStatus(DEPOSIT_STATUS.Completed)).toBe(true);
		expect(isTerminalDepositStatus(DEPOSIT_STATUS.Pending)).toBe(false);
		expect(isPendingDepositStatus(DEPOSIT_STATUS.Settling)).toBe(true);
	});
});
