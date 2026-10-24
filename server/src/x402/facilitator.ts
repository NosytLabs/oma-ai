// ============================================================
// x402 facilitator — HTTP surface (routes + payment middleware)
// ============================================================
//
// This file is the FAÇADE for the x402 payment facilitator. The
// implementation was split into focused modules (2026-07-26):
//
//   types.ts            wire types + PAYMENT_WINDOW_SECONDS
//   treasury.ts         SERVER_TREASURY pin + fail-closed startup check
//   replay.ts           nonce replay protection (Redis + bounded LRU fallback)
//   settlement-cache.ts verified/settled LRU cache
//   eip3009.ts          EIP-3009 transferWithAuthorization verify path
//   verify.ts           verifyPayment core (mock / QuickNode / EVM dispatch)
//   settle.ts           settlePayment(Async), receipts, idempotency, locks
//   facilitator-signing.ts  receipt HMAC signing + parseUsdcAtomic
//
// Every public symbol is re-exported here so importers (routes, tests,
// lib/settlement-retry) keep using "./x402/facilitator.js" unchanged.

import { Hono } from "hono";
import type { Context, Next, MiddlewareHandler } from "hono";
import { config, isProductionEnv } from "../config.js";
import { buildV2Challenge, buildXPaymentResponse, CAIP2_BASE_MAINNET, parsePaymentSignatureHeader, parseXPaymentHeader } from "./v2.js";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";
import { db } from "../db/client.js";
import { deposits, settlements, user as userTable } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { rateLimit } from "../middleware/rate-limit.js";
import { requirePaymentRail } from "../middleware/payment-rail.js";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
import {
	isSupportedSettlementAsset,
	resolveSettlementNetwork,
} from "./eip3009.js";
import { logger } from "../lib/logger.js";
import { logPaymentEvent } from "../lib/payment-observability.js";
import { parseUsdcAtomic } from "./facilitator-signing.js";
import {
		atomicCacheSet,
		getSettlementCacheKey,
		settlementCache,
} from "./settlement-cache.js";
import { settlePaymentAsync } from "./settle.js";
import { SERVER_TREASURY } from "./treasury.js";
import { paymentCreditAmounts, readTreasuryTransfer } from "./funding-recovery.js";
import { getPublicClient } from "../lib/rpc-client.js";
import { creditConfirmedUsdcPayment, PaymentCreditConflictError } from "../lib/payment-credit.js";
import { verifyPayment } from "./verify.js";
import {
		PAYMENT_WINDOW_SECONDS,
		type PaymentMiddlewareConfig,
		type PaymentRequired,
		type PaymentSignature,
		type SettlementResponse,
} from "./types.js";

/**
 * Credit the authenticated user after a successful x402 settlement.
 * Idempotent via deposits.tx_hash unique index — retries / cache-hit
 * replays do not double-credit.
 */
async function creditSettledPayment(
		userId: string,
		txHash: string,
		amountUsd: string,
		payFrom: string,
): Promise<{ creditedCents: number; alreadyCredited: boolean }> {
		const result = await creditConfirmedUsdcPayment({
			userId, txHash, amountUsd, payFrom,
			depositAddress: SERVER_TREASURY || config.TREASURY_BASE_ADDRESS || "",
		});
		if (!result.alreadyCredited) logPaymentEvent({
			kind: "x402", outcome: "settled", userId,
			amountCents: result.creditedCents, signature: txHash, latencyMs: 0,
		});
		return result;
}

async function settleAndCredit(
		userId: string,
		txHash: string,
		amount: string,
		networkId: string,
		payee: string,
		payFrom: string,
): Promise<SettlementResponse & { creditedCents?: number }> {
		const result = await settlePaymentAsync(txHash, amount, networkId, payee);
		if (!result.settled) return result;
		try {
				const credit = await creditSettledPayment(userId, txHash, amount, payFrom);
				return { ...result, creditedCents: credit.creditedCents };
		} catch (err) {
				logger.error({ err, userId, txHash }, "[FACILITATOR] settle succeeded but credit failed");
				throw err;
		}
}

// ── Public surface (unchanged import paths for routes, tests, retry lib) ────
export { parseUsdcAtomic };
export { verifyPayment } from "./verify.js";
export {
		getSettlementReceipt,
		getSettlementReceiptAsync,
		isSettled,
		isSettledAsync,
		settlePayment,
		settlePaymentAsync,
		verifySettlementReceipt,
} from "./settle.js";
export type {
		PaymentMiddlewareConfig,
		PaymentPayload,
		PaymentRequired,
		PaymentResponse,
		PaymentSignature,
		SettlementRecord,
		SettlementResponse,
		X402Version,
} from "./types.js";

// ============================================================
// Hono Routes
// ============================================================

function paymentError(
		code: string,
		message: string,
		retryable: boolean,
): { error: { code: string; message: string; retryable: boolean; type: string } } {
		return { error: { code, message, retryable, type: "payment_error" } };
}

function settlementFailure(c: Context<OmaEnv>, err: unknown) {
	if (err instanceof PaymentCreditConflictError) {
		return c.json(paymentError(err.code, err.message, false), err.status);
	}
	logger.error({ err }, "[FACILITATOR] settlement credit pending");
	return c.json(paymentError("x402_credit_failed", "Payment confirmed but credit is pending. Retry settlement with the same transaction hash.", true), 500);
}

export const x402Routes = new Hono<OmaEnv>();

function maximumFundingAtomic(): bigint {
	return BigInt(config.USDC_DEPOSIT_MAX_CENTS ?? 1_000_000) * 10n ** BigInt(USDC_DECIMALS - 2);
}

// Apply before session authentication, including denied requests and errors.
// Successful responses carry receipts and account-specific credit results.
x402Routes.use("/x402/settle", async (c, next) => {
	c.header("Cache-Control", "no-store");
	await next();
});

x402Routes.get("/x402/info", (c) => {
		c.header("Cache-Control", "no-store");
		if (!SERVER_TREASURY) {
			return c.json(paymentError("funding_unconfigured", "Funding recipient is not configured", false), 503);
		}
		return c.json({
			x402Version: 2, scheme: "exact", network: CAIP2_BASE_MAINNET,
			asset: USDC_BASE, decimals: USDC_DECIMALS, payTo: SERVER_TREASURY,
			maxAtomicAmount: maximumFundingAtomic().toString(),
			maxTimeoutSeconds: PAYMENT_WINDOW_SECONDS, extra: { name: "USD Coin", version: "2" },
		});
});

x402Routes.post("/x402/verify", rateLimit({ windowMs: 60_000, maxRequests: 10 }), requirePaymentRail("crypto"), async (c) => {
		const headerVal = c.req.header("PAYMENT-SIGNATURE") ?? c.req.header("X-PAYMENT");
		if (!headerVal) {
				return c.json(
						{ error: { message: "Missing PAYMENT-SIGNATURE header", type: "payment_error" } },
						400,
				);
		}

		let paymentSig: PaymentSignature;
		try {
				paymentSig = parsePaymentSignatureHeader(headerVal);
		} catch (error) {
				return c.json(
						{ error: { message: error instanceof Error ? error.message : "Invalid PAYMENT-SIGNATURE", type: "payment_error" } },
						400,
				);
		}

		// V6 #8 — pin the merchant payee on the public verify endpoint.
		// Previously any valid USDC transfer verified regardless of who received
		// the funds, which let a third party use this endpoint to launder a
		// verification receipt for an arbitrary tx. The settle route already pins
		// payee; verify now matches that contract.
		if (SERVER_TREASURY) {
				const declared = (paymentSig.payload?.payee ?? "").toLowerCase();
				if (!declared || declared !== SERVER_TREASURY) {
						return c.json(
								{ error: { message: "Invalid payee: payload does not match configured merchant address", type: "invalid_payee" } },
								400,
						);
				}
		}

		if (!paymentSig.signature || !paymentSig.payload) {
				return c.json(
						{ error: { message: "PAYMENT-SIGNATURE must include signature and payload", type: "payment_error" } },
						400,
				);
		}

		if (!paymentSig.payload.scheme || !paymentSig.payload.amount || !paymentSig.payload.networkId) {
			return c.json(
				{ error: { message: "Payload must include scheme, amount, and networkId", type: "payment_error" } },
				400,
			);
		}

		// Pin the declared chain and asset instead of quietly settling against
		// Base regardless. Verification already falls back to USDC_BASE for an
		// unrecognised network, which protects the funds but means a caller could
		// assert any network at all and still be told the payment verified. An
		// unsupported chain or a different token is a client error, not something
		// to reinterpret.
		try {
			resolveSettlementNetwork(paymentSig.payload.networkId);
		} catch {
			return c.json(
				{ error: { message: "Unsupported settlement network", type: "unsupported_network" } },
				400,
			);
		}
		if (!isSupportedSettlementAsset(paymentSig.payload.asset)) {
			return c.json(
				{ error: { message: "Unsupported settlement asset", type: "unsupported_asset" } },
				400,
			);
		}

		// Cap both advertised amount and legacy required amount before entering
		// the EIP-3009 path, which can broadcast real funds. V2 pins the signed
		// authorization value to these requirements; v1 verifies that equality.
		const maximum = maximumFundingAtomic();
		for (const amount of [paymentSig.payload.amount, paymentSig.payload.maxAmountRequired || paymentSig.payload.amount]) {
			let atomic: bigint;
			try { atomic = parseUsdcAtomic(amount); } catch { continue; }
			if (atomic > maximum) {
				return c.json(paymentError("x402_funding_limit", "Payment exceeds the configured funding maximum. Read maxAtomicAmount from /x402/info.", false), 400);
			}
		}
		const result = await verifyPayment(paymentSig);
		return c.json(result, result.valid ? 200 : 422);
});

// Settlement recovers funds already sent; a funding pause must not block crediting.
x402Routes.post(
	"/x402/settle",
	sessionAuth,
	rateLimit({ windowMs: 60_000, maxRequests: 30 }),
	async (c) => {
		const userId = c.get("userId");
		if (!userId) {
				return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 401);
		}

		// C2 — amount is derived from the verified cache, NEVER from the
		// body. Without this, a client could call `/x402/verify` with a 0.01 USDC tx,
		// get a valid receipt, then call `/x402/settle` with `amount: "1000000"` and
		// stamp a receipt claiming they paid a million dollars. The receipt signed
		// here is what downstream services (credit ledger, audit log) consume.
		let body: { txHash?: string; amount?: string; networkId?: string; payee?: string };
		try {
				body = await c.req.json<{ txHash?: string; amount?: string; networkId?: string; payee?: string }>();
		} catch {
				return c.json(
						{ error: { message: "Invalid JSON body", type: "payment_error" } },
						400,
				);
		}

		if (!body || typeof body !== "object" || typeof body.txHash !== "string" || typeof body.networkId !== "string" || (body.payee !== undefined && typeof body.payee !== "string")) {
				return c.json(
						{ error: { message: "txHash and networkId are required (amount is derived from verified cache, not the body)", type: "payment_error" } },
						400,
				);
		}

		if (!/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
				return c.json({ error: { message: "Invalid txHash format", type: "validation_error" } }, 400);
		}
		if (!["base", "eip155:8453"].includes(body.networkId)) return c.json(paymentError("unsupported_network", "Only Base mainnet is supported", false), 400);
		body.networkId = "base";
		body.txHash = body.txHash.toLowerCase();

		// Pin payee to the configured merchant address; never trust user-supplied
		// recipients. The x402 spec requires the merchant to receive the payment.
		const expectedPayee = (config.TREASURY_BASE_ADDRESS || "").toLowerCase();
		if (!expectedPayee) {
				return c.json(
						{ error: { message: "Server merchant address not configured", type: "server_misconfigured" } },
						500,
				);
		}
		if (body.payee && body.payee.toLowerCase() !== expectedPayee) {
				return c.json(
						{ error: { message: "Payee does not match configured merchant address", type: "payment_error" } },
						400,
				);
		}

		// log a warning when the legacy client sends body.amount, so we
		// can track migration progress and surface it in the docs changelog.
		if (body.amount !== undefined) {
				logger.warn(
						{ txHash: body.txHash, clientAmount: body.amount },
						"[FACILITATOR] /x402/settle body.amount is ignored; amount is derived from the verified cache",
				);
		}

		// Optional PAYMENT-SIGNATURE header: if present, parse and validate JSON
		// shape (legacy dual-channel settle+verify path).
		const paymentHeader = c.req.header("PAYMENT-SIGNATURE");
		if (paymentHeader) {
				try {
						parsePaymentSignatureHeader(paymentHeader);
				} catch {
						return c.json(
								{ error: { message: "Invalid PAYMENT-SIGNATURE header: must be valid JSON", type: "payment_error" } },
								400,
						);
				}
		}

		// Look up the verified record from the in-memory cache. The cache is
		// populated by `/x402/verify` after a successful on-chain verification.
		// If the cache has no entry for this txHash, fall back to the DB so that
		// settlements survive server restarts (CRIT-4).
		const cacheKey = getSettlementCacheKey(body.networkId, body.txHash);
		const cached = settlementCache.get(cacheKey);
		if (cached) {
				// SECURITY gate (x402-ownership audit): bind the credit to the
				// payment's actual sender. verifyPayment already enforced tx
				// `from == payload.payFrom` on-chain; cacheVerifiedRecord now carries
				// that payer. Without this check any authenticated session could call
				// /settle with a verified-but-unsettled txHash and have the amount
				// credited to their own balance (first-claimant-wins theft). Require
				// the session user's DB evmAddress to equal the payment sender.
				{
					const [u] = await db
						.select({ evmAddress: userTable.evmAddress })
						.from(userTable)
						.where(eq(userTable.id, userId))
						.limit(1);
					const sessionAddr = (u?.evmAddress ?? "").toLowerCase();
					const senderAddr = cached.payFrom?.toLowerCase() ?? "";
					if (!sessionAddr || sessionAddr !== senderAddr) {
						logger.warn(
							{ userId, txHash: body.txHash, senderAddr },
							"[FACILITATOR] /x402/settle rejected: session wallet does not own the payment sender",
						);
						return c.json(
							{ error: { message: "Payment sender does not match the authenticated wallet", type: "payment_error", code: "x402_payer_mismatch" } },
							403,
						);
					}
				}
				try {
					const result = await settleAndCredit(
						userId,
						body.txHash,
						cached.amount,
						cached.networkId,
						expectedPayee,
						cached.payFrom!,
					);
					if (result.settled) c.header("PAYMENT-RESPONSE", buildXPaymentResponse({ txHash: body.txHash, payer: cached.payFrom }));
					return c.json(result, result.settled ? 200 : 422);
				} catch (err) {
						return settlementFailure(c, err);
				}
		}

		// Cache miss — check the DB for an existing settlement.
		const existingSettlement = await db
				.select()
				.from(settlements)
				.where(and(eq(settlements.txHash, body.txHash), eq(settlements.networkId, body.networkId)))
				.limit(1);
		if (existingSettlement.length > 0) {
				// SECURITY gate (x402-ownership audit, DB-repopulate path): the
				// settlements table has no payer column, so recover the sender from
				// the crediting deposit row (stored by creditSettledPayment). If the
				// payment has not yet been credited, fall back to an on-chain check —
				// the tx's actual `from` — which is the ground truth the caller must
				// own. Without this gate a session claiming credits after cache
				// eviction/restart could assert ownership of someone else's payment
				// (first-claimant-wins theft, same as the cached-path gate above).
				const depositRow = await db
						.select({ fromAddress: deposits.fromAddress })
						.from(deposits)
						.where(eq(deposits.txHash, body.txHash))
						.limit(1);
				let senderAddr = (depositRow[0]?.fromAddress ?? "").toLowerCase();
				if (!senderAddr) {
						try {
								const receipt = await getPublicClient().getTransactionReceipt({
										hash: body.txHash as `0x${string}`,
								});
								const transfer = readTreasuryTransfer(receipt, expectedPayee);
								if (transfer && transfer.amount === paymentCreditAmounts(existingSettlement[0].amount).amountUsd) senderAddr = transfer.payFrom;
						} catch (chainErr) {
								logger.warn(
										{ err: chainErr, txHash: body.txHash },
										"[FACILITATOR] /x402/settle could not recover payer from chain",
								);
						}
				}
				const [u] = await db
						.select({ evmAddress: userTable.evmAddress })
						.from(userTable)
						.where(eq(userTable.id, userId))
						.limit(1);
				const sessionAddr = (u?.evmAddress ?? "").toLowerCase();
				if (!sessionAddr || !senderAddr || sessionAddr !== senderAddr) {
						logger.warn(
								{ userId, txHash: body.txHash, senderAddr },
								"[FACILITATOR] /x402/settle rejected (db path): session wallet does not own the payment sender",
						);
						return c.json(
								{ error: { message: "Payment sender does not match the authenticated wallet", type: "payment_error", code: "x402_payer_mismatch" } },
								403,
						);
				}
				// Repopulate the cache and credit if this settle has not yet
				// been applied to a user balance (idempotent via deposits.tx_hash).
				atomicCacheSet(cacheKey, {
						txHash: existingSettlement[0].txHash,
						amount: existingSettlement[0].amount,
						networkId: existingSettlement[0].networkId,
						payee: existingSettlement[0].payee,
						payFrom: senderAddr,
						settledAt: existingSettlement[0].settledAt.getTime(),
						receipt: existingSettlement[0].receipt,
				});
				try {
						const credit = await creditSettledPayment(
								userId,
								existingSettlement[0].txHash,
								existingSettlement[0].amount,
								senderAddr,
						);
						c.header("PAYMENT-RESPONSE", buildXPaymentResponse({ txHash: body.txHash, payer: senderAddr }));
						return c.json(
								{
										settled: true,
										receipt: existingSettlement[0].receipt,
										creditedCents: credit.creditedCents,
								},
								200,
						);
				} catch (err) {
						return settlementFailure(c, err);
				}
		}

		// A serverless restart can lose the verified cache after funds moved.
		// Recover only from a confirmed USDC transfer to our treasury, bound to
		// the authenticated payer. No caller-supplied amount is used.
		let recovered: ReturnType<typeof readTreasuryTransfer> = null;
		try {
			recovered = readTreasuryTransfer(await getPublicClient().getTransactionReceipt({ hash: body.txHash as `0x${string}` }), expectedPayee);
		} catch { /* Unknown or unconfirmed transaction: require verification below. */ }
		if (recovered) {
			const [u] = await db.select({ evmAddress: userTable.evmAddress }).from(userTable).where(eq(userTable.id, userId)).limit(1);
			if (!u?.evmAddress || u.evmAddress.toLowerCase() !== recovered.payFrom) return c.json(paymentError("x402_payer_mismatch", "Payment sender does not match the authenticated wallet", false), 403);
			atomicCacheSet(cacheKey, { txHash: body.txHash, amount: recovered.amount, networkId: "base", payee: expectedPayee, payFrom: recovered.payFrom, settledAt: 0 });
			try {
				const result = await settleAndCredit(userId, body.txHash, recovered.amount, "base", expectedPayee, recovered.payFrom);
				if (result.settled) c.header("PAYMENT-RESPONSE", buildXPaymentResponse({ txHash: body.txHash, payer: recovered.payFrom }));
				return c.json(result, result.settled ? 200 : 422);
			} catch (err) {
				return settlementFailure(c, err);
			}
		}

		// No confirmed payment evidence.
		return c.json(
				{
						error: {
								message: "No verified payment on file for this txHash. Call /x402/verify first.",
								type: "missing_verify",
								code: "x402_verify_required",
						},
				},
				400,
		);
});

// ── Test routes — dev/staging only ──────────────────────────────────────────
if (!isProductionEnv) {
x402Routes.post("/x402/pay-req-test",
		rateLimit({ windowMs: 60_000, maxRequests: 30 }),
		async (c) => {
		// refuse to mount the test route with an unset merchant address —
		// falling back to 0x000… lets an attacker mint a Pay-Req header with a
		// bogus payee and probe verification behavior. Returns 503 (not 500) so
		// it's clearly "intentionally disabled", not "broken".
		const payeeAddress = config.TREASURY_BASE_ADDRESS;
		if (!payeeAddress) {
				return c.json(
						{ error: { message: "x402 test endpoint disabled: TREASURY_BASE_ADDRESS unset", type: "feature_disabled" } },
						503,
				);
		}
		const now = Math.floor(Date.now() / 1000);
		const paymentURL = `https://oma-ai.com/deposit?route=x402&network=base&asset=USDC&return_to=${encodeURIComponent(c.req.url)}`;
		const amount = "1.00";

		const paymentRequired: PaymentRequired = {
				x402Version: "1",
				scheme: "evm",
				networkId: "base",
				asset: USDC_BASE,
				amount,
				payee: payeeAddress,
				maxAmountRequired: amount,
				validBefore: now + PAYMENT_WINDOW_SECONDS,
				validAfter: now,
				description: "Payment required for x402 test",
				"payment-URL": paymentURL,
		};

		c.header("PAYMENT-REQUIRED", JSON.stringify(paymentRequired));
		return c.json(
				{
						error: {
								message: "Payment required",
								type: "payment_required",
								payment: paymentRequired,
						},
				},
				402,
		);
});

const testPricing: Record<string, string> = {
		"/x402/middleware-test": "0.50",
};

const testPayeeAddress = config.TREASURY_BASE_ADDRESS;
// only mount the middleware test when a real merchant address is set.
// Falling back to the zero address would let `/x402/middleware-test` accept
// payments to nobody and falsely report "success" — see audit X402-2026-06-14.
if (testPayeeAddress) {
		x402Routes.use("/x402/middleware-test", paymentMiddleware({
				pricing: testPricing,
				payeeAddress: testPayeeAddress,
		}));
}

x402Routes.post("/x402/middleware-test", async (c) => {
		return c.json({ success: true });
});
} // end dev-only test routes

// Houdini/crosschain deposit flow removed — /v1/x402/proxy/chat/completions no longer exists.

// Public funding endpoints accept the v2 wire envelope and bind credited
// payments to the SIWE payer. The middleware below supports development
// protocol tests; production inference spends prepaid account credits.

// ============================================================
// Payment Middleware
// ============================================================

export function paymentMiddleware(
		middlewareConfig: PaymentMiddlewareConfig,
): MiddlewareHandler<OmaEnv> {
		const {
				pricing,
				payeeAddress,
				asset = USDC_BASE,
				networkId = "base",
				scheme = "evm",
		} = middlewareConfig;

		return async (c: Context<OmaEnv>, next: Next) => {
				const path = new URL(c.req.url).pathname;
				const price = pricing[path];

				if (price === undefined) {
						await next();
						return;
				}

				// v2 transport (X-PAYMENT, base64 JSON, CAIP-2 networks) is checked
				// first; the legacy v1 PAYMENT-SIGNATURE raw-JSON header remains fully
				// supported. Both map onto the same EIP-3009 verify/settle core.
				const xPaymentHeader = c.req.header("X-PAYMENT");
				const paymentHeader = c.req.header("PAYMENT-SIGNATURE");

				if (!xPaymentHeader && !paymentHeader) {
						const now = Math.floor(Date.now() / 1000);
						const paymentURL = `https://oma-ai.com/deposit?route=x402&network=${networkId}&asset=${encodeURIComponent(asset)}&return_to=${encodeURIComponent(c.req.url)}`;

						const paymentRequired: PaymentRequired = {
								x402Version: "1",
								scheme,
								networkId,
								asset,
								amount: price,
								payee: payeeAddress,
								maxAmountRequired: price,
								validBefore: now + PAYMENT_WINDOW_SECONDS,
								validAfter: now,
								description: `Payment required for ${path}`,
								"payment-URL": paymentURL,
						};

						const v2Challenge = buildV2Challenge({
								priceUsd: price,
								payTo: payeeAddress,
								resource: c.req.url,
								maxTimeoutSeconds: PAYMENT_WINDOW_SECONDS,
								bazaar: middlewareConfig.bazaar?.[path],
						});

						c.header("PAYMENT-REQUIRED", Buffer.from(JSON.stringify(v2Challenge)).toString("base64"));
						// Spec-shaped v2 body (x402Version/accepts) with the legacy v1
						// error envelope folded in so both client generations can parse it.
						return c.json(
								{
										...v2Challenge,
										error: {
												message: "Payment required",
												type: "payment_required",
												payment: paymentRequired,
										},
								},
								402,
						);
				}

				let paymentSig: PaymentSignature;
				if (xPaymentHeader) {
						try {
								paymentSig = parseXPaymentHeader(xPaymentHeader);
						} catch (err) {
								return c.json(
										{ error: { message: err instanceof Error ? err.message : "Invalid X-PAYMENT header", type: "payment_error" } },
										400,
								);
						}
				} else {
						// PAYMENT-SIGNATURE carries either the legacy OMA raw-JSON envelope or,
						// per the current v2 spec (which renamed X-PAYMENT → PAYMENT-SIGNATURE),
						// base64-encoded v2 JSON. Sniff the first character to tell them apart.
						const raw = (paymentHeader as string).trim();
						try {
								paymentSig = parsePaymentSignatureHeader(raw);
						} catch (err) {
								return c.json(
										{ error: { message: err instanceof Error ? err.message : "Invalid PAYMENT-SIGNATURE header", type: "payment_error" } },
										400,
								);
						}
				}

				if (paymentSig.payload?.payee?.toLowerCase() !== payeeAddress.toLowerCase()) {
						return c.json(
								paymentError("x402_payee_mismatch", "Payment payee mismatch", false),
								402,
						);
				}

				const requestedAtomic = parseUsdcAtomic(paymentSig.payload?.amount ?? "0");
				const requiredAtomic = parseUsdcAtomic(price);
				// Reject underpayment first (the client is paying less than the price).
				if (requestedAtomic < requiredAtomic) {
						return c.json(
								paymentError("x402_underpayment", `Insufficient payment: requested ${requestedAtomic} but ${requiredAtomic} required`, false),
								402,
						);
				}
				// Reject overpayment — the actual settled amount is determined by
				// verifyPayment (on-chain), not the client-supplied amount field.
				if (requestedAtomic > requiredAtomic) {
						return c.json(
								paymentError("x402_overpayment", `Payment amount exceeds maximum: requested ${requestedAtomic} but ${requiredAtomic} allowed`, false),
								402,
						);
				}

				const startedAt = Date.now();
				const verification = await verifyPayment(paymentSig);

				if (!verification.valid) {
						logPaymentEvent({
								kind: "x402",
								outcome: verification.error?.toLowerCase().includes("replay")
										? "double_spend_blocked"
										: "rejected",
								amountCents: Number(price) * 100,
								signature: paymentSig.signature,
								latencyMs: Date.now() - startedAt,
						});
						return c.json(
								paymentError(
										verification.error?.toLowerCase().includes("replay")
												? "x402_replay_detected"
												: "x402_verification_failed",
										verification.error ?? "Payment verification failed",
										false,
								),
								402,
						);
				}

				if (verification.txHash) {
						await settlePaymentAsync(
								verification.txHash,
								verification.amount ?? paymentSig.payload.amount,
								verification.networkId ?? paymentSig.payload.networkId,
								payeeAddress,
								{ idempotencyKey: paymentSig.signature },
						);
						logPaymentEvent({
								kind: "x402",
								outcome: "settled",
								amountCents: Number(verification.amount ?? paymentSig.payload.amount) * 100,
								signature: paymentSig.signature,
								latencyMs: Date.now() - startedAt,
						});
				}

				c.set("payment", { txHash: verification.txHash, amount: verification.amount ?? paymentSig.payload.amount, networkId: verification.networkId ?? paymentSig.payload.networkId });
				// Settlement receipt headers: PAYMENT-RESPONSE is the current v2 spec
				// name; X-PAYMENT-RESPONSE is kept for clients built against the older
				// draft. Same base64 payload in both.
				const receiptHeader = buildXPaymentResponse({
						txHash: verification.txHash,
						payer: paymentSig.payload.payFrom,
				});
				c.header("PAYMENT-RESPONSE", receiptHeader);
				if (xPaymentHeader) {
						c.header("X-PAYMENT-RESPONSE", receiptHeader);
				}
				await next();
		};
}
