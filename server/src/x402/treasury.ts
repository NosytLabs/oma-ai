import { config } from "../config.js";
import { logger } from "../lib/logger.js";

// in tests TREASURY_BASE_ADDRESS may be unset;
// resolve defensively.
export const SERVER_TREASURY = (config.TREASURY_BASE_ADDRESS || "").toLowerCase();

// SECURITY (A3): Fail closed — if no treasury address is configured, the
// facilitator cannot verify payee pinning. Refuse to verify payments rather
// than silently accepting payments to any address.
if (!SERVER_TREASURY && config.FACILITATOR_MODE === "live") {
		throw new Error("[FACILITATOR] FATAL: SERVER_TREASURY is empty in live mode. Set TREASURY_BASE_ADDRESS before starting.");
} else if (!SERVER_TREASURY) {
		logger.warn("[FACILITATOR] SERVER_TREASURY is empty in mock mode — payee validation disabled. This is NOT safe for production.");
}
