"use client";

/**
 * EIP-1193 wallet client — viem-backed, no wagmi.
 *
 * Discovery order (EIP-6963, then the legacy injection):
 *   1. providers that answered `eip6963:requestProvider`
 *   2. `window.ethereum.providers` when several extensions fight over the slot
 *   3. `window.ethereum` itself
 *
 * Connecting stores that provider. Later signs and transfers use it, not
 * whichever extension last overwrote `window.ethereum`.
 *
 *   import { connectWallet, signSiweMessage } from "@/lib/wallet";
 *   const { address } = await connectWallet();
 *   const { message, signature } = await signSiweMessage(address, nonce, "oma-ai.com");
 */
import { createWalletClient, custom, encodeFunctionData, getAddress, parseUnits, type WalletClient } from "viem";
import { base } from "viem/chains";
import { SiweMessage } from "siwe";

export type Eip1193Provider = {
	request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
	on?: (event: string, handler: (...args: unknown[]) => void) => void;
	removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
	providers?: Eip1193Provider[];
	isRabby?: boolean;
	isCoinbaseWallet?: boolean;
	isRainbow?: boolean;
	isMetaMask?: boolean;
};

export interface DiscoveredWallet {
	id: string;
	name: string;
	provider: Eip1193Provider;
}

declare global {
	interface Window {
		ethereum?: Eip1193Provider;
	}
}

const NO_WALLET =
	"No EIP-1193 wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.";

const announced = new Map<string, DiscoveredWallet>();
const walletListeners = new Set<() => void>();
const providerListeners = new Set<() => void>();
let listening = false;
let activeProvider: Eip1193Provider | undefined;

function notifyWallets() {
	for (const listener of walletListeners) listener();
	for (const listener of providerListeners) listener();
}

function installEip6963Listener() {
	if (listening || typeof window === "undefined") return;
	listening = true;
	window.addEventListener("eip6963:announceProvider", (event: Event) => {
		const detail = (
			event as CustomEvent<{
				info?: { uuid?: string; name?: string; rdns?: string };
				provider?: Eip1193Provider;
			}>
		).detail;
		const provider = detail?.provider;
		if (!provider || typeof provider.request !== "function") return;
		const id = detail.info?.uuid || detail.info?.rdns || `eip6963-${announced.size}`;
		const previous = announced.get(id);
		const name = detail.info?.name || "Wallet";
		if (previous?.provider === provider && previous.name === name) return;
		announced.set(id, {
			id,
			name,
			provider,
		});
		notifyWallets();
	});
}

/** Ask injected wallets to announce. Safe to call more than once. */
export function requestWalletDiscovery(): void {
	installEip6963Listener();
	if (typeof window === "undefined") return;
	window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export function subscribeWallets(listener: () => void): () => void {
	walletListeners.add(listener);
	requestWalletDiscovery();
	// Legacy providers do not announce; publish the initial inventory too.
	listener();
	return () => {
		walletListeners.delete(listener);
	};
}

function legacyName(provider: Eip1193Provider): string {
	// Rabby and Coinbase also set isMetaMask. Check the specific flag first.
	if (provider.isRabby) return "Rabby";
	if (provider.isCoinbaseWallet) return "Coinbase Wallet";
	if (provider.isRainbow) return "Rainbow";
	if (provider.isMetaMask) return "MetaMask";
	return "Browser wallet";
}

/** Wallets this page can actually call. Deduped by provider object. */
export function listWallets(): DiscoveredWallet[] {
	requestWalletDiscovery();
	const out: DiscoveredWallet[] = [];
	const seen = new Set<Eip1193Provider>();
	for (const wallet of announced.values()) {
		if (seen.has(wallet.provider)) continue;
		seen.add(wallet.provider);
		out.push(wallet);
	}
	const eth = typeof window === "undefined" ? undefined : window.ethereum;
	const legacy = Array.isArray(eth?.providers)
		? eth.providers.filter((provider) => provider && typeof provider.request === "function")
		: eth && typeof eth.request === "function"
			? [eth]
			: [];
	legacy.forEach((provider, index) => {
		if (seen.has(provider)) return;
		seen.add(provider);
		const name = legacyName(provider);
		out.push({ id: `${name}-${index}`, name, provider });
	});
	return out;
}

function getProvider(): Eip1193Provider | undefined {
	if (activeProvider && typeof activeProvider.request === "function") return activeProvider;
	return listWallets()[0]?.provider;
}

/** Test-only. Module state would otherwise leak across cases. */
export function resetWalletDiscoveryForTests(): void {
	announced.clear();
	activeProvider = undefined;
}

export const OMA_CHAIN_ID = base.id; // 8453 — Base mainnet.

export interface WalletState {
	address: `0x${string}`;
	chainId: number;
}

/**
 * Prompt the user to connect a wallet. `walletId` selects one entry from
 * `listWallets()` when several extensions are installed. Returns the first
 * authorized address.
 */
export async function connectWallet(walletId?: string): Promise<WalletState> {
	const wallets = listWallets();
	const chosen = walletId
		? wallets.find((wallet) => wallet.id === walletId)
		: wallets.find(wallet => wallet.provider === activeProvider) ?? wallets[0];
	if (!chosen) {
		throw new Error(
			walletId ? "That wallet is no longer available. Reload and try again." : NO_WALLET,
		);
	}
	const accounts = (await chosen.provider.request({
		method: "eth_requestAccounts",
	})) as string[];
	if (!accounts || accounts.length === 0) {
		throw new Error("Wallet returned no accounts — user rejected the request");
	}
	const chainIdHex = (await chosen.provider.request({ method: "eth_chainId" })) as string;
	const chainId = Number.parseInt(chainIdHex, 16);
	// Normalize to EIP-55 checksum case. Some wallets return all-lowercase
	// accounts, which the `siwe` package rejects at message build time
	// ("line 2: invalid EIP-55 address"). getAddress accepts any hex case.
	let address: `0x${string}`;
	try {
		address = getAddress(accounts[0]);
	} catch {
		throw new Error("Wallet returned a malformed address — please try a different account");
	}
	activeProvider = chosen.provider;
	for (const listener of providerListeners) listener();
	return { address, chainId };
}

function requireActiveOperation(isActive?: () => boolean): void {
	if (isActive && !isActive()) throw new Error("This deposit request is no longer active.");
}

function guardedProvider(eth: Eip1193Provider, isActive?: () => boolean): Eip1193Provider {
	return { request: (args) => {
		requireActiveOperation(isActive);
		return eth.request(args);
	} };
}

function viemWalletClient(isActive?: () => boolean): WalletClient {
	const eth = getProvider();
	if (!eth) throw new Error("No wallet available");
	return createWalletClient({
		chain: base,
		// A wallet prompt must be explicitly retried by the user, never automatically.
		transport: custom(guardedProvider(eth, isActive) as never, { retryCount: 0 }),
	});
}

/**
	* Build, sign, and return an EIP-4361 SIWE message addressed to OMA.
	* The returned `message` is what the server's `verifyMessage` will
	* re-derive and verify against `signature` using viem's recoverMessage.
	*/
export async function signSiweMessage(
	address: `0x${string}`,
	nonce: string,
	domain: string,
	uri = `https://${domain}`,
): Promise<{ message: string; signature: string }> {
	// Defensive: callers may pass a raw (lowercase) account. SIWE requires
	// EIP-55 checksum case on the address line — normalize before building.
	let checksummed: `0x${string}`;
	try {
		checksummed = getAddress(address);
	} catch {
		throw new Error("Wallet returned a malformed address — please try a different account");
	}
	// Network/permission prompts can change the selected account after connect.
	// Do not ask the wallet to sign a stale identity or move to another provider.
	const provider = getProvider();
	await requireSendingAccount(checksummed);
	if (getProvider() !== provider) throw new Error("Wallet changed. Reconnect the original wallet and try again.");
	const client = viemWalletClient();
	const message = new SiweMessage({
		domain,
		address: checksummed,
		statement: "Sign in to OMA AI",
		uri,
		version: "1",
		chainId: OMA_CHAIN_ID,
		nonce,
		issuedAt: new Date().toISOString(),
	}).toMessage();
	const signature = await client.signMessage({
		account: checksummed,
		message,
	});
	return { message, signature };
}

/** True when an injected EIP-1193 browser wallet is available. */
export function hasWallet(): boolean {
	return listWallets().length > 0;
}

/**
 * Returns the currently authorized account without prompting
 * (`eth_accounts`), or null when the wallet is locked / not connected.
 */
export async function getConnectedAccount(): Promise<`0x${string}` | null> {
	const eth = getProvider();
	if (!eth) return null;
	try {
		const accounts = (await eth.request({ method: "eth_accounts" })) as string[];
		if (!accounts?.[0]) return null;
		try {
			return getAddress(accounts[0]);
		} catch {
			return null;
		}
	} catch {
		return null;
	}
}

/** Observe the selected wallet without requesting new permissions. */
export function subscribeWalletAccount(listener: (address: `0x${string}` | null) => void): () => void {
	let provider: Eip1193Provider | undefined;
	let disposed = false;
	let revision = 0;
	const refresh = () => {
		const current = ++revision;
		void getConnectedAccount().then(address => {
			if (!disposed && current === revision) listener(address);
		});
	};
	const disconnected = () => { ++revision; listener(null); };
	const detach = () => {
		provider?.removeListener?.("accountsChanged", refresh);
		provider?.removeListener?.("chainChanged", refresh);
		provider?.removeListener?.("disconnect", disconnected);
	};
	const bind = () => {
		const next = getProvider();
		if (next !== provider) {
			detach(); provider = next;
			provider?.on?.("accountsChanged", refresh);
			provider?.on?.("chainChanged", refresh);
			provider?.on?.("disconnect", disconnected);
		}
		refresh();
	};
	providerListeners.add(bind);
	bind();
	return () => { disposed = true; ++revision; detach(); providerListeners.delete(bind); };
}

async function requireSendingAccount(address: `0x${string}`): Promise<void> {
	const current = await getConnectedAccount();
	if (!current || current.toLowerCase() !== address.toLowerCase()) {
		throw new Error("Wallet account changed. Reconnect the original wallet and try again.");
	}
}

/** Switches the connected wallet to Base mainnet, prompting when needed. */
export async function ensureBaseChain(isActive?: () => boolean): Promise<void> {
	requireActiveOperation(isActive);
	const eth = getProvider();
	if (!eth) {
		throw new Error(NO_WALLET);
	}
	const hex = (await eth.request({ method: "eth_chainId" })) as string;
	requireActiveOperation(isActive);
	if (Number.parseInt(hex, 16) === OMA_CHAIN_ID) return;
	try {
		await eth.request({
			method: "wallet_switchEthereumChain",
			params: [{ chainId: `0x${OMA_CHAIN_ID.toString(16)}` }],
		});
	} catch {
		throw new Error(
			`Switch your wallet to Base mainnet (chain id ${OMA_CHAIN_ID}) and try again.`,
		);
	}
	requireActiveOperation(isActive);
}

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** Canonical deposit authorization message a wallet signs (must match server). */
export function buildDepositSignMessage(args: {
	fromAddress: string;
	challengeToken: string;
	depositAddress: string;
	/** Optional on-chain tx hash this authorization is bound to. */
	txHash?: string;
	/** Optional declared USD amount this authorization is bound to. */
	amountUsd?: number | string;
}): string {
	const lines = [
		"OMA-AI deposit authorization",
		"",
		`Sending wallet: ${args.fromAddress}`,
		`Deposit to: ${args.depositAddress}`,
		`Challenge: ${args.challengeToken}`,
	];
	if (args.txHash) lines.push(`Transaction: ${args.txHash}`);
	if (args.amountUsd !== undefined) lines.push(`Amount USD: ${args.amountUsd}`);
	return lines.join("\n");
}

/** Sign the canonical deposit message with the connected wallet. */
export async function signDepositMessage(args: {
	fromAddress: `0x${string}`;
	challengeToken: string;
	depositAddress: string;
	txHash?: string;
	amountUsd?: number | string;
	isActive?: () => boolean;
}): Promise<string> {
	requireActiveOperation(args.isActive);
	await requireSendingAccount(args.fromAddress);
	requireActiveOperation(args.isActive);
	const client = viemWalletClient(args.isActive);
	const message = buildDepositSignMessage({
		fromAddress: args.fromAddress,
		challengeToken: args.challengeToken,
		depositAddress: args.depositAddress,
		txHash: args.txHash,
		amountUsd: args.amountUsd,
	});
	return client.signMessage({
		account: args.fromAddress,
		message,
	});
}

const USDC_TRANSFER_ABI = [
	{
		type: "function",
		name: "transfer",
		stateMutability: "nonpayable",
		inputs: [
			{ type: "address", name: "to" },
			{ type: "uint256", name: "value" },
		],
		outputs: [{ type: "bool", name: "" }],
	},
] as const;

/**
	* Sends `amountUsd` USDC from the connected wallet to `to` on Base.
	* Prompts the user in their wallet (popup / extension). Returns the
	* transaction hash once the user confirms and the tx is broadcast.
	*/
export async function sendUsdcTransfer({
	to,
	amountUsd,
	from,
	isActive,
}: {
	to: `0x${string}`;
	amountUsd: number;
	from: `0x${string}`;
	isActive?: () => boolean;
}): Promise<{ txHash: `0x${string}` }> {
	// Never round a customer's transfer upward or silently send zero USDC.
	const decimal = String(amountUsd);
	if (!Number.isFinite(amountUsd) || amountUsd <= 0 || !/^\d+(\.\d{1,6})?$/.test(decimal)) {
		throw new Error("Amount must be positive USDC with at most six decimal places.");
	}
	const value = parseUnits(decimal, 6);
	const eth = getProvider();
	if (!eth) {
		throw new Error(NO_WALLET);
	}
	requireActiveOperation(isActive);
	await requireSendingAccount(from);
	requireActiveOperation(isActive);
	await ensureBaseChain(isActive);
	// A chain-switch prompt can also change the wallet's selected account.
	await requireSendingAccount(from);
	requireActiveOperation(isActive);
	if (getProvider() !== eth) throw new Error("Wallet changed. Reconnect the original sending wallet and try again.");
	const client = createWalletClient({
		chain: base,
		transport: custom(guardedProvider(eth, isActive) as never, { retryCount: 0 }),
	});
	const txHash = await client.sendTransaction({
		account: from,
		to: USDC_BASE,
		data: encodeFunctionData({
			abi: USDC_TRANSFER_ABI,
			functionName: "transfer",
			args: [to, value],
		}),
	});
	return { txHash };
}
