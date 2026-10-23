/**
	* Billing — credit deduction, usage recording, and balance checks.
	*
	* Extracted from proxy.ts for focused responsibility.
	*/
import { db } from "../db/client.js";
import { creditBalances, usageRecords } from "../db/schema.js";
import { auditLog } from "../middleware/audit.js";
import { logger } from "../lib/logger.js";
import { and, eq, sql } from "drizzle-orm";
import { getModelPricing, pricingForContext } from "./billing-service.js";
import { ProviderError } from "./provider-route.js";
import { settleInferenceReservation, recordFinancialOutcome } from "./credit-reservations.js";

export type UsageProvider = "venice" | "litellm" | "tinyfish" | "surplus" | "oma-ai";

export interface RecordUsageArgs {
	userId: string;
	/** The model that actually SERVED the request (post-failover). */
	model: string;
	/** The model the client asked for. Enables failover-rate reporting. */
	requestedModel?: string;
	provider: UsageProvider;
	/** Operator-facing routing label: "direct" | "fallback" | "free-website". */
	routedVia?: string;
	/** Upstream attempts made; >1 means the request failed over. */
	attemptCount?: number;
	promptTokens: number;
	outputTokens: number;
	pricing: ReturnType<typeof getModelPricing>;
	requestId: string;
	status: "completed" | "error" | "aborted";
	/**
	 * Epoch ms captured when the request entered the handler, so latency_ms
	 * measures the whole round-trip including the upstream stream.
	 * Without it `latency_ms` stayed NULL forever.
	 */
	startedAt?: number;
	/** Skip credit deduction for free website chat */
	skipBilling?: boolean;
	/** API key row id when the caller authenticated with Bearer oma_sk_*.
	 * Null for session/guest website chat. Lets analytics tell paid API
	 * traffic apart from free website traffic on the same model. */
	apiKeyId?: string | null;
	/** This paid request reserved its maximum charge before inference. */
	reservation?: boolean;
	/** Upstream response reference for cost reconciliation; no prompt content. */
	providerResponseId?: string;
	usageVerified?: boolean;
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
		pricing = pricingForContext(pricing, promptTokens);
		const upstreamCostCents =
				((promptTokens / 1_000_000) * pricing.inputPer1M +
						(outputTokens / 1_000_000) * pricing.outputPer1M) *
				100;
		return upstreamCostCents * (1 + pricing.markup / 100);
}

/**
	* Legacy read-only affordability helper. Paid HTTP routes additionally reserve
	* credit atomically before inference; this helper alone does not admit work.
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
				.where(eq(creditBalances.userId, userId))
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

/**
	* Conditionally deduct `costCents` from the user balance.
	* Returns true when a row was updated (balance was sufficient).
	* Never floors below zero and never re-seeds free-trial credits.
	*/
export async function deductCreditsIfSufficient(
		userId: string,
		costCents: number,
		tx: Parameters<Parameters<typeof db.transaction>[0]>[0] = db as never,
): Promise<boolean> {
		if (costCents <= 0) return true;
		// Match numeric(18,8); four decimals erase short $0.02/M requests.
		const cost = costCents.toFixed(8);
		const updated = await tx
				.update(creditBalances)
				.set({
						balanceCents: sql`${creditBalances.balanceCents}::numeric - ${cost}::numeric`,
						totalUsedCents: sql`${creditBalances.totalUsedCents}::numeric + ${cost}::numeric`,
						lastActivityAt: sql`NOW()`,
				})
				.where(
						and(
								eq(creditBalances.userId, userId),
								sql`${creditBalances.balanceCents}::numeric >= ${cost}::numeric`,
						),
				)
				.returning({ userId: creditBalances.userId });
		return updated.length > 0;
}

/** Record usage, deduct credits, and emit an audit log entry. */
export async function recordUsage(args: RecordUsageArgs): Promise<void> {
		const {
				userId,
				model,
				requestedModel,
				provider,
				routedVia,
				attemptCount,
				promptTokens,
				outputTokens,
				pricing,
				requestId,
				status,
				startedAt,
				skipBilling = false,
				apiKeyId = null,
			} = args;
			const totalTokens = promptTokens + outputTokens;
			// Wall-clock latency for the whole request, including the streamed
			// upstream call. `latency_ms` existed on the table from day one but was
			// never written, so every "which provider is slow?" query returned NULL.
			const latencyMs =
				typeof startedAt === "number" && startedAt > 0
					? Math.max(0, Date.now() - startedAt)
					: null;
		// Pricing fields are in DOLLARS per 1M tokens; multiply by 100 for cents.
		const appliedPricing = pricingForContext(pricing, promptTokens);
		const upstreamCostCents = appliedPricing.costKnown === false ? 0 :
			((promptTokens / 1_000_000) * (appliedPricing.costInputPer1M ?? appliedPricing.inputPer1M) +
			 (outputTokens / 1_000_000) * (appliedPricing.costOutputPer1M ?? appliedPricing.outputPer1M)) * 100;
		const userCostCents = estimateUserCostCents(appliedPricing, promptTokens, outputTokens);
		const shouldCharge = status === "completed" && !skipBilling;
		const markupCents = appliedPricing.costKnown === false ? 0 : (shouldCharge ? userCostCents : 0) - upstreamCostCents;

		// Anonymous free-tier requests have no BetterAuth user. The DB schema
		// enforces a FK on usage_records.user_id, and there's no credit balance
		// to deduct. The daily-limit middleware already tracks anon usage in
		// Redis. Skip the DB write entirely for anon to avoid the FK throw.
		const isAnonymous = userId === "anonymous" || !userId;
		const financialOutcome = {
			requestId, model, provider, providerResponseId: args.providerResponseId,
			promptTokens, outputTokens, costCents: upstreamCostCents,
			costKnown: appliedPricing.costKnown !== false, usageVerified: args.usageVerified ?? false,
		};

		let deductionRejected = false;
		let reservationRejected = false;
				let duplicateRecord = false;
					try {
					await db.transaction(async (tx) => {
						// Only persist usage for authenticated users. Anonymous free-tier
						// is tracked in Redis by the daily-limit middleware.
						if (isAnonymous) return;

						// MONEY SAFETY (P0): claim the request_id FIRST, before touching
						// the balance. `uq_usage_request_id` makes this insert the
						// serialization point for a requestId:
						//
						//   - First caller wins the insert and proceeds to deduct.
						//   - A duplicate caller gets 0 rows back, returns immediately,
						//     and NEVER deducts.
						//
						// The previous order (deduct, then insert) let any double-record
						// path charge twice: the insert raised a unique-violation AFTER
						// the deduction had already been committed by its own statement,
						// the transaction rolled back only the insert, and the catch
						// swallowed the error — the user was billed twice and the ledger
						// kept one row. createStreamingProxy has three recordUsage call
						// sites (done / read-error / client-abort) reachable in the same
						// lifetime, and the idempotency-key replay path is a second.
						const claimed = await tx
							.insert(usageRecords)
							.values({
								requestId,
								providerResponseId: args.providerResponseId?.slice(0, 256) ?? null,
								usageVerified: args.usageVerified ?? false,
								userId,
								apiKeyId,
								model,
								requestedModel: requestedModel ?? null,
								provider,
								routedVia: routedVia ?? null,
								attemptCount: attemptCount ?? 1,
								inputTokens: promptTokens,
								outputTokens,
								costCents: upstreamCostCents.toFixed(8),
								markupCents: markupCents.toFixed(8),
								totalCents: shouldCharge ? userCostCents.toFixed(8) : "0",
								latencyMs,
								status: skipBilling && status === "completed" ? "free_tier" : status,
							})
							.onConflictDoNothing({ target: usageRecords.requestId })
							.returning({ requestId: usageRecords.requestId });

						// Already recorded by a concurrent or earlier call for this
										// requestId. The row is the receipt; do not charge again.
										if (claimed.length === 0) {
											duplicateRecord = true;
											logger.info(
												{ userId, requestId },
												"[billing] usage already recorded for requestId — skipping duplicate charge",
											);
											return;
										}

						if (args.reservation) {
							reservationRejected = !await settleInferenceReservation(tx, userId, requestId, userCostCents, shouldCharge);
							if (reservationRejected) await tx.update(usageRecords).set({ status: "error", totalCents: "0", markupCents: appliedPricing.costKnown === false ? "0" : (-upstreamCostCents).toFixed(8) }).where(eq(usageRecords.requestId, requestId));
							await recordFinancialOutcome(tx, { ...financialOutcome, chargedCents: shouldCharge && !reservationRejected ? userCostCents : 0, state: shouldCharge && !reservationRejected ? "settled" : "reconciliation" });
						} else if (shouldCharge) {
							const deducted = await deductCreditsIfSufficient(
								userId,
								userCostCents,
								tx,
							);
							if (!deducted) {
								// Stream/completion already finished; do not invent balance.
								// Log so ops can reconcile — concurrent callers lost the race.
								deductionRejected = true;
								await tx.update(usageRecords).set({
									totalCents: "0",
									markupCents: appliedPricing.costKnown === false ? "0" : (-upstreamCostCents).toFixed(8),
								}).where(eq(usageRecords.requestId, requestId));
								logger.error(
									{
										userId,
										requestId,
										costCents: userCostCents.toFixed(8),
									},
									"[billing] deduction skipped: insufficient balance (race or missing ledger row)",
								);
							}
						}
					});
				if (reservationRejected) throw new ProviderError("Provider usage exceeded the prepaid limit; contact support with the request ID", 503);
				// Only claim a deduction that actually happened. When the guarded
				// UPDATE matched no rows (insufficient balance, or a concurrent
				// request won the race) the user was NOT charged, so recording
								// CREDIT_DEDUCTED would make the audit log contradict the ledger —
								// and hide a real reconciliation signal behind a success entry.
								//
								// A duplicate (already-recorded requestId) was likewise NOT
								// charged, so it must not log CREDIT_DEDUCTED either — that
								// would invent a charge in the audit trail that the ledger
								// never saw.
								// Free/failed/aborted requests are already recorded in usageRecords.
								// Only paid completion deductions and duplicates need ledger audit events.
								if (!isAnonymous && (shouldCharge || duplicateRecord)) await auditLog({
									userId,
									action: duplicateRecord
										? "USAGE_RECORD_DUPLICATE"
										: deductionRejected
											? "CREDIT_DEDUCTION_REJECTED"
											: "CREDIT_DEDUCTED",
									resource: "chat_completion",
									resourceId: requestId,
									metadata: {
										model,
										requestedModel: requestedModel ?? null,
										provider,
										routedVia: routedVia ?? null,
										attemptCount: attemptCount ?? 1,
										promptTokens,
										outputTokens,
										totalTokens,
										costCents: shouldCharge ? userCostCents.toFixed(8) : "0",
										upstreamCostKnown: appliedPricing.costKnown !== false,
										latencyMs,
										status,
									},
								});
							} catch (err) {
								logger.error({ err, requestId }, "[proxy] usage record failed");
								if (args.reservation) {
									await recordFinancialOutcome(db as never, { ...financialOutcome, chargedCents: 0, state: "reconciliation" }).catch(failure => logger.error({ err: failure, requestId }, "[billing] detached receipt requires reconciliation"));
									throw err;
								}
							}
						}
