import { afterEach, describe, expect, it, vi } from "vitest";
import { deposit } from "../deposit";

afterEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
describe("payment update acknowledgments", () => {
	it("dates a completed update by its confirmation rather than an old pending creation", async () => {
		const completedAt = "2026-10-13T19:00:00Z";
		vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ deposits: [{
			id: "de09fad9-6495-43db-b57c-a82c11744737", status: "completed", amountUsd: "25.00000000",
			creditsIssued: "2500", txHash: null, createdAt: "2026-10-10T19:00:00Z", completedAt,
		}] }));
		expect((await deposit.getNotifications("account-a")).notifications[0].createdAt).toBe(completedAt);
	});
	it("a new status is unread even after acknowledging the previous status", async () => {
		let status = "pending";
		vi.spyOn(globalThis, "fetch").mockImplementation(async () => Response.json({ deposits: [{
			id: "de09fad9-6495-43db-b57c-a82c11744737", status, amountUsd: "25.00000000", creditsIssued: "0", txHash: null, createdAt: "2026-10-13T19:00:00Z",
		}] }));
		const initial = (await deposit.getNotifications("account-a")).notifications[0];
		await deposit.markNotificationRead(initial.id, "account-a");
		expect((await deposit.getNotifications("account-a")).notifications[0].notifiedAt).not.toBeNull();
		status = "completed";
		const updated = (await deposit.getNotifications("account-a")).notifications[0];
		expect(updated.notifiedAt).toBeNull();
		expect(updated.id).not.toBe(initial.id);
	});
});
