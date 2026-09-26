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
import { createWalletClient, custom, encodeFunctionData, getAddress, type WalletClient } from "viem";
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
	// Normalize to EIP-55 checksum case. Some wallets return all-lowercase
	// accounts, which the `siwe` package rejects at message build time
	// ("line 2: invalid EIP-55 address"). getAddress accepts any hex case.
	let address: `0x${string}`;
	try {
		address = getAddress(accounts[0]);
	} catch {
		throw new Error("Wallet returned a malformed address — please try a different account");
	}
	return { address, chainId };
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
	// Defensive: callers may pass a raw (lowercase) account. SIWE requires
	// EIP-55 checksum case on the address line — normalize before building.
	let checksummed: `0x${string}`;
	try {
		checksummed = getAddress(address);
	} catch {
		throw new Error("Wallet returned a malformed address — please try a different account");
	}
	const message = new SiweMessage({
		domain,
		address: checksummed,
		statement: "Sign in to OMA AI",
		uri: `https://${domain}`,
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

/** True iff the browser has any EIP-1193 wallet injected. */
export function hasWallet(): boolean {
	return Boolean(getEthereum());
}

/**
 * Returns the currently authorized account without prompting
 * (`eth_accounts`), or null when the wallet is locked / not connected.
 */
export async function getConnectedAccount(): Promise<`0x${string}` | null> {
	const eth = getEthereum();
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

/** Switches the wallet to Base mainnet, prompting when needed. */
export async function ensureBaseChain(): Promise<void> {
	const eth = getEthereum();
	if (!eth) {
		throw new Error(
			"No EIP-1193 wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.",
		);
	}
	const hex = (await eth.request({ method: "eth_chainId" })) as string;
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
}

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;

/** Canonical deposit authorization message a wallet signs (must match server). */
export function buildDepositSignMessage(args: {
	fromAddress: string;
	challengeToken: string;
	depositAddress: string;
}): string {
	return [
		"OMA-AI deposit authorization",
		"",
		`Sending wallet: ${args.fromAddress}`,
		`Deposit to: ${args.depositAddress}`,
		`Challenge: ${args.challengeToken}`,
	].join("\n");
}

/** Sign the canonical deposit message with the connected wallet. */
export async function signDepositMessage(args: {
	fromAddress: `0x${string}`;
	challengeToken: string;
	depositAddress: string;
}): Promise<string> {
	const client = viemWalletClient();
	const message = buildDepositSignMessage({
		fromAddress: args.fromAddress,
		challengeToken: args.challengeToken,
		depositAddress: args.depositAddress,
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
}: {
	to: `0x${string}`;
	amountUsd: number;
	from: `0x${string}`;
}): Promise<{ txHash: `0x${string}` }> {
	const eth = getEthereum();
	if (!eth) {
		throw new Error(
			"No EIP-1193 wallet detected. Install MetaMask, Rabby, or Coinbase Wallet.",
		);
	}
	await ensureBaseChain();
	const client = createWalletClient({
		chain: base,
		transport: custom(eth as never),
	});
	const value = BigInt(Math.round(amountUsd * 1_000_000)); // USDC is 6 decimals.
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

