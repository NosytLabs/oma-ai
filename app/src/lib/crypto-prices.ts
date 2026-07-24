/**
 * Crypto Price Fetching Module
 * Fetches real-time prices from CoinGecko (BTC, ETH, etc.)
 * Implements 30-second client-side caching
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";

// Re-export types and functions from models-data for backwards compatibility
export type { Capability, Model, Provider, Tier } from "./models-data";
export {
	formatPricePerMillion,
	getModelsByTier,
	MODELS,
	PROVIDER_COLORS,
	TIER_COLORS,
	TIER_ORDER,
} from "./models-data";

// =============================================================================
// TYPES
// =============================================================================

export interface CryptoPrice {
	symbol: string;
	name: string;
	price: number;
	change24h: number;
	lastUpdated: string;
	source: "coingecko";
}

export interface PriceData {
	btc: CryptoPrice | null;
	eth: CryptoPrice | null;
}

interface PriceCache {
	data: CryptoPrice[];
	timestamp: number;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CACHE_DURATION = 30 * 1000; // 30 seconds in milliseconds
const COINGECKO_API = "/api/pricing/crypto";

// =============================================================================
// COINGECKO PRICE FETCHING
// =============================================================================

interface CoinGeckoPriceResponse {
	success: boolean;
	data: CryptoPrice[];
	source: string;
	cachedAt: string;
}

async function fetchPricesFromCoinGecko(): Promise<CryptoPrice[]> {
	try {
		const response = await fetch(COINGECKO_API, {
			next: { revalidate: 30 },
		});

		if (!response.ok) {
			throw new Error(`CoinGecko API error: ${response.status}`);
		}

		const data: CoinGeckoPriceResponse = await response.json();

		if (!data.success || !data.data) {
			throw new Error("Invalid response from pricing API");
		}

		return data.data.map((price) => ({
			...price,
			source: "coingecko" as const,
		}));
	} catch (error) {
		console.error("Failed to fetch prices from CoinGecko:", error);
		return [];
	}
}

// =============================================================================
// PRICE CACHE & DEDUP
// =============================================================================

let priceCache: PriceCache | null = null;
let ongoingFetch: Promise<PriceData> | null = null;

async function getCryptoPrices(
	forceRefresh = false,
): Promise<PriceData> {
	const now = Date.now();
	const isCacheValid =
		priceCache && now - priceCache.timestamp < CACHE_DURATION;

	if (isCacheValid && !forceRefresh && priceCache) {
		return {
			btc: priceCache.data.find((p) => p.symbol === "BTC") || null,
			eth: priceCache.data.find((p) => p.symbol === "ETH") || null,
		};
	}

	if (ongoingFetch && !forceRefresh) {
		return ongoingFetch;
	}

	ongoingFetch = (async () => {
		const coingeckoPrices = await fetchPricesFromCoinGecko();

		priceCache = { data: coingeckoPrices, timestamp: now };
		return {
			btc: coingeckoPrices.find((p) => p.symbol === "BTC") || null,
			eth: coingeckoPrices.find((p) => p.symbol === "ETH") || null,
		};
	})();

	try {
		return await ongoingFetch;
	} finally {
		ongoingFetch = null;
	}
}

// =============================================================================
// REACT HOOKS (TanStack Query)
// =============================================================================

interface UseCryptoPricesOptions {
	/** Refresh interval in milliseconds (default: 30s = cache duration) */
	refreshInterval?: number;
	/** Enable auto-refresh (default: true) */
	autoRefresh?: boolean;
}

interface UseCryptoPricesReturn {
	/** Current price data */
	prices: PriceData;
	/** Whether prices are currently loading */
	isLoading: boolean;
	/** Error message if fetch failed */
	error: string | null;
	/** Force a fresh price fetch */
	refresh: () => Promise<void>;
	/** Time until next auto-refresh (approximate) */
	nextRefreshIn: number;
}

/**
 * React hook for accessing crypto prices with auto-refresh.
 * Built on TanStack Query for caching, deduplication, and background refetching.
 */
export function useCryptoPrices(
	options: UseCryptoPricesOptions = {},
): UseCryptoPricesReturn {
	const { refreshInterval = CACHE_DURATION, autoRefresh = true } = options;
	const queryClient = useQueryClient();

	const { data, isLoading, error, dataUpdatedAt } = useQuery({
		queryKey: ["cryptoPrices"],
		queryFn: () => getCryptoPrices(),
		staleTime: CACHE_DURATION,
		refetchInterval: autoRefresh ? refreshInterval : false,
		refetchOnWindowFocus: false,
	});

	const prices: PriceData = data ?? { btc: null, eth: null };

	const refresh = useCallback(async () => {
		await queryClient.invalidateQueries({ queryKey: ["cryptoPrices"] });
	}, [queryClient]);

	// eslint-disable-next-line react-hooks/purity -- one-time elapsed calc, safe
	const elapsed = useMemo(() => Date.now() - dataUpdatedAt, [dataUpdatedAt]);
	const nextRefreshIn = autoRefresh
		? Math.max(0, refreshInterval - elapsed)
		: 0;

	return {
		prices,
		isLoading,
		error:
			error instanceof Error
				? error.message
				: error
					? "Failed to fetch prices"
					: null,
		refresh,
		nextRefreshIn,
	};
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function getPriceBySymbol(prices: PriceData, symbol: string): number | null {
	const upperSymbol = symbol.toUpperCase();

	switch (upperSymbol) {
		case "BTC":
			return prices.btc?.price ?? null;
		case "ETH":
			return prices.eth?.price ?? null;
		default:
			return null;
	}
}

/**
 * Calculate USD value of a crypto amount
 */
export function calculateUsdValue(
	symbol: string,
	amount: number,
	prices: PriceData,
): number | null {
	const price = getPriceBySymbol(prices, symbol);
	if (price === null) return null;
	return amount * price;
}
