import { randomBytes } from "node:crypto";
import {
		decodeFunctionData,
		formatUnits,
		parseAbi,
		type Hash,
} from "viem";
import { config } from "../config.js";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
import { logger } from "../lib/logger.js";
import { getPublicClient } from "../lib/rpc-client.js";
import { isEip3009Authorization, verifyEip3009Payment } from "./eip3009.js";
import { parseUsdcAtomic } from "./facilitator-signing.js";
import { consumeNonce } from "./replay.js";
import {
		cacheVerifiedRecord,
		getVerificationCacheKey,
		settlementCache,
} from "./settlement-cache.js";
import { SERVER_TREASURY } from "./treasury.js";
import type { PaymentPayload, PaymentResponse, PaymentSignature } from "./types.js";

function checkTransferAmount(
		rawAmount: bigint,
		recipient: string,
		payeeLower: string,
		txHash: Hash,
		networkId: string,
		requiredAmountStr: string,
): PaymentResponse {
		const amount = formatUnits(rawAmount, USDC_DECIMALS);
		const actualAtomic = parseUsdcAtomic(amount);
		const requiredAtomic = parseUsdcAtomic(requiredAmountStr);
		if (actualAtomic < requiredAtomic) {
				return { valid: false, error: `Insufficient payment: ${actualAtomic} < ${requiredAtomic}` };
		}
		if (recipient.toLowerCase() !== payeeLower) {
				return { valid: false, error: "Recipient mismatch" };
		}
		return { valid: true, txHash, amount, networkId };
}

/**
	* Legacy on-chain-receipt verification (kept for backward compatibility with
	* any client still sending a tx hash as `signature`). New clients should use
	* the EIP-3009 path via verifyEip3009Payment, which is gasless for the user.
	*/
async function verifyUsdcTransferReceipt(
		txHash: Hash,
		payload: PaymentPayload,
): Promise<PaymentResponse> {
		// CRIT-2 — consume nonce BEFORE the on-chain RPC call. A replay
		// attempt never reaches the (expensive) `eth_getTransactionReceipt`.
		const nonceResult = await consumeNonce(payload.nonce);
		if (!nonceResult.ok) {
				return { valid: false, error: `Replay protection: ${nonceResult.reason}` };
		}

		async function attemptVerification(): Promise<PaymentResponse> {
				const client = getPublicClient();

				const receipt = await client.getTransactionReceipt({ hash: txHash });

				if (!receipt || receipt.status !== "success") {
						return { valid: false, error: "Transaction failed or not found" };
				}

				const tx = await client.getTransaction({ hash: txHash });

				if (!tx) {
						return { valid: false, error: "Transaction data not found" };
				}

				if (tx.to?.toLowerCase() !== USDC_BASE.toLowerCase()) {
						return { valid: false, error: "Transaction not to USDC contract" };
				}

				const fromLower = tx.from.toLowerCase();
				const payeeLower = payload.payee.toLowerCase();
				const payFromLower = payload.payFrom.toLowerCase();

				if (SERVER_TREASURY && payeeLower !== SERVER_TREASURY) {
						return { valid: false, error: "Payee does not match configured treasury" };
				}

				if (fromLower !== payFromLower) {
						return { valid: false, error: "Transaction sender does not match payFrom" };
				}

				if (tx.input.length >= 10) {
						try {
								const usdcAbi = parseAbi([
										"function transfer(address to, uint256 amount) returns (bool)",
										"function transferFrom(address from, address to, uint256 amount) returns (bool)",
								]);
								const decoded = decodeFunctionData({ abi: usdcAbi, data: tx.input as `0x${string}` });

								if (decoded.functionName === "transfer") {
										const [recipient, rawAmount] = decoded.args as [string, bigint];
										return checkTransferAmount(rawAmount, recipient, payeeLower, txHash, payload.networkId, payload.maxAmountRequired || payload.amount || "0");
								}

								if (decoded.functionName === "transferFrom") {
										const [, recipient, rawAmount] = decoded.args as [string, string, bigint];
										return checkTransferAmount(rawAmount, recipient, payeeLower, txHash, payload.networkId, payload.maxAmountRequired || payload.amount || "0");
								}
						} catch (decodeErr) {
								logger.error({ err: decodeErr }, "[facilitator] Failed to decode USDC transfer data");
								return { valid: false, error: `Failed to decode USDC transfer data` };
						}
				}

				const valueEth = formatUnits(tx.value, 18);
				return {
						valid: false,
						txHash,
						amount: valueEth,
						networkId: payload.networkId,
						error: "Unrecognized USDC transfer method",
				};
		}

		// viem fallback transport (getPublicClient) handles RPC failover
		// automatically across QuickNode + free public endpoints.
		try {
				return await attemptVerification();
		} catch (err: unknown) {
				logger.error({ err }, "[facilitator] EVM verification error (all RPCs failed)");
				return { valid: false, error: "EVM verification failed: no trusted RPC available" };
		}
}

// ============================================================
// EVM Verification Dispatcher (Base)
// ============================================================
//
// Routes V1 verify calls to the EIP-3009 path (default, gasless for the user)
// when the request carries a JSON EIP-3009 authorization tuple, OR to the
// legacy on-chain-receipt path when the request carries a tx hash in
// `signature` (backward compatibility).
//
// one dispatcher, two children. The two children have totally
// different semantics (sig-recovery vs receipt-check) so a single merged
// function would be a 200-line branch spaghetti. The split keeps each path
// readable and independently testable.

async function verifyEvmPayment(
		signature: string,
		authorization: string,
		payload: PaymentPayload,
): Promise<PaymentResponse> {
		// Detect EIP-3009 wire by attempting to parse `authorization` as the JSON
		// tuple. If it parses AND has the EIP-3009 shape, route to the new path.
		let parsedAuth: unknown = null;
		let parsedAsJson = false;
		if (authorization) {
				try {
						parsedAuth = JSON.parse(authorization);
						parsedAsJson = true;
				} catch {
						parsedAuth = null;
				}
		}

		if (isEip3009Authorization(parsedAuth)) {
				return verifyEip3009Payment(signature, authorization, payload);
		}

		// if the client sent JSON but the shape is NOT a complete
		// EIP-3009 tuple, it's almost certainly a malformed EIP-3009 request.
		// Surface a clear "invalid authorization" error rather than silently
		// falling through to the legacy receipt-check path (which would then
		// fail with an RPC error that has nothing to do with the real cause).
		if (parsedAsJson && parsedAuth && typeof parsedAuth === "object") {
				return {
						valid: false,
						error: "Invalid EIP-3009 authorization: missing required fields { from, to, value, validAfter, validBefore, nonce }",
				};
		}

		// a 65-byte signature (132 hex chars) is the EIP-712 sig shape,
		// NOT a 32-byte tx-hash shape. If the client sent an EIP-712-shaped sig
		// with a non-JSON authorization, they almost certainly forgot to JSON-
		// encode the EIP-3009 tuple. Reject loud with the canonical error rather
		// than letting the legacy path try to fetch a receipt for a non-tx hash.
		if (signature.startsWith("0x") && signature.length === 132) {
				return {
						valid: false,
						error: "Invalid EIP-3009 authorization: must be JSON-encoded EIP-3009 tuple { from, to, value, validAfter, validBefore, nonce }",
				};
		}

		// Legacy path: `authorization` is opaque (non-JSON) and `signature` is a tx
		// hash. We still support this for any pre-existing client that already
		// submitted a USDC transfer on its own.
		const txHash = signature.startsWith("0x")
				? (signature as Hash)
				: (`0x${signature}` as Hash);
		return verifyUsdcTransferReceipt(txHash, payload);
}

// ============================================================
// Mock Verification (DEVELOPMENT ONLY)
// ============================================================
// WARNING: Mock mode accepts ANY payment as valid without on-chain
// verification. This is safe ONLY because config.ts throws a fatal
// error if FACILITATOR_MODE=mock is used in production or staging.
// See: config.ts line ~41-43

async function mockVerifyPayment(
		signature: string,
		payload: PaymentPayload,
): Promise<PaymentResponse> {
		// CRIT-2 — even mock mode must consume the nonce so a replayed
		// mock signature does not verify twice.
		const nonceResult = await consumeNonce(payload.nonce);
		if (!nonceResult.ok) {
				logger.warn({ reason: nonceResult.reason }, "[FACILITATOR] Mock-mode replay blocked");
				return { valid: false, error: `Replay protection: ${nonceResult.reason}` };
		}
		logger.warn(
				{ signaturePrefix: signature.slice(0, 16), scheme: payload.scheme, amount: payload.amount },
				"[FACILITATOR] Mock-mode verification accepted",
		);

		// Mock mode still emits a plausible txHash so the settle cache + receipt
		// contract work identically to live mode (the hash is synthetic and never
		// corresponds to an on-chain tx). Scheme is always "evm" for x402, so no
		// branching is needed — both branches were byte-identical.
		const mockTxHash = `0x${randomBytes(32).toString("hex")}`;

		return {
				valid: true,
				txHash: mockTxHash,
				amount: payload.amount,
				networkId: payload.networkId,
		};
}

// ============================================================
// Core: verifyPayment
// ============================================================

export async function verifyPayment(
	paymentSig: PaymentSignature,
): Promise<PaymentResponse> {
	const { signature, authorization, payload } = paymentSig;
	const cacheKey = getVerificationCacheKey(payload, signature);

	// The validity window is checked BEFORE the cache is consulted, and that
	// ordering is load-bearing.
	//
	// A cache hit used to short-circuit straight to `{ valid: true }`, which
	// skipped both this expiry check and the nonce consumption further down
	// (consumeNonce in verifyEipmPayment and again in the EIP-3009 path).
	// Because the verification cache is retained for CACHE_TTL_MS — 24 hours —
	// a single captured payment signature stayed replayable for a full day,
	// long after its own 5-minute validBefore closed, authorizing repeated
	// paid inference for one payment.
	//
	// The cache exists for settlement idempotency (don't re-submit an
	// on-chain transfer for a client retry), which is legitimate, but it must
	// never extend an authorization's life. Bounding a cache hit by the
	// signed validity window keeps that retry behaviour while capping reuse
	// at the window the payer actually signed.
	const now = Math.floor(Date.now() / 1000);
	if (payload.validBefore && now > payload.validBefore) {
		return { valid: false, error: "Payment authorization expired" };
	}
	if (payload.validAfter && now < payload.validAfter) {
		return { valid: false, error: "Payment authorization not yet valid" };
	}

	const cached = settlementCache.get(cacheKey);
	if (cached) {
		return {
			valid: true,
			txHash: cached.txHash,
			amount: cached.amount,
			networkId: cached.networkId,
		};
	}

		const mode = config.FACILITATOR_MODE ?? "mock";

		if (mode === "mock") {
				if (config.NODE_ENV === "production") {
						throw new Error(`[FACILITATOR] FATAL: Mock payment mode explicitly forbidden in production`);
				}
				logger.warn("[FACILITATOR] Processing payment in mock mode -- signatures are NOT verified on-chain");
				const result = await mockVerifyPayment(signature, payload);
				cacheVerifiedRecord(payload, result, signature);
				return result;
		}

		if (payload.scheme === "evm") {
				const result = await verifyEvmPayment(signature, authorization, payload);
				cacheVerifiedRecord(payload, result, signature);
				return result;
		}

		return { valid: false, error: `Unsupported scheme: ${payload.scheme}` };
}
