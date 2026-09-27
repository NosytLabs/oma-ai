/**
	* x402 v2 transport adapter (2026 spec, x402 Foundation / Coinbase + Cloudflare).
	*
	* HEADER NAMING (per the official v1→v2 migration guide, verified 2026-07-26):
	*   payment (client→server):  v1 `X-PAYMENT`  →  v2 `PAYMENT-SIGNATURE` (base64 JSON)
	*   receipt (server→client):  v1 `X-PAYMENT-RESPONSE`  →  v2 `PAYMENT-RESPONSE`
	* OMA accepts ALL of these inbound shapes (raw-JSON legacy PAYMENT-SIGNATURE,
	* base64 X-PAYMENT, base64 PAYMENT-SIGNATURE) and emits both receipt headers.
	*
	* v2 challenge body: `{ x402Version: 2, accepts: [{ scheme: "exact", network
	* (CAIP-2 `eip155:8453`), amount (atomic units; spec renamed
	* maxAmountRequired→amount — we emit both), asset, payTo,
	* maxTimeoutSeconds, extra }] }`.
	*
	* The signing core is unchanged — EIP-3009 transferWithAuthorization over
	* USDC — so this module only translates the v2 envelope to the internal
	* `PaymentSignature` consumed by `verifyPayment`, and builds the v2
	* challenge/response artifacts. v1 clients keep working untouched.
	*
	* Spec: https://github.com/coinbase/x402/blob/main/specs/x402-specification-v2.md
	*/

import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
import { formatUnits } from "viem";
import { parseUsdcAtomic } from "./facilitator-signing.js";
import type { PaymentSignature } from "./facilitator.js";

/** CAIP-2 id for Base mainnet (the only network OMA settles on today). */
export const CAIP2_BASE_MAINNET = "eip155:8453";

const CAIP2_TO_INTERNAL: Record<string, string> = {
		[CAIP2_BASE_MAINNET]: "base",
		base: "base",
};

/** Atomic USDC units → decimal string ("100000" → "0.10"). */
export function atomicToDecimal(atomic: bigint): string {
	return formatUnits(atomic, USDC_DECIMALS);
}

interface XPaymentV2 {
		x402Version: number;
		scheme: string;
		network: string;
		accepted?: { scheme: string; network: string; asset: string; payTo: string; amount: string };
		payload: {
				signature: string;
				authorization: {
						from: string;
						to: string;
						value: string;
						validAfter: string | number;
						validBefore: string | number;
						nonce: string;
				};
		};
}

/**
	* Parse a v2 `X-PAYMENT` header (base64 JSON) into the internal
	* `PaymentSignature` envelope. Throws with a client-safe message on any
	* malformed input — callers surface it as a 400/402, never a 500.
	*/
export function parseXPaymentHeader(headerValue: string): PaymentSignature {
		let decoded: string;
		try {
				decoded = Buffer.from(headerValue, "base64").toString("utf-8");
		} catch {
				throw new Error("X-PAYMENT header is not valid base64");
		}
		let parsed: XPaymentV2;
		try {
				parsed = JSON.parse(decoded) as XPaymentV2;
		} catch {
				throw new Error("X-PAYMENT header does not decode to valid JSON");
		}
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
			throw new Error("PAYMENT-SIGNATURE must contain a JSON object");
		}
		if (parsed.x402Version !== 2) {
				throw new Error(`Unsupported x402Version in X-PAYMENT: ${parsed.x402Version} (expected 2)`);
		}
		// Current v2 clients put the selected requirements in `accepted`.
		// Keep the older flat envelope readable during client migration.
		const requirements = parsed.accepted ?? parsed;
		if (requirements.scheme !== "exact") {
				throw new Error(`Unsupported scheme in X-PAYMENT: ${requirements.scheme} (expected "exact")`);
		}
		const internalNetwork = CAIP2_TO_INTERNAL[requirements.network];
		if (!internalNetwork) {
				throw new Error(`Unsupported network in X-PAYMENT: ${requirements.network} (expected ${CAIP2_BASE_MAINNET})`);
		}
		const auth = parsed.payload?.authorization;
		const signature = parsed.payload?.signature;
		if (typeof signature !== "string" || !/^0x[\da-f]{130}$/i.test(signature) || !auth || typeof auth.from !== "string" || typeof auth.to !== "string" || !/^0x[\da-f]{40}$/i.test(auth.from) || !/^0x[\da-f]{40}$/i.test(auth.to) || typeof auth.nonce !== "string" || !/^0x[\da-f]{64}$/i.test(auth.nonce)) {
				throw new Error("X-PAYMENT payload must include signature and a full EIP-3009 authorization tuple");
		}
		for (const time of [auth.validAfter, auth.validBefore]) {
			if ((typeof time !== "string" && typeof time !== "number") || !/^\d+$/.test(String(time)) || !Number.isSafeInteger(Number(time))) {
				throw new Error("Authorization time bounds must be non-negative integer seconds");
			}
		}

		let valueAtomic: bigint;
		try {
				if (typeof auth.value !== "string" || !/^\d+$/.test(auth.value)) throw new Error("Invalid atomic value");
				valueAtomic = BigInt(auth.value);
		} catch {
				throw new Error("X-PAYMENT authorization.value must be an integer string of atomic USDC units");
		}
		if (valueAtomic <= 0n) {
				throw new Error("X-PAYMENT authorization.value must be positive");
		}
		if (parsed.accepted) {
			const offer = parsed.accepted;
			if (typeof offer.asset !== "string" || offer.asset.toLowerCase() !== USDC_BASE.toLowerCase()) throw new Error("Unsupported accepted asset: expected USDC on Base");
			if (typeof offer.payTo !== "string" || offer.payTo.toLowerCase() !== auth.to.toLowerCase()) throw new Error("Accepted payTo does not match authorization recipient");
			if (typeof offer.amount !== "string" || !/^\d+$/.test(offer.amount) || BigInt(offer.amount) !== valueAtomic) throw new Error("Accepted amount does not match authorization value");
		}
		const amountDecimal = atomicToDecimal(valueAtomic);

		return {
				x402Version: "2",
				signature,
				// Internal shape: `authorization` is the JSON-stringified EIP-3009
				// tuple (string fields), auto-detected by isEip3009Authorization.
				authorization: JSON.stringify({
						from: auth.from,
						to: auth.to,
						value: auth.value.toString(),
						validAfter: auth.validAfter.toString(),
						validBefore: auth.validBefore.toString(),
						nonce: auth.nonce,
				}),
				payload: {
						x402Version: "2",
						scheme: "evm",
						networkId: internalNetwork,
						asset: USDC_BASE,
						amount: amountDecimal,
						payee: auth.to,
						payFrom: auth.from,
						maxAmountRequired: amountDecimal,
						validBefore: Number(auth.validBefore),
						validAfter: Number(auth.validAfter),
						nonce: auth.nonce,
				},
		};
}

/** Same decoder for the public funding endpoints and payment middleware. */
export function parsePaymentSignatureHeader(headerValue: string): PaymentSignature {
	if (!headerValue.trimStart().startsWith("{")) return parseXPaymentHeader(headerValue);
	const parsed = JSON.parse(headerValue) as PaymentSignature;
	if (!parsed || typeof parsed !== "object" || typeof parsed.signature !== "string" || !parsed.payload || typeof parsed.payload !== "object") {
		throw new Error("PAYMENT-SIGNATURE must include signature and payload");
	}
	for (const field of ["scheme", "networkId", "asset", "amount", "payee", "payFrom"] as const) {
		if (typeof parsed.payload[field] !== "string" || !parsed.payload[field]) throw new Error(`PAYMENT-SIGNATURE payload must include ${field}`);
	}
	if (typeof parsed.authorization !== "string") throw new Error("PAYMENT-SIGNATURE must include authorization");
	return parsed;
}

/**
	* Bazaar discovery extension (x402-foundation specs/extensions/bazaar.md):
	* declares the endpoint's input/output contract inside the 402 challenge so
	* facilitators (CDP's /discovery/resources index) can catalog it.
	*/
export interface BazaarResourceInfo {
		/** Top-level `resource` object on the 402 body. */
		resource: {
				url: string;
				description: string;
				mimeType: string;
				serviceName?: string;
				tags?: string[];
				iconUrl?: string;
		};
		/** `extensions.bazaar.info.input` — discriminated by `type`/`method`. */
		input: Record<string, unknown>;
		/** `extensions.bazaar.info.output`. */
		output: Record<string, unknown>;
		/** JSON Schema validating the `info` structure (required by the spec). */
		schema: Record<string, unknown>;
}

/**
	* Build the v2 402 challenge body. `priceUsd` is the decimal USD price
	* ("0.10"); `resource` is the absolute URL (or path) being purchased.
	* When `bazaar` is provided the challenge carries the discovery extension.
	*/
export function buildV2Challenge(params: {
		priceUsd: string;
		payTo: string;
		resource: string;
		description?: string;
		maxTimeoutSeconds?: number;
		bazaar?: BazaarResourceInfo;
}): {
		x402Version: 2;
		error: string;
		accepts: Array<Record<string, unknown>>;
		resource?: BazaarResourceInfo["resource"];
		extensions?: Record<string, unknown>;
} {
		const atomic = parseUsdcAtomic(params.priceUsd).toString();
		return {
				x402Version: 2,
				error: "Payment required",
				resource: params.bazaar?.resource ?? { url: params.resource, description: params.description ?? `Payment required for ${params.resource}`, mimeType: "application/json" },
				accepts: [
						{
								scheme: "exact",
								network: CAIP2_BASE_MAINNET,
								// Spec renamed maxAmountRequired → amount (atomic units). Emit both
								// so pre-rename clients keep parsing the challenge.
								amount: atomic,
								maxAmountRequired: atomic,
								asset: USDC_BASE,
								payTo: params.payTo,
								resource: params.resource,
								description: params.description ?? `Payment required for ${params.resource}`,
								mimeType: "application/json",
								maxTimeoutSeconds: params.maxTimeoutSeconds ?? 300,
								// EIP-712 domain hints for the USDC contract on Base.
								extra: { name: "USD Coin", version: "2" },
						},
				],
				...(params.bazaar
						? {
										resource: params.bazaar.resource,
										extensions: {
												bazaar: {
														info: { input: params.bazaar.input, output: params.bazaar.output },
														schema: params.bazaar.schema,
												},
										},
								}
						: {}),
		};
}

/**
	* Bazaar descriptor for POST /v1/chat/completions — the one x402-priced
	* endpoint OMA exposes today. Kept here (not in the route) so the
	* discovery contract lives next to the transport that advertises it.
	*/
export const CHAT_COMPLETIONS_BAZAAR: BazaarResourceInfo = {
		resource: {
				url: "https://www.oma-ai.com/api/v1/chat/completions",
				description:
						"OpenAI-compatible chat completions across the curated Venice + OMA-AI/OpenBroker catalog. Fund with USDC credits on Base, including x402 verify/settle.",
				mimeType: "application/json",
				serviceName: "OMA — Open Model Access",
				tags: ["ai", "llm", "chat-completions", "openai-compatible", "inference"],
				iconUrl: "https://oma-ai.com/logos/oma-icon-192.png",
		},
		input: {
				type: "http",
				method: "POST",
				bodyType: "json",
				body: {
						model: "llama-3.3-70b",
						messages: [{ role: "user", content: "Hello" }],
						max_tokens: 256,
				},
		},
		output: {
				type: "json",
				example: {
						id: "chatcmpl_123",
						object: "chat.completion",
						choices: [
								{
										index: 0,
										message: { role: "assistant", content: "Hello! How can I help?" },
										finish_reason: "stop",
								},
						],
						usage: { prompt_tokens: 8, completion_tokens: 7, total_tokens: 15 },
				},
		},
		schema: {
				$schema: "https://json-schema.org/draft/2020-12/schema",
				type: "object",
				properties: {
						input: {
								type: "object",
								properties: {
										type: { type: "string", const: "http" },
										method: { type: "string", enum: ["POST", "PUT", "PATCH"] },
										bodyType: { type: "string", enum: ["json", "form-data", "text"] },
										body: { type: "object" },
										queryParams: {
												type: "object",
												additionalProperties: { type: "string" },
										},
										headers: {
												type: "object",
												additionalProperties: { type: "string" },
										},
								},
								required: ["type", "method", "bodyType", "body"],
								additionalProperties: false,
						},
						output: {
								type: "object",
								properties: {
										type: { type: "string" },
										example: { type: "object" },
								},
								required: ["type"],
						},
				},
				required: ["input"],
		},
};

/**
	* Build the v2 `X-PAYMENT-RESPONSE` header value (base64 JSON) returned on
	* a successfully settled request.
	*/
export function buildXPaymentResponse(params: {
		txHash?: string;
		payer?: string;
}): string {
		return Buffer.from(
				JSON.stringify({
						success: true,
						transaction: params.txHash ?? null,
						network: CAIP2_BASE_MAINNET,
						payer: params.payer ?? null,
				}),
				"utf-8",
		).toString("base64");
}
