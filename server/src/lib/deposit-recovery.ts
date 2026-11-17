import { parseAbi, getAddress, formatUnits } from "viem";
import { db } from "../db/client.js";
import { DEPOSIT_STATUS } from "./deposit-status.js";
import { deposits } from "../db/schema.js";
import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { logPaymentEvent } from "./payment-observability.js";
import { creditConfirmedUsdcPayment } from "./payment-credit.js";

import { USDC_BASE, USDC_DECIMALS } from "../constants.js";
const MIN_DEPOSIT_CENTS = 100;

const TRANSFER_ABI = parseAbi([
		"event Transfer(address indexed from, address indexed to, uint256 value)",
]);

interface DepositRecoveryClient {
		getBlockNumber(): Promise<bigint>;
		getLogs(args: Record<string, unknown>): Promise<Array<{ transactionHash?: string; args?: unknown }>>;
}

interface TransferEvent {
		transactionHash: string;
		args: {
				from: string;
				to: string;
				value: bigint;
		};
}

export async function processTransfer(
		_client: DepositRecoveryClient,
		event: TransferEvent,
		depositAddress: string,
): Promise<void> {
		const { transactionHash, args } = event;
		const txHash = transactionHash.toLowerCase();
		const startedAt = Date.now();

		if (args.to.toLowerCase() !== depositAddress.toLowerCase()) return;

		const verifiedAmountCents = Math.round(Number(formatUnits(args.value, USDC_DECIMALS)) * 100);
		if (verifiedAmountCents < MIN_DEPOSIT_CENTS) {
				logger.debug({ txHash, amountUsdCents: verifiedAmountCents }, "[deposit-recovery] skipping dust transfer");
				return;
		}

		// Deposits are attributed by the authenticated wallet flow: the user
		// connects their wallet in the app and submits txHash + fromAddress after
		// signing the transfer. A transfer that was never recorded has no owner —
		// the legacy memo-in-calldata rail was removed. Never auto-credit here.
		const [existingDeposit] = await db
				.select()
				.from(deposits)
				.where(sql`lower(${deposits.txHash}) = ${txHash}`)
				.limit(1);

		const userId = existingDeposit?.userId ?? null;

		if (!userId) {
				logger.debug({ txHash }, "[deposit-recovery] no recorded deposit for txHash, skipping (wallet-submitted deposits only)");
				return;
		}

		if (existingDeposit) {
				if (existingDeposit.status === DEPOSIT_STATUS.Completed) {
						logPaymentEvent({
								kind: "usdc_deposit",
								outcome: "double_spend_blocked",
								userId,
						amountCents: verifiedAmountCents,
								signature: txHash,
								latencyMs: Date.now() - startedAt,
						});
						logger.debug({ txHash, userId }, "[deposit-recovery] deposit already completed, skipping");
						return;
				}

				// Attribution guard: the deposit row records the wallet that submitted
				// the txHash. Only credit when the on-chain sender actually matches —
				// otherwise anyone could submit someone else's transfer hash first and
				// claim the credits. Legacy rows (no fromAddress) keep the old behavior.
			if (existingDeposit.fromAddress) {
						const sender = (args.from ?? "").toLowerCase();
						const recorded = existingDeposit.fromAddress.toLowerCase();
						if (sender !== recorded) {
								await db
										.update(deposits)
										.set({ status: DEPOSIT_STATUS.Failed })
										.where(and(eq(deposits.id, existingDeposit.id), inArray(deposits.status, [DEPOSIT_STATUS.Pending, DEPOSIT_STATUS.Settling])));
								logPaymentEvent({
										kind: "usdc_deposit",
										outcome: "attribution_mismatch",
										userId,
							amountCents: verifiedAmountCents,
										signature: txHash,
										latencyMs: Date.now() - startedAt,
								});
								logger.warn(
										{ txHash, userId, sender, recorded },
										"[deposit-recovery] sender does not match recorded fromAddress, marked deposit failed",
								);
								return;
				}
			}

			// The browser's declared amount is informational only. Credits must
			// always equal the amount in the mined USDC Transfer event; otherwise a
			// caller could submit a small transfer and claim a larger balance.
			const declaredAmountCents = Math.round(Number(existingDeposit.amountUsd) * 100);
			if (declaredAmountCents !== verifiedAmountCents) {
				await db
					.update(deposits)
					.set({ status: DEPOSIT_STATUS.Failed })
					.where(and(eq(deposits.id, existingDeposit.id), inArray(deposits.status, [DEPOSIT_STATUS.Pending, DEPOSIT_STATUS.Settling])));
				logPaymentEvent({
					kind: "usdc_deposit",
					outcome: "amount_mismatch",
					userId,
					amountCents: verifiedAmountCents,
					signature: txHash,
					latencyMs: Date.now() - startedAt,
				});
				logger.warn(
					{ txHash, userId, declaredAmountCents, verifiedAmountCents },
					"[deposit-recovery] declared amount does not match verified transfer, marked deposit failed",
				);
				return;
			}

		const credit = await creditConfirmedUsdcPayment({
			userId, txHash, amountUsd: formatUnits(args.value, USDC_DECIMALS),
			payFrom: args.from, depositAddress,
		});
		logPaymentEvent({
			kind: "usdc_deposit", outcome: credit.alreadyCredited ? "double_spend_blocked" : "settled",
			userId, amountCents: credit.creditedCents, signature: txHash, latencyMs: Date.now() - startedAt,
		});
		logger.info({ txHash, userId, depositId: existingDeposit.id, amountUsdCents: credit.creditedCents }, "[deposit-recovery] marked pending deposit as completed and credited balance");
				return;
		}
}

export async function runRecoveryIteration(
		client: DepositRecoveryClient,
		depositAddress: string,
		fromBlock: bigint,
): Promise<bigint> {
		try {
				const currentBlock = await client.getBlockNumber();
				if (currentBlock <= fromBlock) {
						return fromBlock;
				}

				const logs = await client.getLogs({
						address: USDC_BASE,
						fromBlock,
						toBlock: currentBlock,
						event: TRANSFER_ABI[0],
						args: { to: getAddress(depositAddress) },
				});

				let processingFailed = false;
				for (const log of logs) {
						try {
								const event = log as unknown as TransferEvent;
								await processTransfer(client, event, depositAddress);
						} catch (err) {
								processingFailed = true;
								logger.error({ err, txHash: log.transactionHash }, "[deposit-recovery] failed to process transfer, continuing");
						}
				}

				// A failed credit must remain in the next scan. Successful credits
				// are idempotent, so replaying the range cannot credit them twice.
				return processingFailed ? fromBlock : currentBlock;
		} catch (err) {
				logger.error({ err, fromBlock }, "[deposit-recovery] iteration failed, will retry from same block");
				return fromBlock;
		}
}

/**
 * How long a deposit may sit in `pending` before it is decided as `expired`.
 *
 * A pending row is created when the user submits a txHash for a transfer
 * they have already signed, so a real transfer confirms within minutes and
 * the recovery scan above credits it. Seven days is far beyond any chain
 * delay: a row still pending after that is a transfer that never landed
 * (never broadcast, wrong network, dropped), and without this writer it
 * stayed `pending` forever -- the client renders "awaiting on-chain
 * confirmation" for a payment that will never arrive.
 */
export const PENDING_DEPOSIT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Move stale `pending` deposits to `expired`. Guarded by the current status
 * in the same statement, so a deposit the recovery scan is concurrently
 * completing is never expired underneath it. Returns how many rows expired.
 * Never throws: the caller is a scheduled tick that must survive a bad pass.
 */
export async function expireStalePendingDeposits(
		now: Date = new Date(),
		ttlMs: number = PENDING_DEPOSIT_TTL_MS,
): Promise<number> {
		try {
				const cutoff = new Date(now.getTime() - ttlMs);
				const expired = await db
						.update(deposits)
						.set({ status: DEPOSIT_STATUS.Expired })
						.where(and(eq(deposits.status, DEPOSIT_STATUS.Pending), lt(deposits.createdAt, cutoff)))
						.returning({ id: deposits.id });
				if (expired.length) {
						logger.info({ count: expired.length, cutoff: cutoff.toISOString() }, "[deposit-recovery] expired stale pending deposits");
				}
				return expired.length;
		} catch (err) {
				logger.error({ err }, "[deposit-recovery] pending-deposit expiry pass failed");
				return 0;
		}
}
