import { createConfig, createStorage, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

/**
 * RPC transport URLs.
 *
 * We route through /api/rpc/[chain] so the QuickNode API key stays
 * server-side (QUICKNODE_RPC_URL env var, no NEXT_PUBLIC_ prefix).
 * The proxy route forwards JSON-RPC calls to QuickNode (or public RPC
 * fallbacks if no key is configured). This keeps the key out of the
 * client-side JS bundle.
 */
const MAINNET_RPC = "/api/rpc/base";
const TESTNET_RPC = "/api/rpc/base-sepolia";

function getWagmiConfig() {
	// Single connector: injected (EIP-1193). Works for MetaMask / Rabby /
	// Brave / OKX / Coinbase Extension — no cloud relay, no project ID,
	// no SDK, zero bundle overhead from wallet-connect-relay.
	//
	// Coinbase Wallet SDK was dropped — it's a separate SDK that adds
	// bundle weight and the Coinbase Extension already exposes
	// window.ethereum via the injected path.
	const connectors = [injected({ shimDisconnect: true })];

	return createConfig({
		chains: [base, baseSepolia],
		connectors,
		transports: {
			[base.id]: http(MAINNET_RPC, {
				batch: { batchSize: 8, wait: 50 },
				retryCount: 3,
				retryDelay: 200,
			}),
			[baseSepolia.id]: http(TESTNET_RPC, {
				batch: { batchSize: 8, wait: 50 },
				retryCount: 3,
				retryDelay: 200,
			}),
		},
		storage: createStorage({
			storage: typeof window !== "undefined" ? window.localStorage : undefined,
			key: "wagmi",
		}),
		ssr: true,
	});
}

let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null;

export function getWagmiConfigSingleton() {
	if (!wagmiConfigSingleton) {
		wagmiConfigSingleton = getWagmiConfig();
	}
	return wagmiConfigSingleton;
}

/** Test-only: drop the singleton so env / window changes re-bind connectors. */
export function __resetWagmiConfigForTests() {
	wagmiConfigSingleton = null;
}
