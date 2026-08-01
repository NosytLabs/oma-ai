/**
 * USDC deposit flow on Base.
 *
 *   GET  /v1/deposit/usdc     → returns deposit instructions
 *                                 (receiver address, USDC contract, memo,
 *                                  min/max).
 *   POST /v1/deposit/usdc     → records a pending deposit for the
 *                                 supplied txHash. Actual on-chain
 *                                 confirmation is handled by an external
 *                                 watcher (jobs/deposit-recovery.ts);
 *                                 this endpoint does NOT credit the
 *                                 balance until the watcher flips the
 *                                 deposit row to `completed`.
 *   GET  /v1/deposit/status   → user's deposit history (pending +
 *                                 completed).
 *   GET  /v1/balance          → user's current credit balance.
 */
import { Hono } from "hono";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { OmaEnv } from "../../types.js";
import { sessionOrBearerAuth } from "../../auth/middleware.js";
import { rateLimit } from "../../middleware/rate-limit.js";
import { db } from "../../db/client.js";
import { creditBalances, deposits, siteSettings } from "../../db/schema.js";
import { auditLog } from "../../middleware/audit.js";
import { config } from "../../config.js";
import { logger } from "../../lib/logger.js";

// USDC contract on Base mainnet.
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const USDC_BASE_CHAIN_ID = 8453;

export const depositRoutes = new Hono<OmaEnv>();

// ─── GET /v1/balance ─────────────────────────────────────────────────────────

depositRoutes.get("/v1/balance", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  try {
    const [row] = await db
      .select()
      .from(creditBalances)
      .where(eq(creditBalances.userId, userId))
      .limit(1);
    return c.json({
      userId,
      balanceCents: row?.balanceCents ?? "0",
      totalDepositedCents: row?.totalDepositedCents ?? "0",
      totalUsedCents: row?.totalUsedCents ?? "0",
    });
  } catch (err) {
    logger.error({ err, userId }, "[deposit] balance fetch failed");
    return c.json(
      { error: { message: "Failed to fetch balance", type: "server_error" } },
      500,
    );
  }
});

// ─── GET /v1/deposit/usdc ────────────────────────────────────────────────────
// Returns deposit instructions: address, network, USDC contract, memo,
// min/max. The frontend surfaces this on the /deposit page.

depositRoutes.get("/v1/deposit/usdc", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");

  // Check if crypto deposits are disabled by admin
  try {
    const [settings] = await db.select({ cryptoPaymentsEnabled: siteSettings.cryptoPaymentsEnabled }).from(siteSettings).limit(1);
    if (settings && !settings.cryptoPaymentsEnabled) {
      return c.json(
        {
          error: {
            message: "USDC deposits are temporarily disabled by the administrator.",
            type: "service_unavailable",
          },
        },
        503,
      );
    }
  } catch (err) {
    logger.error({ err }, "[deposit] failed to check site settings for crypto payments");
  }

  if (!config.USDC_DEPOSIT_ADDRESS) {
    return c.json(
      {
        error: {
          message:
            "USDC deposits are temporarily unavailable. Set USDC_DEPOSIT_ADDRESS in the server env to enable.",
          type: "not_configured",
        },
      },
      503,
    );
  }
  // The memo lets the operator's reconciliation script credit the right
  // user. First 8 chars of the Better Auth user id are stable + unique enough
  // for a lookup; the operator can match on a longer prefix server-side.
  const memo = `oma-${userId.slice(0, 8)}`;
  return c.json({
    depositAddress: config.USDC_DEPOSIT_ADDRESS,
    network: config.USDC_DEPOSIT_NETWORK,
    chainId: USDC_BASE_CHAIN_ID,
    usdcContract: USDC_BASE,
    memo,
    memoNote:
      "Optional. Including the memo in your transfer lets the watcher credit your balance automatically.",
    minDepositCents: config.USDC_DEPOSIT_MIN_CENTS,
    maxDepositCents: config.USDC_DEPOSIT_MAX_CENTS,
    creditsPerCent: 1, // 1 cent = 1 credit (CREDITS_PER_USD / 100)
  });
});

// ─── POST /v1/deposit/usdc ───────────────────────────────────────────────────
// Records a pending deposit. The watcher (server/src/jobs/) flips
// status to `completed` after on-chain confirmation. Balance is NOT
// touched here.

const submitSchema = z.object({
  amountUsd: z.number().positive().max(10_000),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  network: z.enum(["base"]).default("base"),
  fromAddress: z
    .string()
    .regex(/^0x[a-fA-F0-9]{40}$/)
    .optional(),
});

depositRoutes.post(
  "/v1/deposit/usdc",
  rateLimit({ windowMs: 60_000, maxRequests: 10 }),
  sessionOrBearerAuth,
  async (c) => {
    const userId = c.get("userId");

    // Check if crypto deposits are disabled by admin
    try {
      const [settings] = await db.select({ cryptoPaymentsEnabled: siteSettings.cryptoPaymentsEnabled }).from(siteSettings).limit(1);
      if (settings && !settings.cryptoPaymentsEnabled) {
        return c.json(
          {
            error: {
              message: "USDC deposits are temporarily disabled by the administrator.",
              type: "service_unavailable",
            },
          },
          503,
        );
      }
    } catch (err) {
      logger.error({ err }, "[deposit] failed to check site settings for crypto payments");
    }

    if (!config.USDC_DEPOSIT_ADDRESS) {
      return c.json(
        {
          error: {
            message: "USDC deposits are temporarily unavailable.",
            type: "not_configured",
          },
        },
        503,
      );
    }
    const depositAddress = config.USDC_DEPOSIT_ADDRESS;
    const body = await c.req.json().catch(() => null);
    const parsed = submitSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        {
          error: {
            message: "Invalid request",
            type: "invalid_request_error",
            issues: parsed.error.flatten(),
          },
        },
        400,
      );
    }
    const { amountUsd, txHash, network, fromAddress } = parsed.data;
    const amountCents = Math.round(amountUsd * 100);
    if (amountCents < config.USDC_DEPOSIT_MIN_CENTS) {
      return c.json(
        {
          error: {
            message: `Minimum deposit is $${(
              config.USDC_DEPOSIT_MIN_CENTS / 100
            ).toFixed(2)}`,
            type: "invalid_request_error",
          },
        },
        400,
      );
    }
    if (amountCents > config.USDC_DEPOSIT_MAX_CENTS) {
      return c.json(
        {
          error: {
            message: `Maximum deposit is $${(
              config.USDC_DEPOSIT_MAX_CENTS / 100
            ).toFixed(2)}`,
            type: "invalid_request_error",
          },
        },
        400,
      );
    }
    try {
      const [created] = await db
        .insert(deposits)
        .values({
          userId,
          type: "usdc_direct",
          amountUsd: amountUsd.toFixed(8),
          creditsIssued: "0",
          txHash,
depositAddress,
          status: "pending",
        })
        .returning();
      await auditLog({
        userId,
        action: "DEPOSIT_CREATED",
        resource: "deposits",
        resourceId: created.id,
        metadata: { amountCents, txHash, network, fromAddress: fromAddress ?? null },
      });
      return c.json({
        depositId: created.id,
        status: "pending" as const,
        amountCents,
        txHash,
        network,
        message:
          "Deposit recorded. Watcher will credit your balance after on-chain confirmation (typically <60s on Base).",
      });
    } catch (err: unknown) {
      // txHash unique index — already submitted.
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        (err as { code?: string }).code === "23505"
      ) {
        const [existing] = await db
          .select()
          .from(deposits)
          .where(and(eq(deposits.userId, userId), eq(deposits.txHash, txHash)))
          .limit(1);
        if (existing) {
          return c.json({
            depositId: existing.id,
            status: existing.status,
            amountCents: Number(existing.amountUsd) * 100,
            txHash,
            message: "Deposit already recorded for this txHash.",
          });
        }
      }
      logger.error({ err }, "[deposit] submit failed");
      return c.json(
        { error: { message: "Failed to record deposit", type: "server_error" } },
        500,
      );
    }
  },
);

// ─── GET /v1/deposit/status ──────────────────────────────────────────────────

depositRoutes.get("/v1/deposit/status", sessionOrBearerAuth, async (c) => {
  const userId = c.get("userId");
  try {
    const rows = await db
      .select()
      .from(deposits)
      .where(eq(deposits.userId, userId))
      .orderBy(desc(deposits.createdAt))
      .limit(50);
    return c.json({
      deposits: rows.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        amountUsd: r.amountUsd,
        creditsIssued: r.creditsIssued,
        txHash: r.txHash,
        depositAddress: r.depositAddress,
        createdAt: r.createdAt.toISOString(),
        completedAt: r.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (err) {
    logger.error({ err }, "[deposit] status list failed");
    return c.json(
      { error: { message: "Failed to list deposits", type: "server_error" } },
      500,
    );
  }
});

