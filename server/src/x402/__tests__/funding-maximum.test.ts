import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
const fixture = vi.hoisted(() => ({ verify: vi.fn(async () => ({ valid: true })), treasury: `0x${"12".repeat(20)}`, maximumCents: 1_000_000 }));
vi.mock("../../config.js", () => ({ config: { NODE_ENV: "test", FACILITATOR_MODE: "mock", TREASURY_BASE_ADDRESS: fixture.treasury,
	get USDC_DEPOSIT_MAX_CENTS() { return fixture.maximumCents; }, RECEIPT_HMAC_SECRET: "funding-maximum-regression-secret-123456789" }, isProductionEnv: true }));
vi.mock("../verify.js", () => ({ verifyPayment: fixture.verify }));
vi.mock("../../middleware/payment-rail.js", () => ({ requirePaymentRail: () => (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../../middleware/rate-limit.js", () => ({ rateLimit: () => (_c: unknown, next: () => Promise<void>) => next() }));
vi.mock("../../db/client.js", () => ({ db: {} }));
import { x402Routes } from "../facilitator.js";
import { USDC_BASE } from "../../constants.js";
const app = new Hono().route("/", x402Routes);
const verify = (amount: string, maxAmountRequired = amount) => app.request("/x402/verify", { method: "POST", headers: { "PAYMENT-SIGNATURE": JSON.stringify({
	x402Version: "1", signature: `0x${"ab".repeat(65)}`, authorization: "opaque", payload: {
		x402Version: "1", scheme: "evm", networkId: "base", asset: USDC_BASE, amount, maxAmountRequired,
		payee: fixture.treasury, payFrom: `0x${"34".repeat(20)}`, validAfter: 0, validBefore: 9999999999,
	},
}) } });
beforeEach(() => { vi.clearAllMocks(); fixture.maximumCents = 1_000_000; });
describe("x402 maximum before transfer verification or broadcast", () => {
	it("accepts the configured boundary and positive atomic-unit payments", async () => {
		expect((await verify("10000")).status).toBe(200); expect((await verify("0.000001")).status).toBe(200);
	});
	it.each([["10000.000001", "10000.000001"], ["1", "10000.000001"], ["invalid", "10000.000001"]])("rejects amount %s / authorization requirement %s without entering the transfer path", async (amount, required) => {
		const response = await verify(amount, required); expect(response.status).toBe(400); expect(fixture.verify).not.toHaveBeenCalled();
		expect((await response.json()).error.code).toBe("x402_funding_limit");
	});
	it("advertises the configured maximum in atomic units", async () => {
		fixture.maximumCents = 123;
		expect((await (await app.request("/x402/info")).json()).maxAtomicAmount).toBe("1230000");
	});
	it("rejects an over-limit v2 envelope before verification or broadcast", async () => {
		const envelope = { x402Version: 2, accepted: { scheme: "exact", network: "eip155:8453", asset: USDC_BASE, amount: "10000000001", payTo: fixture.treasury },
			payload: { signature: `0x${"ab".repeat(65)}`, authorization: { from: `0x${"34".repeat(20)}`, to: fixture.treasury, value: "10000000001", validAfter: "0", validBefore: "9999999999", nonce: `0x${"56".repeat(32)}` } } };
		const response = await app.request("/x402/verify", { method: "POST", headers: { "PAYMENT-SIGNATURE": Buffer.from(JSON.stringify(envelope)).toString("base64") } });
		expect(response.status).toBe(400); expect((await response.json()).error.code).toBe("x402_funding_limit"); expect(fixture.verify).not.toHaveBeenCalled();
	});
});
