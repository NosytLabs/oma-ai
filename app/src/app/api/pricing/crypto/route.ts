import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/rate-limit-middleware";
import { generalLimiter } from "@/lib/rate-limiter";

export const runtime = "nodejs";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const JUPITER_API = "https://api.jup.ag/swap/v2/quote";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

interface CoinPrice {
	symbol: string;
	name: string;
	price: number;
	change24h: number;
	lastUpdated: string;
	source: "jupiter" | "coingecko";
}

interface PaymentLinkRequest {
	amount: number;
	chain: "base" | "solana";
	token?: string;
	expiry?: number;
	metadata?: Record<string, string>;
}

const SUPPORTED_COINS: Record<
	string,
	{ id: string; symbol: string; name: string }
> = {
	btc: { id: "bitcoin", symbol: "BTC", name: "Bitcoin" },
	eth: { id: "ethereum", symbol: "ETH", name: "Ethereum" },
	sol: { id: "solana", symbol: "SOL", name: "Solana" },
	usdc: { id: "usd-coin", symbol: "USDC", name: "USD Coin" },
	xmr: { id: "monero", symbol: "XMR", name: "Monero" },
};

async function fetchSolFromJupiter(): Promise<CoinPrice | null> {
	try {
		const queryParams = new URLSearchParams({
			inputMint: SOL_MINT,
			outputMint: USDC_MINT,
			amount: "1000000000",
			slippageBps: "1",
			onlyDirectRoutes: "false",
		});

		const response = await fetch(`${JUPITER_API}?${queryParams.toString()}`, {
			headers: { "Content-Type": "application/json" },
			signal: AbortSignal.timeout(60_000),
		});

		if (!response.ok) return null;

		const quote = await response.json();
		const price = parseFloat(quote.outAmount) / 1e6;

		return {
			symbol: "SOL",
			name: "Solana",
			price,
			change24h: 0,
			lastUpdated: new Date().toISOString(),
			source: "jupiter",
		};
	} catch (error) {
		console.error("Jupiter SOL price fetch failed:", error);
		return null;
	}
}

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
			const coinIds = Object.values(SUPPORTED_COINS)
				.filter((c) => c.id !== "solana")
				.map((c) => c.id);

			const [jupiterSolPrice, coingeckoData] = await Promise.all([
				fetchSolFromJupiter(),
				fetchFromCoinGecko(coinIds),
			]);

			const prices: CoinPrice[] = [];

			if (jupiterSolPrice) {
				prices.push(jupiterSolPrice);
			}

			for (const [key, coin] of Object.entries(SUPPORTED_COINS)) {
				if (key === "sol" && jupiterSolPrice) continue;

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

			const primarySource = jupiterSolPrice
				? "jupiter + coingecko"
				: "coingecko";

			return NextResponse.json({
				success: true,
				data: prices,
				source: primarySource,
				cachedAt: new Date().toISOString(),
			});
		} catch (error) {
			console.error("Crypto price fetch error:", error);
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

export const POST = withRateLimit(
	async (request: Request) => {
		try {
			const body = await request.json();
			const { action } = body;

			if (action !== "create-payment-link") {
				return NextResponse.json(
					{ error: { message: "Unknown action", type: "validation_error" } },
					{ status: 400 },
				);
			}

			const {
				amount,
				chain,
				token = "USDC",
			} = body as PaymentLinkRequest & { action: string };

			// --- Server-side validation ---
			if (
				typeof amount !== "number" ||
				!Number.isFinite(amount) ||
				amount <= 0
			) {
				return NextResponse.json(
					{
						error: {
							message: "amount must be a positive number",
							type: "validation_error",
						},
					},
					{ status: 400 },
				);
			}
			const validChains = ["base", "solana"] as const;
			if (!validChains.includes(chain as (typeof validChains)[number])) {
				return NextResponse.json(
					{
						error: {
							message: `chain must be one of: ${validChains.join(", ")}`,
							type: "validation_error",
						},
					},
					{ status: 400 },
				);
			}
			if (
				typeof token !== "string" ||
				token.length === 0 ||
				token.length > 32
			) {
				return NextResponse.json(
					{
						error: {
							message: "token must be a non-empty string (max 32 chars)",
							type: "validation_error",
						},
					},
					{ status: 400 },
				);
			}

			const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
			const sessionToken =
				request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") || "";
			const response = await fetch(
				`${apiUrl}/v1/deposit/houdini/payment-link`,
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						...(sessionToken
							? { Authorization: `Bearer ${sessionToken}` }
							: {}),
					},
					body: JSON.stringify({ amount, chain, token }),
					signal: AbortSignal.timeout(60_000),
				},
			);

			if (!response.ok) {
				const error = await response.json().catch(() => ({}));
				return NextResponse.json(
					{
						error: {
							message: error?.error?.message || "Payment link creation failed",
							type: "upstream_error",
						},
					},
					{ status: response.status },
				);
			}

			const data = await response.json().catch(() => ({}));
			return NextResponse.json({
				success: true,
				paymentLink: {
					id: data.paymentLink?.id,
					url: data.paymentLink?.url,
					amount: data.paymentLink?.amount,
					chain: data.paymentLink?.chain,
					token: data.paymentLink?.token,
					expiresAt: data.paymentLink?.expiresAt,
					status: data.paymentLink?.status,
					depositId: data.depositId,
				},
			});
		} catch (error) {
			console.error("Payment link API error:", error);
			return NextResponse.json(
				{
					error: {
						message: "Failed to process payment link request",
						type: "internal_server_error",
					},
				},
				{ status: 500 },
			);
		}
	},
	{ limiter: generalLimiter, route: "/api/pricing/crypto" },
);
