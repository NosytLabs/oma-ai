import type { MiddlewareHandler } from "hono";
import { db } from "../db/client.js";
import { siteSettings } from "../db/schema.js";
import { logger } from "../lib/logger.js";
import type { OmaEnv } from "../types.js";

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
			enabled = (rail === "card" ? settings?.cardPaymentsEnabled : settings?.cryptoPaymentsEnabled) ?? true;
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
