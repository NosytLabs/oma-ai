import { createPublicClient, http, decodeFunctionData, formatUnits, parseAbi, type Hash } from "viem";
import { base } from "viem/chains";
import { config } from "../config.js";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";

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
): Promise<UsdcVerifyResult> {
  const hash = (txHash.startsWith("0x") ? txHash : `0x${txHash}`) as Hash;
  const treasury = config.TREASURY_BASE_ADDRESS;
  const expectedRawAmount = BigInt(Math.round(claimedAmountUsd)) * 1_000_000n;

  async function attempt(rpcUrl: string): Promise<UsdcVerifyResult> {
    const client = createPublicClient({ chain: base, transport: http(rpcUrl) });

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
      if (recipient.toLowerCase() !== treasury.toLowerCase()) {
        return { valid: false, error: "Recipient mismatch: not treasury" };
      }
      if (rawAmount < expectedRawAmount) {
        return { valid: false, error: `Insufficient payment: sent ${formatUnits(rawAmount, USDC_DECIMALS)} USDC, expected at least ${claimedAmountUsd} USDC` };
      }
      return { valid: true, txHash: hash, amount: formatUnits(rawAmount, USDC_DECIMALS) };
    }

    if (decoded.functionName === "transferFrom") {
      const [, recipient, rawAmount] = decoded.args as [string, string, bigint];
      if (recipient.toLowerCase() !== treasury.toLowerCase()) {
        return { valid: false, error: "Recipient mismatch: not treasury" };
      }
      if (rawAmount < expectedRawAmount) {
        return { valid: false, error: `Insufficient payment: sent ${formatUnits(rawAmount, USDC_DECIMALS)} USDC, expected at least ${claimedAmountUsd} USDC` };
      }
      return { valid: true, txHash: hash, amount: formatUnits(rawAmount, USDC_DECIMALS) };
    }

    return { valid: false, error: "Unrecognized USDC transfer method" };
  }

  try {
    return await attempt(config.CHAIN_RPC_URL);
  } catch (primaryErr: unknown) {
    const isNetworkError = primaryErr instanceof Error && (
      primaryErr.message.includes("fetch") ||
      primaryErr.message.includes("ECONNREFUSED") ||
      primaryErr.message.includes("ETIMEDOUT") ||
      primaryErr.message.includes("network") ||
      primaryErr.message.includes("timeout") ||
      primaryErr.name === "TypeError"
    );
    if (!isNetworkError) {
      return { valid: false, error: "On-chain verification failed" };
    }
    if (config.CHAIN_RPC_URL_FALLBACK) {
      try {
        return await attempt(config.CHAIN_RPC_URL_FALLBACK);
      } catch {
        return { valid: false, error: "On-chain verification failed (fallback RPC also failed)" };
      }
    }
    return { valid: false, error: "On-chain verification failed (primary RPC unavailable)" };
  }
}
