"use client";

import type { EthereumProvider as EthereumProviderConstructor } from "@walletconnect/ethereum-provider";
import type { DiscoveredWallet, Eip1193Provider } from "./wallet";
import { walletConnectProjectId } from "./wallet-connect-config";

type Handler = (...args: unknown[]) => void;
type RemoteProvider = InstanceType<typeof EthereumProviderConstructor>;

/** Stable EIP-1193 adapter. Relay initialization and pairing happen only after a click. */
export function createWalletConnectWallet(projectId: string): DiscoveredWallet {
	let remote: RemoteProvider | undefined;
	let initializing: Promise<RemoteProvider> | undefined;
	let pairing: Promise<string[]> | undefined;
	const handlers = new Map<string, Set<Handler>>();

	async function initialize(): Promise<RemoteProvider> {
		if (remote) return remote;
		if (!initializing) {
			initializing = (async () => {
				const { EthereumProvider } = await import("@walletconnect/ethereum-provider");
				const origin = window.location.origin;
				const provider = await EthereumProvider.init({
					projectId, showQrModal: true, optionalChains: [8453], telemetryEnabled: false,
					optionalMethods: ["personal_sign", "eth_sendTransaction", "eth_signTypedData_v4", "wallet_switchEthereumChain"],
					rpcMap: { 8453: `${origin}/api/rpc/base` },
					metadata: { name: "OMA AI", description: "Sign in and fund your OMA AI account on Base", url: origin, icons: [`${origin}/favicon.ico`] },
				});
				for (const event of ["accountsChanged", "chainChanged", "disconnect"] as const) {
					provider.on(event, (...args: unknown[]) => {
						for (const handler of handlers.get(event) ?? []) handler(...args);
					});
				}
				remote = provider;
				return provider;
			})().finally(() => { initializing = undefined; });
		}
		return initializing;
	}

	const adapter: Eip1193Provider = {
		async request(args) {
			if (args.method === "eth_accounts") return remote?.session ? remote.accounts : [];
			if (args.method === "eth_chainId") return `0x${(remote?.chainId ?? 8453).toString(16)}`;
			if (args.method === "eth_requestAccounts") {
				if (!pairing) pairing = initialize().then(provider => provider.enable()).finally(() => { pairing = undefined; });
				return pairing;
			}
			if (!remote?.session) throw new Error("Connect WalletConnect before signing or sending a transaction.");
			// No automatic retries: a sign or send must require an explicit user action.
			return remote.request(args);
		},
		on(event, handler) {
			if (!handlers.has(event)) handlers.set(event, new Set());
			handlers.get(event)!.add(handler);
		},
		removeListener(event, handler) { handlers.get(event)?.delete(handler); },
	};
	return { id: "walletconnect", name: "WalletConnect", provider: adapter };
}

let configured: { projectId: string; wallet: DiscoveredWallet } | undefined;
export function getWalletConnectWallet(): DiscoveredWallet | undefined {
	const projectId = walletConnectProjectId();
	if (!projectId || typeof window === "undefined") return undefined;
	if (configured?.projectId !== projectId) configured = { projectId, wallet: createWalletConnectWallet(projectId) };
	return configured.wallet;
}
