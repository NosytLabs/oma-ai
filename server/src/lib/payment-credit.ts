import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { creditBalances, deposits, paymentCreditClaims, paymentCreditPolicy } from "../db/schema.js";
import { config } from "../config.js";
import { getPublicClient } from "./rpc-client.js";
import { paymentCreditAmounts } from "../x402/funding-recovery.js";

export class PaymentCreditConflictError extends Error {
	readonly status = 409;
	constructor(message: string, readonly code: "payment_already_credited" | "payment_reconciliation_required") {
		super(message);
		this.name = "PaymentCreditConflictError";
	}
}

interface ConfirmedPayment {
	userId: string;
	txHash: string;
	amountUsd: string;
	payFrom: string;
	depositAddress: string;
}

/** Call only after verifying a Base USDC transfer and its authenticated owner. */
export async function creditConfirmedUsdcPayment(payment: ConfirmedPayment): Promise<{ creditedCents: number; alreadyCredited: boolean }> {
	const txHash = payment.txHash.toLowerCase();
	const amount = paymentCreditAmounts(payment.amountUsd);
	const claimKey = and(eq(paymentCreditClaims.networkId, "base"), eq(paymentCreditClaims.txHash, txHash));
	const previouslyCredited = (claim: { creditedUserId: string; creditedCents: string }) => {
		if (claim.creditedUserId !== payment.userId) throw new PaymentCreditConflictError("Payment already credited to another account", "payment_already_credited");
		return { creditedCents: Number(claim.creditedCents), alreadyCredited: true };
	};

	return db.transaction(async (tx) => {
		const [previous] = await tx.select().from(paymentCreditClaims).where(claimKey).limit(1);
		if (previous) return previouslyCredited(previous);

		// A row lock also serializes this helper with the existing deposit watcher.
		const [deposit] = await tx.select().from(deposits)
			.where(sql`lower(${deposits.txHash}) = ${txHash}`).limit(1).for("update");
		if (deposit && deposit.userId !== payment.userId) throw new PaymentCreditConflictError("Payment already recorded for another account", "payment_already_credited");
		if (deposit?.fromAddress && deposit.fromAddress.toLowerCase() !== payment.payFrom.toLowerCase()) throw new PaymentCreditConflictError("Payment requires manual reconciliation: recorded sender differs from confirmed sender", "payment_reconciliation_required");

		const alreadyCompleted = deposit?.status === "completed" || deposit?.status === "refunded";
		if (!alreadyCompleted) {
			const mock = config.FACILITATOR_MODE === "mock" && ["development", "test"].includes(config.NODE_ENV);
			if (!mock) {
				const [policy] = await tx.select().from(paymentCreditPolicy).where(eq(paymentCreditPolicy.networkId, "base")).limit(1);
				if (!policy) throw new Error("Payment credit policy is missing; apply the durable credit migration");
				const client = getPublicClient();
				const receipt = await client.getTransactionReceipt({ hash: txHash as `0x${string}` });
				if (receipt.status !== "success" || !receipt.blockHash) throw new Error("Payment is not confirmed on chain");
				const block = await client.getBlock({ blockHash: receipt.blockHash });
				if (Number(block.timestamp) * 1000 < policy.recoveryNotBefore.getTime()) {
					throw new PaymentCreditConflictError("Payment predates durable credit records and requires manual reconciliation. Contact support with the transaction hash.", "payment_reconciliation_required");
				}
			}
		}

		const credits = alreadyCompleted ? paymentCreditAmounts(deposit.amountUsd).credits : amount.credits;
		const claimed = await tx.insert(paymentCreditClaims).values({
			networkId: "base", txHash, creditedUserId: payment.userId, creditedCents: credits,
		}).onConflictDoNothing({ target: [paymentCreditClaims.networkId, paymentCreditClaims.txHash] }).returning();
		if (claimed.length === 0) {
			const [winner] = await tx.select().from(paymentCreditClaims).where(claimKey).limit(1);
			if (!winner) throw new Error("Payment credit claim could not be read");
			return previouslyCredited(winner);
		}
		if (alreadyCompleted) return { creditedCents: Number(credits), alreadyCredited: true };

		const data = {
			userId: payment.userId, type: "usdc_direct" as const, amountUsd: amount.amountUsd,
			creditsIssued: credits, fromAddress: payment.payFrom.toLowerCase(), txHash,
			depositAddress: payment.depositAddress, status: "completed" as const, completedAt: new Date(),
		};
		if (deposit) await tx.update(deposits).set(data).where(eq(deposits.id, deposit.id));
		else await tx.insert(deposits).values(data);
		await tx.insert(creditBalances).values({
			userId: payment.userId, balanceCents: credits, totalDepositedCents: credits, totalUsedCents: "0", lastActivityAt: new Date(),
		}).onConflictDoUpdate({ target: creditBalances.userId, set: {
			balanceCents: sql`${creditBalances.balanceCents}::numeric + ${credits}::numeric`,
			totalDepositedCents: sql`${creditBalances.totalDepositedCents}::numeric + ${credits}::numeric`,
			lastActivityAt: new Date(), updatedAt: new Date(),
		} });
		return { creditedCents: amount.creditedCents, alreadyCredited: false };
	});
}
