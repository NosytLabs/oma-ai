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

function resolveWalletConnectProjectId(): string | undefined {
	const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

	// Reject known placeholders so we never send 403-bound requests to
	// api.web3modal.org. Real IDs come from https://cloud.walletconnect.com
	const KNOWN_PLACEHOLDERS = new Set([
		"your_walletconnect_project_id",
		"dev-placeholder-project-id",
	]);

	if (rawProjectId && KNOWN_PLACEHOLDERS.has(rawProjectId)) {
		console.warn(
			"[wagmi] NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is a placeholder. " +
				"WalletConnect connector will not be registered. " +
				"Get a free project ID at https://cloud.walletconnect.com",
		);
		return undefined;
	}

	return rawProjectId?.trim() || undefined;
}

function getWagmiConfig() {
	const walletConnectProjectId = resolveWalletConnectProjectId();

	// Always register Coinbase Wallet (SDK popup / extension) so browsers
	// without window.ethereum still get a connect path. Injected is always
	// registered — MetaMask / Brave / Rabby attach when present.
	// WalletConnect is optional (needs a real project ID).
	//
	// Previous behavior returned connectors: [] when ethereum was missing,
	// which broke /login entirely for users without a browser extension
	// (Safari, clean Chrome, mobile in-app browsers without WC).
	const connectors = [
		injected({ shimDisconnect: true }),
		coinbaseWallet({
			appName: "OMA AI",
			appLogoUrl: "https://oma-ai.com/logos/oma-icon-192.png",
		}),
		...(walletConnectProjectId
			? [
					walletConnect({
						projectId: walletConnectProjectId,
						showQrModal: true,
						metadata: {
							name: "OMA AI",
							description: "Open Model Access — AI inference paid in USDC",
							url: "https://oma-ai.com",
							icons: ["https://oma-ai.com/logos/oma-icon-192.png"],
						},
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
