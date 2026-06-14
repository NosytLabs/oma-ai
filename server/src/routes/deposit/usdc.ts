import { Hono } from "hono";
import { z } from "zod";
import { processUsdcDeposit } from "../../credits/deposit.js";
import { sessionAuth } from "../../auth/middleware.js";
import { auditLog } from "../../middleware/audit.js";
import { db } from "../../db/client.js";
import { deposits } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import crypto from "crypto";
import { verifyMessage } from "viem";
import { logger } from "../../lib/logger.js";

const EVM_TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const EVM_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

function generateDepositNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

const depositNonceSchema = z.object({
  amount: z.number().positive().max(100000),
  walletAddress: z.string().regex(EVM_ADDRESS_RE, "Invalid EVM address format").optional(),
});

const verifyDepositSignatureSchema = z.object({
  amount: z.number().positive().max(100000),
  txHash: z.string().regex(EVM_TX_HASH_RE, "Invalid EVM transaction hash format"),
  signature: z.string().min(130, "Signature must be 130 hex chars (65 bytes r + s + v)"),
  nonce: z.string().min(1),
  walletAddress: z.string().regex(EVM_ADDRESS_RE, "Invalid EVM address format").optional(),
  chainId: z.number().int().positive().optional(),
});

const usdcDepositSchema = z.object({
  amount: z.number().positive().max(100000),
  txHash: z.string().regex(EVM_TX_HASH_RE, "Invalid EVM transaction hash format"),
  signature: z.string().min(130, "Signature must be 130 hex chars (65 bytes r + s + v)"),
  nonce: z.string().min(1),
  walletAddress: z.string().regex(EVM_ADDRESS_RE, "Invalid EVM address format").optional(),
  chainId: z.number().int().positive().optional(),
});

interface DepositNonceData {
  nonce: string;
  amount: number;
  userId: string;
  walletAddress?: string;
  expiresAt: number;
}

const depositNonces = new Map<string, DepositNonceData>();

const NONCE_CLEANUP_INTERVAL_MS = 60_000;

function cleanupExpiredNonces(): void {
  const now = Date.now();
  for (const [key, data] of depositNonces) {
    if (data.expiresAt < now) {
      depositNonces.delete(key);
    }
  }
}

setInterval(cleanupExpiredNonces, NONCE_CLEANUP_INTERVAL_MS).unref();

export const usdcRoutes = new Hono<OmaEnv>();

usdcRoutes.post("/v1/deposit/usdc/nonce", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = depositNonceSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request", type: "validation_error", details: parsed.error.flatten() } }, 400);
  }
  const { amount, walletAddress } = parsed.data;

  const nonce = generateDepositNonce();
  const expiresAt = Date.now() + 10 * 60 * 1000;
  
  depositNonces.set(`${userId}:${nonce}`, { nonce, amount, userId, walletAddress, expiresAt });

  return c.json({ nonce, expiresAt: new Date(expiresAt).toISOString() });
});

usdcRoutes.post("/v1/deposit/usdc/signature", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = verifyDepositSignatureSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: { message: "Invalid request", type: "validation_error", details: parsed.error.flatten() } }, 400);
  }
  const { amount, txHash, signature, nonce, walletAddress: providedWallet, chainId } = parsed.data;

  const nonceData = depositNonces.get(`${userId}:${nonce}`);
  if (!nonceData) {
    return c.json({ error: { message: "Invalid or expired deposit nonce", type: "authentication_error" } }, 401);
  }
  if (nonceData.userId !== userId) {
    return c.json({ error: { message: "Nonce ownership mismatch", type: "authentication_error" } }, 401);
  }
  if (nonceData.expiresAt < Date.now()) {
    depositNonces.delete(`${userId}:${nonce}`);
    return c.json({ error: { message: "Deposit nonce has expired. Please request a new one.", type: "authentication_error" } }, 401);
  }
  if (Math.abs(nonceData.amount - amount) > 0.01) {
    return c.json({ error: { message: "Amount mismatch. Please use the nonce for the exact deposit amount.", type: "validation_error" } }, 400);
  }

  const walletToVerify = providedWallet || nonceData.walletAddress;
  const chainIdToUse = chainId || 8453;

  if (walletToVerify) {
    const messageToSign = `Deposit ${amount} USDC to OMA\nTx: ${txHash}\nChain: ${chainIdToUse}\nNonce: ${nonce}\nWallet: ${walletToVerify}\n\nSigning this message confirms the deposit.`;
    
    try {
      const isValid = verifyMessage({
        address: walletToVerify as `0x${string}`,
        message: messageToSign,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return c.json({ error: { message: "Invalid signature. The signature does not match the expected format or signer.", type: "authentication_error" } }, 401);
      }
    } catch (verifyErr) {
      logger.error({ err: verifyErr }, "[deposit:usdc] Signature verification error:");
      return c.json({ error: { message: "Signature verification failed", type: "authentication_error" } }, 401);
    }
  }

  depositNonces.delete(`${userId}:${nonce}`);

  return c.json({ verified: true });
});

usdcRoutes.post("/v1/deposit/usdc", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = usdcDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: { message: "Invalid request", type: "validation_error", details: parsed.error.flatten() } }, 400);
  const { amount, txHash, signature, nonce, walletAddress: providedWallet, chainId } = parsed.data;

  const nonceData = depositNonces.get(`${userId}:${nonce}`);
  if (!nonceData) {
    return c.json({ error: { message: "Invalid or expired deposit nonce. Please request a new nonce before depositing.", type: "authentication_error" } }, 401);
  }
  if (nonceData.userId !== userId) {
    return c.json({ error: { message: "Nonce ownership mismatch", type: "authentication_error" } }, 401);
  }
  if (nonceData.expiresAt < Date.now()) {
    depositNonces.delete(`${userId}:${nonce}`);
    return c.json({ error: { message: "Deposit nonce has expired. Please request a new one.", type: "authentication_error" } }, 401);
  }
  if (Math.abs(nonceData.amount - amount) > 0.01) {
    return c.json({ error: { message: "Amount mismatch between nonce and deposit request.", type: "validation_error" } }, 400);
  }

  const walletToVerify = providedWallet || nonceData.walletAddress;
  const chainIdToUse = chainId || 8453;

  if (walletToVerify) {
    const messageToSign = `Deposit ${amount} USDC to OMA\nTx: ${txHash}\nChain: ${chainIdToUse}\nNonce: ${nonce}\nWallet: ${walletToVerify}\n\nSigning this message confirms the deposit.`;
    
    try {
      const isValid = verifyMessage({
        address: walletToVerify as `0x${string}`,
        message: messageToSign,
        signature: signature as `0x${string}`,
      });

      if (!isValid) {
        return c.json({ error: { message: "Invalid signature. The signature does not match the expected format or signer.", type: "authentication_error" } }, 401);
      }
    } catch (verifyErr) {
      logger.error({ err: verifyErr }, "[deposit:usdc] Signature verification error:");
      return c.json({ error: { message: "Signature verification failed", type: "authentication_error" } }, 401);
    }
  }

  depositNonces.delete(`${userId}:${nonce}`);

  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  if (existing.length > 0) return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);

  try {
    const result = await processUsdcDeposit(userId, amount, txHash);

    const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || undefined;
    const userAgent = c.req.header("user-agent") || undefined;

    await auditLog({
      userId,
      action: "DEPOSIT_CREATED",
      resource: "deposits",
      resourceId: result.depositId,
      metadata: { amount, txHash, method: "usdc_direct", walletAddress: walletToVerify },
      ipAddress,
      userAgent,
    });

    return c.json({ credits: result.creditsCents, depositId: result.depositId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err: message, amount, txHash }, "[deposit:usdc] Deposit failed:");
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});
