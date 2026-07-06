import { createConfig, createStorage, http } from "wagmi";
import { base, baseSepolia } from "wagmi/chains";
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors";

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
	const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

	// Reject known placeholder values so the app doesn't send 403-bound
	// requests to api.web3modal.org. A real project ID must be obtained from
	// https://cloud.walletconnect.com and set in .env.local.
	const KNOWN_PLACEHOLDERS = new Set([
		"your_walletconnect_project_id",
		"dev-placeholder-project-id",
	]);
	const walletConnectProjectId =
		rawProjectId && !KNOWN_PLACEHOLDERS.has(rawProjectId)
			? rawProjectId
			: undefined;

	if (!walletConnectProjectId && rawProjectId) {
		console.warn(
			"[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set to the default placeholder. " +
				"WalletConnect connector will not be registered. " +
				"Get a free project ID at https://cloud.walletconnect.com",
		);
	}

	const connectors = [
		injected(),
		coinbaseWallet({ appName: "OMA AI" }),
		// WalletConnect is only registered when a valid project ID is configured.
		...(walletConnectProjectId
			? [
					walletConnect({
						projectId: walletConnectProjectId,
						showQrModal: true,
					}),
				]
			: []),
	];

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
	});
}

let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null;

export function getWagmiConfigSingleton() {
	if (!wagmiConfigSingleton) {
		wagmiConfigSingleton = getWagmiConfig();
	}
	return wagmiConfigSingleton;
}
