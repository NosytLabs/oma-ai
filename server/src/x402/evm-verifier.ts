import { createPublicClient, http, formatUnits, decodeFunctionData, parseAbi, type Hash } from "viem";
import { base } from "viem/chains";
import { config } from "../config.js";
import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
import type { PaymentPayload, PaymentResponse } from "./types.js";

const EVM_PUBLIC_RPC_FALLBACK = "https://base-rpc.publicnode.com";

export async function verifyEvmPayment(
  signature: string,
  authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  const txHash = signature.startsWith("0x")
    ? (signature as Hash)
    : (`0x${signature}` as Hash);

  async function attemptVerification(rpcUrl: string, fallbackRpcUrl: string | undefined): Promise<PaymentResponse> {
    const isFallback = rpcUrl !== config.CHAIN_RPC_URL;
    if (isFallback && fallbackRpcUrl) {
      console.warn(`[FACILITATOR] [WARN] EVM RPC fallback active: ${rpcUrl}`);
    }

    const client = createPublicClient({
      chain: base,
      transport: http(rpcUrl),
    });

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
          const amount = formatUnits(rawAmount, USDC_DECIMALS);
          const actualAmount = parseFloat(amount);
          const requiredAmount = parseFloat(payload.maxAmountRequired || payload.amount || "0");

          if (actualAmount < requiredAmount) {
            return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
          }

          if (recipient.toLowerCase() !== payeeLower) {
            return { valid: false, error: "Recipient mismatch" };
          }

          return {
            valid: true,
            txHash,
            amount,
            networkId: payload.networkId,
          };
        }

        if (decoded.functionName === "transferFrom") {
          const [, recipient, rawAmount] = decoded.args as [string, string, bigint];
          const amount = formatUnits(rawAmount, USDC_DECIMALS);
          const actualAmount = parseFloat(amount);
          const requiredAmount = parseFloat(payload.maxAmountRequired || payload.amount || "0");

          if (actualAmount < requiredAmount) {
            return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
          }

          if (recipient.toLowerCase() !== payeeLower) {
            return { valid: false, error: "Recipient mismatch" };
          }

          return {
            valid: true,
            txHash,
            amount,
            networkId: payload.networkId,
          };
        }
      } catch (decodeErr) {
        console.error(`[facilitator] Failed to decode USDC transfer data:`, decodeErr);
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

  try {
    return await attemptVerification(config.CHAIN_RPC_URL, config.CHAIN_RPC_URL_FALLBACK);
  } catch (primaryErr: unknown) {
    const isNetworkError = primaryErr instanceof Error && (
      primaryErr.message.includes("fetch") ||
      primaryErr.message.includes("ECONNREFUSED") ||
      primaryErr.message.includes("ETIMEDOUT") ||
      primaryErr.message.includes("network") ||
      primaryErr.message.includes("timeout") ||
      primaryErr.name === "TypeError"
    );

    console.error(`[facilitator] EVM verification error:`, primaryErr);
    if (!isNetworkError) {
      return { valid: false, error: `EVM verification failed` };
    }

    if (config.CHAIN_RPC_URL_FALLBACK) {
      try {
        return await attemptVerification(config.CHAIN_RPC_URL_FALLBACK, undefined);
      } catch {
        return { valid: false, error: `EVM verification failed` };
      }
    }

    try {
      return await attemptVerification(EVM_PUBLIC_RPC_FALLBACK, undefined);
    } catch {
      return { valid: false, error: `EVM verification failed` };
    }
  }
}