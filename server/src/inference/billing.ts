/**
	* Billing — credit deduction, usage recording, and balance checks.
	*
	* Extracted from proxy.ts for focused responsibility.
	*/
import { config } from "../config.js";
import { db } from "../db/client.js";
import { creditBalances, usageRecords } from "../db/schema.js";
import { auditLog } from "../middleware/audit.js";
import { logger } from "../lib/logger.js";
import { sql } from "drizzle-orm";
import { getModelPricing } from "./billing-service.js";
import { ProviderError } from "./provider-route.js";

export interface RecordUsageArgs {
		userId: string;
		model: string;
		provider: "venice" | "oma-ai" | "litellm";
		promptTokens: number;
		outputTokens: number;
		pricing: ReturnType<typeof getModelPricing>;
		requestId: string;
		status: "completed" | "error";
		/** Skip credit deduction for free website chat */
		skipBilling?: boolean;
}

/**
	* Estimate the maximum charge for a request before contacting the provider.
	* Values are cents and intentionally use the requested max token budget as
	* the worst-case output bound.
	*/
function estimateUserCostCents(
		pricing: ReturnType<typeof getModelPricing>,
		promptTokens: number,
		maxOutputTokens?: number,
): number {
		const outputTokens = Math.max(0, maxOutputTokens ?? 0);
		const upstreamCostCents =
				((promptTokens / 1_000_000) * pricing.inputPer1M +
						(outputTokens / 1_000_000) * pricing.outputPer1M) *
				100;
		return upstreamCostCents * (1 + pricing.markup / 100);
}

/**
	* Preflight the authenticated credit balance. This is deliberately a read
	* only check; the transaction in recordUsage remains the authoritative final
	* deduction and protects against concurrent callers.
	*/
export async function assertSufficientBalance(
		userId: string,
		pricing: ReturnType<typeof getModelPricing>,
		promptTokens: number,
		maxOutputTokens?: number,
): Promise<void> {
		const [balance] = await db
				.select({ balanceCents: creditBalances.balanceCents })
				.from(creditBalances)
				.where(sql`${creditBalances.userId} = ${userId}`)
				.limit(1);
		const available = Number(balance?.balanceCents ?? 0);
		const estimated = estimateUserCostCents(pricing, promptTokens, maxOutputTokens);
		// A zero estimate can occur for a catalog entry with missing upstream
		// pricing; allow it through so the provider/config error remains visible.
		if (estimated > 0 && available < estimated) {
				throw new ProviderError(
						`Insufficient credits. Add credits to continue (estimated maximum: $${(estimated / 100).toFixed(4)}).`,
						402,
				);
		}
}

/** Record usage, deduct credits, and emit an audit log entry. */
export async function recordUsage(args: RecordUsageArgs): Promise<void> {
		const {
				userId,
				model,
				provider,
				promptTokens,
				outputTokens,
				pricing,
				requestId,
				status,
				skipBilling = false,
		} = args;
		const totalTokens = promptTokens + outputTokens;
		// Pricing fields are in DOLLARS per 1M tokens; multiply by 100 for cents.
		const upstreamCostCents =
				((promptTokens / 1_000_000) * pricing.inputPer1M +
				(outputTokens / 1_000_000) * pricing.outputPer1M) * 100;
		const markupMultiplier = 1 + pricing.markup / 100;
		const userCostCents = upstreamCostCents * markupMultiplier;
		const markupCents = userCostCents - upstreamCostCents;

		// Anonymous free-tier requests have no BetterAuth user. The DB schema
		// enforces a FK on usage_records.user_id, and there's no credit balance
		// to deduct. The daily-limit middleware already tracks anon usage in
		// Redis. Skip the DB write entirely for anon to avoid the FK throw.
		const isAnonymous = userId === "anonymous" || !userId;

		try {
				await db.transaction(async (tx) => {
						// Only deduct credits if not free website chat AND user is authed.
						// Upsert: seed a fresh credit row on first call (with the configured
						// free-trial cents) instead of silently letting the call go free when
						// the user has no balance row. Without this, every new user gets free
						// inference forever and the ledger never moves.
						if (status === "completed" && !skipBilling && !isAnonymous) {
								const freeTrialCents = Number(config.FREE_SIGNUP_CENTS ?? 0);
								const initialBalanceCents = Math.max(0, freeTrialCents - userCostCents);
								await tx
										.insert(creditBalances)
										.values({
												userId,
												balanceCents: initialBalanceCents.toFixed(4),
												totalDepositedCents: freeTrialCents.toFixed(4),
												totalUsedCents: userCostCents.toFixed(4),
										})
										.onConflictDoUpdate({
												target: creditBalances.userId,
												set: {
														balanceCents: sql`GREATEST(${creditBalances.balanceCents}::numeric - ${userCostCents.toFixed(4)}::numeric, 0)`,
														totalUsedCents: sql`${creditBalances.totalUsedCents}::numeric + ${userCostCents.toFixed(4)}::numeric`,
														lastActivityAt: sql`NOW()`,
												},
										});
						}
						// Only persist usage for authenticated users. Anonymous free-tier
						// is tracked in Redis by the daily-limit middleware.
						if (!isAnonymous) {
								await tx.insert(usageRecords).values({
										requestId,
										userId,
										model,
										provider,
										inputTokens: promptTokens,
										outputTokens,
										costCents: skipBilling ? "0" : upstreamCostCents.toFixed(4),
										markupCents: skipBilling ? "0" : markupCents.toFixed(4),
										totalCents: skipBilling ? "0" : userCostCents.toFixed(4),
										status: skipBilling ? "free_tier" : status,
								});
						}
				});
				await auditLog({
						userId,
						action: "USER_CREATED",
						resource: "chat_completion",
						resourceId: requestId,
						metadata: {
								model,
								provider,
								promptTokens,
								outputTokens,
								totalTokens,
								costCents: userCostCents.toFixed(4),
								status,
						},
				});
		} catch (err) {
				logger.error({ err, requestId }, "[proxy] usage record failed");
		}
}
