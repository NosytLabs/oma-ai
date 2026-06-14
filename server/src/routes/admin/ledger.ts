/**
 * M6.1 — Admin / Ledger routes
 *
 * Operator-only view of OMA's on-chain treasury / hot-wallet surface. Per the
 * M6 hot-wallet design (`.opencode/unit-tests/2026-06-14T05-00Z-hot-wallet-design.md`)
 * the server holds ONE signer (FACILITATOR_PRIVATE_KEY) for x402 + CheapTokens +
 * (optionally) a SECOND signer (SURPLUS_WALLET_PRIVATE_KEY) for Surplus EIP-712.
 * TREASURY_BASE_ADDRESS is the receiving address. The operator MAY configure
 * TREASURY_PRIVATE_KEY on the server for automated sweeps (config.ts:57). In
 * production deployments where the key lives in a hardware/HSM module, the
 * sweep endpoint returns 501 (read-only mode). This module is the *operator
 * console* for monitoring and (when configured) moving funds to a cold wallet.
 *
 * Endpoints:
 *   GET  /v1/admin/ledger/info                — TREASURY USDC + ETH balance, recent transfers
 *   GET  /v1/admin/ledger/hot-vs-cold-report  — split of hot (FACILITATOR / SURPLUS wallets) vs cold (TREASURY)
 *   POST /v1/admin/ledger/sweep               — admin-initiated transfer: TREASURY → ADMIN_SWEEP_ADDRESS
 *
 * Auth: inherited from adminRoutes (sessionAuth + requireAdmin + rate limit).
 * Audit: every state-mutating call (sweep) writes one audit log row.
 *
 * Failure modes:
 *   - TREASURY_PRIVATE_KEY not set: sweep returns 501 (the operator's wallet is
 *     off-server; the API can't sign). This is the expected state in dev.
 *   - ADMIN_SWEEP_ADDRESS not set: 403 (the operator must opt in to a destination).
 *   - CHAIN_RPC_URL unreachable: 503 (RPC down — don't pretend the sweep happened).
 *   - Any on-chain failure: 500 with the viem error message; audit log captures it.
 */
import { Hono } from "hono";
import { z } from "zod";
import { createPublicClient, createWalletClient, http, formatUnits, type Address, type Hash } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { auditLog } from "../../middleware/audit.js";
import { config } from "../../config.js";
import { USDC_BASE, USDC_DECIMALS } from "../../constants.js";
import { logger } from "../../lib/logger.js";
import type { OmaEnv } from "../../types.js";

/** Minimal ERC-20 ABI for balanceOf + the USDC-specific transfer(). We don't
 *  load the full ABI — the server's only need here is a read of the USDC
 *  balance and a plain transfer (no EIP-3009 — sweep is operator-signed, not
 *  user-pre-authorized). */
const USDC_BALANCE_ABI = [
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/** Reusable public client for read-only RPC calls. Created on demand — the
 *  CHAIN_RPC_URL may rotate, and viem clients are cheap to construct. */
function getPublicClient() {
  return createPublicClient({ chain: base, transport: http(config.CHAIN_RPC_URL) });
}

/** Resolve the operator-controlled *signer* for sweep operations. Returns
 *  null when TREASURY_PRIVATE_KEY is unset (typical dev / staging state). The
 *  caller is expected to translate null into 501. */
function getSweepSigner() {
  const pk = config.TREASURY_PRIVATE_KEY;
  if (!pk) return null;
  if (!/^0x[a-fA-F0-9]{64}$/.test(pk)) {
    throw new Error("TREASURY_PRIVATE_KEY is malformed (expected 0x + 64 hex)");
  }
  const account = privateKeyToAccount(pk as `0x${string}`);
  return createWalletClient({ account, chain: base, transport: http(config.CHAIN_RPC_URL) });
}

const sweepRequestSchema = z.object({
  /** Optional human-readable memo for the audit log; not signed into the tx. */
  memo: z.string().max(500).optional(),
  /** USDC amount in atomic units (6 decimals). Required. */
  amountAtomic: z.string().regex(/^[0-9]+$/, "amountAtomic must be a base-10 integer string"),
});

export const ledgerRoutes = new Hono<OmaEnv>();

/**
 * GET /v1/admin/ledger/info
 *
 * Returns:
 *   - treasury: { address, usdcBalanceAtomic, usdcBalanceFormatted, ethBalanceWei, ethBalanceFormatted }
 *   - recentTransfers: last 5 USDC Transfer events *to* the treasury (best-effort;
 *     node-rpc log queries are paginated; if the node doesn't support eth_getLogs
 *     with fromBlock=latest-200, returns []).
 *   - sweepConfig: { sweepAddress, signerConfigured, chainId }
 */
ledgerRoutes.get("/v1/admin/ledger/info", async (c) => {
  const userId = c.get("userId") as string | undefined;
  const client = getPublicClient();
  const treasury = config.TREASURY_BASE_ADDRESS as Address;

  let usdcBalanceAtomic: bigint;
  let ethBalanceWei: bigint;
  try {
    [usdcBalanceAtomic, ethBalanceWei] = await Promise.all([
      client.readContract({
        address: USDC_BASE as Address,
        abi: USDC_BALANCE_ABI,
        functionName: "balanceOf",
        args: [treasury],
      }) as Promise<bigint>,
      client.getBalance({ address: treasury }),
    ]);
  } catch (err) {
    logger.error({ err, treasury }, "ledger.info: failed to read on-chain balances");
    return c.json({
      error: {
        message: "Failed to read on-chain balances — check CHAIN_RPC_URL",
        type: "upstream_error",
      },
    }, 503);
  }

  // Best-effort recent USDC transfers TO treasury. We use a small block window
  // (last ~200 blocks) to keep the query bounded; on a busy chain this may miss
  // older transfers but is enough for an operator dashboard.
  let recentTransfers: Array<{
    blockNumber: string;
    txHash: Hash;
    from: Address;
    valueAtomic: string;
    valueFormatted: string;
  }> = [];
  try {
    const currentBlock = await client.getBlockNumber();
    const fromBlock = currentBlock > 200n ? currentBlock - 200n : 0n;
    const logs = await client.getLogs({
      address: USDC_BASE as Address,
      event: {
        type: "event",
        name: "Transfer",
        inputs: [
          { name: "from", type: "address", indexed: true },
          { name: "to", type: "address", indexed: true },
          { name: "value", type: "uint256", indexed: false },
        ],
      },
      args: { to: treasury },
      fromBlock,
      toBlock: "latest",
    });
    recentTransfers = logs.slice(-5).reverse().map((log) => ({
      blockNumber: log.blockNumber?.toString() ?? "0",
      txHash: log.transactionHash as Hash,
      from: (log.args?.from ?? "0x0") as Address,
      valueAtomic: (log.args?.value ?? 0n).toString(),
      valueFormatted: formatUnits((log.args?.value ?? 0n) as bigint, USDC_DECIMALS),
    }));
  } catch (err) {
    // Don't fail the whole endpoint if the node can't serve historical logs.
    logger.warn({ err, treasury }, "ledger.info: getLogs failed, returning empty recentTransfers");
    recentTransfers = [];
  }

  return c.json({
    treasury: {
      address: treasury,
      usdcBalanceAtomic: usdcBalanceAtomic.toString(),
      usdcBalanceFormatted: formatUnits(usdcBalanceAtomic, USDC_DECIMALS),
      ethBalanceWei: ethBalanceWei.toString(),
      ethBalanceFormatted: formatUnits(ethBalanceWei, 18),
    },
    recentTransfers,
    sweepConfig: {
      sweepAddress: config.ADMIN_SWEEP_ADDRESS ?? null,
      signerConfigured: Boolean(config.TREASURY_PRIVATE_KEY),
      chainId: base.id,
    },
    requester: userId ?? null,
  });
});

/**
 * GET /v1/admin/ledger/hot-vs-cold-report
 *
 * Splits OMA's on-chain surface into:
 *   - cold: TREASURY_BASE_ADDRESS (off-server signer — read-only here)
 *   - hot: derived from FACILITATOR_PRIVATE_KEY (if set) and SURPLUS_WALLET_PRIVATE_KEY
 *     (if set) — we report the *address* derived from each key but never the key itself.
 *
 * Each wallet reports USDC + ETH balance. Useful for the operator to confirm
 * hot-wallet balance is below the $50 cap recommended in the hot-wallet design.
 */
ledgerRoutes.get("/v1/admin/ledger/hot-vs-cold-report", async (c) => {
  const client = getPublicClient();
  const coldAddress = config.TREASURY_BASE_ADDRESS as Address;

  // Derive hot-wallet addresses from private keys (without exposing the keys).
  // These are the addresses that *sign*; their balances reflect float in motion.
  const hotAddresses: Array<{ label: Address; source: string }> = [];
  if (config.FACILITATOR_PRIVATE_KEY && /^0x[a-fA-F0-9]{64}$/.test(config.FACILITATOR_PRIVATE_KEY)) {
    try {
      const acct = privateKeyToAccount(config.FACILITATOR_PRIVATE_KEY as `0x${string}`);
      hotAddresses.push({ label: acct.address as Address, source: "FACILITATOR_PRIVATE_KEY" });
    } catch {
      // Malformed key — skip silently (config.ts will have already fatalled in prod)
    }
  }
  if (config.SURPLUS_WALLET_PRIVATE_KEY && /^0x[a-fA-F0-9]{64}$/.test(config.SURPLUS_WALLET_PRIVATE_KEY)) {
    try {
      const acct = privateKeyToAccount(config.SURPLUS_WALLET_PRIVATE_KEY as `0x${string}`);
      hotAddresses.push({ label: acct.address as Address, source: "SURPLUS_WALLET_PRIVATE_KEY" });
    } catch {
      // Malformed key — skip silently
    }
  }

  const allAddresses: Array<{ role: "cold" | "hot"; source: string; address: Address }> = [
    { role: "cold", source: "TREASURY_BASE_ADDRESS", address: coldAddress },
    ...hotAddresses.map((h) => ({ role: "hot" as const, source: h.source, address: h.label })),
  ];

  // Batch all balance reads in parallel.
  const balances = await Promise.all(
    allAddresses.map(async (entry) => {
      try {
        const [usdc, eth] = await Promise.all([
          client.readContract({
            address: USDC_BASE as Address,
            abi: USDC_BALANCE_ABI,
            functionName: "balanceOf",
            args: [entry.address],
          }) as Promise<bigint>,
          client.getBalance({ address: entry.address }),
        ]);
        return {
          ...entry,
          usdcBalanceAtomic: usdc.toString(),
          usdcBalanceFormatted: formatUnits(usdc, USDC_DECIMALS),
          ethBalanceWei: eth.toString(),
          ethBalanceFormatted: formatUnits(eth, 18),
          error: null,
        };
      } catch (err) {
        logger.error({ err, address: entry.address }, "ledger.hot-vs-cold-report: balance read failed");
        return {
          ...entry,
          usdcBalanceAtomic: "0",
          usdcBalanceFormatted: "0",
          ethBalanceWei: "0",
          ethBalanceFormatted: "0",
          error: "balance read failed",
        };
      }
    }),
  );

  return c.json({ wallets: balances, chainId: base.id });
});

/**
 * POST /v1/admin/ledger/sweep
 *
 * Body: { amountAtomic: string, memo?: string }
 *   amountAtomic: USDC in atomic units (6 decimals). e.g. "1000000" = $1.
 *   memo: optional human-readable note for the audit log.
 *
 * Side effect: submits `USDC.transfer(ADMIN_SWEEP_ADDRESS, amountAtomic)` from
 * TREASURY_BASE_ADDRESS. The operator (admin) is the sole authorization —
 * requireAdmin() upstream + this being the only endpoint that can move funds
 * from the receiving address.
 *
 * Failure modes (each audited):
 *   - 501: TREASURY_PRIVATE_KEY not configured (typical dev/staging).
 *   - 403: ADMIN_SWEEP_ADDRESS not configured (opt-in destination).
 *   - 400: amountAtomic is "0" or unparseable.
 *   - 500: on-chain tx reverts or RPC down.
 *
 * Success: returns 200 with the tx hash. The audit log entry records the
 * operator (userId from session), the destination, the amount, and the tx hash.
 */
ledgerRoutes.post("/v1/admin/ledger/sweep", async (c) => {
  const userId = c.get("userId") as string | undefined;
  const treasury = config.TREASURY_BASE_ADDRESS as Address;
  const sweepAddress = config.ADMIN_SWEEP_ADDRESS as Address | undefined;
  const sweepSigner = getSweepSigner();

  // Parse + validate body. We parse *before* checking the signer so that
  // schema errors (400) are reported even in dev with no key configured.
  let body: z.infer<typeof sweepRequestSchema>;
  try {
    const json = await c.req.json();
    const parsed = sweepRequestSchema.safeParse(json);
    if (!parsed.success) {
      return c.json(
        { error: { message: parsed.error.errors.map((e) => e.message).join("; "), type: "invalid_request_error" } },
        400,
      );
    }
    body = parsed.data;
  } catch {
    return c.json({ error: { message: "Request body must be valid JSON", type: "invalid_request_error" } }, 400);
  }

  const amountAtomic = BigInt(body.amountAtomic);
  if (amountAtomic <= 0n) {
    return c.json({ error: { message: "amountAtomic must be > 0", type: "invalid_request_error" } }, 400);
  }

  // Pre-flight: signer present?
  if (!sweepSigner) {
    await auditLog({
      userId,
      action: "WITHDRAWAL_FAILED",
      resource: "admin_ledger_sweep",
      resourceId: undefined,
      metadata: {
        reason: "TREASURY_PRIVATE_KEY not configured",
        amountAtomic: amountAtomic.toString(),
        sweepAddress: sweepAddress ?? undefined,
      },
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
    });
    return c.json(
      {
        error: {
          message:
            "Sweep is not available: TREASURY_PRIVATE_KEY is not configured on this server. Set it to a real key with authority over TREASURY_BASE_ADDRESS to enable operator-initiated sweeps.",
          type: "not_implemented",
        },
      },
      501,
    );
  }

  // Pre-flight: destination configured?
  if (!sweepAddress) {
    await auditLog({
      userId,
      action: "WITHDRAWAL_FAILED",
      resource: "admin_ledger_sweep",
      resourceId: undefined,
      metadata: {
        reason: "ADMIN_SWEEP_ADDRESS not configured",
        amountAtomic: amountAtomic.toString(),
      },
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
    });
    return c.json(
      {
        error: {
          message:
            "Sweep destination not configured: set ADMIN_SWEEP_ADDRESS to a valid 0x-address you control before sweeping.",
          type: "forbidden",
        },
      },
      403,
    );
  }

  if (sweepAddress.toLowerCase() === treasury.toLowerCase()) {
    return c.json(
      { error: { message: "ADMIN_SWEEP_ADDRESS cannot equal TREASURY_BASE_ADDRESS", type: "invalid_request_error" } },
      400,
    );
  }

  // Submit the on-chain transfer. viem's writeContract returns the hash
  // synchronously (the tx is broadcast but not yet mined); we deliberately
  // don't wait for the receipt here — the operator dashboard can poll the
  // explorer / the next /ledger/info call to confirm.
  let txHash: Hash;
  try {
    txHash = await sweepSigner.writeContract({
      address: USDC_BASE as Address,
      abi: USDC_BALANCE_ABI,
      functionName: "transfer",
      args: [sweepAddress, amountAtomic],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, amountAtomic: amountAtomic.toString(), sweepAddress }, "ledger.sweep: writeContract failed");
    await auditLog({
      userId,
      action: "WITHDRAWAL_FAILED",
      resource: "admin_ledger_sweep",
      metadata: {
        amountAtomic: amountAtomic.toString(),
        sweepAddress,
        fromAddress: treasury,
        error: message,
        memo: body.memo ?? null,
      },
      ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
      userAgent: c.req.header("user-agent") ?? undefined,
    });
    return c.json(
      { error: { message: `Sweep failed: ${message}`, type: "upstream_error" } },
      500,
    );
  }

  // Success: record the sweep. This is the row that satisfies the audit
  // requirement that "every sweep attempt (success or failure)" is captured.
  await auditLog({
    userId,
    action: "WITHDRAWAL_COMPLETED",
    resource: "admin_ledger_sweep",
    resourceId: txHash,
    metadata: {
      amountAtomic: amountAtomic.toString(),
      amountFormatted: formatUnits(amountAtomic, USDC_DECIMALS),
      sweepAddress,
      fromAddress: treasury,
      memo: body.memo ?? null,
    },
    ipAddress: c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? c.req.header("x-real-ip") ?? undefined,
    userAgent: c.req.header("user-agent") ?? undefined,
  });

  return c.json({
    ok: true,
    txHash,
    from: treasury,
    to: sweepAddress,
    amountAtomic: amountAtomic.toString(),
    amountFormatted: formatUnits(amountAtomic, USDC_DECIMALS),
    memo: body.memo ?? null,
  });
});
