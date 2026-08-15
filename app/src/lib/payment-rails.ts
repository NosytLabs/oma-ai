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
	* Defaults are optimistic (Available) only when flags are unknown (null settings).
	*/
export function railStatuses(
	settings: SitePaymentSettings | null | undefined,
): RailStatus[] {
	if (!settings) {
		return [
			{
				key: "usdc",
				label: "USDC (Base)",
				badge: "Available",
				actionable: true,
				reason: null,
			},
			{
				key: "card",
				label: "Card · Polar",
				badge: "Available",
				actionable: true,
				reason: null,
			},
			{
				key: "x402",
				label: "x402 Pay-Per-Request",
				badge: "Agents",
				actionable: true,
				reason: null,
			},
		];
	}

	const usdcConfigured = settings.usdcDepositConfigured !== false;
	const polarConfigured = settings.polarConfigured !== false;

	const usdcPaused = settings.cryptoPaymentsEnabled === false;
	const usdcMissing = !usdcConfigured;
	const cardPaused = settings.cardPaymentsEnabled === false;
	const cardMissing = !polarConfigured;

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
					? "Polar checkout is not configured on the server."
					: null,
		},
		{
			key: "x402",
			label: "x402 Pay-Per-Request",
			badge: "Agents",
			// x402 does not require pre-funded deposit UI; protocol lives on the API.
			actionable: true,
			reason: null,
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
			badge: "Available",
			actionable: true,
			reason: null,
		}
	);
}
