import { describe, expect, it, vi } from "vitest";

vi.mock("../../constants.js", () => ({
	USDC_BASE: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
	USDC_DECIMALS: 6,
}));

import {
	isSupportedSettlementAsset,
	resolveSettlementNetwork,
} from "../eip3009.js";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

describe("settlement network and asset pinning", () => {
	it("resolves the Base mainnet domain", () => {
		const domain = resolveSettlementNetwork("base");
		expect(domain.chainId).toBe(8453);
		expect(domain.verifyingContract.toLowerCase()).toBe(USDC_BASE.toLowerCase());
	});

	it("is case-insensitive on the network key", () => {
		expect(resolveSettlementNetwork("BASE").chainId).toBe(8453);
	});

	it("refuses an unknown network instead of falling back to Base", () => {
		expect(() => resolveSettlementNetwork("ethereum-mainnet")).toThrow(
			/Unsupported settlement network/,
		);
		expect(() => resolveSettlementNetwork("eip155:1")).toThrow();
		expect(() => resolveSettlementNetwork("polygon")).toThrow();
	});

	it("accepts the configured USDC contract in any address casing", () => {
		expect(isSupportedSettlementAsset(USDC_BASE)).toBe(true);
		expect(isSupportedSettlementAsset(USDC_BASE.toLowerCase())).toBe(true);
	});

	it("rejects any other token, including a lookalike address", () => {
		expect(isSupportedSettlementAsset(undefined)).toBe(false);
		expect(isSupportedSettlementAsset("")).toBe(false);
		// Same last bytes, different contract.
		expect(
			isSupportedSettlementAsset("0x000000000000000000000000000000000000dA02913"),
		).toBe(false);
		// A plausible but wrong Base token.
		expect(
			isSupportedSettlementAsset("0x4200000000000000000000000000000000000006"),
		).toBe(false);
	});
});
