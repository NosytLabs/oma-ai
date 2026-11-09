/**
	* payment-rails.ts — single source of truth for deposit rail status.
	*
	* Mirrors public GET /v1/site-settings so home/pricing/deposit never
	* claim a rail is Available while the same env would 503 that rail.
	*
	* The site's settings arrive as a set of independent booleans (and three
	* optional "is this configured" flags). The badge, the actionability and
	* the reason were three parallel expressions per rail, each re-deciding
	* the same question -- so they could disagree, and the per-rail
	* precedence was implicit in the order of the `?:` chain. There is now one
	* derived state per rail, and the three outputs are read off it.
	*/

export type SitePaymentSettings = {
	/** False when operator payment toggles could not be read. */
	paymentStatusAvailable?: boolean;
	maintenanceMode: boolean;
	cardPaymentsEnabled: boolean;
	cryptoPaymentsEnabled: boolean;
	/** Server has USDC_DEPOSIT_ADDRESS set. */
	usdcDepositConfigured?: boolean;
	/** Polar token + at least one product id present. */
	polarConfigured?: boolean;
	/** Live x402 facilitator has signing key, RPC, and treasury configured. */
	x402Configured?: boolean;
};

type RailKey = "usdc" | "card" | "x402";

/**
 * The state of one payment rail.
 *
 * `Unknown` is the state for "we do not know yet" (settings not loaded) and
 * must never render as Available.
 */
export const PAYMENT_RAIL_STATE = {
	/** The rail accepts deposits right now. */
	Available: "available",
	/** The rail is switched off by an operator or by site maintenance. */
	Paused: "paused",
	/** The rail is not configured, or the server could not confirm it. */
	Unavailable: "unavailable",
	/** The rail's state is not known yet. */
	Unknown: "unknown",
} as const;

type PaymentRailState =
	(typeof PAYMENT_RAIL_STATE)[keyof typeof PAYMENT_RAIL_STATE];

type RailStatus = {
	key: RailKey;
	label: string;
	/** Short badge text for cards. */
	badge: "Available" | "Paused" | "Unavailable" | "Checking…";
	/** True when the user can complete a deposit/checkout for this rail. */
	actionable: boolean;
	/** One-line reason when not actionable. */
	reason: string | null;
};

/** The badge each state renders as. */
const RAIL_STATE_BADGE: Record<PaymentRailState, RailStatus["badge"]> = {
	[PAYMENT_RAIL_STATE.Available]: "Available",
	[PAYMENT_RAIL_STATE.Paused]: "Paused",
	[PAYMENT_RAIL_STATE.Unavailable]: "Unavailable",
	[PAYMENT_RAIL_STATE.Unknown]: "Checking…",
};

const RAILS: readonly { key: RailKey; label: string }[] = [
	{ key: "usdc", label: "USDC (Base)" },
	{ key: "card", label: "Card · Polar" },
	{ key: "x402", label: "x402 Agent Settle" },
];

/**
 * Derive one rail's state from the public site settings.
 *
 * The precedence is deliberate and differs per rail, so it is written down
 * once, here, instead of being spread across the badge/actionable/reason
 * expressions:
 *
 * - A rail whose status could not be read at all is Unavailable: the site
 *   cannot promise a deposit it cannot confirm.
 * - Site maintenance pauses every rail.
 * - USDC reports "Paused" before "Unavailable" (an operator toggle is a
 *   temporary condition, a missing deposit address is a configuration one).
 * - Card reports "Unavailable" before "Paused" (an unconfigured Polar
 *   provider is not something a user can wait out).
 * - x402 follows the USDC order.
 */
export function paymentRailState(
	settings: SitePaymentSettings | null | undefined,
	key: RailKey,
): PaymentRailState {
	if (!settings) return PAYMENT_RAIL_STATE.Unknown;
	if (settings.paymentStatusAvailable === false) {
		return PAYMENT_RAIL_STATE.Unavailable;
	}
	if (settings.maintenanceMode) return PAYMENT_RAIL_STATE.Paused;

	if (key === "usdc") {
		if (settings.cryptoPaymentsEnabled === false) return PAYMENT_RAIL_STATE.Paused;
		return settings.usdcDepositConfigured === true
			? PAYMENT_RAIL_STATE.Available
			: PAYMENT_RAIL_STATE.Unavailable;
	}

	if (key === "card") {
		if (settings.polarConfigured !== true) return PAYMENT_RAIL_STATE.Unavailable;
		return settings.cardPaymentsEnabled === false
			? PAYMENT_RAIL_STATE.Paused
			: PAYMENT_RAIL_STATE.Available;
	}

	// x402
	if (settings.cryptoPaymentsEnabled === false) return PAYMENT_RAIL_STATE.Paused;
	return settings.x402Configured === true
		? PAYMENT_RAIL_STATE.Available
		: PAYMENT_RAIL_STATE.Unavailable;
}

/** Why a rail is not actionable, in the order the operator would explain it. */
function railReason(
	settings: SitePaymentSettings | null | undefined,
	key: RailKey,
	state: PaymentRailState,
): string | null {
	if (state === PAYMENT_RAIL_STATE.Available) return null;
	if (!settings) return "Checking payment availability…";
	if (settings.paymentStatusAvailable === false) {
		return "Payment availability could not be checked. Please try again shortly.";
	}
	if (state === PAYMENT_RAIL_STATE.Paused && settings.maintenanceMode) {
		return "New payments are paused during site maintenance.";
	}
	if (key === "usdc") {
		return state === PAYMENT_RAIL_STATE.Paused
			? "USDC deposits are temporarily paused."
			: "USDC deposits are not available right now.";
	}
	if (key === "card") {
		return state === PAYMENT_RAIL_STATE.Paused
			? "Card payments are temporarily paused."
			: "Card payments are not available right now.";
	}
	return state === PAYMENT_RAIL_STATE.Paused
		? "New x402 funding is temporarily paused."
		: "x402 funding is not available right now.";
}

/**
 * Derive per-rail status from public site settings.
 * Unknown settings stay non-actionable (Checking…) so we never flash
 * "Available" for a rail the server has not confirmed.
 */
export function railStatuses(
	settings: SitePaymentSettings | null | undefined,
): RailStatus[] {
	return RAILS.map(({ key, label }) => {
		const state = paymentRailState(settings, key);
		return {
			key,
			label,
			badge: RAIL_STATE_BADGE[state],
			actionable: state === PAYMENT_RAIL_STATE.Available,
			reason: railReason(settings, key, state),
		};
	});
}

export function railByKey(
	settings: SitePaymentSettings | null | undefined,
	key: RailKey,
): RailStatus {
	return (
		railStatuses(settings).find((r) => r.key === key) ?? {
			key,
			label: key,
			badge: RAIL_STATE_BADGE[PAYMENT_RAIL_STATE.Unknown],
			actionable: false,
			reason: "Checking payment availability…",
		}
	);
}
