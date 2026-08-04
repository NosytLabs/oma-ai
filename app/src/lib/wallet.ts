"use client";

/**
 * Minimal EIP-1193 wallet client — viem-backed, no wagmi.
 *
 * The app deliberately avoids wagmi to keep the dependency surface
 * small. `window.ethereum` is the standard EIP-1193 injection point;
 * most wallets (MetaMask, Rabby, Rainbow, Coinbase) expose it.
 *
 * If the user has no wallet, `getWalletClient()` returns null and the
 * login page surfaces a "no wallet detected" CTA with a link to
 * common wallets.
 *
 *   import { connectWallet, signSiweMessage } from "@/lib/wallet";
 *   const { address } = await connectWallet();
 *   const { message, signature } = await signSiweMessage(address, nonce, "oma-ai.com");
 */
import { createWalletClient, custom, type WalletClient } from "viem";
import { base } from "viem/chains";
import { SiweMessage } from "siwe";

declare global {
	interface Window {
		ethereum?: {
			request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
			on?: (event: string, handler: (...args: unknown[]) => void) => void;
			removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
		};
	}
}

export const OMA_CHAIN_ID = base.id; // 8453 — Base mainnet.

export interface WalletState {
	address: `0x${string}`;
	chainId: number;
}

function getEthereum(): Window["ethereum"] {
	if (typeof window === "undefined") return undefined;
	return window.ethereum;
}

/**
 * Prompt the user to connect a wallet. Returns the first authorized
 * address (MetaMask's `eth_requestAccounts` returns the most-recently
 * used account first; multi-account UIs can extend this).
 */
export async function connectWallet(): Promise<WalletState> {
	const eth = getEthereum();
	if (!eth) {
		throw new Error(
			"No EIP-1193 wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.",
		);
	}
	const accounts = (await eth.request({
		method: "eth_requestAccounts",
	})) as string[];
	if (!accounts || accounts.length === 0) {
		throw new Error("Wallet returned no accounts — user rejected the request");
	}
	const chainIdHex = (await eth.request({ method: "eth_chainId" })) as string;
	const chainId = Number.parseInt(chainIdHex, 16);
	return { address: accounts[0] as `0x${string}`, chainId };
}

function viemWalletClient(): WalletClient {
	const eth = getEthereum();
	if (!eth) throw new Error("No wallet available");
	return createWalletClient({
		chain: base,
		transport: custom(eth as never),
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
): Promise<{ message: string; signature: string }> {
	const client = viemWalletClient();
	const message = new SiweMessage({
		domain,
		address,
		statement: "Sign in to OMA AI",
		uri: `https://${domain}`,
		version: "1",
		chainId: OMA_CHAIN_ID,
		nonce,
		issuedAt: new Date().toISOString(),
	}).toMessage();
	const signature = await client.signMessage({
		account: address,
		message,
	});
	return { message, signature };
}

/** True iff the browser has any EIP-1193 wallet injected. */
export function hasWallet(): boolean {
	return Boolean(getEthereum());
}

/** Read the connected chainId without prompting. */
async function readChainId(): Promise<number | null> {
	const eth = getEthereum();
	if (!eth) return null;
	try {
		const hex = (await eth.request({ method: "eth_chainId" })) as string;
		return Number.parseInt(hex, 16);
	} catch {
		return null;
	}
}

