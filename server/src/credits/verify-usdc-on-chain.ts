import { decodeFunctionData, formatUnits, parseAbi, type Hash } from "viem";
import { config } from "../config.js";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
import { getPublicClient } from "../lib/rpc-client.js";

export interface UsdcVerifyResult {
  valid: boolean;
  error?: string;
  txHash?: string;
  amount?: string;
}

const USDC_TRANSFER_ABI = parseAbi([
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
]);

const EVM_TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

/**
 * H-USDC-1: Verify a USDC deposit's on-chain transfer before crediting the
 * user. Rejects:
 *  - missing / failed / reverted receipts
 *  - non-USDC contract as `to`
 *  - calldata where recipient != TREASURY_BASE_ADDRESS
 *  - calldata where value < claimed amount
 *
 * The `to` field check is the critical one — without it, a user with any
 * valid SIWE wallet could submit any 64-hex txHash and receive credits,
 * because the prior code only verified an off-chain EIP-191 signature
 * (which proves wallet ownership, not that the USDC transfer happened).
 */
export async function verifyUsdcOnChain(
  txHash: string,
  claimedAmountUsd: number,
  expectedPayer?: string,
): Promise<UsdcVerifyResult> {
  if (!EVM_TX_HASH_RE.test(txHash)) {
    return { valid: false, error: "Invalid transaction hash format" };
  }
  if (!Number.isFinite(claimedAmountUsd) || claimedAmountUsd <= 0) {
    return { valid: false, error: "Invalid claimed amount" };
  }
  if (expectedPayer && !EVM_ADDRESS_RE.test(expectedPayer)) {
    return { valid: false, error: "Invalid expected payer address" };
  }

  const hash = txHash as Hash;
  const treasury = config.TREASURY_BASE_ADDRESS;
  if (!treasury) {
    return { valid: false, error: "Treasury address not configured" };
  }
  // After the guard above, treasury is string — but the inner function
  // `attempt` captures it in a closure, so TS doesn't narrow. Use the
  // definite assignment assertion since we've already handled the undefined case.
  const treasuryAddr = treasury;
  const expectedRawAmount = BigInt(Math.round(claimedAmountUsd * 10 ** USDC_DECIMALS));

  async function attempt(expectedPayer?: string): Promise<UsdcVerifyResult> {
    const client = getPublicClient();

    let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>> | null = null;
    try {
      receipt = await client.getTransactionReceipt({ hash });
    } catch (err) {
      return { valid: false, error: `Failed to fetch tx receipt: ${err instanceof Error ? err.message : String(err)}` };
    }
    if (!receipt) {
      return { valid: false, error: "Transaction receipt not found" };
    }
    if (receipt.status !== "success") {
      return { valid: false, error: "Transaction failed or reverted" };
    }

    const tx = await client.getTransaction({ hash });
    if (!tx) {
      return { valid: false, error: "Transaction data not found" };
    }

    if (tx.to?.toLowerCase() !== USDC_BASE.toLowerCase()) {
      return { valid: false, error: "Transaction not to USDC contract" };
    }

    // H-Deposit-2: bind the on-chain sender to the authenticated depositing
    // wallet so a third party cannot finalize a deposit credited to another
    // account.
    if (expectedPayer && (!tx.from || tx.from.toLowerCase() !== expectedPayer.toLowerCase())) {
      return { valid: false, error: "Deposit sender does not match the authenticated wallet" };
    }

    if (!tx.input || tx.input.length < 10) {
      return { valid: false, error: "Missing USDC transfer calldata" };
    }

    let decoded: ReturnType<typeof decodeFunctionData<typeof USDC_TRANSFER_ABI>> | null = null;
    try {
      decoded = decodeFunctionData({ abi: USDC_TRANSFER_ABI, data: tx.input as `0x${string}` });
    } catch (err) {
      return { valid: false, error: `Failed to decode USDC calldata: ${err instanceof Error ? err.message : String(err)}` };
    }

    if (decoded.functionName === "transfer") {
      const [recipient, rawAmount] = decoded.args as [string, bigint];
      if (recipient.toLowerCase() !== treasuryAddr.toLowerCase()) {
        return { valid: false, error: "Recipient mismatch: not treasury" };
      }
      if (rawAmount < expectedRawAmount) {
        return { valid: false, error: `Insufficient payment: sent ${formatUnits(rawAmount, USDC_DECIMALS)} USDC, expected at least ${claimedAmountUsd} USDC` };
      }
      return { valid: true, txHash: hash, amount: formatUnits(rawAmount, USDC_DECIMALS) };
    }

    if (decoded.functionName === "transferFrom") {
      const [payer, recipient, rawAmount] = decoded.args as [string, string, bigint];
      if (expectedPayer && payer.toLowerCase() !== expectedPayer.toLowerCase()) {
        return { valid: false, error: "Transfer payer does not match the authenticated wallet" };
      }
      if (recipient.toLowerCase() !== treasuryAddr.toLowerCase()) {
        return { valid: false, error: "Recipient mismatch: not treasury" };
      }
      if (rawAmount < expectedRawAmount) {
        return { valid: false, error: `Insufficient payment: sent ${formatUnits(rawAmount, USDC_DECIMALS)} USDC, expected at least ${claimedAmountUsd} USDC` };
      }
      return { valid: true, txHash: hash, amount: formatUnits(rawAmount, USDC_DECIMALS) };
    }

    return { valid: false, error: "Unrecognized USDC transfer method" };
  }

  // viem fallback transport (getPublicClient) handles RPC failover
  // automatically across QuickNode + free public endpoints.
  try {
    return await attempt(expectedPayer);
  } catch {
    return { valid: false, error: "On-chain verification failed (all RPC endpoints unavailable)" };
  }
}
