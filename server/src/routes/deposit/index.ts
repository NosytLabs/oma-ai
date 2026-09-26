/**
	* USDC deposit flow on Base.
	*
	*   GET  /v1/deposit/usdc     → returns deposit instructions
	*                                 (receiver address, USDC contract,
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
	*   GET  /v1/site-settings    → public rail/config status for the frontend.
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
import { USDC_BASE } from "../../constants.js";
import {
	issueDepositChallenge,
	verifyDepositChallenge,
	verifyDepositSignature,
} from "../../lib/deposit-challenge.js";

// Chain id for Base mainnet.
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
// Returns deposit instructions: address, network, USDC contract,
// min/max. The frontend surfaces this on the /deposit page.

depositRoutes.get("/v1/deposit/usdc", sessionOrBearerAuth, async (c) => {
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
		// The deposit is attributed to the authenticated user via the txHash they
		// submit (the watcher additionally verifies the transfer's `from` matches
		// the fromAddress recorded here), so no memo is needed.
		return c.json({
				depositAddress: config.USDC_DEPOSIT_ADDRESS,
				network: config.USDC_DEPOSIT_NETWORK,
				chainId: USDC_BASE_CHAIN_ID,
				usdcContract: USDC_BASE,
				minDepositCents: config.USDC_DEPOSIT_MIN_CENTS,
				maxDepositCents: config.USDC_DEPOSIT_MAX_CENTS,
				creditsPerCent: 1, // 1 cent = 1 credit (CREDITS_PER_USD / 100)
		});
});

// ─── POST /v1/deposit/usdc/challenge ────────────────────────────────────────
// Issues a short-lived, user-bound challenge token the depositor's wallet must
// sign. Prevents the deposit Blocker: gates every pending deposit on a
// cryptographic proof that the caller controls the sending wallet.

depositRoutes.post(
	"/v1/deposit/usdc/challenge",
	rateLimit({ windowMs: 60_000, maxRequests: 30 }),
	sessionOrBearerAuth,
	async (c) => {
		const userId = c.get("userId");
		const body = await c.req.json().catch(() => null);
		const parsed = challengeSchema.safeParse(body);
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
		const { fromAddress } = parsed.data;
		const issued = issueDepositChallenge({ userId, fromAddress });
		await auditLog({
			userId,
			action: "DEPOSIT_CREATED",
			resource: "deposits",
			metadata: { stage: "challenge_issued", fromAddress },
		});
		return c.json({
			token: issued.token,
			nonce: issued.nonce,
			expiresAt: issued.expiresAt,
		});
	},
);

// ─── POST /v1/deposit/usdc ───────────────────────────────────────────────────
// Records a pending deposit. The watcher (server/src/jobs/) flips
// status to `completed` after on-chain confirmation. Balance is NOT
// touched here.

const submitSchema = z.object({
		amountUsd: z.number().positive().max(10_000),
		txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
		network: z.enum(["base"]).default("base"),
		// Sending wallet address. The watcher verifies the on-chain sender
		// matches this so credits can't be claimed for someone else's transfer.
		fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
		// SECURITY (deposit Blocker): proof-of-ownership. The client must first
		// obtain a user-bound challenge token (POST /v1/deposit/usdc/challenge)
		// and then sign the canonical deposit message with the sending wallet.
		// The signature's recovered signer must equal fromAddress — cryptographically
		// proving the caller controls the wallet that sends the funds.
		challengeToken: z.string().min(20),
		signature: z.string().min(2),
});

const challengeSchema = z.object({
		fromAddress: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
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
				const { amountUsd, txHash, network, fromAddress, challengeToken, signature } =
					parsed.data;
				const amountCents = Math.round(amountUsd * 100);

				// SECURITY (deposit Blocker): the pending deposit must be backed by
				// (1) a valid, unexpired challenge token bound to this user + wallet,
				// and (2) a wallet signature over the canonical deposit message that
				// recovers to fromAddress. Without this, an attacker could submit a
				// victim's broadcast txHash + the victim's real fromAddress under
				// their OWN account and claim the credits.
				const challengeCheck = verifyDepositChallenge({
					token: challengeToken,
					userId,
					fromAddress,
				});
				if (!challengeCheck.ok) {
					logger.warn(
						{ userId, reason: challengeCheck.reason, fromAddress },
						"[deposit] challenge rejected",
					);
					await auditLog({
						userId,
						action: "DEPOSIT_FAILED",
						resource: "deposits",
						metadata: { reason: `challenge:${challengeCheck.reason}`, fromAddress },
					});
					return c.json(
						{
							error: {
								message: "Deposit proof expired or invalid. Please retry.",
								type: "invalid_request_error",
							},
						},
						403,
					);
				}
				const proofOk = await verifyDepositSignature({
					fromAddress,
					depositAddress: config.USDC_DEPOSIT_ADDRESS,
					challengeToken,
					signature,
				});
				if (!proofOk) {
					logger.warn(
						{ userId, fromAddress },
						"[deposit] signature proof failed — wallet ownership not established",
					);
					await auditLog({
						userId,
						action: "DEPOSIT_FAILED",
						resource: "deposits",
						metadata: { reason: "signature:ownership", fromAddress },
					});
					return c.json(
						{
							error: {
								message:
									"Signature does not match the sending wallet. Verify you're signing with the wallet that sent the USDC.",
								type: "invalid_request_error",
							},
						},
						403,
					);
				}
				await auditLog({
					userId,
					action: "DEPOSIT_CREATED",
					resource: "deposits",
					metadata: { stage: "proof_verified", fromAddress, txHash },
				});
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
										fromAddress,
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

// ─── GET /v1/site-settings ───────────────────────────────────────────────────
// Public. Lets the frontend render honest rail statuses instead of
// discovering a 503 after the user picks a rail.
//
// Resilience: if the DB is unreachable (dev DB down, network blip) we still
// serve a best-effort config from env vars so the deposit page never 5xxs
// for an anonymous visitor. The toggle states (maintenance, payment on/off)
// fall back to "open" defaults — the admin panel can re-apply them once
// the DB recovers.

depositRoutes.get("/v1/site-settings", async (c) => {
		const envDefaults = {
				maintenanceMode: false,
				cardPaymentsEnabled: true,
				cryptoPaymentsEnabled: true,
				usdcDepositConfigured: Boolean(config.USDC_DEPOSIT_ADDRESS),
				polarConfigured:
						Boolean(config.POLAR_ACCESS_TOKEN) &&
						Boolean(
								config.POLAR_HOBBY_PRODUCT_ID ||
										config.POLAR_BUILDER_PRODUCT_ID ||
										config.POLAR_SCALE_PRODUCT_ID,
						),
				x402Configured:
						config.FACILITATOR_MODE === "live" &&
						Boolean(config.FACILITATOR_PRIVATE_KEY) &&
						Boolean(config.CHAIN_RPC_URL) &&
						Boolean(config.TREASURY_BASE_ADDRESS),
		};
		try {
			const [settings] = await db.select().from(siteSettings).limit(1);
			// Card checkout is only advertised when it can actually complete.
			// The admin toggle is a necessary-but-not-sufficient condition: the
			// DB default is `true`, so a site with no POLAR_ACCESS_TOKEN and no
			// product IDs was rendering a "Card · Polar" option that 404s on
			// /checkout/session. Gate the advertised flag on BOTH the toggle and
			// real Polar configuration, so the UI never offers a dead payment
			// path. The toggle still governs intent; this governs capability.
			const cardToggle = settings?.cardPaymentsEnabled ?? envDefaults.cardPaymentsEnabled;
			return c.json({
				maintenanceMode: settings?.maintenanceMode ?? envDefaults.maintenanceMode,
				cardPaymentsEnabled: cardToggle && envDefaults.polarConfigured,
				cryptoPaymentsEnabled:
					settings?.cryptoPaymentsEnabled ?? envDefaults.cryptoPaymentsEnabled,
				usdcDepositConfigured: envDefaults.usdcDepositConfigured,
				polarConfigured: envDefaults.polarConfigured,
				x402Configured: envDefaults.x402Configured,
			});
		} catch (err) {
				logger.warn(
						{ err: (err as Error).message },
						"[deposit] site-settings DB read failed; serving env defaults",
				);
				return c.json(envDefaults);
		}
});

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

