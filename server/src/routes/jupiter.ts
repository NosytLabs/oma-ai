/**
 * Jupiter Solana Deposit Route
 * Handles SOL/SPL token deposits via Jupiter swap to USDC
 */

import { Hono } from "hono";
import { z } from "zod";
import { addCredits } from "../credits/index.js";
import { db } from "../db/client.js";
import { deposits } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { config } from "../config.js";
import { validationError } from "../lib/validation.js";
import { sessionAuth } from "../auth/middleware.js";
import type { OmaEnv } from "../types.js";

// Jupiter constants
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8DM4GMX5HEsPsS1";
export const REFERRAL_FEE = 0.001;

interface JupiterQuote {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  priceImpactPct: number;
  slippageBps: number;
  routePlan: unknown[];
}

interface JupiterToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

interface JupiterSwapResult {
  quote: JupiterQuote;
  swapTransaction: string;
  lastValidBlockHeight: number;
}

class JupiterClient {
  private baseUrl = "https://quote-api.jup.ag/v6";

  async getQuote(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    referralFee?: number;
  }): Promise<JupiterQuote> {
    const url = new URL(`${this.baseUrl}/quote`);
    url.searchParams.set("inputMint", params.inputMint);
    url.searchParams.set("outputMint", params.outputMint);
    url.searchParams.set("amount", String(params.amount));
    if (params.slippageBps) url.searchParams.set("slippageBps", String(params.slippageBps));
    if (params.referralFee) url.searchParams.set("referralFee", String(params.referralFee));
    url.searchParams.set("onlyDirectRoutes", "true");
    url.searchParams.set("maxAccounts", "10");

    const res = await fetch(url.toString());
    if (!res.ok) throw new Error(`Jupiter quote failed: ${res.statusText}`);
    return res.json() as Promise<JupiterQuote>;
  }

  async getSwapTx(inputMint: string, outputMint: string, amount: number, userPublicKey: string): Promise<JupiterSwapResult> {
    const res = await fetch(`${this.baseUrl}/swap`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse: await this.getQuote({ inputMint, outputMint, amount }),
        userPublicKey,
        wrapAndUnwrapSol: true,
      }),
    });
    if (!res.ok) throw new Error(`Jupiter swap tx failed: ${res.statusText}`);
    return res.json() as Promise<JupiterSwapResult>;
  }

  async getTokens(): Promise<JupiterToken[]> {
    const res = await fetch(`${this.baseUrl}/tokens`);
    if (!res.ok) throw new Error(`Jupiter tokens failed: ${res.statusText}`);
    const tokens = (await res.json()) as Record<string, JupiterToken>;
    return Object.values(tokens);
  }
}

export const jupiterClient = new JupiterClient();
export const getQuote = (params: Parameters<JupiterClient["getQuote"]>[0]) => jupiterClient.getQuote(params);

export const jupiterRoutes = new Hono<OmaEnv>();

const jupiterQuoteSchema = z.object({
  inputMint: z.string().min(1),
  outputMint: z.string().min(1),
  amount: z.number().positive(), // in SOL (not lamports)
  slippageBps: z.number().optional().default(50),
});

const jupiterSwapSchema = z.object({
  inputMint: z.string().min(1),
  outputMint: z.string().min(1),
  amount: z.number().positive(),
  userPublicKey: z.string().min(1),
  txSignature: z.string().min(1),
  slippageBps: z.number().optional().default(50),
});

const solanaDirectDepositSchema = z.object({
  amount: z.number().positive(),
  signature: z.string().min(1),
});

/**
 * POST /v1/deposit/jupiter/quote
 * Get a quote for Jupiter swap
 */
jupiterRoutes.post("/v1/deposit/jupiter/quote", sessionAuth, async (c) => {
  const parsed = jupiterQuoteSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { inputMint, outputMint, amount, slippageBps } = parsed.data;

  // Convert SOL amount to lamports if SOL mint
  let amountLamports = amount;
  if (inputMint === SOL_MINT) {
    amountLamports = Math.round(amount * 1e9);
  }

  try {
    const quote = await getQuote({
      inputMint,
      outputMint,
      amount: amountLamports,
      slippageBps,
      referralFee: REFERRAL_FEE,
    });

    return c.json({
      inputMint: quote.inputMint,
      inAmount: quote.inAmount,
      outputMint: quote.outputMint,
      outAmount: quote.outAmount,
      otherAmountThreshold: quote.otherAmountThreshold,
      swapMode: quote.swapMode,
      priceImpactPct: quote.priceImpactPct,
      slippageBps: quote.slippageBps,
      routePlan: quote.routePlan,
      estimatedUsd: parseFloat(quote.outAmount) / 1e6, // USDC has 6 decimals
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Quote failed: ${message}`, type: "quote_error" } }, 502);
  }
});

/**
 * POST /v1/deposit/jupiter/swap-tx
 * Get swap transaction for Jupiter swap
 */
jupiterRoutes.post("/v1/deposit/jupiter/swap-tx", sessionAuth, async (c) => {
  const parsed = jupiterQuoteSchema.extend({ userPublicKey: z.string().min(1) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { inputMint, outputMint, amount, userPublicKey } = parsed.data;

  // Convert SOL amount to lamports if SOL mint
  let amountLamports = amount;
  if (inputMint === SOL_MINT) {
    amountLamports = Math.round(amount * 1e9);
  }

  try {
    const result = await jupiterClient.getSwapTx(inputMint, outputMint, amountLamports, userPublicKey);

    return c.json({
      quote: result.quote,
      swapTransaction: result.swapTransaction,
      lastValidBlockHeight: result.lastValidBlockHeight,
      // Return the input amount in human-readable form
      inputAmount: amount,
      estimatedOutput: parseFloat(result.quote.outAmount) / 1e6,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to get swap transaction: ${message}`, type: "swap_error" } }, 502);
  }
});

/**
 * POST /v1/deposit/jupiter/complete
 * Mark a Jupiter swap as completed and credit user
 * Called after user confirms the swap transaction on their end
 */
jupiterRoutes.post("/v1/deposit/jupiter/complete", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = jupiterSwapSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { inputMint, outputMint, amount, txSignature } = parsed.data;

  // Check for duplicate
  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txSignature)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);
  }

  // Verify transaction on Solana RPC
  try {
    const solRpcUrl = config.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    const txResponse = await fetch(solRpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [
          txSignature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ],
      }),
    });

    if (!txResponse.ok) {
      return c.json({ error: { message: "Failed to verify Solana transaction", type: "verification_error" } }, 502);
    }

    const txData = (await txResponse.json()) as { result: Record<string, unknown> | null; error?: { message: string } };
    if (txData.error || !txData.result) {
      return c.json({ error: { message: "Transaction not found or invalid", type: "verification_error" } }, 400);
    }

    // Verify transaction had no execution errors
    const txResult = txData.result as Record<string, unknown>;
    const meta = txResult.meta as { err?: unknown } | undefined;
    if (meta?.err !== null && meta?.err !== undefined) {
      return c.json({ error: { message: "Transaction had execution errors", type: "verification_error" } }, 400);
    }

    // Parse transaction to find the swap output
    const instructions = (txResult?.transaction as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
    const ixList = (instructions?.instructions ?? []) as Array<Record<string, unknown>>;

    // Find USDC transfer to treasury
    let usdcAmount = 0;
    const treasuryAddress = config.TREASURY_SOLANA_ADDRESS;

    for (const ix of ixList) {
      const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> } | undefined;
      if (parsed?.type === "transfer" && parsed?.info) {
        const info = parsed.info;
        // Check if this is a USDC transfer to our treasury
        if (info.destination === treasuryAddress && info.mint === USDC_MINT) {
          usdcAmount = Number(info.amount) / 1e6; // USDC has 6 decimals
        }
      }
    }

        // If we couldn't find USDC transfer, use estimate based on Jupiter quote
        if (usdcAmount === 0) {
          let amountLamports = amount;
          if (inputMint === SOL_MINT) {
            amountLamports = Math.round(amount * 1e9);
          }
          try {
            const quote = await getQuote({
              inputMint,
              outputMint,
              amount: amountLamports,
              slippageBps: 50,
            });
            usdcAmount = parseFloat(quote.outAmount) / 1e6;
          } catch {
            return c.json({ error: { message: "Could not verify deposit amount on-chain or via quote. Please retry.", type: "verification_error" } }, 400);
          }
    }

    // Create deposit record
    const creditsCents = Math.round(usdcAmount * 100);
    const [deposit] = await db.insert(deposits).values({
      userId,
      type: "jupiter_swap",
      status: "completed",
      amountUsd: String(usdcAmount),
      creditsIssued: String(usdcAmount),
      txHash: txSignature,
    }).returning();

    // Add credits to user
    await addCredits(userId, creditsCents);

    return c.json({
      credits: creditsCents,
      depositId: deposit.id,
      usdcAmount,
      inputAmount: amount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Deposit completion failed: ${message}`, type: "deposit_error" } }, 500);
  }
});

/**
 * POST /v1/deposit/jupiter/direct-sol
 * Direct SOL deposit (not via swap, just send SOL to treasury and we credit based on amount)
 */
jupiterRoutes.post("/v1/deposit/jupiter/direct-sol", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = solanaDirectDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);

  const { amount, signature } = parsed.data;
  const treasuryAddress = config.TREASURY_SOLANA_ADDRESS;

  if (!treasuryAddress) {
    return c.json({ error: { message: "Solana deposits not configured", type: "config_error" } }, 503);
  }

  // Check for duplicate
  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, signature)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);
  }

  try {
    // Verify transaction on Solana RPC
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
      return c.json({ error: { message: "Failed to verify Solana transaction", type: "verification_error" } }, 502);
    }

    const txData = (await txResponse.json()) as { result: Record<string, unknown> | null; error?: { message: string } };
    if (txData.error || !txData.result) {
      return c.json({ error: { message: "Transaction not found or invalid", type: "verification_error" } }, 400);
    }

    // Verify transaction had no execution errors
    const txResult = txData.result as Record<string, unknown>;
    const meta = txResult.meta as { err?: unknown } | undefined;
    if (meta?.err !== null && meta?.err !== undefined) {
      return c.json({ error: { message: "Transaction had execution errors", type: "verification_error" } }, 400);
    }

    // Extract fee-payer from transaction message accountKeys[0]
    const txMessage = (txResult?.transaction as Record<string, unknown> | undefined)?.message as Record<string, unknown> | undefined;
    const accountKeysList = (txMessage?.accountKeys ?? []) as Array<{ pubkey?: string; signer?: boolean }>;
    const feePayer = accountKeysList[0]?.pubkey;
    if (!feePayer) {
      return c.json({ error: { message: "Could not determine transaction fee payer", type: "verification_error" } }, 400);
    }
    if (feePayer === treasuryAddress) {
      return c.json({ error: { message: "Transaction fee payer cannot be treasury address", type: "verification_error" } }, 400);
    }

    // Parse transaction to find SOL transfer to treasury
    const ixList = (txMessage?.instructions ?? []) as Array<Record<string, unknown>>;

    let verified = false;
    let transferAmount = 0;

    for (const ix of ixList) {
      const parsed = ix.parsed as { type?: string; info?: Record<string, unknown> } | undefined;
      if (parsed?.type === "transfer" && parsed?.info) {
        const info = parsed.info;
        // SOL transfer - lamports
        if (info.destination === treasuryAddress && !info.mint) {
          verified = true;
          transferAmount = Number(info.lamports) / 1e9; // Convert lamports to SOL
        }
      }
    }

    if (!verified) {
      return c.json({ error: { message: "Transfer to treasury not found in transaction", type: "verification_error" } }, 400);
    }

    // Check amount matches (within 0.01 SOL tolerance)
    if (Math.abs(transferAmount - amount) > 0.01) {
      return c.json({
        error: { message: `Amount mismatch: claimed ${amount} vs on-chain ${transferAmount}`, type: "verification_error" },
      }, 400);
    }

    // Create deposit record
    const creditsCents = Math.round(transferAmount * 100);
    const [deposit] = await db.insert(deposits).values({
      userId,
      type: "solana_direct",
      status: "completed",
      amountUsd: String(transferAmount),
      creditsIssued: String(transferAmount),
      txHash: signature,
    }).returning();

    // Add credits to user
    await addCredits(userId, creditsCents);

    return c.json({
      credits: creditsCents,
      depositId: deposit.id,
      solAmount: transferAmount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Deposit failed: ${message}`, type: "deposit_error" } }, 500);
  }
});

/**
 * GET /v1/deposit/jupiter/tokens
 * Get supported tokens for Jupiter swaps
 */
jupiterRoutes.get("/v1/deposit/jupiter/tokens", async (c) => {
  try {
    const tokens = await jupiterClient.getTokens();

    // Filter and return commonly used tokens with their info
    const supportedTokens = tokens.filter(t =>
      t.symbol === "SOL" ||
      t.symbol === "USDC" ||
      t.symbol === "USDT" ||
      t.symbol === "BONK" ||
      t.symbol === "WIF" ||
      t.symbol === "JITO" ||
      t.symbol === "PYTH"
    );

    return c.json({
      tokens: supportedTokens.map(t => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI: t.logoURI,
      })),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Failed to fetch tokens: ${message}`, type: "external_error" } }, 502);
  }
});

/**
 * GET /v1/deposit/jupiter/price
 * Get current SOL to USDC price
 */
jupiterRoutes.get("/v1/deposit/jupiter/price", async (c) => {
  try {
    const quote = await getQuote({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      amount: 1e9, // 1 SOL in lamports
      slippageBps: 1,
    });

    const solToUsdc = parseFloat(quote.outAmount) / 1e6;

    return c.json({
      inputMint: SOL_MINT,
      outputMint: USDC_MINT,
      price: solToUsdc,
      inputAmount: "1", // 1 SOL
      outputAmount: quote.outAmount,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message: `Price lookup failed: ${message}`, type: "price_error" } }, 502);
  }
});