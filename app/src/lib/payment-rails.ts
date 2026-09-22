/**
	* payment-rails.ts — single source of truth for deposit rail status.
	*
	* Mirrors public GET /v1/site-settings so home/pricing/deposit never
	* claim a rail is Available while the same env would 503 that rail.
	*/

export type SitePaymentSettings = {
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
	badge: "Available" | "Paused" | "Setup required" | "Agents";
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
				badge: "Setup required",
				actionable: false,
				reason: "Checking payment configuration…",
			},
			{
				key: "card",
				label: "Card · Polar",
				badge: "Setup required",
				actionable: false,
				reason: "Checking payment configuration…",
			},
			{
				key: "x402",
				label: "x402 Agent Settle",
				badge: "Setup required",
				actionable: false,
				reason: "Checking facilitator configuration…",
			},
		];
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
					? "Setup required"
					: "Available",
			actionable: !usdcPaused && !usdcMissing,
			reason: usdcPaused
				? "On-chain USDC deposits are paused by the operator."
				: usdcMissing
					? "Deposit address is not configured on the server."
					: null,
		},
		{
			key: "card",
			label: "Card · Polar",
			badge: cardPaused
				? "Paused"
				: cardMissing
					? "Setup required"
					: "Available",
			actionable: !cardPaused && !cardMissing,
			reason: cardPaused
				? "Card checkout is paused by the operator."
				: cardMissing
					? "Card payments are not yet enabled. Contact the operator to enable Polar checkout."
					: null,
		},
		{
			key: "x402",
			label: "x402 Agent Settle",
			badge: x402Paused
				? "Paused"
				: x402Configured
					? "Agents"
					: "Setup required",
			actionable: !x402Paused && x402Configured,
			reason: x402Paused
				? "Crypto settlement is paused by the operator."
				: x402Configured
					? null
					: "The live x402 facilitator is not fully configured.",
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
			badge: "Setup required",
			actionable: false,
			reason: "Checking payment configuration…",
		}
	);
}
