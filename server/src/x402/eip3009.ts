import {
		createWalletClient,
		http,
		formatUnits,
		encodePacked,
		encodeFunctionData,
		keccak256,
		recoverTypedDataAddress,
		parseAbi,
		type Hash,
		type Hex,
} from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config.js";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
import { logger } from "../lib/logger.js";
import { getPublicClient } from "../lib/rpc-client.js";
import { parseUsdcAtomic } from "./facilitator-signing.js";
import { consumeNonce } from "./replay.js";
import { SERVER_TREASURY } from "./treasury.js";
import type { PaymentPayload, PaymentResponse } from "./types.js";

// ============================================================
// EIP-3009 transferWithAuthorization (Base USDC)
// ============================================================
//
// USDC on Base is FiatTokenV2_2 (Circle's reference implementation) and exposes
// both EIP-3009 selectors natively:
//   transferWithAuthorization = 0xe3ee160e
//   receiveWithAuthorization  = 0xef55bec6
//
// Wire shape (canonical x402 v2 + Coinbase x402):
//   signature     = 65-byte EIP-712 sig over TransferWithAuthorization typed data
//   authorization = JSON { from, to, value, validAfter, validBefore, nonce }
//   payload       = PaymentPayload (payee == authorization.to)
//
// EIP-3009 is GASLESS for the user — the facilitator (us) submits
// the on-chain tx via FACILITATOR_PRIVATE_KEY when set. Without the private key
// we fall back to an eth_call simulation and return a deterministic synthetic
// txHash so the verify+settle API surface still produces a receipt.

// SECP256K1_N/2 — EIP-2 mandates a low-S signature. We enforce it explicitly
// because viem's `recoverTypedDataAddress` does not reject high-S; a
// malleated signature would still recover the same address and pass the
// upstream equality check. Reject at the verify path so the contract call
// (which the contract itself rejects) never even reaches submission.
const SECP256K1_N_OVER_2 =
		0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0n;

// USDC contracts and their chain IDs. OMA settles on Base mainnet today
// but the chainId for EIP-712 must match the actual chain the
// authorization is bound to, otherwise the typed-data hash differs and
// the signature doesn't recover. We derive chainId from the request's
// networkId via `USDC_DOMAIN_BY_NETWORK`.
type UsdcDomain = {
		name: string;
		version: string;
		chainId: number;
		verifyingContract: `0x${string}`;
};

const USDC_DOMAIN_BY_NETWORK: Record<string, UsdcDomain> = {
		base: {
				name: "USD Coin",
				version: "2",
				chainId: 8453,
				verifyingContract: USDC_BASE,
		},
};

/**
 * Strict network resolution for anything user-supplied.
 *
 * usdcDomainForNetwork deliberately falls back to Base so an unrecognised
 * network still verifies against the chain OMA actually settles on — funds
 * can never be diverted, because the EIP-712 domain and the transfer target
 * both stay pinned to USDC_BASE.
 *
 * That fallback is correct for verification but wrong for *accepting a
 * request*: a caller could declare `networkId: "ethereum-mainnet"` and be
 * told the payment was verified, even though nothing about that declaration
 * was checked. This resolver refuses instead, so a contradictory claim is
 * rejected rather than quietly reinterpreted.
 */
export function resolveSettlementNetwork(networkId: string | undefined): UsdcDomain {
	const key = (networkId ?? "base").toLowerCase();
	const domain = USDC_DOMAIN_BY_NETWORK[key];
	if (!domain) {
		throw new Error(`Unsupported settlement network: ${networkId}`);
	}
	return domain;
}

/** True when `asset` is the USDC contract OMA settles against. */
export function isSupportedSettlementAsset(asset: string | undefined): boolean {
	return (asset ?? "").toLowerCase() === USDC_BASE.toLowerCase();
}

function usdcDomainForNetwork(networkId: string | undefined): UsdcDomain {
	// SECURITY (audit 3.1): the chainId is derived from the request's
	// networkId, never hardcoded. The default is Base mainnet, which is
	// the only chain OMA settles on today. Adding a new network requires
	// adding the corresponding entry to USDC_DOMAIN_BY_NETWORK.
	const key = (networkId ?? "base").toLowerCase();
	return (
		USDC_DOMAIN_BY_NETWORK[key] ?? {
			...USDC_DOMAIN_BY_NETWORK.base,
		}
	);
}

const EIP3009_TRANSFER_WITH_AUTH_TYPES = {
		TransferWithAuthorization: [
				{ name: "from", type: "address" },
				{ name: "to", type: "address" },
				{ name: "value", type: "uint256" },
				{ name: "validAfter", type: "uint256" },
				{ name: "validBefore", type: "uint256" },
				{ name: "nonce", type: "bytes32" },
		],
} as const;

const USDC_EIP3009_ABI = parseAbi([
		"function transferWithAuthorization(address from, address to, uint256 value, uint256 validAfter, uint256 validBefore, bytes32 nonce, bytes signature) returns (bool)",
		"function authorizationState(address authorizer, bytes32 nonce) view returns (bool)",
		"function balanceOf(address account) view returns (uint256)",
]);

export interface Eip3009Authorization {
		from: string;
		to: string;
		value: string;
		validAfter: string;
		validBefore: string;
		nonce: string;
}

/**
	* Type-guard: is `authorization` a JSON EIP-3009 tuple? We auto-detect from
	* shape so the V1 endpoint can serve both the legacy on-chain-receipt path
	* (signature = tx hash) AND the new EIP-3009 path (signature = EIP-712 sig).
	*/
export function isEip3009Authorization(value: unknown): value is Eip3009Authorization {
		if (!value || typeof value !== "object") return false;
		const a = value as Record<string, unknown>;
		return (
				typeof a.from === "string" &&
				typeof a.to === "string" &&
				(typeof a.value === "string" || typeof a.value === "number") &&
				(typeof a.validAfter === "string" || typeof a.validAfter === "number") &&
				(typeof a.validBefore === "string" || typeof a.validBefore === "number") &&
				typeof a.nonce === "string"
		);
}

/**
	* Signature recovery logic for EIP-3009 compliant authorize payloads.
	*
	* Why: Resolves the canonical public key address that authorized the specified transfer,
	* allowing the facilitator to verify that the signer is indeed the owner of the funds
	* before spending gas on-chain or generating synthetic receipts.
	*
	* @param auth - The detailed EIP-3009 transfer authorization payload structure.
	* @param signature - The 65-byte ECDSA signature over the typed domain.
	* @param networkId - The x402 network id from the payload (drives USDC chainId).
	* @returns The verified, lowercase Ethereum address.
	*/
async function recoverEip3009Signer(
		auth: Eip3009Authorization,
		signature: Hex,
		networkId: string,
): Promise<string> {
		const recovered = await recoverTypedDataAddress({
				domain: usdcDomainForNetwork(networkId),
				types: EIP3009_TRANSFER_WITH_AUTH_TYPES,
				primaryType: "TransferWithAuthorization",
				message: {
						from: auth.from as `0x${string}`,
						to: auth.to as `0x${string}`,
						value: BigInt(auth.value),
						validAfter: BigInt(auth.validAfter),
						validBefore: BigInt(auth.validBefore),
						nonce: auth.nonce as `0x${string}`,
				},
				signature,
		});
		return recovered.toLowerCase();
}

/**
	* Generates a deterministic, collison-free synthetic transaction hash.
	* 
	* Why: When running in a testing environment or without a configured facilitator private key,
	* we must still supply a valid receipt structure back to API callers. This helper produces
	* a unique synthetic hash derived from the specific authorization details and signature,
	* preventing replay mapping collisions while maintaining API contract integrity.
	* 
	* @param auth - The EIP-3009 transfer authorization payload structure.
	* @param signature - The signature that authorized the transfer.
	* @returns A unique Hash acting as a placeholder receipt transaction identifier.
	*/
function syntheticEip3009TxHash(auth: Eip3009Authorization, signature: Hex): Hash {
		const sigHex = signature.startsWith("0x") ? signature.slice(2) : signature;
		const packed = encodePacked(
				[
						"string",
						"address",
						"address",
						"uint256",
						"uint256",
						"uint256",
						"bytes32",
				],
				[
						"oma-eip3009",
						auth.from as `0x${string}`,
						auth.to as `0x${string}`,
						BigInt(auth.value),
						BigInt(auth.validAfter),
						BigInt(auth.validBefore),
						auth.nonce as `0x${string}`,
				],
		);
		// bind the placeholder to the signature too, so the same auth
		// tuple with a different signature gets a different placeholder. Concat
		// the keccak of the tuple with the first 32 bytes of the sig, then hash.
		const sigChunk = (sigHex.length >= 64 ? sigHex.slice(0, 64) : sigHex.padEnd(64, "0")) as Hex;
		return keccak256(("0x" + (packed.slice(2) + sigChunk.slice(2))) as Hex) as Hash;
}

/**
	* Simulates the execution of the authorization transfer on-chain via eth_call.
	* 
	* Why: We must ensure that the USDC contract will accept the transfer before we submit it to
	* the block-mining queue or record a synthetic deposit receipt. This simulation checks for common
	* failure modes (e.g., used nonces, expired validity periods, or insufficient user balances)
	* under real-time network states without incurring gas fees.
	* 
	* @param auth - The EIP-3009 transfer authorization payload structure.
	* @param signature - The signature that authorized the transfer.
	* @throws If the simulated contract call reverts.
	*/
async function simulateEip3009Transfer(
		auth: Eip3009Authorization,
		signature: Hex,
): Promise<void> {
		const client = getPublicClient();
		const data = encodeFunctionData({
				abi: USDC_EIP3009_ABI,
				functionName: "transferWithAuthorization",
				args: [
						auth.from as `0x${string}`,
						auth.to as `0x${string}`,
						BigInt(auth.value),
						BigInt(auth.validAfter),
						BigInt(auth.validBefore),
						auth.nonce as `0x${string}`,
						signature,
				],
		});
		await client.call({
				to: USDC_BASE,
				data,
				// simulate from zero-address; contract-level checks (msg.sender) are not
				// meaningful for transferWithAuthorization (sender must NOT be `from`),
				// so a zero-address simulates "anyone calls this" which is the legitimate
				// facilitator role. The contract will revert on (a) bad signature, (b)
				// nonce already used, (c) value > balance, etc.
				account: "0x0000000000000000000000000000000000000000",
		});
}

/**
	* Dispatches the authorized transaction on-chain via the local facilitator wallet.
	* 
	* Why: When a dedicated private key is configured, the server operates as a gasless relayer
	* for the user, paying the transaction fee to complete the transfer directly on the Base network.
	* 
	* @param auth - The EIP-3009 transfer authorization payload structure.
	* @param signature - The signature that authorized the transfer.
	* @returns The genuine on-chain transaction hash.
	* @throws If the facilitator key is missing or the contract transaction reverts during execution.
	*/
async function submitEip3009Transfer(
		auth: Eip3009Authorization,
		signature: Hex,
): Promise<Hash> {
		if (!config.FACILITATOR_PRIVATE_KEY) {
				throw new Error("FACILITATOR_PRIVATE_KEY not configured; cannot submit on-chain");
		}
		const account = privateKeyToAccount(config.FACILITATOR_PRIVATE_KEY as Hex);
		const walletClient = createWalletClient({
				account,
				chain: base,
				transport: http(config.CHAIN_RPC_URL),
		});
		const txHash = await walletClient.writeContract({
			address: USDC_BASE,
			abi: USDC_EIP3009_ABI,
			functionName: "transferWithAuthorization",
			args: [
				auth.from as `0x${string}`,
				auth.to as `0x${string}`,
				BigInt(auth.value),
				BigInt(auth.validAfter),
				BigInt(auth.validBefore),
				auth.nonce as `0x${string}`,
				signature,
			],
		});
		return txHash as Hash;
	}

/**
 * Upper bound on the receipt wait, in ms.
 *
 * viem's own default is 180_000 (3 minutes), which exceeds most gateway and
 * serverless request deadlines. The x402 facilitator guidance is explicit that
 * the wait should sit below the platform deadline so a process killed mid-wait
 * returns something reconcilable rather than a bare 5xx with no hash.
 */
const SETTLEMENT_CONFIRMATION_TIMEOUT_MS = 25_000;

/**
 * Dispatches the transfer AND waits for it to actually settle.
 *
 * `writeContract` returns as soon as the transaction is *broadcast* — it says
 * nothing about whether the transaction was ever mined, and nothing about
 * whether it succeeded. The caller persisted that hash as a completed
 * settlement and issued credits against it, so a transfer that was dropped
 * from the mempool, reverted (insufficient balance at broadcast time, a race
 * that already consumed the nonce, a paused contract), or never mined at all
 * still read as a paid request.
 *
 * This waits for the receipt and requires status "success". A reverted or
 * missing receipt throws, so no credit is ever issued for a transfer that did
 * not complete. The cost is latency: settlement now blocks for finality
 * instead of returning immediately, which is the correct trade for a payment
 * that grants credits.
 */
export async function submitEip3009TransferAndConfirm(
	auth: Eip3009Authorization,
	signature: Hex,
): Promise<Hash> {
	const txHash = await submitEip3009Transfer(auth, signature);
	const client = getPublicClient();

	let receipt: Awaited<
		ReturnType<typeof client.waitForTransactionReceipt>
	>;
	try {
		receipt = await client.waitForTransactionReceipt({
			hash: txHash,
			confirmations: 1,
			// Bound the wait. viem's own default is 180s, which is longer than
			// most gateway/serverless request deadlines — being killed mid-wait
			// loses the hash entirely. The x402 spec calls for the receipt wait
			// to sit below the platform deadline for exactly this reason.
			timeout: SETTLEMENT_CONFIRMATION_TIMEOUT_MS,
		});
	} catch (err) {
		// NOT a terminal failure and NOT a success. The transfer is already
		// broadcast, so it may still confirm on chain. The x402 spec models
		// this as a non-terminal `settlement_pending`: the response carries the
		// broadcast hash so the caller can reconcile on chain before deciding
		// whether to retry, rather than re-submitting and double-paying.
		//
		// The hash is returned alongside the failure on purpose — dropping it
		// would leave an unknown broadcast transaction nobody can reconcile.
		logger.error(
			{ err, txHash },
			"[FACILITATOR] settlement unconfirmed; returning hash for reconciliation",
		);
		const pending = new Error(
			`Settlement transaction ${txHash} was not confirmed; payment not credited`,
		) as Error & { txHash?: string };
		pending.txHash = txHash;
		throw pending;
	}

	if (receipt.status !== "success") {
		// Terminal: the transaction mined and reverted, so the funds did not
		// move. Retrying the same authorization is pointless (the nonce is
		// spent) and the payer must be told to sign a new one.
		logger.error(
			{ txHash, status: receipt.status },
			"[FACILITATOR] settlement tx reverted; refusing to credit",
		);
		throw new Error(
			`Settlement transaction ${txHash} reverted on chain; payment not credited`,
		);
	}

	return txHash;
}

/**
	* EIP-3009 verify path. Replaces the legacy on-chain-receipt check.
	*
	* Steps:
	*  1. Consume nonce (CRIT-2 replay protection; runs before any expensive RPC).
	*  2. Parse + validate the EIP-3009 authorization tuple shape.
	*  3. Reject if payee != SERVER_TREASURY (the merchant pin is non-negotiable).
	*  4. Reject if amount < payload.maxAmountRequired.
	*  5. Reject if validBefore expired or validAfter not yet reached.
	*  6. Recover the EIP-712 signer; reject if signer != authorization.from.
	*  7. Simulate via eth_call (rejects if contract would revert — e.g. nonce
	*     already used, balance insufficient).
	*  8. Submit on-chain if FACILITATOR_PRIVATE_KEY is set; otherwise return a
	*     deterministic synthetic txHash so the settle cache + receipt still work.
	*/
/**
	* Verifies, simulates, and executes an incoming gasless EIP-3009 payment.
	* 
	* Why: Orchestrates the x402 payment verification and settlement pipeline
	* required by x402 headers. Performs multi-layered checks (double-spend/replay protection,
	* signature recovery, time bounds, and recipient treasury validation) to guarantee that
	* each request is fully authorized and backed by sufficient USDC balances prior to processing
	* upstream inference operations.
	* 
	* @param signature - The EIP-712 signature proving transfer authorization.
	* @param authorization - JSON-encoded EIP-3009 transfer details.
	* @param payload - The payment requirement context including expected amounts, payees, and nonces.
	* @returns A structured verification and settlement response containing validation status and txHash.
	*/
export async function verifyEip3009Payment(
		signature: string,
		authorization: string,
		payload: PaymentPayload,
): Promise<PaymentResponse> {
		// 1. Replay protection
		const nonceResult = await consumeNonce(payload.nonce);
		if (!nonceResult.ok) {
				return { valid: false, error: `Replay protection: ${nonceResult.reason}` };
		}

		// 2. Parse authorization tuple. Accept JSON object or JSON-encoded string.
		let authRaw: unknown;
		try {
				authRaw = JSON.parse(authorization);
		} catch {
				return { valid: false, error: "Invalid authorization: must be JSON-encoded EIP-3009 tuple { from, to, value, validAfter, validBefore, nonce }" };
		}
		if (!isEip3009Authorization(authRaw)) {
				return { valid: false, error: "Invalid EIP-3009 authorization: missing required fields { from, to, value, validAfter, validBefore, nonce }" };
		}
		const auth: Eip3009Authorization = authRaw;
		if (payload.nonce !== auth.nonce) {
				return { valid: false, error: "Payload nonce does not match EIP-3009 authorization nonce" };
		}

		// 3. Payee must equal the server-pinned merchant treasury.
		const payeeLower = auth.to.toLowerCase();
		if (SERVER_TREASURY && payeeLower !== SERVER_TREASURY) {
				return { valid: false, error: "Payee does not match configured treasury" };
		}

		if (payload.payee.toLowerCase() !== auth.to.toLowerCase()) {
				return { valid: false, error: "Payload payee does not match EIP-3009 authorization recipient" };
		}
		if (payload.payFrom.toLowerCase() !== auth.from.toLowerCase()) {
				return { valid: false, error: "Payload payFrom does not match EIP-3009 authorization sender" };
		}

		// 4. Amount check.
		let authAtomic: bigint;
		let requiredAtomic: bigint;
		try {
				authAtomic = BigInt(auth.value);
				requiredAtomic = parseUsdcAtomic(payload.maxAmountRequired || payload.amount || "0");
		} catch (err) {
				return { valid: false, error: `Invalid amount: ${err instanceof Error ? err.message : String(err)}` };
		}
		if (requiredAtomic <= 0n) {
				return { valid: false, error: "Required payment amount must be a positive USDC value" };
		}
		if (authAtomic < requiredAtomic) {
				return { valid: false, error: `Insufficient payment: ${authAtomic} < ${requiredAtomic}` };
		}
		// SECURITY (audit 3.3 / HIGH): reject overpayment. We pin the x402 invoice
		// to the exact request price; any surplus would otherwise be silently
		// absorbed by the treasury. Clients must re-issue a payment with the
		// exact requiredAtomic amount.
		if (authAtomic > requiredAtomic) {
				return { valid: false, error: `Overpayment rejected: ${authAtomic} > ${requiredAtomic} required` };
		}

		// 5. Time-bounds check. Authorization is valid while
		//    validAfter <= now < validBefore.
		// Legacy headers can carry arbitrary strings. Validate before BigInt so
		// malformed input returns a payment rejection instead of an HTTP 500.
		if (![auth.validAfter, auth.validBefore].every((value) =>
			(typeof value !== "number" || Number.isSafeInteger(value)) && /^\d{1,78}$/.test(String(value)),
		)) {
			return { valid: false, error: "Invalid authorization time: expected unsigned integer seconds" };
		}
		const nowSec = BigInt(Math.floor(Date.now() / 1000));
		const validAfter = BigInt(auth.validAfter);
		const validBefore = BigInt(auth.validBefore);
		if (validAfter > nowSec) {
				return { valid: false, error: "Authorization not yet valid (validAfter in future)" };
		}
		if (validBefore <= nowSec) {
				return { valid: false, error: "Authorization expired (validBefore in past)" };
		}

		// 6. Recover EIP-712 signer. The signature is 65 bytes (r||s||v), hex-encoded
		//    with 0x prefix. viem's recoverTypedDataAddress handles parsing.
		const sigHex = (signature.startsWith("0x") ? signature : `0x${signature}`) as Hex;
		if (sigHex.length !== 132) {
				return { valid: false, error: `Invalid EIP-712 signature length: expected 65 bytes (132 hex chars), got ${(sigHex.length - 2) / 2} bytes` };
		}
		if (!/^0x[0-9a-fA-F]{130}$/.test(sigHex)) {
			return { valid: false, error: "Invalid EIP-712 signature: expected hexadecimal bytes" };
		}
		// SECURITY (audit 3.1 / MEDIUM): reject high-S signatures explicitly.
		// EIP-2 mandates low-S; a high-S variant is a malleated signature that
		// recovers the same address but is non-canonical. Without this check
		// the same authorization could be replayed under a different signature
		// and bypass nonce-based replay protection if the nonce key were
		// recovered from the auth tuple (we use the raw nonce here, so it
		// wouldn't actually bypass — but rejecting is defense in depth and
		// matches the contract's on-chain behavior).
		//
		// signature layout: 0x || r (32 bytes = 64 hex) || s (32 bytes = 64 hex) || v (1 byte = 2 hex)
		const sigS = BigInt(("0x" + sigHex.slice(66, 130)) as Hex);
		if (sigS > SECP256K1_N_OVER_2) {
				return { valid: false, error: "High-S signature rejected (EIP-2 mandates low-S)" };
		}
		let recovered: string;
		try {
				recovered = await recoverEip3009Signer(auth, sigHex, payload.networkId);
		} catch (err) {
				return { valid: false, error: `Invalid EIP-712 signature: ${err instanceof Error ? err.message : String(err)}` };
		}
		if (recovered !== auth.from.toLowerCase()) {
				return { valid: false, error: "Signature does not match authorization.from" };
		}

		// 7. Simulate on-chain via eth_call. Rejects if the contract would revert
		//    (e.g. nonce already used, payer balance insufficient). This catches
		//    double-spend attempts even before submission.
		let txHash: Hash;
		try {
				await simulateEip3009Transfer(auth, sigHex);
				// 8. Settle: real on-chain submission when facilitator key is configured,
				//    deterministic synthetic txHash otherwise. The synthetic path keeps
				//    the verify+settle contract intact for dev/preview deployments that
				//    don't yet have a funded facilitator wallet.
				if (config.FACILITATOR_PRIVATE_KEY) {
						try {
								// Confirm the transfer actually settled before returning the
						// hash. A broadcast hash alone is not proof of payment: a
						// reverted or never-mined transfer would otherwise be
						// persisted as a completed settlement and credited.
						txHash = await submitEip3009TransferAndConfirm(auth, sigHex);
						} catch (submitErr) {
								// Surface a clear error if the facilitator key is configured but the
								// submit failed — the receipt can't be issued without a real txHash.
								logger.error(
										{ err: submitErr, from: auth.from, to: auth.to },
										"[FACILITATOR] EIP-3009 submit failed despite configured FACILITATOR_PRIVATE_KEY",
								);
								const pendingHash = (submitErr as { txHash?: string }).txHash;
								return { valid: false, ...(pendingHash ? { txHash: pendingHash, networkId: payload.networkId } : {}), error: `EIP-3009 submit failed: ${submitErr instanceof Error ? submitErr.message : String(submitErr)}` };
						}
				} else {
						txHash = syntheticEip3009TxHash(auth, sigHex);
				}
		} catch (simErr) {
				logger.warn(
						{ err: simErr, from: auth.from, to: auth.to, noncePrefix: auth.nonce.slice(0, 8) },
						"[FACILITATOR] EIP-3009 simulation failed (likely nonce already used or insufficient balance)",
				);
				return { valid: false, error: `EIP-3009 simulation failed: ${simErr instanceof Error ? simErr.message : String(simErr)}` };
		}

		const amount = formatUnits(authAtomic, USDC_DECIMALS);

		return {
				valid: true,
				txHash,
				amount,
				networkId: payload.networkId,
		};
}
