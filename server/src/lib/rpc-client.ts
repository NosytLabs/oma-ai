/**
	* Shared viem public client with automatic RPC fallback.
	*
	* Transport order (viem tries each in sequence on failure):
	*   1. QuickNode (paid, covered by $300 credit — fast, archive data)
	*   2. Free public RPCs (base.llamarpc.com, mainnet.base.org, publicnode)
	*
	* Usage:
	*   import { getPublicClient } from "../lib/rpc-client.js";
	*   const client = getPublicClient();
	*   const receipt = await client.getTransactionReceipt({ hash });
	*/
import {
		createPublicClient,
		fallback,
		http,
		type FallbackTransport,
		type PublicClient,
} from "viem";
import { base } from "viem/chains";
import { config } from "../config.js";
import { logger } from "./logger.js";

// Free public Base RPCs — no API key, rate-limited but reliable for reads.
const FREE_BASE_RPCS = [
		"https://base.llamarpc.com",
		"https://mainnet.base.org",
		"https://base-rpc.publicnode.com",
];

/**
	* Base mainnet public client over a ranked fallback transport. Bound to
	* `typeof base` so OP-stack transaction types (e.g. `deposit`) are included,
	* and expressed via viem's public `PublicClient`/`FallbackTransport` exports
	* so the type is portably nameable (the raw inferred type is not).
	*/
type BasePublicClient = PublicClient<FallbackTransport, typeof base>;

/** Build the Base public client from an ordered transport list. */
function createClient(transports: ReturnType<typeof http>[]): BasePublicClient {
		return createPublicClient({
				chain: base,
				transport: fallback(transports, { rank: true }),
		});
}

let cachedClient: BasePublicClient | null = null;

/**
	* Returns a singleton viem PublicClient for Base mainnet with fallback
	* transport. Primary = CHAIN_RPC_URL (QuickNode), fallbacks = free public
	* RPCs. If CHAIN_RPC_URL is unset (dev/test), uses free RPCs only.
	*/
export function getPublicClient(): BasePublicClient {
		if (cachedClient) return cachedClient;

		const transports: ReturnType<typeof http>[] = [];
		const seenUrls = new Set<string>();

		// Ignore a placeholder or obviously invalid CHAIN_RPC_URL. A literal
		// `placeholder-url.quiknode.pro` (or any *placeholder*/*changeme* value)
		// is unusable: keeping it as the ranked primary would make every x402
		// on-chain call burn a failover round-trip against a dead host before
		// falling through to the working public RPCs. Treat it as unset so the
		// real fallback + free RPCs serve directly.
		if (config.CHAIN_RPC_URL && !/placeholder|changeme/i.test(config.CHAIN_RPC_URL)) {
				transports.push(http(config.CHAIN_RPC_URL));
				seenUrls.add(config.CHAIN_RPC_URL);
		}

		// Explicit fallback from env (e.g. QUICKNODE_RPC_URL_FALLBACK)
		if (
				config.CHAIN_RPC_URL_FALLBACK &&
				config.CHAIN_RPC_URL_FALLBACK !== config.CHAIN_RPC_URL
		) {
				transports.push(http(config.CHAIN_RPC_URL_FALLBACK));
				seenUrls.add(config.CHAIN_RPC_URL_FALLBACK);
		}

		// Free public RPCs — deduped against the URLs already registered above.
		// (Tracking URLs directly is more reliable than reading `.url` off viem
		// transports, which is not part of the public transport type.)
		for (const url of FREE_BASE_RPCS) {
				if (!seenUrls.has(url)) {
						transports.push(http(url));
						seenUrls.add(url);
				}
		}

		if (transports.length === 0) {
				// Absolute last resort — viem's default public transport
				transports.push(http());
		}

		logger.info(
				`[rpc] fallback transport: ${transports.length} endpoints (primary: ${config.CHAIN_RPC_URL ? "QuickNode" : "free"})`,
		);

		const client = createClient(transports);
		cachedClient = client;

		return client;
}

/** Reset cached client (for tests). */
export function resetPublicClient(): void {
		cachedClient = null;
}
