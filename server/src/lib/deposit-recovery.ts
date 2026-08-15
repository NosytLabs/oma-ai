import { parseAbi, getAddress, formatUnits } from "viem";
import { db } from "../db/client.js";
import { creditBalances, deposits } from "../db/schema.js";
import { eq, and, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { logPaymentEvent } from "./payment-observability.js";

const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" as const;
const USDC_DECIMALS = 6;
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
		client: DepositRecoveryClient,
		event: TransferEvent,
		depositAddress: string,
): Promise<void> {
		const { transactionHash, args } = event;
		const txHash = transactionHash;
		const startedAt = Date.now();

		if (args.to.toLowerCase() !== depositAddress.toLowerCase()) return;

		const amountUsdCents = Math.round(Number(formatUnits(args.value, USDC_DECIMALS)) * 100);
		if (amountUsdCents < MIN_DEPOSIT_CENTS) {
				logger.debug({ txHash, amountUsdCents }, "[deposit-recovery] skipping dust transfer");
				return;
		}

		// Deposits are attributed by the authenticated wallet flow: the user
		// connects their wallet in the app and submits txHash + fromAddress after
		// signing the transfer. A transfer that was never recorded has no owner —
		// the legacy memo-in-calldata rail was removed. Never auto-credit here.
		const [existingDeposit] = await db
				.select()
				.from(deposits)
				.where(eq(deposits.txHash, txHash))
				.limit(1);

		const userId = existingDeposit?.userId ?? null;

		if (!userId) {
				logger.debug({ txHash }, "[deposit-recovery] no recorded deposit for txHash, skipping (wallet-submitted deposits only)");
				return;
		}

		if (existingDeposit) {
				if (existingDeposit.status === "completed") {
						logPaymentEvent({
								kind: "usdc_deposit",
								outcome: "double_spend_blocked",
								userId,
								amountCents: amountUsdCents,
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
										.set({ status: "failed" })
										.where(eq(deposits.id, existingDeposit.id));
								logPaymentEvent({
										kind: "usdc_deposit",
										outcome: "attribution_mismatch",
										userId,
										amountCents: amountUsdCents,
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

		await db.transaction(async (tx) => {
				const claimed = await tx
						.update(deposits)
						.set({
								status: "completed",
								completedAt: new Date(),
								creditsIssued: existingDeposit.amountUsd,
						})
						.where(and(eq(deposits.id, existingDeposit.id), eq(deposits.status, "pending")))
						.returning({ id: deposits.id });
				if (claimed.length === 0) {
						logPaymentEvent({
								kind: "usdc_deposit",
								outcome: "double_spend_blocked",
								userId,
								amountCents: amountUsdCents,
								signature: txHash,
								latencyMs: Date.now() - startedAt,
						});
						return;
				}

				await tx
						.insert(creditBalances)
						.values({
								userId,
								balanceCents: Math.round(Number(existingDeposit.amountUsd) * 100).toString(),
								totalDepositedCents: Math.round(Number(existingDeposit.amountUsd) * 100).toString(),
								totalUsedCents: "0",
								lastActivityAt: new Date(),
						})
						.onConflictDoUpdate({
								target: creditBalances.userId,
								set: {
										balanceCents: sql`${creditBalances.balanceCents} + ${Math.round(Number(existingDeposit.amountUsd) * 100)}`,
										totalDepositedCents: sql`${creditBalances.totalDepositedCents} + ${Math.round(Number(existingDeposit.amountUsd) * 100)}`,
										lastActivityAt: new Date(),
										updatedAt: new Date(),
								},
						});

				logPaymentEvent({
						kind: "usdc_deposit",
						outcome: "settled",
						userId,
						amountCents: amountUsdCents,
						signature: txHash,
						latencyMs: Date.now() - startedAt,
				});
				logger.info({ txHash, userId, depositId: existingDeposit.id, amountUsdCents }, "[deposit-recovery] marked pending deposit as completed and credited balance");
				});
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

				for (const log of logs) {
						try {
								const event = log as unknown as TransferEvent;
								await processTransfer(client, event, depositAddress);
						} catch (err) {
								logger.error({ err, txHash: log.transactionHash }, "[deposit-recovery] failed to process transfer, continuing");
						}
				}

				return currentBlock;
		} catch (err) {
				logger.error({ err, fromBlock }, "[deposit-recovery] iteration failed, will retry from same block");
				return fromBlock;
		}
}