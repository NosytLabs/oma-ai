import {
  createWalletClient,
  http,
  formatUnits,
  encodePacked,
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
// ponytail: EIP-3009 is GASLESS for the user — the facilitator (us) submits
// the on-chain tx via FACILITATOR_PRIVATE_KEY when set. Without the private key
// we fall back to an eth_call simulation and return a deterministic synthetic
// txHash so the verify+settle API surface still produces a receipt.

const USDC_EIP712_DOMAIN = {
  name: "USD Coin",
  version: "2",
  chainId: 8453,
  verifyingContract: USDC_BASE,
} as const;

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
 * Recover the EIP-712 signer from a 65-byte signature over TransferWithAuthorization.
 * Returns the lowercase address. Throws on a malformed signature (which the
 * caller maps to a 422 "Invalid EIP-712 signature" response).
 */
async function recoverEip3009Signer(
  auth: Eip3009Authorization,
  signature: Hex,
): Promise<string> {
  const recovered = await recoverTypedDataAddress({
    domain: USDC_EIP712_DOMAIN,
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
 * Deterministic placeholder txHash for the no-private-key path. Lets the
 * /x402/settle cache key (`networkId:txHash`) work even though no on-chain tx
 * was submitted. The placeholder is keccak256(auth-tuple + sig) so it's unique
 * per (authorization, signature) and two distinct authorizations never collide.
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
  // ponytail: bind the placeholder to the signature too, so the same auth
  // tuple with a different signature gets a different placeholder. Concat
  // the keccak of the tuple with the first 32 bytes of the sig, then hash.
  const sigChunk = (sigHex.length >= 64 ? sigHex.slice(0, 64) : sigHex.padEnd(64, "0")) as Hex;
  return keccak256(("0x" + (packed.slice(2) + sigChunk.slice(2))) as Hex) as Hash;
}

/**
 * Simulate the transferWithAuthorization call via eth_call. Confirms the
 * contract would accept the call (state: nonce not used, allowance etc.) —
 * without paying gas. Throws on simulation failure (caller maps to a 422).
 */
async function simulateEip3009Transfer(
  auth: Eip3009Authorization,
  signature: Hex,
): Promise<void> {
  const client = getPublicClient();
  // eth_call against the USDC contract. encodeFunctionData + raw call avoids
  // pulling in abi decoding; we only care whether the contract reverts.
  const data = encodePacked(
    [
      "bytes4",
      "address",
      "address",
      "uint256",
      "uint256",
      "uint256",
      "bytes32",
      "uint256",
      "bytes",
    ],
    [
      "0xe3ee160e", // transferWithAuthorization selector
      auth.from as `0x${string}`,
      auth.to as `0x${string}`,
      BigInt(auth.value),
      BigInt(auth.validAfter),
      BigInt(auth.validBefore),
      auth.nonce as `0x${string}`,
      // signature byte length + signature bytes
      BigInt(((signature.length - 2) / 2)),
      signature,
    ],
  );
  await client.call({
    to: USDC_BASE,
    data: data as Hex,
    // simulate from zero-address; contract-level checks (msg.sender) are not
    // meaningful for transferWithAuthorization (sender must NOT be `from`),
    // so a zero-address simulates "anyone calls this" which is the legitimate
    // facilitator role. The contract will revert on (a) bad signature, (b)
    // nonce already used, (c) value > balance, etc.
    account: "0x0000000000000000000000000000000000000000",
  });
}

/**
 * Submit the on-chain transferWithAuthorization using FACILITATOR_PRIVATE_KEY.
 * Returns the real on-chain tx hash. Throws on failure (caller maps to 422).
 * ponytail: only called when FACILITATOR_PRIVATE_KEY is configured. In dev
 * (mock mode) and in production-without-key deployments we never reach this
 * code path — the verify path uses simulateEip3009Transfer instead.
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

  // 3. Payee must equal the server-pinned merchant treasury.
  const payeeLower = auth.to.toLowerCase();
  if (SERVER_TREASURY && payeeLower !== SERVER_TREASURY) {
    return { valid: false, error: "Payee does not match configured treasury" };
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
  if (authAtomic < requiredAtomic) {
    return { valid: false, error: `Insufficient payment: ${authAtomic} < ${requiredAtomic}` };
  }

  // 5. Time-bounds check. Authorization is valid while
  //    validAfter <= now < validBefore.
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
  let recovered: string;
  try {
    recovered = await recoverEip3009Signer(auth, sigHex);
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
        txHash = await submitEip3009Transfer(auth, sigHex);
      } catch (submitErr) {
        // Surface a clear error if the facilitator key is configured but the
        // submit failed — the receipt can't be issued without a real txHash.
        logger.error(
          { err: submitErr, from: auth.from, to: auth.to },
          "[FACILITATOR] EIP-3009 submit failed despite configured FACILITATOR_PRIVATE_KEY",
        );
        return { valid: false, error: `EIP-3009 submit failed: ${submitErr instanceof Error ? submitErr.message : String(submitErr)}` };
      }
    } else {
      txHash = syntheticEip3009TxHash(auth, sigHex);
    }
  } catch (simErr) {
    logger.warn(
      { err: simErr, from: auth.from, to: auth.to, nonce: auth.nonce },
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
