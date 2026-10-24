import type { MiddlewareHandler } from "hono";
import { db } from "../db/client.js";
import { siteSettings } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import type { OmaEnv } from "../types.js";

/** Funding is open until an operator pauses a rail in site_settings. */
const DEFAULT_RAIL_ENABLED = true;

/** Gate new funding before a wallet authorization or hosted checkout. */
export function requirePaymentRail(rail: "card" | "crypto"): MiddlewareHandler<OmaEnv> {
	return async (c, next) => {
		c.header("Cache-Control", "no-store");
		let enabled: boolean;
		try {
			const [settings] = await db.select({
				cardPaymentsEnabled: siteSettings.cardPaymentsEnabled,
				cryptoPaymentsEnabled: siteSettings.cryptoPaymentsEnabled,
			}).from(siteSettings).limit(1);
			// Explicit default. The operator's switch lives in site_settings
			// and is a PAUSE control: funding is open until someone pauses a
			// rail. A missing row therefore means "not configured", not
			// "paused" -- but it is also not a silent guess, so it is named,
			// logged, and reported instead of being buried in a `?? true`.
			const configured = rail === "card" ? settings?.cardPaymentsEnabled : settings?.cryptoPaymentsEnabled;
			if (configured === undefined) {
				logger.warn({ rail }, "[payments] no availability settings row found; using the default (enabled). Seed site_settings so the operator switch is authoritative.");
			}
			enabled = configured ?? DEFAULT_RAIL_ENABLED;
		} catch (err) {
			logger.error({ err, rail }, "[payments] availability check failed");
			c.header("Retry-After", "30");
			return c.json({ error: { type: "service_unavailable", code: "funding_status_unavailable", message: "Payment availability could not be checked. Please try again shortly." } }, 503);
		}
		if (!enabled) {
			return c.json({ error: { type: "service_unavailable", code: "funding_paused", message: `${rail === "card" ? "Card" : "Crypto"} payments are temporarily paused by the operator.` } }, 503);
		}
		await next();
	};
}
