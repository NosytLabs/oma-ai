import { config } from "../config.js";
import type { PaymentPayload, PaymentResponse, SolanaInstruction, SolanaRpcResponse } from "./types.js";

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_PUBLIC_RPC_FALLBACK = "https://rpc.ankr.com/solana";

async function fetchWithFallback(
  url: string,
  fallbackUrl: string | undefined,
  fallbackDisplay: string,
  request: RequestInit,
): Promise<Response> {
  try {
    const response = await fetch(url, request);
    return response;
  } catch {
    if (!fallbackUrl) {
      console.warn(`[FACILITATOR] [WARN] Primary RPC failed (${url}), trying public fallback: ${fallbackDisplay}`);
      const fallbackResponse = await fetch(fallbackDisplay, request);
      return fallbackResponse;
    }
    console.warn(`[FACILITATOR] [WARN] Primary RPC failed (${url}), trying fallback: ${fallbackUrl}`);
    const fallbackResponse = await fetch(fallbackUrl, request);
    return fallbackResponse;
  }
}

export async function verifySolanaPayment(
  signature: string,
  _authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  async function attemptVerification(rpcUrl: string): Promise<PaymentResponse> {
    const response = await fetchWithFallback(
      rpcUrl,
      config.SOLANA_RPC_URL_FALLBACK,
      SOLANA_PUBLIC_RPC_FALLBACK,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getTransaction",
          params: [
            signature,
            { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
          ],
        }),
      },
    );

    if (!response.ok) {
      return { valid: false, error: "Solana RPC request failed" };
    }

    const json = (await response.json()) as SolanaRpcResponse;

    if (json.error) {
      console.error(`[facilitator] Solana RPC error:`, json.error);
      return { valid: false, error: `Solana RPC error` };
    }

    const tx = json.result;
    if (!tx || !tx.meta || tx.meta.err) {
      return { valid: false, error: "Transaction not found or failed on Solana" };
    }

    const instructions = tx.transaction?.message?.instructions ?? [];
    const allInstructions: SolanaInstruction[] = [...instructions];

    const innerIxs = (tx.meta as { innerInstructions?: Array<{ instructions: SolanaInstruction[] }> } | undefined)?.innerInstructions ?? [];
    for (const innerGroup of innerIxs) {
      if (innerGroup.instructions) {
        allInstructions.push(...innerGroup.instructions);
      }
    }

    let foundTransfer = false;
    let amount = "0";

    const requiredAmount = parseFloat(payload.maxAmountRequired || payload.amount || "0");

    for (const ix of allInstructions) {
      if (
        ix.parsed?.type === "transfer" &&
        ix.parsed?.info?.destination === payload.payee
      ) {
        const isUsdc = payload.asset === SOLANA_USDC || payload.asset.toLowerCase().includes("usdc");
        const divisor = isUsdc ? 1e6 : 1e9;
        const rawAmt = Number(ix.parsed.info.lamports || ix.parsed.info.amount || 0);
        amount = (rawAmt / divisor).toString();
        const actualAmount = parseFloat(amount);

        if (actualAmount < requiredAmount) {
          return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
        }

        foundTransfer = true;
        break;
      }
      if (
        ix.parsed?.type === "transferChecked" &&
        ix.parsed?.info?.destination === payload.payee
      ) {
        const rawAmount = Number(ix.parsed.info.tokenAmount?.amount || ix.parsed.info.amount || 0);
        const decimals = ix.parsed.info.tokenAmount?.decimals ?? 6;
        amount = (rawAmount / Math.pow(10, decimals)).toString();
        const actualAmount = parseFloat(amount);

        if (actualAmount < requiredAmount) {
          return { valid: false, error: `Insufficient payment: ${actualAmount} < ${requiredAmount}` };
        }

        foundTransfer = true;
        break;
      }
    }

    if (!foundTransfer) {
      return { valid: false, error: "No matching USDC transfer to payee found" };
    }

    return {
      valid: true,
      txHash: signature,
      amount,
      networkId: payload.networkId,
    };
  }

  try {
    return await attemptVerification(config.SOLANA_RPC_URL);
  } catch (err: unknown) {
    console.error(`[facilitator] Solana verification failed:`, err);
    return { valid: false, error: `Solana verification failed` };
  }
}