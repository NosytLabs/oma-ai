import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import { hexToBytes, verifyMessage } from "viem";
import {
	OMA_CHAIN_ID,
	connectWallet,
	ensureBaseChain,
	getConnectedAccount,
	hasWallet,
	listWallets,
	resetWalletDiscoveryForTests,
	signSiweMessage,
	subscribeWallets,
	subscribeWalletAccount,
	sendUsdcTransfer,
} from "../wallet";

/**
 * Wallet-connect coverage with a mock EIP-1193 provider.
 *
 * The previous state of this file had no tests at all, which meant the SIWE
 * path was only ever exercised by a real browser with a real extension. The
 * riskiest part is not the UI wiring but whether the message we build is one
 * the server can actually verify, so these tests sign with a real test key
 * and recover the address from the signature. A mock that returned a canned
 * string would pass regardless of whether the SIWE payload were malformed.
 */

// Anvil's first default key. Public, well-known, and safe: it controls no
// real funds and exists only to make signatures reproducible.
const TEST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(TEST_KEY);
const ADDRESS = account.address as `0x${string}`;

type Request = { method: string; params?: unknown[] };

/** Minimal EIP-1193 provider backed by the test account. */
function makeProvider(overrides: Partial<Record<string, unknown>> = {}) {
	const calls: Request[] = [];
	const provider = {
		request: async ({ method, params }: Request) => {
			calls.push({ method, params });
			switch (method) {
				case "eth_requestAccounts":
				case "eth_accounts":
					return overrides.accounts ?? [ADDRESS];
				case "eth_chainId":
					return overrides.chainId ?? "0x2105"; // 8453, Base
				case "personal_sign": {
					// viem hands the provider a HEX-ENCODED message. A real wallet
					// decodes those bytes and signs them; signing the literal
					// "0x6f6d61..." characters instead produces a signature over
					// different bytes, and verification silently fails.
					const [message] = params as [`0x${string}`, string];
					return account.signMessage({ message: { raw: hexToBytes(message) } });
				}
				case "wallet_switchEthereumChain":
					return null;
				default:
					throw new Error(`unexpected method ${method}`);
			}
		},
		on: () => {},
		removeListener: () => {},
	};
	return { provider, calls };
}

function install(provider: unknown) {
	(window as unknown as { ethereum?: unknown }).ethereum = provider;
}

describe("wallet", () => {
	beforeEach(() => {
		delete (window as unknown as { ethereum?: unknown }).ethereum;
		resetWalletDiscoveryForTests();
	});
	afterEach(() => {
		delete (window as unknown as { ethereum?: unknown }).ethereum;
		resetWalletDiscoveryForTests();
	});

	describe("hasWallet", () => {
		it("is false with no injected provider", () => {
			expect(hasWallet()).toBe(false);
		});

		it("is true once a provider is injected", () => {
			install(makeProvider().provider);
			expect(hasWallet()).toBe(true);
		});
	});

	describe("connectWallet", () => {
		it("throws a message naming real wallets when none is injected", async () => {
			await expect(connectWallet()).rejects.toThrow(/MetaMask|Rabby|Coinbase/);
		});

		it("surfaces a user rejection rather than returning empty", async () => {
			install(makeProvider({ accounts: [] }).provider);
			await expect(connectWallet()).rejects.toThrow(/rejected/i);
		});

		it("rejects a malformed address instead of returning it", async () => {
			install(makeProvider({ accounts: ["0xnothex"] }).provider);
			await expect(connectWallet()).rejects.toThrow(/malformed/i);
		});

		it("returns the address in EIP-55 checksum case", async () => {
			// The siwe package rejects a lowercase address at build time, so this
			// normalization is load-bearing, not cosmetic.
			install(makeProvider({ accounts: [ADDRESS.toLowerCase()] }).provider);
			const { address } = await connectWallet();
			expect(address).toBe(ADDRESS);
			expect(address).not.toBe(ADDRESS.toLowerCase());
		});

		it("parses the hex chainId to a number", async () => {
			install(makeProvider({ chainId: "0x1" }).provider);
			expect((await connectWallet()).chainId).toBe(1);
		});
	});

	describe("getConnectedAccount", () => {
		it("returns null when no wallet is injected", async () => {
			expect(await getConnectedAccount()).toBeNull();
		});

		it("returns null rather than throwing when the provider rejects", async () => {
			install({
				request: async () => {
					throw new Error("locked");
				},
			});
			expect(await getConnectedAccount()).toBeNull();
		});

		it("returns null when the wallet has no authorized account", async () => {
			install(makeProvider({ accounts: [] }).provider);
			expect(await getConnectedAccount()).toBeNull();
		});

		it("checksums an authorized account", async () => {
			install(makeProvider({ accounts: [ADDRESS.toLowerCase()] }).provider);
			expect(await getConnectedAccount()).toBe(ADDRESS);
		});
	});

	describe("ensureBaseChain", () => {
		it("does nothing when already on Base", async () => {
			const { provider, calls } = makeProvider({ chainId: "0x2105" });
			install(provider);
			await ensureBaseChain();
			expect(calls.some((c) => c.method === "wallet_switchEthereumChain")).toBe(false);
		});

		it("asks the wallet to switch when on the wrong chain", async () => {
			const { provider, calls } = makeProvider({ chainId: "0x1" });
			install(provider);
			await ensureBaseChain();
			const sw = calls.find((c) => c.method === "wallet_switchEthereumChain");
			expect(sw?.params).toEqual([{ chainId: "0x2105" }]);
		});

		it("throws an actionable error when the switch is refused", async () => {
			install({
				request: async ({ method }: Request) => {
					if (method === "eth_chainId") return "0x1";
					throw new Error("user rejected");
				},
			});
			await expect(ensureBaseChain()).rejects.toThrow(/Base mainnet \(chain id 8453\)/);
		});
	});

	describe("signSiweMessage", () => {
		it("produces a message the server can verify back to the signer", async () => {
			// The real assertion: recover the address from the signature and
			// confirm it matches. A malformed SIWE payload would fail here even
			// though signMessage itself succeeded.
			install(makeProvider().provider);
			const { message, signature } = await signSiweMessage(
				ADDRESS,
				"a1b2c3d4e5f6a7b8",
				"oma-ai.com",
			);
			expect(
				await verifyMessage({
					address: ADDRESS,
					message,
					signature: signature as `0x${string}`,
				}),
			).toBe(true);
		});

		it("builds an EIP-4361 payload with the expected fields", async () => {
			install(makeProvider().provider);
			const { message } = await signSiweMessage(
				ADDRESS,
				"a1b2c3d4e5f6a7b8",
				"oma-ai.com",
			);
			const lines = message.split("\n");
			expect(lines[0]).toBe("oma-ai.com wants you to sign in with your Ethereum account:");
			expect(lines[1]).toBe(ADDRESS);
			expect(message).toContain("oma-ai.com wants you to sign in with your Ethereum account:");
			expect(message).toContain("Sign in to OMA AI");
			// Base is 8453 = 0x2105
			expect(message).toContain("8453");
			expect(message).toContain("a1b2c3d4e5f6a7b8");
			expect(message).toContain("https://oma-ai.com");
		});

		it("rejects a malformed address before asking the wallet to sign", async () => {
			const { provider, calls } = makeProvider();
			install(provider);
			await expect(
				signSiweMessage("0xnope" as `0x${string}`, "a1b2c3d4e5f6a7b8", "oma-ai.com"),
			).rejects.toThrow(/malformed/i);
			// Nothing should have been sent to the wallet.
			expect(calls).toHaveLength(0);
		});

		it("propagates a user rejection from the wallet", async () => {
			install({
				request: async ({ method }: Request) => {
					if (method === "personal_sign") throw new Error("User rejected the request");
					return null;
				},
			});
			await expect(
				signSiweMessage(ADDRESS, "a1b2c3d4e5f6a7b8", "oma-ai.com"),
			).rejects.toThrow(/rejected/i);
		});

		it("normalizes a lowercase address so siwe can build the message", async () => {
			install(makeProvider().provider);
			const { message } = await signSiweMessage(
				ADDRESS.toLowerCase() as `0x${string}`,
				"a1b2c3d4e5f6a7b8",
				"oma-ai.com",
			);
			// The address line must be checksummed, not the lowercase input.
			expect(message).toContain(ADDRESS);
		});
	});

	it("targets Base mainnet", () => {
		expect(OMA_CHAIN_ID).toBe(8453);
	});

	it("does not retry a failing signature prompt automatically", async () => {
		const request = vi.fn(async ({ method }: { method: string }) => {
			if (method === "personal_sign") throw new Error("Wallet disconnected");
			return [];
		});
		install({ request });
		await expect(signSiweMessage(ADDRESS, "a1b2c3d4e5f6a7b8", "oma-ai.com")).rejects.toThrow();
		expect(request.mock.calls.filter(([args]) => args.method === "personal_sign")).toHaveLength(1);
	});

	it("keeps providers with the same wallet brand distinct by EIP-6963 UUID", () => {
		const first = makeProvider();
		const second = makeProvider();
		listWallets();
		for (const [uuid, provider] of [["wallet-one", first.provider], ["wallet-two", second.provider]] as const) {
			window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid, rdns: "io.example", name: "Example" }, provider } }));
		}
		expect(listWallets().filter(wallet => wallet.name === "Example").map(wallet => wallet.id)).toEqual(["wallet-one", "wallet-two"]);
	});

	it("discovers synchronously announced wallets without recursively announcing forever", () => {
		const { provider } = makeProvider();
		const onRequest = () => window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail: { info: { uuid: "sync-wallet", name: "Example" }, provider } }));
		window.addEventListener("eip6963:requestProvider", onRequest);
		const seen: string[][] = [];
		let unsubscribe: (() => void) | undefined;
		try {
			unsubscribe = subscribeWallets(() => {
				if (seen.length > 3) throw new Error("Recursive wallet discovery");
				seen.push(listWallets().map(wallet => wallet.id));
			});
			expect(seen.some(ids => ids.includes("sync-wallet"))).toBe(true);
			listWallets();
			expect(seen.length).toBeLessThanOrEqual(2);
		} finally {
			unsubscribe?.(); window.removeEventListener("eip6963:requestProvider", onRequest);
		}
	});

	it("does not automatically retry a failed transfer prompt", async () => {
		const request = vi.fn(async ({ method }: Request) => {
			if (method === "eth_chainId") return "0x2105";
			if (method === "eth_accounts") return [ADDRESS];
			if (method === "eth_sendTransaction") throw new Error("Wallet disconnected");
			return [];
		});
		install({ request });
		await expect(sendUsdcTransfer({ to: "0x0000000000000000000000000000000000000002", from: ADDRESS, amountUsd: 10 })).rejects.toThrow();
		expect(request.mock.calls.filter(([args]) => args.method === "eth_sendTransaction")).toHaveLength(1);
	});

	it("blocks a transfer if the authorized account changed since the form was filled", async () => {
		const { provider, calls } = makeProvider({ accounts: ["0x0000000000000000000000000000000000000001"] });
		install(provider);
		await expect(sendUsdcTransfer({ to: "0x0000000000000000000000000000000000000002", from: ADDRESS, amountUsd: 10 })).rejects.toThrow(/account changed/i);
		expect(calls.some(call => call.method === "eth_sendTransaction")).toBe(false);
	});

	it("updates the displayed account when the selected wallet changes or disconnects", async () => {
		let current = ADDRESS;
		const handlers = new Map<string, (...args: unknown[]) => void>();
		install({
			request: async () => [current],
			on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
			removeListener: (event: string) => handlers.delete(event),
		});
		const seen: Array<string | null> = [];
		const unsubscribe = subscribeWalletAccount(address => seen.push(address));
		try {
			await vi.waitFor(() => expect(seen.at(-1)).toBe(ADDRESS));
			current = "0x0000000000000000000000000000000000000001";
			handlers.get("accountsChanged")?.([current]);
			await vi.waitFor(() => expect(seen.at(-1)).toBe(current));
			handlers.get("disconnect")?.();
			expect(seen.at(-1)).toBeNull();
		} finally { unsubscribe(); }
		expect(handlers.size).toBe(0);
	});

	it("connects an EIP-6963 wallet when window.ethereum is absent", async () => {
		const { provider } = makeProvider();
		const onRequest = () => {
			window.dispatchEvent(
				new CustomEvent("eip6963:announceProvider", {
					detail: {
						info: { rdns: "io.metamask", name: "MetaMask", uuid: "mm" },
						provider,
					},
				}),
			);
		};
		window.addEventListener("eip6963:requestProvider", onRequest);
		try {
			const { address } = await connectWallet();
			expect(address).toBe(ADDRESS);
		expect(listWallets().some((wallet) => wallet.id === "mm")).toBe(true);
		} finally {
			window.removeEventListener("eip6963:requestProvider", onRequest);
		}
	});

	it("connects the wallet the user picked, not the other extension", async () => {
		const other = "0x0000000000000000000000000000000000000001";
		const first = makeProvider();
		const second = makeProvider({ accounts: [other] });
		(window as unknown as { ethereum?: unknown }).ethereum = {
			request: async () => {
				throw new Error("aggregate");
			},
			providers: [first.provider, second.provider],
		};
		const picked = listWallets().find((wallet) => wallet.provider === second.provider);
		expect(picked?.name).toBe("Browser wallet");
		const { address } = await connectWallet(picked?.id);
		expect(address).toBe("0x0000000000000000000000000000000000000001");
	});

	it("keeps the chosen provider when reconnecting from the deposit form", async () => {
		const first = makeProvider();
		const second = makeProvider({ accounts: ["0x0000000000000000000000000000000000000001"] });
		install({ ...first.provider, providers: [first.provider, second.provider] });
		const chosen = listWallets().find(wallet => wallet.provider === second.provider)!;
		await connectWallet(chosen.id);
		expect((await connectWallet()).address).toBe("0x0000000000000000000000000000000000000001");
		expect(first.calls.some(call => call.method === "eth_requestAccounts")).toBe(false);
	});

	it("signs with the connected provider, not a later window.ethereum overwrite", async () => {
		const real = makeProvider();
		const onRequest = () => {
			window.dispatchEvent(
				new CustomEvent("eip6963:announceProvider", {
					detail: {
						info: { rdns: "io.rabby", name: "Rabby", uuid: "rb" },
						provider: real.provider,
					},
				}),
			);
		};
		window.addEventListener("eip6963:requestProvider", onRequest);
		try {
			await connectWallet("rb");
			(window as unknown as { ethereum?: unknown }).ethereum = {
				request: async () => {
					throw new Error("decoy");
				},
			};
			const { signature } = await signSiweMessage(ADDRESS, "a1b2c3d4e5f6a7b8", "oma-ai.com");
			expect(signature).toMatch(/^0x/);
		} finally {
			window.removeEventListener("eip6963:requestProvider", onRequest);
		}
	});
});
