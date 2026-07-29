import { createConfig, createStorage, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
// Import the connector directly instead of the barrel. The barrel eagerly
// resolves optional Base/Coinbase/Safe/WalletConnect/Porto adapters, which
// adds unavailable peer warnings and unnecessary client bundle work even
// though OMA intentionally supports the standard injected EIP-1193 path.
import { injected } from "wagmi/connectors/injected";

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

