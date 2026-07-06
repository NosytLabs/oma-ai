export type DepositStep =
	| "select"
	| "processing"
	| "complete"
	| "error";
export type RouteType = "direct-usdc" | "onramp" | "x402-pay";

export interface CoinOption {
	id: string;
	symbol: string;
	name: string;
	network: string;
	decimals: number;
	isPopular?: boolean;
	isNative?: boolean;
	isPrivacy?: boolean;
	chain: "base";
}

export interface RouteInfo {
	type: RouteType;
	label: string;
	description: string;
	estimatedTime: string;
	feePercent: number;
	creditMultiplier: number;
	badge?: string;
}

export const ERC20_ABI = [
	{
		name: "transfer",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "to", type: "address" },
			{ name: "value", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
	},
	{
		name: "approve",
		type: "function",
		stateMutability: "nonpayable",
		inputs: [
			{ name: "spender", type: "address" },
			{ name: "value", type: "uint256" },
		],
		outputs: [{ name: "", type: "bool" }],
	},
] as const;

export const USDC_ADDRESS = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const treasuryAddress = process.env.NEXT_PUBLIC_TREASURY_BASE_ADDRESS;

// Only USDC on Base is supported for direct deposit. Non-USDC coins
// require a swap flow which is currently disabled.
export const POPULAR_COINS: CoinOption[] = [
	{
		id: "usdc-base",
		symbol: "USDC",
		name: "USD Coin",
		network: "Base",
		isNative: true,
		decimals: 6,
		isPopular: true,
		chain: "base",
	},
];

export const ROUTES: Record<string, RouteInfo> = {
	"usdc-base": {
		type: "direct-usdc",
		label: "Direct USDC",
		description: "Instant deposit directly to Base treasury",
		estimatedTime: "~30s",
		feePercent: 0,
		creditMultiplier: 1.0,
	},
	"x402-pay": {
		type: "x402-pay",
		label: "x402 Pay-Per-Request",
		description: "Gasless payments with automatic fee deduction per request",
		estimatedTime: "Real-time",
		feePercent: 0,
		creditMultiplier: 1.0,
		badge: "GASLESS",
	},
};

/**
 * Lightweight wrapper for the public payment-link info returned by
 * the Houdini / x402 facilitator endpoints. The dashboard's deposit
 * flow treats this as opaque metadata; the type only exists so
 * components can pass the value through without `any`.
 */
export interface PaymentLinkInfo {
	/** Stable ID for the payment intent. */
	id: string;
	/** URL the user can open in a wallet to complete the payment. */
	url: string;
	/** Optional human-readable label (route name, memo, etc.). */
	label?: string;
	/** Optional expiry timestamp (ISO 8601). */
	expiresAt?: string;
	/** Optional amount in minor units (cents/satoshi) tied to the link. */
	amount?: number;
	/** Optional currency code (`USDC`, `ETH`, ...). */
	currency?: string;
	/** Optional deposit id linking the link to backend credit batch. */
	depositId?: string;
	/** Optional token symbol (USDC, ETH, etc.) for display. */
	token?: string;
	/** Optional chain label for display (base, etc). */
	chain?: string;
}
