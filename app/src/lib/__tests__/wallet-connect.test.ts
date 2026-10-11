import { beforeEach, describe, expect, it, vi } from "vitest";
import { createWalletConnectWallet, getWalletConnectWallet } from "../wallet-connect";

const mocks = vi.hoisted(() => ({ init: vi.fn() }));
vi.mock("@walletconnect/ethereum-provider", () => ({ EthereumProvider: { init: mocks.init } }));
const PROJECT = "a".repeat(32);
const ADDRESS = "0x0000000000000000000000000000000000000001";

function remoteWallet() {
	const listeners = new Map<string, (...args: unknown[]) => void>();
	const remote = {
		session: undefined as object | undefined,
		accounts: [] as string[], chainId: 8453,
		enable: vi.fn(async () => { remote.session = {}; remote.accounts = [ADDRESS]; return remote.accounts; }),
		request: vi.fn(async () => "0xsignature"),
		disconnect: vi.fn(async () => { remote.session = undefined; remote.accounts = []; listeners.get("disconnect")?.(); }),
		on: (event: string, listener: (...args: unknown[]) => void) => { listeners.set(event, listener); },
	};
	return { remote, listeners };
}

describe("WalletConnect session boundary", () => {
	beforeEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

	it("hides the connector when the project ID is missing or malformed", () => {
		vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "");
		expect(getWalletConnectWallet()).toBeUndefined();
		vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", "YOUR_PROJECT_ID");
		expect(getWalletConnectWallet()).toBeUndefined();
		vi.stubEnv("NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID", PROJECT);
		expect(getWalletConnectWallet()?.name).toBe("WalletConnect");
		expect(mocks.init).not.toHaveBeenCalled();
	});

	it("does not initialize the relay or prompt on discovery and account reads", async () => {
		const wallet = createWalletConnectWallet(PROJECT);
		expect(await wallet.provider.request({ method: "eth_accounts" })).toEqual([]);
		await expect(wallet.provider.request({ method: "personal_sign", params: [] })).rejects.toThrow(/connect/i);
		expect(mocks.init).not.toHaveBeenCalled();
	});

	it("shares initialization and pairing while forwarding later signs exactly once", async () => {
		const { remote } = remoteWallet(); mocks.init.mockResolvedValue(remote);
		const wallet = createWalletConnectWallet(PROJECT);
		const request = { method: "eth_requestAccounts" };
		expect(await Promise.all([wallet.provider.request(request), wallet.provider.request(request)])).toEqual([[ADDRESS], [ADDRESS]]);
		expect(mocks.init).toHaveBeenCalledOnce(); expect(remote.enable).toHaveBeenCalledOnce();
		expect(mocks.init).toHaveBeenCalledWith(expect.objectContaining({ projectId: PROJECT, optionalChains: [8453], showQrModal: true,
			rpcMap: { 8453: `${window.location.origin}/api/rpc/base` }, metadata: expect.objectContaining({ url: window.location.origin }) }));
		const sign = { method: "personal_sign", params: ["0xmessage", ADDRESS] };
		await wallet.provider.request(sign);
		expect(remote.request).toHaveBeenCalledExactlyOnceWith(sign);
	});

	it("allows an explicit retry after a cancelled pairing, without initializing twice", async () => {
		const { remote } = remoteWallet(); mocks.init.mockResolvedValue(remote);
		remote.enable.mockRejectedValueOnce(new Error("User rejected pairing"));
		const wallet = createWalletConnectWallet(PROJECT);
		await expect(wallet.provider.request({ method: "eth_requestAccounts" })).rejects.toThrow(/rejected/);
		expect(await wallet.provider.request({ method: "eth_accounts" })).toEqual([]);
		await expect(wallet.provider.request({ method: "eth_requestAccounts" })).resolves.toEqual([ADDRESS]);
		expect(mocks.init).toHaveBeenCalledOnce(); expect(remote.enable).toHaveBeenCalledTimes(2);
	});

	it("forwards account changes and stops signing after a remote disconnect", async () => {
		const { remote, listeners } = remoteWallet(); mocks.init.mockResolvedValue(remote);
		const wallet = createWalletConnectWallet(PROJECT), changed = vi.fn(), removed = vi.fn();
		wallet.provider.on?.("accountsChanged", changed); wallet.provider.on?.("accountsChanged", removed);
		wallet.provider.removeListener?.("accountsChanged", removed);
		await wallet.provider.request({ method: "eth_requestAccounts" });
		listeners.get("accountsChanged")?.([ADDRESS]); expect(changed).toHaveBeenCalledWith([ADDRESS]); expect(removed).not.toHaveBeenCalled();
		await remote.disconnect();
		expect(await wallet.provider.request({ method: "eth_accounts" })).toEqual([]);
		await expect(wallet.provider.request({ method: "eth_sendTransaction", params: [] })).rejects.toThrow(/connect/i);
		expect(remote.request).not.toHaveBeenCalled();
	});

	it("can retry initialization after a relay setup failure", async () => {
		const { remote } = remoteWallet(); mocks.init.mockRejectedValueOnce(new Error("Relay unavailable")).mockResolvedValueOnce(remote);
		const wallet = createWalletConnectWallet(PROJECT);
		await expect(wallet.provider.request({ method: "eth_requestAccounts" })).rejects.toThrow(/Relay/);
		await expect(wallet.provider.request({ method: "eth_requestAccounts" })).resolves.toEqual([ADDRESS]);
	});
});
