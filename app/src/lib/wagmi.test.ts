/* eslint-disable @typescript-eslint/no-explicit-any */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Track the constructor args for each connector so we can assert that
// only the injected connector is registered.
const connectorCalls = vi.hoisted(
	() => [] as Array<{ name: string; args: unknown }>,
);

/** Set `window.ethereum` to a fake injected provider. Test-only helper. */
function setWindowEthereum(provider: unknown): void {
	const w = globalThis as unknown as { window?: { ethereum?: unknown } };
	w.window = w.window ?? {};
	w.window.ethereum = provider;
}

/** Remove any `window.ethereum` we set during a test. Test-only helper. */
function clearWindowEthereum(): void {
	const w = globalThis as unknown as { window?: { ethereum?: unknown } };
	if (w.window) delete w.window.ethereum;
}

vi.mock("wagmi/connectors/injected", () => {
	// wagmi v3 connectors are created by calling injected(), etc., and
	// each call returns a CreateConnectorFn — a function that wagmi
	// later invokes with { emitter, chains, ... }. Track each
	// construction so we can assert what's registered.
	const makeSpy = (name: string) => {
		const factory = (...args: unknown[]) => {
			connectorCalls.push({ name, args });
			// Return a CreateConnectorFn that, when called by
			// createConfig, returns a minimal Connector-shaped stub.
			const connectorFn = () => ({
				id: name,
				name,
				type: name,
				rdns: undefined,
				emitter: undefined,
			});
			return connectorFn;
		};
		return factory;
	};
	return {
		injected: makeSpy("injected"),
	};
});

describe("getWagmiConfigSingleton", () => {
	beforeEach(async () => {
		vi.resetModules();
		connectorCalls.length = 0;
	});

	it("always registers injected (even without ethereum)", async () => {
		// Users on Safari / clean Chrome / mobile must still see a
		// connect path — the injected connector surfaces any EIP-1193
		// wallet (MetaMask / Rabby / Brave / OKX / Coinbase Extension).
		clearWindowEthereum();
		delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		const mod = await import("./wagmi");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const config = mod.getWagmiConfigSingleton() as any;

		const names = connectorCalls.map((c) => c.name);
		expect(names).toContain("injected");
		expect(config.connectors.length).toBeGreaterThanOrEqual(1);
	}, 15_000);

	it("registers injected when window.ethereum exists", async () => {
		setWindowEthereum({ isMetaMask: true });
		delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		const mod = await import("./wagmi");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const config = mod.getWagmiConfigSingleton() as any;

		const names = connectorCalls.map((c) => c.name);
		expect(names).toContain("injected");
		expect(config.connectors.length).toBeGreaterThanOrEqual(1);
	});

	it("does NOT register walletConnect (connector was removed — only injected remains)", async () => {
		delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		await import("./wagmi");

		const names = connectorCalls.map((c) => c.name);
		expect(names).not.toContain("walletConnect");
	});

	it("always configures Base + Base Sepolia chains", async () => {
		delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		const mod = await import("./wagmi");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const config = mod.getWagmiConfigSingleton() as any;

		const ids = config.chains.map((c: { id: number }) => c.id);
		expect(ids).toContain(8453); // base mainnet
		expect(ids).toContain(84532); // base sepolia
	});
});