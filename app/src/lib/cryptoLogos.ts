/**
 * Crypto Logo Configuration
 * Centralized logo URLs for supported cryptocurrencies
 * Uses CoinGecko CDN for production logos with fallback URLs
 */

interface CryptoLogoConfig {
	symbol: string;
	name: string;
	coingeckoId: string;
	primaryUrl: string;
	fallbackUrl: string;
	svgUrl?: string;
}

// CoinGecko logo URL patterns
const COINGECKO_BASE = "https://assets.coingecko.com/coins/images";
const COINGECKO_THUMB = "https://assets.coingecko.com/coins/images/thumb";

/**
 * Supported cryptocurrency logo configurations
 * Add new coins here to extend logo support
 */
export const CRYPTO_LOGOS: Record<string, CryptoLogoConfig> = {
	BTC: {
		symbol: "BTC",
		name: "Bitcoin",
		coingeckoId: "1",
		primaryUrl: `${COINGECKO_BASE}/1/large/bitcoin.png`,
		fallbackUrl: `${COINGECKO_THUMB}/1/small/bitcoin.png`,
		svgUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg",
	},
	XMR: {
		symbol: "XMR",
		name: "Monero",
		coingeckoId: "328",
		primaryUrl: `${COINGECKO_BASE}/328/large/monero_logo.png`,
		fallbackUrl: `${COINGECKO_THUMB}/328/small/monero_logo.png`,
	},
	ETH: {
		symbol: "ETH",
		name: "Ethereum",
		coingeckoId: "279",
		primaryUrl: `${COINGECKO_BASE}/279/large/ethereum.png`,
		fallbackUrl: `${COINGECKO_THUMB}/279/small/ethereum.png`,
		svgUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.svg",
	},
	SOL: {
		symbol: "SOL",
		name: "Solana",
		coingeckoId: "4128",
		primaryUrl: `${COINGECKO_BASE}/4128/large/Solana_magic_icon.png`,
		fallbackUrl: `${COINGECKO_THUMB}/4128/small/Solana_magic_icon.png`,
		svgUrl: "https://cryptologos.cc/logos/solana-sol-logo.svg",
	},
	DOGE: {
		symbol: "DOGE",
		name: "Dogecoin",
		coingeckoId: "5",
		primaryUrl: `${COINGECKO_BASE}/5/large/dogecoin.png`,
		fallbackUrl: `${COINGECKO_THUMB}/5/small/dogecoin.png`,
		svgUrl: "https://cryptologos.cc/logos/dogecoin-doge-logo.svg",
	},
	USDC: {
		symbol: "USDC",
		name: "USD Coin",
		coingeckoId: "6319",
		primaryUrl: `${COINGECKO_BASE}/6319/large/USD_Coin_icon.png`,
		fallbackUrl: `${COINGECKO_THUMB}/6319/small/USD_Coin_icon.png`,
		svgUrl: "https://cryptologos.cc/logos/usd-coin-usdc-logo.svg",
	},
	OMA: {
		symbol: "OMA",
		name: "OMA AI",
		coingeckoId: "oma-ai", // Custom token - may not exist on CoinGecko
		primaryUrl: "/logos/oma-logo.svg", // Local placeholder
		fallbackUrl: "/logos/oma-logo.svg",
		svgUrl: "/logos/oma-logo.svg",
	},
	LTC: {
		symbol: "LTC",
		name: "Litecoin",
		coingeckoId: "2",
		primaryUrl: `${COINGECKO_BASE}/2/large/litecoin.png`,
		fallbackUrl: `${COINGECKO_THUMB}/2/small/litecoin.png`,
		svgUrl: "https://cryptologos.cc/logos/litecoin-ltc-logo.svg",
	},
	XRP: {
		symbol: "XRP",
		name: "XRP",
		coingeckoId: "44",
		primaryUrl: `${COINGECKO_BASE}/44/large/xrp-symbol-white-src.png`,
		fallbackUrl: `${COINGECKO_THUMB}/44/small/xrp-symbol-white-src.png`,
		svgUrl: "https://cryptologos.cc/logos/xrp-xrp-logo.svg",
	},
	MATIC: {
		symbol: "MATIC",
		name: "Polygon",
		coingeckoId: "4713",
		primaryUrl: `${COINGECKO_BASE}/4713/large/polygon.png`,
		fallbackUrl: `${COINGECKO_THUMB}/4713/small/polygon.png`,
		svgUrl: "https://cryptologos.cc/logos/polygon-matic-logo.svg",
	},
	// Additional common tokens for future expansion
	BNB: {
		symbol: "BNB",
		name: "BNB",
		coingeckoId: "1839",
		primaryUrl: `${COINGECKO_BASE}/1839/large/bnb-icon2_2.png`,
		fallbackUrl: `${COINGECKO_THUMB}/1839/small/bnb-icon2_2.png`,
		svgUrl: "https://cryptologos.cc/logos/bnb-bnb-logo.svg",
	},
	ADA: {
		symbol: "ADA",
		name: "Cardano",
		coingeckoId: "975",
		primaryUrl: `${COINGECKO_BASE}/975/large/cardano.png`,
		fallbackUrl: `${COINGECKO_THUMB}/975/small/cardano.png`,
		svgUrl: "https://cryptologos.cc/logos/cardano-ada-logo.svg",
	},
	DOT: {
		symbol: "DOT",
		name: "Polkadot",
		coingeckoId: "12171",
		primaryUrl: `${COINGECKO_BASE}/12171/large/polkadot.png`,
		fallbackUrl: `${COINGECKO_THUMB}/12171/small/polkadot.png`,
		svgUrl: "https://cryptologos.cc/logos/polkadot-new-dot-logo.svg",
	},
	LINK: {
		symbol: "LINK",
		name: "Chainlink",
		coingeckoId: "877",
		primaryUrl: `${COINGECKO_BASE}/877/large/chainlink-new-logo.png`,
		fallbackUrl: `${COINGECKO_THUMB}/877/small/chainlink-new-logo.png`,
		svgUrl: "https://cryptologos.cc/logos/chainlink-link-logo.svg",
	},
	AVAX: {
		symbol: "AVAX",
		name: "Avalanche",
		coingeckoId: "12559",
		primaryUrl: `${COINGECKO_BASE}/12559/large/Avalanche_C_Red_Positive_RGB.png`,
		fallbackUrl: `${COINGECKO_THUMB}/12559/small/Avalanche_C_Red_Positive_RGB.png`,
		svgUrl: "https://cryptologos.cc/logos/avalanche-avax-logo.svg",
	},
	TRX: {
		symbol: "TRX",
		name: "TRON",
		coingeckoId: "1094",
		primaryUrl: `${COINGECKO_BASE}/1094/large/tron-logo.png`,
		fallbackUrl: `${COINGECKO_THUMB}/1094/small/tron-logo.png`,
		svgUrl: "https://cryptologos.cc/logos/tron-trx-logo.svg",
	},
	USDT: {
		symbol: "USDT",
		name: "Tether",
		coingeckoId: "325",
		primaryUrl: `${COINGECKO_BASE}/325/large/Tether.png`,
		fallbackUrl: `${COINGECKO_THUMB}/325/small/Tether.png`,
		svgUrl: "https://cryptologos.cc/logos/tether-usdt-logo.svg",
	},
};

/**
 * Get logo URL for a given symbol
 * Returns primary URL with fallback chain
 */
export function getCryptoLogoUrl(
	symbol: string,
	options: { useSvg?: boolean; size?: "large" | "thumb" } = {},
): string {
	const normalizedSymbol = symbol.toUpperCase();
	const config = CRYPTO_LOGOS[normalizedSymbol];

	if (!config) {
		// Return placeholder for unknown tokens
		return `/logos/unknown.svg`;
	}

	const { useSvg = false, size = "large" } = options;

	// For OMA and similar local tokens
	if (config.primaryUrl.startsWith("/")) {
		return config.primaryUrl;
	}

	// Prefer SVG if available and requested
	if (useSvg && config.svgUrl) {
		return config.svgUrl;
	}

	// Return appropriate size
	if (size === "thumb") {
		return config.fallbackUrl;
	}

	return config.primaryUrl;
}

/**
 * Check if logo config exists for symbol
 */
export function hasCryptoLogo(symbol: string): boolean {
	return symbol.toUpperCase() in CRYPTO_LOGOS;
}
