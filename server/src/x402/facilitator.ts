import { Hono } from "hono";
import type { Context, Next, MiddlewareHandler } from "hono";
import { createPublicClient, http, formatUnits, decodeFunctionData, parseAbi, type Hash } from "viem";
import { base } from "viem/chains";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { config } from "../config.js";
import type { OmaEnv } from "../types.js";
import { sessionAuth } from "../auth/middleware.js";

// ============================================================
// Types
// ============================================================

export type X402Version = "1" | "2";

interface SolanaInstruction {
  parsed?: {
    type: string;
    info: {
      destination?: string;
      lamports?: string;
      amount?: string;
      mint?: string;
      tokenAmount?: { amount?: string; decimals?: number };
    };
  };
}

interface SolanaRpcResponse {
  result?: {
    meta?: { err?: unknown };
    transaction?: {
      message?: {
        instructions?: SolanaInstruction[];
      };
    };
  };
  error?: { message?: string; code?: number };
}

export interface PaymentPayload {
  x402Version: X402Version;
  scheme: "evm" | "solana";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  payFrom: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
}

export interface PaymentSignature {
  x402Version: X402Version;
  signature: string;
  authorization: string;
  payload: PaymentPayload;
}

export interface PaymentRequired {
  x402Version: X402Version;
  scheme: "evm" | "solana";
  networkId: string;
  asset: string;
  amount: string;
  payee: string;
  maxAmountRequired: string;
  validBefore: number;
  validAfter: number;
  description?: string;
}

export interface PaymentResponse {
  valid: boolean;
  txHash?: string;
  amount?: string;
  networkId?: string;
  error?: string;
}

export interface SettlementRecord {
  txHash: string;
  amount: string;
  networkId: string;
  payee: string;
  settledAt: number;
  receipt: string;
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
  scheme?: "evm" | "solana";
}

// ============================================================
// Settlement Cache
// ============================================================

const settlementCache = new Map<string, SettlementRecord>();
const CACHE_TTL_MS = 86_400_000;

function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, record] of settlementCache) {
    if (now - record.settledAt > CACHE_TTL_MS) {
      settlementCache.delete(key);
    }
  }
}

setInterval(cleanExpiredCache, 300_000).unref();

// ============================================================
// Signing Utilities
// ============================================================

function signReceipt(data: string): string {
  const secret = config.RECEIPT_HMAC_SECRET || config.JWT_SECRET;
  const hmac = createHmac("sha256", secret);
  hmac.update(data);
  return hmac.digest("hex");
}

function verifyReceipt(data: string, receipt: string): boolean {
  const expected = signReceipt(data);
  const a = Buffer.from(receipt, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(Math.max(a.length, b.length), 0);
    timingSafeEqual(dummy, dummy);
    return false;
  }
  return timingSafeEqual(a, b);
}

// ============================================================
// EVM Verification (Base)
// ============================================================

import { USDC_BASE, USDC_DECIMALS } from "../constants.js";

function getEvmClient() {
  return createPublicClient({
    chain: base,
    transport: http(config.CHAIN_RPC_URL),
  });
}

async function verifyEvmPayment(
  signature: string,
  authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  try {
    const client = getEvmClient();

    const txHash = signature.startsWith("0x")
      ? (signature as Hash)
      : (`0x${signature}` as Hash);

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
        return { valid: false, error: `Failed to decode USDC transfer data: ${decodeErr instanceof Error ? decodeErr.message : String(decodeErr)}` };
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
  } catch (err: unknown) {
    return { valid: false, error: `EVM verification failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================================
// Solana Verification (Simplified)
// ============================================================

const SOLANA_USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

async function verifySolanaPayment(
  signature: string,
  _authorization: string,
  payload: PaymentPayload,
): Promise<PaymentResponse> {
  try {
    const rpcUrl = config.CHAIN_RPC_URL;
    const response = await fetch(rpcUrl, {
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

    if (!response.ok) {
      return { valid: false, error: "Solana RPC request failed" };
    }

    const json = (await response.json()) as SolanaRpcResponse;

    if (json.error) {
      return { valid: false, error: `Solana RPC error: ${json.error.message}` };
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

    for (const ix of allInstructions) {
      if (
        ix.parsed?.type === "transfer" &&
        ix.parsed?.info?.destination === payload.payee
      ) {
        foundTransfer = true;
        const isUsdc = payload.asset === SOLANA_USDC || payload.asset.toLowerCase().includes("usdc");
        const divisor = isUsdc ? 1e6 : 1e9;
        const rawAmt = Number(ix.parsed.info.lamports || ix.parsed.info.amount || 0);
        amount = (rawAmt / divisor).toString();
        break;
      }
      if (
        ix.parsed?.type === "transferChecked" &&
        ix.parsed?.info?.destination === payload.payee
      ) {
        foundTransfer = true;
        const rawAmount = Number(ix.parsed.info.tokenAmount?.amount || ix.parsed.info.amount || 0);
        const decimals = ix.parsed.info.tokenAmount?.decimals ?? 6;
        amount = (rawAmount / Math.pow(10, decimals)).toString();
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
  } catch (err: unknown) {
    return { valid: false, error: `Solana verification failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

// ============================================================
// Mock Verification (DEVELOPMENT ONLY)
// ============================================================
// WARNING: Mock mode accepts ANY payment as valid without on-chain
// verification. This is safe ONLY because config.ts throws a fatal
// error if FACILITATOR_MODE=mock is used in production or staging.
// See: config.ts line ~41-43

function mockVerifyPayment(
  signature: string,
  payload: PaymentPayload,
): PaymentResponse {
  console.warn(
    `[FACILITATOR] [WARN] Mock-mode verification accepted -- signature=${signature.slice(0, 16)}... scheme=${payload.scheme} amount=${payload.amount}`,
  );

  const mockTxHash =
    payload.scheme === "evm"
      ? `0x${randomBytes(32).toString("hex")}`
      : signature || randomBytes(64).toString("base64url");

  return {
    valid: true,
    txHash: mockTxHash,
    amount: payload.amount,
    networkId: payload.networkId,
  };
}

// ============================================================
// Core: verifyPayment
// ============================================================

export async function verifyPayment(
  paymentSig: PaymentSignature,
): Promise<PaymentResponse> {
  const { signature, authorization, payload } = paymentSig;
  const cacheKey = `${payload.scheme}:${signature}`;

  const cached = settlementCache.get(cacheKey);
  if (cached) {
    return {
      valid: true,
      txHash: cached.txHash,
      amount: cached.amount,
      networkId: cached.networkId,
    };
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.validBefore && now > payload.validBefore) {
    return { valid: false, error: "Payment authorization expired" };
  }
  if (payload.validAfter && now < payload.validAfter) {
    return { valid: false, error: "Payment authorization not yet valid" };
  }

  const mode = config.FACILITATOR_MODE ?? "mock";

  if (mode === "mock") {
    console.warn("[FACILITATOR] [WARN] Processing payment in mock mode -- signatures are NOT verified on-chain");
    return mockVerifyPayment(signature, payload);
  }

  if (payload.scheme === "evm") {
    return verifyEvmPayment(signature, authorization, payload);
  }

  if (payload.scheme === "solana") {
    return verifySolanaPayment(signature, authorization, payload);
  }

  return { valid: false, error: `Unsupported scheme: ${payload.scheme}` };
}

// ============================================================
// Core: settlePayment
// ============================================================

export function settlePayment(
  txHash: string,
  amount: string,
  networkId: string,
  payee: string,
): SettlementResponse {
  const cacheKey = `${networkId}:${txHash}`;

  const existing = settlementCache.get(cacheKey);
  if (existing) {
    return { settled: true, receipt: existing.receipt };
  }

  const settledAt = Date.now();
  const receiptPayload = `${txHash}:${amount}:${networkId}:${payee}:${settledAt}`;
  const receipt = signReceipt(receiptPayload);

  const record: SettlementRecord = {
    txHash,
    amount,
    networkId,
    payee,
    settledAt,
    receipt,
  };

  settlementCache.set(cacheKey, record);

  return { settled: true, receipt };
}

export function isSettled(txHash: string, networkId: string): boolean {
  const cacheKey = `${networkId}:${txHash}`;
  return settlementCache.has(cacheKey);
}

export function getSettlementReceipt(txHash: string, networkId: string): string | null {
  const record = settlementCache.get(`${networkId}:${txHash}`);
  return record?.receipt ?? null;
}

export function verifySettlementReceipt(
  txHash: string,
  amount: string,
  networkId: string,
  payee: string,
  settledAt: number,
  receipt: string,
): boolean {
  const payload = `${txHash}:${amount}:${networkId}:${payee}:${settledAt}`;
  return verifyReceipt(payload, receipt);
}

// ============================================================
// Hono Routes
// ============================================================

export const x402Routes = new Hono<OmaEnv>();

x402Routes.post("/x402/verify", async (c) => {
  const headerVal = c.req.header("PAYMENT-SIGNATURE");
  if (!headerVal) {
    return c.json(
      { error: { message: "Missing PAYMENT-SIGNATURE header", type: "payment_error" } },
      400,
    );
  }

  let paymentSig: PaymentSignature;
  try {
    paymentSig = JSON.parse(headerVal) as PaymentSignature;
  } catch {
    return c.json(
      { error: { message: "Invalid PAYMENT-SIGNATURE: must be valid JSON", type: "payment_error" } },
      400,
    );
  }

  if (!paymentSig.signature || !paymentSig.payload) {
    return c.json(
      { error: { message: "PAYMENT-SIGNATURE must include signature and payload", type: "payment_error" } },
      400,
    );
  }

  if (!paymentSig.payload.scheme || !paymentSig.payload.amount || !paymentSig.payload.networkId) {
    return c.json(
      { error: { message: "Payload must include scheme, amount, and networkId", type: "payment_error" } },
      400,
    );
  }

  const result = await verifyPayment(paymentSig);
  return c.json(result, result.valid ? 200 : 422);
});

x402Routes.post("/x402/settle", sessionAuth, async (c) => {
  const userId = c.get("userId");
  if (!userId) {
    return c.json({ error: { message: "Unauthorized", type: "authentication_error" } }, 401);
  }

  const body = await c.req.json<{ txHash?: string; amount?: string; networkId?: string; payee?: string }>();

  if (!body.txHash || !body.amount || !body.networkId || !body.payee) {
    return c.json(
      { error: { message: "txHash, amount, networkId, and payee are required", type: "payment_error" } },
      400,
    );
  }

  if (!/^0x[a-fA-F0-9]{64}$/.test(body.txHash)) {
    return c.json({ error: { message: "Invalid txHash format", type: "validation_error" } }, 400);
  }

  const result = settlePayment(body.txHash, body.amount, body.networkId, body.payee);
  return c.json(result, result.settled ? 200 : 422);
});

// ============================================================
// Payment Middleware
// ============================================================

export function paymentMiddleware(
  middlewareConfig: PaymentMiddlewareConfig,
): MiddlewareHandler<OmaEnv> {
  const {
    pricing,
    payeeAddress,
    asset = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    networkId = "base",
    scheme = "evm",
  } = middlewareConfig;

  return async (c: Context<OmaEnv>, next: Next) => {
    const path = new URL(c.req.url).pathname;
    const price = pricing[path];

    if (price === undefined) {
      await next();
      return;
    }

    const paymentHeader = c.req.header("PAYMENT-SIGNATURE");

    if (!paymentHeader) {
      const now = Math.floor(Date.now() / 1000);
      const paymentRequired: PaymentRequired = {
        x402Version: "1",
        scheme,
        networkId,
        asset,
        amount: price,
        payee: payeeAddress,
        maxAmountRequired: price,
        validBefore: now + 3600,
        validAfter: now,
        description: `Payment required for ${path}`,
      };

      c.header("PAYMENT-REQUIRED", JSON.stringify(paymentRequired));
      return c.json(
        {
          error: {
            message: "Payment required",
            type: "payment_required",
            payment: paymentRequired,
          },
        },
        402,
      );
    }

    let paymentSig: PaymentSignature;
    try {
      paymentSig = JSON.parse(paymentHeader) as PaymentSignature;
    } catch {
      return c.json(
        { error: { message: "Invalid PAYMENT-SIGNATURE header", type: "payment_error" } },
        400,
      );
    }

    if (
      paymentSig.payload?.payee?.toLowerCase() !== payeeAddress.toLowerCase() &&
      paymentSig.payload?.payee !== payeeAddress
    ) {
      return c.json(
        { error: { message: "Payment payee mismatch", type: "payment_error" } },
        402,
      );
    }

    const requestedAmount = parseFloat(paymentSig.payload?.amount ?? "0");
    const requiredAmount = parseFloat(price);
    if (requestedAmount < requiredAmount) {
      return c.json(
        { error: { message: `Insufficient payment: ${requestedAmount} < ${requiredAmount}`, type: "payment_error" } },
        402,
      );
    }

    const verification = await verifyPayment(paymentSig);

    if (!verification.valid) {
      return c.json(
        { error: { message: verification.error ?? "Payment verification failed", type: "payment_error" } },
        402,
      );
    }

    if (verification.txHash) {
      settlePayment(
        verification.txHash,
        verification.amount ?? paymentSig.payload.amount,
        verification.networkId ?? paymentSig.payload.networkId,
        payeeAddress,
      );
    }

    c.set("payment", { txHash: verification.txHash, amount: verification.amount ?? paymentSig.payload.amount, networkId: verification.networkId ?? paymentSig.payload.networkId });
    await next();
  };
}
