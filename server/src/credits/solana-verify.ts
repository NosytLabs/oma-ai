/**
 * Solana transaction verification helpers.
 * Deduplicates the RPC fetch + validation logic used by Jupiter deposit routes.
 */

import { db } from "../db/client.js";
import { deposits } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";

export class SolanaVerifyError extends Error {
  constructor(message: string, public status: number) {
    super(message);
    this.name = "SolanaVerifyError";
  }
}

/**
 * Fetch and validate a Solana transaction via RPC.
 * Returns the parsed transaction result or throws SolanaVerifyError.
 */
export async function fetchSolanaTx(signature: string): Promise<Record<string, unknown>> {
  const solRpcUrl = config.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
  const txResponse = await fetch(solRpcUrl, {
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
  });

  if (!txResponse.ok) {
    throw new SolanaVerifyError("Failed to verify Solana transaction", 502);
  }

  const txData = (await txResponse.json()) as { result: Record<string, unknown> | null; error?: { message: string } };
  if (txData.error || !txData.result) {
    throw new SolanaVerifyError("Transaction not found or invalid", 400);
  }

  const txResult = txData.result;
  const meta = txResult.meta as { err?: unknown } | undefined;
  if (meta?.err !== null && meta?.err !== undefined) {
    throw new SolanaVerifyError("Transaction had execution errors", 400);
  }

  return txResult;
}

/**
 * Check if a deposit with this txHash already exists.
 */
export async function checkDuplicateDeposit(txHash: string): Promise<boolean> {
  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  return existing.length > 0;
}

/**
 * Convert an amount to lamports if the input mint is SOL.
 */
export function toLamports(amount: number, inputMint: string, solMint: string): number {
  return inputMint === solMint ? Math.round(amount * 1e9) : amount;
}
