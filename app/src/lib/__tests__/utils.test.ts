import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import {
	toDollars,
	formatTime,
	maskKey,
	formatUsd,
	formatAddress,
	formatDateTime,
} from "../utils";

describe("toDollars", () => {
	it("converts cents to dollar number", () => {
		expect(toDollars(100)).toBe(1);
		expect(toDollars("250")).toBe(2.5);
	});
	it("returns 0 for null/undefined", () => {
		expect(toDollars(null)).toBe(0);
		expect(toDollars(undefined)).toBe(0);
	});
	it("returns 0 for non-finite input", () => {
		expect(toDollars(NaN)).toBe(0);
		expect(toDollars(Infinity)).toBe(0);
	});
});

describe("formatTime", () => {
	const now = new Date("2026-07-18T12:00:00Z");
	beforeAll(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});
	afterAll(() => {
		vi.useRealTimers();
	});
	it("returns 'just now' for <1 min ago", () => {
		expect(formatTime(new Date(now.getTime() - 30_000).toISOString())).toBe("just now");
	});
	it("returns minutes ago", () => {
		expect(formatTime(new Date(now.getTime() - 5 * 60_000).toISOString())).toBe("5m ago");
	});
	it("returns hours ago", () => {
		expect(formatTime(new Date(now.getTime() - 3 * 60 * 60_000).toISOString())).toBe("3h ago");
	});
	it("returns days ago for <30 days", () => {
		expect(formatTime(new Date(now.getTime() - 5 * 24 * 60 * 60_000).toISOString())).toBe("5d ago");
	});
	it("returns '—' for invalid input", () => {
		expect(formatTime("not-a-date")).toBe("—");
	});
});

describe("maskKey", () => {
	it("masks with prefix and ****", () => {
		expect(maskKey("oma_live_abc")).toBe("oma_live_abc****");
	});
	it("returns placeholder for null/undefined", () => {
		expect(maskKey(null)).toBe("••••****");
		expect(maskKey(undefined)).toBe("••••****");
		expect(maskKey("")).toBe("••••****");
	});
});

describe("formatUsd", () => {
	it("formats with $ prefix and 2 decimals by default", () => {
		expect(formatUsd(0.017)).toBe("$0.02");
		expect(formatUsd(100)).toBe("$100.00");
	});
	it("supports custom decimals", () => {
		expect(formatUsd(1.2345, 4)).toBe("$1.2345");
	});
});

describe("formatAddress", () => {
	it("shortens long EVM addresses", () => {
		expect(formatAddress("0x1234567890abcdef1234567890abcdef12345678")).toBe("0x1234…5678");
	});
	it("returns short addresses unchanged", () => {
		expect(formatAddress("0x12345")).toBe("0x12345");
	});
	it("returns '—' for null/undefined", () => {
		expect(formatAddress(null)).toBe("—");
		expect(formatAddress(undefined)).toBe("—");
	});
});

describe("formatDateTime", () => {
	it("formats ISO with date and time", () => {
		const formatted = formatDateTime("2026-01-15T10:30:00Z");
		expect(formatted).toMatch(/2026/);
		// Time may be UTC or local depending on env, just check format contains digits and AM/PM or 24h format
		expect(formatted).toMatch(/\d{1,2}:\d{2}/);
		expect(formatted).toMatch(/(AM|PM|\d{2})/);
	});
});