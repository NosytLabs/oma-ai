import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";
import { log } from "@/lib/logger";

export const runtime = "nodejs";

const COINGECKO_API = "https://api.coingecko.com/api/v3";

interface CoinPrice {
	symbol: string;
	name: string;
	price: number;
	change24h: number;
	lastUpdated: string;
	source: "coingecko";
}

const SUPPORTED_COINS: Record<
	string,
	{ id: string; symbol: string; name: string }
> = {
	btc: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
	eth: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
	usdc: { id: "usd-coin", symbol: "USDC", name: "USD Coin" },
	xmr: { id: "monero", symbol: "XMR", name: "Monero" },
};

async function fetchFromCoinGecko(
	coinIds: string[],
): Promise<
	Record<
		string,
		{ usd: number; usd_24h_change?: number; last_updated_at?: number }
	>
> {
	const response = await fetch(
		`${COINGECKO_API}/simple/price?ids=${coinIds.join(",")}&vs_currencies=usd&include_24hr_change=true&include_last_updated_at=true`,
		{ next: { revalidate: 30 }, signal: AbortSignal.timeout(60_000) },
	);

	if (!response.ok) {
		throw new Error(`CoinGecko API error: ${response.status}`);
	}

	return response.json();
}

export const GET = withRateLimit(
	async () => {
		try {
			const coinIds = Object.values(SUPPORTED_COINS).map((c) => c.id);

			const coingeckoData = await fetchFromCoinGecko(coinIds);

			const prices: CoinPrice[] = [];

			for (const [, coin] of Object.entries(SUPPORTED_COINS)) {
				const coinData = coingeckoData[coin.id];
				if (coinData) {
					prices.push({
						symbol: coin.symbol,
						name: coin.name,
						price: coinData.usd || 0,
						change24h: coinData.usd_24h_change || 0,
						lastUpdated: coinData.last_updated_at
							? new Date(coinData.last_updated_at * 1000).toISOString()
							: new Date().toISOString(),
						source: "coingecko",
					});
				}
			}

			return NextResponse.json({
				success: true,
				data: prices,
				source: "coingecko",
				cachedAt: new Date().toISOString(),
			});
		} catch (error) {
			log.error("Crypto price fetch error:", error);
			return NextResponse.json(
				{
					error: {
						message: "Failed to fetch crypto prices",
						type: "upstream_error",
					},
				},
				{ status: 500 },
			);
		}
	},
	{ limiter: generalLimiter, route: "/api/pricing/crypto" },
);
