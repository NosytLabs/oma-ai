/**
	* payment-rails.ts — single source of truth for deposit rail status.
	*
	* Mirrors public GET /v1/site-settings so home/pricing/deposit never
	* claim a rail is Available while the same env would 503 that rail.
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

export type RailKey = "usdc" | "card" | "x402";

export type RailStatus = {
	key: RailKey;
	label: string;
	/** Short badge text for cards. */
	badge: "Available" | "Paused" | "Unavailable" | "Checking…";
	/** True when the user can complete a deposit/checkout for this rail. */
	actionable: boolean;
	/** One-line reason when not actionable. */
	reason: string | null;
};

/**
	* Derive per-rail status from public site settings.
	* Unknown settings stay non-actionable (Checking…) so we never flash
	* "Available" for a rail the server has not confirmed.
	*/
export function railStatuses(
	settings: SitePaymentSettings | null | undefined,
): RailStatus[] {
	if (!settings) {
		return [
			{
				key: "usdc",
				label: "USDC (Base)",
				badge: "Checking…",
				actionable: false,
				reason: "Checking payment availability…",
			},
			{
				key: "card",
				label: "Card · Polar",
				badge: "Checking…",
				actionable: false,
				reason: "Checking payment availability…",
			},
			{
				key: "x402",
				label: "x402 Agent Settle",
				badge: "Checking…",
				actionable: false,
				reason: "Checking payment availability…",
			},
		];
	}
	if (settings.paymentStatusAvailable === false || settings.maintenanceMode) {
		const unavailable = settings.paymentStatusAvailable === false;
		return ([
			["usdc", "USDC (Base)"], ["card", "Card · Polar"], ["x402", "x402 Agent Settle"],
		] as const).map(([key, label]) => ({
			key, label, badge: unavailable ? "Unavailable" : "Paused", actionable: false,
			reason: unavailable ? "Payment availability could not be checked. Please try again shortly." : "New payments are paused during site maintenance.",
		}));
	}

	const usdcConfigured = settings.usdcDepositConfigured === true;
	const polarConfigured = settings.polarConfigured === true;

	const usdcPaused = settings.cryptoPaymentsEnabled === false;
	const usdcMissing = !usdcConfigured;
	const cardPaused = settings.cardPaymentsEnabled === false;
	const cardMissing = !polarConfigured;
	const x402Configured = settings.x402Configured === true;
	const x402Paused = settings.cryptoPaymentsEnabled === false;

	return [
		{
			key: "usdc",
			label: "USDC (Base)",
			badge: usdcPaused
				? "Paused"
				: usdcMissing
					? "Unavailable"
					: "Available",
			actionable: !usdcPaused && !usdcMissing,
			reason: usdcPaused
				? "USDC deposits are temporarily paused."
				: usdcMissing
					? "USDC deposits are not available right now."
					: null,
		},
		{
			key: "card",
			label: "Card · Polar",
			badge: cardMissing
				? "Unavailable"
				: cardPaused
					? "Paused"
					: "Available",
			actionable: !cardPaused && !cardMissing,
			reason: cardMissing
				? "Card payments are not available right now."
				: cardPaused
					? "Card payments are temporarily paused."
					: null,
		},
		{
			key: "x402",
			label: "x402 Agent Settle",
			badge: x402Paused
				? "Paused"
				: x402Configured
					? "Available"
					: "Unavailable",
			actionable: !x402Paused && x402Configured,
			reason: x402Paused
				? "New x402 funding is temporarily paused."
				: x402Configured
					? null
					: "x402 funding is not available right now.",
		},
	];
}

export function railByKey(
	settings: SitePaymentSettings | null | undefined,
	key: RailKey,
): RailStatus {
	return (
		railStatuses(settings).find((r) => r.key === key) ?? {
			key,
			label: key,
			badge: "Checking…",
			actionable: false,
			reason: "Checking payment availability…",
		}
	);
}
