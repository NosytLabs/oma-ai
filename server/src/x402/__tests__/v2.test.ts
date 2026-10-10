import { describe, expect, it } from "vitest";
import { USDC_BASE } from "../../constants.js";
import {
		atomicToDecimal,
		buildV2Challenge,
		buildXPaymentResponse,
		CAIP2_BASE_MAINNET,
		parseXPaymentHeader,
} from "../v2.js";

const AUTH = {
		from: "0x1111111111111111111111111111111111111111",
		to: "0x2222222222222222222222222222222222222222",
		value: "100000", // 0.10 USDC atomic
		validAfter: "1785000000",
		validBefore: "1785000300",
		nonce: "0x" + "ab".repeat(32),
};

function encodeXPayment(overrides: Record<string, unknown> = {}, payloadOverrides: Record<string, unknown> = {}) {
		return Buffer.from(
				JSON.stringify({
						x402Version: 2,
						scheme: "exact",
						network: CAIP2_BASE_MAINNET,
						payload: { signature: "0x" + "cd".repeat(65), authorization: AUTH, ...payloadOverrides },
						...overrides,
				}),
		).toString("base64");
}

describe("atomicToDecimal", () => {
		it("converts atomic USDC to trimmed decimal strings", () => {
				expect(atomicToDecimal(100000n)).toBe("0.1");
				expect(atomicToDecimal(1000000n)).toBe("1");
				expect(atomicToDecimal(1234567n)).toBe("1.234567");
				expect(atomicToDecimal(5000000n)).toBe("5");
		});
});

describe("parseXPaymentHeader", () => {
		const accepted = { scheme: "exact", network: CAIP2_BASE_MAINNET, amount: AUTH.value, asset: USDC_BASE, payTo: AUTH.to, maxTimeoutSeconds: 300, extra: { name: "USD Coin", version: "2" } };
		it("accepts the current SDK v2 shape with requirements under accepted", () => {
			const encoded = encodeXPayment({ scheme: undefined, network: undefined, accepted, resource: { url: "https://www.oma-ai.com/x402/verify" } });
			expect(parseXPaymentHeader(encoded).payload).toMatchObject({ amount: "0.1", payFrom: AUTH.from, payee: AUTH.to, networkId: "base" });
		});
		it.each([
			{ ...accepted, asset: "0x" + "00".repeat(20) },
			{ ...accepted, payTo: AUTH.from },
			{ ...accepted, amount: "999999" },
		])("rejects accepted requirements that disagree with the signed transfer", (offer) => {
			expect(() => parseXPaymentHeader(encodeXPayment({ accepted: offer }))).toThrow();
		});
		it.each([null, [], "hello", 3])("rejects non-object JSON with a useful error", (value) => {
			expect(() => parseXPaymentHeader(Buffer.from(JSON.stringify(value)).toString("base64"))).toThrow(/object/);
		});
		it("maps a valid v2 envelope to the internal PaymentSignature shape", () => {
				const sig = parseXPaymentHeader(encodeXPayment());
				expect(sig.x402Version).toBe("2");
				expect(sig.payload.scheme).toBe("evm");
				expect(sig.payload.networkId).toBe("base");
				expect(sig.payload.amount).toBe("0.1");
				expect(sig.payload.maxAmountRequired).toBe("0.1");
				expect(sig.payload.payee).toBe(AUTH.to);
				expect(sig.payload.payFrom).toBe(AUTH.from);
				expect(sig.payload.validBefore).toBe(1785000300);
				expect(sig.payload.nonce).toBe(AUTH.nonce);
				// authorization round-trips as the JSON EIP-3009 tuple string
				const auth = JSON.parse(sig.authorization);
				expect(auth).toEqual(AUTH);
		});

		it("rejects non-base64 / non-JSON input", () => {
				expect(() => parseXPaymentHeader("!!!not-base64!!!")).toThrow();
				expect(() =>
						parseXPaymentHeader(Buffer.from("plain text").toString("base64")),
				).toThrow(/valid JSON/);
		});

		it("rejects wrong version, scheme, and network", () => {
				expect(() => parseXPaymentHeader(encodeXPayment({ x402Version: 1 }))).toThrow(/x402Version/);
				expect(() => parseXPaymentHeader(encodeXPayment({ scheme: "deferred" }))).toThrow(/scheme/);
				expect(() => parseXPaymentHeader(encodeXPayment({ network: "eip155:1" }))).toThrow(/network/);
		});

		it("rejects missing or invalid authorization values", () => {
				expect(() =>
						parseXPaymentHeader(encodeXPayment({}, { authorization: { ...AUTH, value: "abc" } })),
				).toThrow(/atomic USDC/);
				expect(() =>
						parseXPaymentHeader(encodeXPayment({}, { authorization: { ...AUTH, value: "0" } })),
				).toThrow(/positive/);
				expect(() =>
						parseXPaymentHeader(encodeXPayment({}, { signature: undefined })),
				).toThrow(/signature/);
		});
});

describe("buildV2Challenge", () => {
		it("builds a spec-shaped accepts array with atomic units and CAIP-2 network", () => {
				const challenge = buildV2Challenge({
						priceUsd: "0.10",
						payTo: AUTH.to,
						resource: "https://www.oma-ai.com/api/v1/chat/completions",
				});
				expect(challenge.x402Version).toBe(2);
				expect(challenge.accepts).toHaveLength(1);
				const offer = challenge.accepts[0];
				expect(offer.scheme).toBe("exact");
				expect(offer.network).toBe(CAIP2_BASE_MAINNET);
				expect(offer.maxAmountRequired).toBe("100000");
				expect(offer.payTo).toBe(AUTH.to);
				expect(offer.maxTimeoutSeconds).toBe(300);
		});

		it("always includes the v2 resource, without optional extensions", () => {
				const challenge = buildV2Challenge({
						priceUsd: "0.10",
						payTo: AUTH.to,
						resource: "/v1/chat/completions",
				});
				expect(challenge.resource).toMatchObject({ url: "/v1/chat/completions", mimeType: "application/json" });
				expect(challenge.extensions).toBeUndefined();
		});

		it("includes the bazaar discovery extension when provided", () => {
				const challenge = buildV2Challenge({
						priceUsd: "0.10",
						payTo: AUTH.to,
						resource: "/v1/chat/completions",
						bazaar: {
							resource: { url: "/test/weather", description: "Test discovery resource", mimeType: "application/json", serviceName: "Test service" },
							input: { type: "http", method: "POST", bodyType: "json", body: { city: "Test city" } },
							output: { type: "json", example: { temperature: 20 } },
							schema: { type: "object", properties: { input: { type: "object" } }, required: ["input"] },
						},
				});
				expect(challenge.resource?.serviceName).toBe("Test service");
				const bazaar = (
						challenge.extensions as Record<
								string,
								{
										info: { input: Record<string, unknown>; output: Record<string, unknown> };
										schema: Record<string, unknown>;
								}
						>
				).bazaar;
				expect(bazaar.info.input.type).toBe("http");
				expect(bazaar.info.input.method).toBe("POST");
				expect(bazaar.info.input.bodyType).toBe("json");
				expect(bazaar.info.output.type).toBe("json");
				// spec requires a schema validating the info structure
				expect(bazaar.schema.required).toEqual(["input"]);
		});
});

describe("buildXPaymentResponse", () => {
		it("emits base64 JSON with transaction and payer", () => {
				const header = buildXPaymentResponse({ txHash: "0xabc", payer: AUTH.from });
				const parsed = JSON.parse(Buffer.from(header, "base64").toString("utf-8"));
				expect(parsed.success).toBe(true);
				expect(parsed.transaction).toBe("0xabc");
				expect(parsed.network).toBe(CAIP2_BASE_MAINNET);
				expect(parsed.payer).toBe(AUTH.from);
		});
});
