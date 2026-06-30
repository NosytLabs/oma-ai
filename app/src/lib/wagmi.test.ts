/* eslint-disable @typescript-eslint/no-explicit-any */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Track the constructor args for each connector so we can assert that
// WalletConnect is only registered when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
// is set. We stub wagmi/connectors so the test doesn't need a window or
// actual WalletConnect runtime.
const connectorCalls = vi.hoisted(
	() => [] as Array<{ name: string; args: unknown }>,
);

vi.mock("wagmi/connectors", () => {
	// wagmi v3 connectors are created by calling coinbaseWallet({...}), injected(),
	// etc., and each call returns a CreateConnectorFn — a function that wagmi
	// later invokes with { emitter, chains, ... }. Track each construction so we
	// can assert what's registered.
	const makeSpy = (name: string) => {
		const factory = (...args: unknown[]) => {
			connectorCalls.push({ name, args });
			// Return a CreateConnectorFn that, when called by createConfig, returns
			// a minimal Connector-shaped stub.
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
		coinbaseWallet: makeSpy("coinbaseWallet"),
		walletConnect: makeSpy("walletConnect"),
	};
});

describe("getWagmiConfigSingleton", () => {
	const ORIGINAL_PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;

	// Reset the wagmi module between tests so the singleton cache (and the
	// connector call log) starts fresh each time.
	beforeEach(async () => {
		vi.resetModules();
		connectorCalls.length = 0;
	});

	afterEach(() => {
		if (ORIGINAL_PROJECT_ID === undefined) {
			delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		} else {
			process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID = ORIGINAL_PROJECT_ID;
		}
	});

	const loadSingleton = async () => {
		const mod = await import("./wagmi");
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		return mod.getWagmiConfigSingleton() as any;
	};

	it("registers injected and coinbaseWallet connectors", async () => {
		delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		const config = await loadSingleton();

		const names = connectorCalls.map((c) => c.name);
		expect(names).toContain("injected");
		expect(names).toContain("coinbaseWallet");
		expect(config.connectors).toHaveLength(2);
	});

	it("does NOT register walletConnect when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is unset", async () => {
		delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		const config = await loadSingleton();

		const names = connectorCalls.map((c) => c.name);
		expect(names).not.toContain("walletConnect");
		expect(config.connectors).toHaveLength(2);
	});

	it("registers walletConnect when NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID is set", async () => {
		process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID =
			"test-walletconnect-project-id";
		const config = await loadSingleton();

		const names = connectorCalls.map((c) => c.name);
		expect(names).toContain("walletConnect");

		const wcCall = connectorCalls.find((c) => c.name === "walletConnect");
		expect(wcCall).toBeDefined();
		// biome-ignore lint/suspicious/noExplicitAny: test file uses any for mocking
		const wcArgs = wcCall as any;
		expect(wcArgs.args[0].projectId).toBe("test-walletconnect-project-id");
		expect(config.connectors).toHaveLength(3);
	});

	it("always configures Base + Base Sepolia chains", async () => {
		delete process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
		const config = await loadSingleton();

		const ids = config.chains.map((c: { id: number }) => c.id);
		expect(ids).toContain(8453); // base mainnet
		expect(ids).toContain(84532); // base sepolia
	});
});
