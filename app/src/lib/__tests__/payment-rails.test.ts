import { describe, expect, it } from "vitest";
import { railByKey, railStatuses, type SitePaymentSettings } from "@/lib/payment-rails";

describe("railStatuses", () => {
	it.each([
		[{ paymentStatusAvailable: false, maintenanceMode: false }, "Unavailable"],
		[{ paymentStatusAvailable: true, maintenanceMode: true }, "Paused"],
	])("disables every payment option when the site cannot accept funding", (status, badge) => {
		const rails = railStatuses({
			...status, cardPaymentsEnabled: true, cryptoPaymentsEnabled: true,
			usdcDepositConfigured: true, polarConfigured: true, x402Configured: true,
		});
		expect(rails.map(rail => rail.badge)).toEqual([badge, badge, badge]);
		expect(rails.every(rail => !rail.actionable && rail.reason)).toBe(true);
	});

	it("shows unavailable for an unconfigured card provider even when the effective toggle is off", () => {
		const card = railByKey({ maintenanceMode: false, cardPaymentsEnabled: false, cryptoPaymentsEnabled: true, polarConfigured: false }, "card");
		expect(card.badge).toBe("Unavailable");
	});
	it("shows Checking while payment availability is loading", () => {
		const rails = railStatuses(null);
		expect(rails.map((r) => r.badge)).toEqual([
			"Checking…",
			"Checking…",
			"Checking…",
		]);
		expect(railByKey(null, "usdc").actionable).toBe(false);
		expect(railByKey(null, "card").actionable).toBe(false);
		expect(railByKey(null, "x402").actionable).toBe(false);
	});

	it("marks USDC Unavailable when deposit address is missing", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: false,
			cardPaymentsEnabled: true,
			cryptoPaymentsEnabled: true,
			usdcDepositConfigured: false,
			polarConfigured: true,
		};
		const usdc = railByKey(settings, "usdc");
		expect(usdc.badge).toBe("Unavailable");
		expect(usdc.actionable).toBe(false);
		expect(usdc.reason).toMatch(/unavailable|not available/i);
		expect(usdc.reason).not.toMatch(/server|configured|setup/i);
		// card still fine
		expect(railByKey(settings, "card").actionable).toBe(true);
	});

	it("marks card Paused when operator disables card payments", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: false,
			cardPaymentsEnabled: false,
			cryptoPaymentsEnabled: true,
			usdcDepositConfigured: true,
			polarConfigured: true,
		};
		const card = railByKey(settings, "card");
		expect(card.badge).toBe("Paused");
		expect(card.actionable).toBe(false);
	});

	it("never shows Available for USDC when paused even if address configured", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: false,
			cardPaymentsEnabled: true,
			cryptoPaymentsEnabled: false,
			usdcDepositConfigured: true,
			polarConfigured: true,
		};
		const usdc = railByKey(settings, "usdc");
		expect(usdc.badge).toBe("Paused");
		expect(usdc.actionable).toBe(false);
	});

	it("marks x402 Unavailable until the live facilitator is configured", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: false,
			cardPaymentsEnabled: true,
			cryptoPaymentsEnabled: true,
			usdcDepositConfigured: false,
			polarConfigured: false,
			x402Configured: false,
		};
		const x402 = railByKey(settings, "x402");
		expect(x402.badge).toBe("Unavailable");
		expect(x402.actionable).toBe(false);
	});

	it("marks configured x402 as an actionable agent rail", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: false,
			cardPaymentsEnabled: true,
			cryptoPaymentsEnabled: true,
			usdcDepositConfigured: false,
			polarConfigured: false,
			x402Configured: true,
		};
		const x402 = railByKey(settings, "x402");
		expect(x402.badge).toBe("Available");
		expect(x402.actionable).toBe(true);
	});
});
