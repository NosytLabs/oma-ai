import { describe, expect, it, beforeEach, vi } from "vitest";
import {
	freeLeftLabel,
	GUEST_DAILY_LIMIT_DEFAULT,
	GUEST_QUOTA_STORAGE_KEY,
	quotaFromHeaders,
	quotaFromServer,
	readStoredGuestQuota,
	writeStoredGuestQuota,
} from "../guest-daily-quota";

describe("quotaFromServer", () => {
	it("uses remaining + limit from 429 daily_limit_exceeded body", () => {
		const q = quotaFromServer({
			remaining: 0,
			limit: 20,
			code: "daily_limit_exceeded",
		});
		expect(q.remaining).toBe(0);
		expect(q.limit).toBe(20);
		expect(freeLeftLabel(q)).toBe(0);
	});

	it("derives remaining from used when remaining omitted", () => {
		const q = quotaFromServer({ used: 7, limit: 20 });
		expect(q.remaining).toBe(13);
	});

	it("forces remaining 0 when code is daily_limit_exceeded even without remaining", () => {
		const q = quotaFromServer({ code: "daily_limit_exceeded", limit: 20 });
		expect(q.remaining).toBe(0);
	});
});

describe("quotaFromHeaders", () => {
	it("reads X-DailyLimit-Remaining / Limit", () => {
		const h = new Headers({
			"X-DailyLimit-Remaining": "3",
			"X-DailyLimit-Limit": "20",
		});
		const q = quotaFromHeaders(h);
		expect(q).toEqual(
			expect.objectContaining({ remaining: 3, limit: 20 }),
		);
	});

	it("returns null when remaining header missing", () => {
		expect(quotaFromHeaders(new Headers())).toBeNull();
	});
});

describe("freeLeftLabel", () => {
	it("defaults to full guest budget when quota unknown", () => {
		expect(freeLeftLabel(null)).toBe(GUEST_DAILY_LIMIT_DEFAULT);
	});

	it("never shows negative free left", () => {
		expect(
			freeLeftLabel({ remaining: -2, limit: 20, date: "2099-01-01" }),
		).toBe(0);
	});
});

describe("localStorage guest quota cache", () => {
	beforeEach(() => {
		const store = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			getItem: (k: string) => store.get(k) ?? null,
			setItem: (k: string, v: string) => {
				store.set(k, v);
			},
			removeItem: (k: string) => {
				store.delete(k);
			},
		});
	});

	it("round-trips remaining without optimistic count inflation", () => {
		writeStoredGuestQuota({
			remaining: 0,
			limit: 20,
			date: new Date().toISOString().slice(0, 10),
		});
		const q = readStoredGuestQuota();
		expect(q?.remaining).toBe(0);
		expect(freeLeftLabel(q)).toBe(0);
		const raw = JSON.parse(
			localStorage.getItem(GUEST_QUOTA_STORAGE_KEY) as string,
		);
		// Legacy count = used messages, not remaining
		expect(raw.count).toBe(20);
	});

	it("reads legacy { date, count } shape as used messages", () => {
		const date = new Date().toISOString().slice(0, 10);
		localStorage.setItem(
			GUEST_QUOTA_STORAGE_KEY,
			JSON.stringify({ date, count: 19 }),
		);
		const q = readStoredGuestQuota();
		// Old client stored count as "messages sent" — free left = 20 - 19 = 1
		expect(q?.remaining).toBe(1);
	});
});
