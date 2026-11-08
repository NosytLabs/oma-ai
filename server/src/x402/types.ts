// x402 wire types shared across the facilitator modules.
// Extracted from facilitator.ts (2026-07-26 module split) — the public
// surface is still re-exported from "./facilitator.js".

type X402Version = "1" | "2";

export interface PaymentPayload {
		x402Version: X402Version;
		scheme: "evm";
		networkId: string;
		asset: string;
		amount: string;
		payee: string;
		payFrom: string;
		maxAmountRequired: string;
		validBefore: number;
		validAfter: number;
		description?: string;
		// per-payload random nonce for replay protection (CRIT-2).
		// Mirrors the field on `types.ts` PaymentPayload. Optional for v1 clients.
		nonce?: string;
}

export interface PaymentSignature {
		x402Version: X402Version;
		signature: string;
		authorization: string;
		payload: PaymentPayload;
}

export interface PaymentRequired {
		x402Version: X402Version;
		scheme: "evm";
		networkId: string;
		asset: string;
		amount: string;
		payee: string;
		maxAmountRequired: string;
		validBefore: number;
		validAfter: number;
		description?: string;
		"payment-URL"?: string;
}

export interface PaymentResponse {
		valid: boolean;
		txHash?: string;
		amount?: string;
		networkId?: string;
		error?: string;
}

/**
 * Settlement cache state.
 *
 * The cache used to tell "verified but not settled" from "settled" by the
 * presence of `receipt`: a missing receipt meant "not settled yet". That rule
 * lived only in comments and in `if (record.receipt)` checks, so a settled
 * record could be written without a receipt, and a reader could not tell the
 * two apart without already knowing the convention.
 *
 * The state is now explicit and the type system enforces the pairing: a
 * settled record always carries its receipt, a verified record never does.
 */
export const SETTLEMENT_STATE = {
	/** The payment was verified on-chain; no receipt has been issued yet. */
	Verified: "verified",
	/** The payment was settled and a receipt was issued. */
	Settled: "settled",
} as const;

interface SettlementRecordBase {
	txHash: string;
	amount: string;
	networkId: string;
	payee: string;
	// SECURITY (x402-ownership audit): the on-chain sender of the verified
	// payment. `/x402/verify` already enforces tx `from == payload.payFrom`
	// (verify.ts), but discards the payer after the check. Carrying it here
	// lets `/x402/settle` bind the credit to the session user who owns that
	// sender (via evmAddress), closing the hole where any session could
	// claim a verified-but-unsettled payment.
	payFrom?: string;
	settledAt: number;
}

/** A verified payment that has not been settled yet. */
interface VerifiedSettlementRecord extends SettlementRecordBase {
	state: typeof SETTLEMENT_STATE.Verified;
}

/** A settled payment: the receipt exists and can be replayed. */
export interface SettledSettlementRecord extends SettlementRecordBase {
	state: typeof SETTLEMENT_STATE.Settled;
	receipt: string;
}

/** A cached settlement in either state. */
export type SettlementRecord =
	| VerifiedSettlementRecord
	| SettledSettlementRecord;

/**
 * True when the cached record is a completed settlement.
 *
 * Replaces the old "does it have a receipt?" test: the state is part of the
 * record, so a settled record can never be missing its receipt.
 */
export function isSettledRecord(
	record: SettlementRecord | null | undefined,
): record is SettledSettlementRecord {
	return record?.state === SETTLEMENT_STATE.Settled;
}

export interface SettlementResponse {
		settled: boolean;
		receipt: string;
		error?: string;
}

export interface PaymentMiddlewareConfig {
		pricing: Record<string, string>;
		payeeAddress: string;
		asset?: string;
		networkId?: string;
		scheme?: "evm";
		/** Per-path Bazaar discovery descriptors included in v2 402 challenges. */
		bazaar?: Record<string, import("./v2.js").BazaarResourceInfo>;
}

/** Seconds a 402 challenge (and its authorization window) stays valid. */
export const PAYMENT_WINDOW_SECONDS = 300;
