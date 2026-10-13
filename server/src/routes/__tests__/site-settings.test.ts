import { describe, expect, it, vi, beforeEach } from "vitest";
import { Hono } from "hono";

/**
	* Tests for GET /v1/site-settings (public rail/config status endpoint).
	*
	* The endpoint must remain available even when the DB is unreachable:
	*   1. DB read succeeds → return DB state (with env fallback for missing fields)
	*   2. DB read throws → discovery stays readable but funding is unavailable
	*
	* This guards the deposit page UX in dev environments where the Postgres
	* container is offline but the operator is browsing the marketing surfaces.
	*/

const mockDb = vi.hoisted(() => {
	const limitMock = vi.fn();
	const fromMock = vi.fn().mockReturnValue({ limit: limitMock });
	const selectMock = vi.fn().mockReturnValue({ from: fromMock });
	return {
		select: selectMock,
		from: fromMock,
		limit: limitMock,
	};
});

vi.mock("../../db/client.js", () => ({ db: mockDb }));

const mockConfig = vi.hoisted(() => ({
	POLAR_ACCESS_TOKEN: "polar_test_token",
	POLAR_HOBBY_PRODUCT_ID: "prod_hobby",
	USDC_DEPOSIT_ADDRESS: "0xabc",
	FACILITATOR_MODE: "live",
	FACILITATOR_PRIVATE_KEY: "0x" + "1".repeat(64),
	CHAIN_RPC_URL: "https://base.example.invalid",
	TREASURY_BASE_ADDRESS: "0x1111111111111111111111111111111111111111",
}));

vi.mock("../../config.js", () => ({ config: mockConfig }));

vi.mock("../../lib/logger.js", () => ({
	logger: {
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		debug: vi.fn(),
	},
}));

// Import after mocks so the route module binds to them
import { depositRoutes } from "../deposit/index.js";

describe("GET /v1/site-settings", () => {
	const app = new Hono();
	app.route("/", depositRoutes);

	beforeEach(() => {
		vi.clearAllMocks();
		mockConfig.POLAR_ACCESS_TOKEN = "polar_test_token";
		mockConfig.POLAR_HOBBY_PRODUCT_ID = "prod_hobby";
		mockConfig.USDC_DEPOSIT_ADDRESS = "0xabc";
		mockConfig.FACILITATOR_MODE = "live";
		mockConfig.FACILITATOR_PRIVATE_KEY = "0x" + "1".repeat(64);
		mockConfig.CHAIN_RPC_URL = "https://base.example.invalid";
		mockConfig.TREASURY_BASE_ADDRESS = "0x1111111111111111111111111111111111111111";
	});

	it("returns DB settings merged with env defaults when DB read succeeds", async () => {
		mockDb.limit.mockResolvedValueOnce([
			{
				maintenanceMode: true,
				cardPaymentsEnabled: false,
				cryptoPaymentsEnabled: true,
			},
		]);

		const res = await app.request("/v1/site-settings");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.maintenanceMode).toBe(true);
		expect(body.cardPaymentsEnabled).toBe(false);
		expect(body.cryptoPaymentsEnabled).toBe(true);
		// Env-derived (no DB column) — should reflect config
		expect(body.usdcDepositConfigured).toBe(true);
		expect(body.polarConfigured).toBe(true);
		expect(body.x402Configured).toBe(true);
	});

	it("returns env defaults when the DB row is empty", async () => {
		mockDb.limit.mockResolvedValueOnce([]);

		const res = await app.request("/v1/site-settings");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.maintenanceMode).toBe(false);
		expect(body.cardPaymentsEnabled).toBe(true);
		expect(body.cryptoPaymentsEnabled).toBe(true);
	});

	it("reports unavailable payments when the DB read throws", async () => {
		mockDb.limit.mockRejectedValueOnce(new Error("DB unreachable"));

		const res = await app.request("/v1/site-settings");
		// Critical: must NOT 5xx for an anonymous visitor
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.maintenanceMode).toBe(false);
		expect(body.cardPaymentsEnabled).toBe(false);
		expect(body.cryptoPaymentsEnabled).toBe(false);
		expect(body.paymentStatusAvailable).toBe(false);
		expect(res.headers.get("cache-control")).toBe("no-store");
		expect(body.usdcDepositConfigured).toBe(true);
		expect(body.polarConfigured).toBe(true);
		expect(body.x402Configured).toBe(true);
	});

	it("reports polarConfigured=false when Polar token or product id missing", async () => {
		mockConfig.POLAR_ACCESS_TOKEN = "";
		mockDb.limit.mockResolvedValueOnce([]);

		const res = await app.request("/v1/site-settings");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.polarConfigured).toBe(false);
	});

	it("reports x402Configured=false unless the live facilitator is complete", async () => {
		mockConfig.FACILITATOR_PRIVATE_KEY = "";
		mockDb.limit.mockResolvedValueOnce([]);

		const res = await app.request("/v1/site-settings");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.x402Configured).toBe(false);
	});

	it("reports usdcDepositConfigured=false when no treasury address", async () => {
		mockConfig.USDC_DEPOSIT_ADDRESS = "";
		mockDb.limit.mockResolvedValueOnce([]);

		const res = await app.request("/v1/site-settings");
		expect(res.status).toBe(200);
		const body = (await res.json()) as Record<string, unknown>;
		expect(body.usdcDepositConfigured).toBe(false);
	});
});
