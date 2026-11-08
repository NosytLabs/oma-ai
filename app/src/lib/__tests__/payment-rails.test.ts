import { describe, expect, it } from "vitest";
import {
	PAYMENT_RAIL_STATE,
	paymentRailState,
	railByKey,
	railStatuses,
	type SitePaymentSettings,
} from "@/lib/payment-rails";

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

describe("paymentRailState", () => {
	const base: SitePaymentSettings = {
		maintenanceMode: false,
		cardPaymentsEnabled: true,
		cryptoPaymentsEnabled: true,
		usdcDepositConfigured: true,
		polarConfigured: true,
		x402Configured: true,
	};

	it("is Unknown when the settings have not loaded", () => {
		for (const key of ["usdc", "card", "x402"] as const) {
			expect(paymentRailState(null, key)).toBe(PAYMENT_RAIL_STATE.Unknown);
			expect(paymentRailState(undefined, key)).toBe(PAYMENT_RAIL_STATE.Unknown);
		}
	});

	it("is Available for every configured rail", () => {
		expect(paymentRailState(base, "usdc")).toBe(PAYMENT_RAIL_STATE.Available);
		expect(paymentRailState(base, "card")).toBe(PAYMENT_RAIL_STATE.Available);
		expect(paymentRailState(base, "x402")).toBe(PAYMENT_RAIL_STATE.Available);
	});

	it("never reports Available when the site cannot confirm payment status", () => {
		const settings = { ...base, paymentStatusAvailable: false };
		for (const key of ["usdc", "card", "x402"] as const) {
			expect(paymentRailState(settings, key)).toBe(
				PAYMENT_RAIL_STATE.Unavailable,
			);
		}
	});

	it("pauses every rail during maintenance", () => {
		const settings = { ...base, maintenanceMode: true };
		for (const key of ["usdc", "card", "x402"] as const) {
			expect(paymentRailState(settings, key)).toBe(PAYMENT_RAIL_STATE.Paused);
		}
	});

	it("keeps the documented per-rail precedence", () => {
		// USDC: an operator toggle outranks a missing deposit address.
		expect(
			paymentRailState(
				{ ...base, cryptoPaymentsEnabled: false, usdcDepositConfigured: false },
				"usdc",
			),
		).toBe(PAYMENT_RAIL_STATE.Paused);
		// Card: an unconfigured provider outranks the operator toggle.
		expect(
			paymentRailState(
				{ ...base, cardPaymentsEnabled: false, polarConfigured: false },
				"card",
			),
		).toBe(PAYMENT_RAIL_STATE.Unavailable);
	});

	it("drives the badge, actionability and reason from the one state", () => {
		const settings: SitePaymentSettings = {
			maintenanceMode: false,
			cardPaymentsEnabled: false,
			cryptoPaymentsEnabled: true,
			usdcDepositConfigured: false,
			polarConfigured: false,
			x402Configured: false,
		};
		for (const rail of railStatuses(settings)) {
			const state = paymentRailState(settings, rail.key);
			if (state === PAYMENT_RAIL_STATE.Available) {
				expect(rail.badge).toBe("Available");
				expect(rail.actionable).toBe(true);
				expect(rail.reason).toBeNull();
			} else {
				expect(rail.actionable).toBe(false);
				expect(rail.reason).toBeTruthy();
			}
		}
	});
});
