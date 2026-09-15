import { describe, expect, it } from "vitest";
import { railByKey, railStatuses, type SitePaymentSettings } from "@/lib/payment-rails";

describe("railStatuses", () => {
	it("defaults USDC/card to Setup required when settings are null (no Available flash)", () => {
		const rails = railStatuses(null);
		expect(rails.map((r) => r.badge)).toEqual([
			"Setup required",
			"Setup required",
			"Agents",
		]);
		expect(railByKey(null, "usdc").actionable).toBe(false);
		expect(railByKey(null, "card").actionable).toBe(false);
		expect(railByKey(null, "x402").actionable).toBe(true);
	});

	it("marks USDC Setup required when deposit address is missing", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: false,
			cardPaymentsEnabled: true,
			cryptoPaymentsEnabled: true,
			usdcDepositConfigured: false,
			polarConfigured: true,
		};
		const usdc = railByKey(settings, "usdc");
		expect(usdc.badge).toBe("Setup required");
		expect(usdc.actionable).toBe(false);
		expect(usdc.reason).toMatch(/not configured/i);
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

	it("keeps x402 as Agents and actionable regardless of deposit flags", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: true,
			cardPaymentsEnabled: false,
			cryptoPaymentsEnabled: false,
			usdcDepositConfigured: false,
			polarConfigured: false,
		};
		const x402 = railByKey(settings, "x402");
		expect(x402.badge).toBe("Agents");
		expect(x402.actionable).toBe(true);
	});
});
