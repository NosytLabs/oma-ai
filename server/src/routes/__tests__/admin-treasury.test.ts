import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { OmaEnv } from "../../types.js";

const mocks = vi.hoisted(() => ({
	config: { FACILITATOR_MODE: "live", FACILITATOR_PRIVATE_KEY: undefined as string | undefined,
		TREASURY_BASE_ADDRESS: "0x1111111111111111111111111111111111111111", USDC_DEPOSIT_ADDRESS: "0x1111111111111111111111111111111111111111" },
	getBalance: vi.fn(), readContract: vi.fn(),
}));
vi.mock("../../config.js", () => ({ config: mocks.config }));
vi.mock("../../lib/rpc-client.js", () => ({ getPublicClient: () => ({ getBalance: mocks.getBalance, readContract: mocks.readContract }) }));
vi.mock("../../auth/middleware.js", () => ({
	sessionOrBearerAuth: async (_c: unknown, next: () => Promise<void>) => next(),
	requireAdmin: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));
vi.mock("../../middleware/rate-limit.js", () => ({ rateLimit: () => async (_c: unknown, next: () => Promise<void>) => next() }));
import { adminTreasuryRoutes } from "../admin-treasury.js";

function request() { return new Hono<OmaEnv>().route("/", adminTreasuryRoutes).request("http://localhost/v1/admin/treasury"); }
beforeEach(() => {
	vi.clearAllMocks();
	mocks.config.FACILITATOR_MODE = "live";
	mocks.config.FACILITATOR_PRIVATE_KEY = undefined;
	mocks.getBalance.mockResolvedValue(1000000000000000n);
	mocks.readContract.mockResolvedValue(1234567n);
});
afterEach(() => { vi.useRealTimers(); });

describe("read-only treasury diagnostics", () => {
	it("formats Base balances, deduplicates shared recipients and does not cache private results", async () => {
		const response = await request();
		expect(response.headers.get("cache-control")).toBe("no-store");
		const data = await response.json();
		expect(data.wallets[0]).toMatchObject({ eth: "0.001", usdc: "1.234567", error: null });
		expect(data.wallets[1]).toMatchObject({ eth: "0.001", usdc: "1.234567" });
		expect(data.wallets[2]).toMatchObject({ address: null, error: "Address is not configured." });
		expect(mocks.getBalance).toHaveBeenCalledTimes(1);
		expect(mocks.readContract).toHaveBeenCalledTimes(1);
	});
	it("never invokes the chain in mock mode or returns the facilitator private key", async () => {
		mocks.config.FACILITATOR_MODE = "mock";
		mocks.config.FACILITATOR_PRIVATE_KEY = `0x${"01".repeat(32)}`;
		const response = await request();
		const data = await response.json();
		expect(data.wallets[2].address).toMatch(/^0x[0-9a-fA-F]{40}$/);
		expect(JSON.stringify(data)).not.toContain(mocks.config.FACILITATOR_PRIVATE_KEY);
		expect(data.wallets.every((wallet: { eth: string | null }) => wallet.eth === null)).toBe(true);
		expect(mocks.getBalance).not.toHaveBeenCalled();
	});
	it("reports failures without leaking a private RPC URL or credentials", async () => {
		mocks.getBalance.mockRejectedValue(new Error("https://private.rpc/secret-token"));
		const response = await request();
		const data = await response.json();
		expect(data.wallets[0]).toMatchObject({ eth: null, usdc: null });
		expect(data.wallets[0].error).toContain("RPC balance check failed");
		expect(JSON.stringify(data)).not.toContain("secret-token");
	});
	it("bounds slow RPC reads so an operator can retry", async () => {
		vi.useFakeTimers();
		mocks.getBalance.mockReturnValue(new Promise(() => {}));
		const pending = request();
		await vi.advanceTimersByTimeAsync(16001);
		const data = await (await pending).json();
		expect(data.wallets[0].error).toContain("RPC balance check failed");
	});
});
