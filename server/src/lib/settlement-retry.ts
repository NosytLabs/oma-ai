import { getSettlementDlqEntries, retrySettlementFromDlq, addSettlementToDlq, getSettlementDlqLength } from "./dlq.js";
import { verifyPayment, settlePaymentAsync } from "../x402/facilitator.js";
import type { PaymentSignature } from "../x402/facilitator.js";
import { config } from "../config.js";

const MAX_RETRIES = 3;
const RETRY_BATCH_SIZE = 10;

export interface SettlementRetryResult {
  orderId: string;
  success: boolean;
  attempts: number;
  error?: string;
  permanentlyFailed: boolean;
}

async function attemptSettlementRetry(entry: {
  orderId: string;
  amount: string;
  chain: string;
  attempts: number;
  lastError: string;
}): Promise<SettlementRetryResult> {
  const { orderId, amount, chain } = entry;

  try {
    const paymentSig: PaymentSignature = {
      x402Version: "1",
      signature: orderId,
      authorization: "settlement_retry",
      payload: {
        x402Version: "1",
        scheme: "evm",
        networkId: chain,
        asset: "USDC",
        amount,
        payee: config.HOUDINI_ADDRESS_TO || "",
        payFrom: "",
        maxAmountRequired: amount,
        validBefore: 0,
        validAfter: 0,
      },
    };

    const verification = await verifyPayment(paymentSig);

    if (!verification.valid) {
      return {
        orderId,
        success: false,
        attempts: entry.attempts + 1,
        error: verification.error || "Verification failed",
        permanentlyFailed: entry.attempts + 1 >= MAX_RETRIES,
      };
    }

    if (verification.txHash) {
      const result = await settlePaymentAsync(
        verification.txHash,
        verification.amount || amount,
        verification.networkId || chain,
        config.HOUDINI_ADDRESS_TO || "",
      );

      if (result.settled) {
        return {
          orderId,
          success: true,
          attempts: entry.attempts + 1,
          permanentlyFailed: false,
        };
      }

      const newError = result.error || "Settlement failed";
      const permanentlyFailed = entry.attempts + 1 >= MAX_RETRIES;

      if (!permanentlyFailed) {
        await addSettlementToDlq(orderId, amount, chain, newError, entry.attempts + 1);
      }

      return {
        orderId,
        success: false,
        attempts: entry.attempts + 1,
        error: newError,
        permanentlyFailed,
      };
    }

    return {
      orderId,
      success: false,
      attempts: entry.attempts + 1,
      error: "No transaction hash returned",
      permanentlyFailed: entry.attempts + 1 >= MAX_RETRIES,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    const permanentlyFailed = entry.attempts + 1 >= MAX_RETRIES;

    if (!permanentlyFailed) {
      await addSettlementToDlq(orderId, amount, chain, errorMsg, entry.attempts + 1);
    }

    return {
      orderId,
      success: false,
      attempts: entry.attempts + 1,
      error: errorMsg,
      permanentlyFailed,
    };
  }
}

export async function processSettlementDLQ(): Promise<SettlementRetryResult[]> {
  const results: SettlementRetryResult[] = [];
  const queueLength = await getSettlementDlqLength();

  if (queueLength === 0) {
    return results;
  }

  const entries = await getSettlementDlqEntries(0, RETRY_BATCH_SIZE);

  for (const entry of entries) {
    const result = await attemptSettlementRetry({
      orderId: entry.orderId,
      amount: entry.amount,
      chain: entry.chain,
      attempts: entry.attempts,
      lastError: entry.lastError,
    });

    results.push(result);

    // Pop the entry from the DLQ when we've reached a terminal state:
    //   - result.success  → settlement went through, no need to keep it
    //   - result.permanentlyFailed → give up, no more retries possible
    // Retryable failures are kept in the queue (we re-add with attempts+1
    // inside attemptSettlementRetry so the entry stays with updated count).
    if (result.success || result.permanentlyFailed) {
      await retrySettlementFromDlq();
    }
  }

  return results;
}

export async function retrySettlementById(orderId: string): Promise<SettlementRetryResult> {
  const entries = await getSettlementDlqEntries(0, await getSettlementDlqLength());

  const entry = entries.find((e) => e.orderId === orderId);

  if (!entry) {
    return {
      orderId,
      success: false,
      attempts: 0,
      error: "Settlement not found in DLQ",
      permanentlyFailed: true,
    };
  }

  const result = await attemptSettlementRetry({
    orderId: entry.orderId,
    amount: entry.amount,
    chain: entry.chain,
    attempts: entry.attempts,
    lastError: entry.lastError,
  });

  if (result.success || result.permanentlyFailed) {
    await retrySettlementFromDlq();
  }

  return result;
}

export async function discardSettlementFromDlq(orderId: string): Promise<boolean> {
  const entries = await getSettlementDlqEntries(0, await getSettlementDlqLength());

  const index = entries.findIndex((e) => e.orderId === orderId);

  if (index === -1) {
    return false;
  }

  const { removeSettlementDlqEntry } = await import("./dlq.js");
  await removeSettlementDlqEntry(index);
  return true;
}

export async function getSettlementDlqStatus(): Promise<{
  total: number;
  retryable: number;
  permanentlyFailed: number;
}> {
  const entries = await getSettlementDlqEntries(0, await getSettlementDlqLength());

  let retryable = 0;
  let permanentlyFailed = 0;

  for (const entry of entries) {
    if (entry.attempts >= MAX_RETRIES) {
      permanentlyFailed++;
    } else {
      retryable++;
    }
  }

  return {
    total: entries.length,
    retryable,
    permanentlyFailed,
  };
}