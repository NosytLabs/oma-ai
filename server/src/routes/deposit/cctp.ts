import { Hono } from "hono";
import { z } from "zod";
import { processCctpDeposit } from "../../credits/deposit.js";
import { sessionAuth } from "../../auth/middleware.js";
import { auditLog } from "../../middleware/audit.js";
import { db } from "../../db/client.js";
import { deposits } from "../../db/schema.js";
import { eq } from "drizzle-orm";
import { verifyBurnTransaction, waitForAttestation, getCctpSupportedChains } from "../../credits/cctp-client.js";
import type { OmaEnv } from "../../types.js";
import { validationError } from "../../lib/validation.js";

const cctpDepositSchema = z.object({
  amount: z.number().positive().max(1000000),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  sourceChain: z.string().min(1),
  fastTransfer: z.boolean().optional(),
});

export const cctpRoutes = new Hono<OmaEnv>();

cctpRoutes.post("/v1/deposit/cctp", sessionAuth, async (c) => {
  const userId = c.get("userId");
  const parsed = cctpDepositSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { amount, txHash, sourceChain, fastTransfer } = parsed.data;

  const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1);
  if (existing.length > 0) return c.json({ error: { message: "Duplicate transaction", type: "duplicate" } }, 409);

  try {
    const burnTx = await verifyBurnTransaction(sourceChain, txHash);
    if (!burnTx.verified) {
      return c.json({ error: { message: "Invalid burn transaction", type: "verification_error" } }, 400);
    }

    // SECURITY: Validate that the user-claimed amount matches the on-chain burn amount.
    // Without this check, a user could submit a real 1-cent burn tx but claim $10,000
    // and receive unlimited credits. The on-chain amount is the single source of truth.
    const onChainAmountUsd = Number(burnTx.burnAmount) / 1e6; // USDC has 6 decimals
    if (Math.abs(onChainAmountUsd - amount) > 0.01) {
      return c.json({
        error: {
          message: `Amount mismatch: claimed $${amount}, on-chain burn is $${onChainAmountUsd.toFixed(2)}`,
          type: "amount_mismatch",
          claimedAmount: amount,
          onChainAmount: onChainAmountUsd,
        },
      }, 400);
    }

    if (fastTransfer) {
      const attestation = await waitForAttestation(sourceChain, txHash, 15, 2000);
      if (attestation.status !== "complete") {
        return c.json({ error: { message: "Attestation timeout - try standard transfer", type: "attestation_timeout" } }, 408);
      }
    }

    const result = await processCctpDeposit(userId, onChainAmountUsd, txHash, sourceChain, burnTx.messageHash);

    const ipAddress = c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || undefined;
    const userAgent = c.req.header("user-agent") || undefined;

    await auditLog({
      userId,
      action: "DEPOSIT_CREATED",
      resource: "deposits",
      resourceId: result.depositId,
      metadata: { amount, txHash, sourceChain, method: "cctp_crosschain" },
      ipAddress,
      userAgent,
    });

    return c.json({ credits: result.creditsCents, depositId: result.depositId, method: "cctp" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "deposit_error" } }, 500);
  }
});

cctpRoutes.post("/v1/deposit/cctp/status", sessionAuth, async (c) => {
  const parsed = z.object({ txHash: z.string().min(1), sourceChain: z.string().min(1) }).safeParse(await c.req.json());
  if (!parsed.success) return c.json(validationError(parsed.error), 400);
  const { txHash, sourceChain } = parsed.data;
  try {
    const burnTx = await verifyBurnTransaction(sourceChain, txHash);
    const attestation = await waitForAttestation(sourceChain, txHash, 3, 2000);
    return c.json({ verified: burnTx.verified, attested: attestation.status === "complete", burnAmount: burnTx.burnAmount, burnDomain: burnTx.sourceChain });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: { message, type: "verification_error" } }, 502);
  }
});

cctpRoutes.get("/v1/deposit/cctp/chains", async (c) => {
  const chains = getCctpSupportedChains();
  return c.json({ chains });
});