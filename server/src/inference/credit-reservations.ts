import { sql } from "drizzle-orm";
import { RESERVATION_STATE } from "../lib/credit-reservation-state.js";
import { db } from "../db/client.js";
import { logger } from "../lib/logger.js";
import { getModelById } from "./models.js";
import { getModelPricing, pricingForContext } from "./billing-service.js";
import { buildFallbackChain } from "./fallback.js";
import { boundedDefaultOutput } from "./token-utils.js";
import { ProviderError, isModelPrivacyAllowed, resolveProvider } from "./provider-route.js";

type BillingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Decimal-string cents to integer ledger units (1e-8 cent). BigInt, so a
 * one-unit boundary is exact — the same arithmetic the settle path uses. */
function ledgerUnits(value: string): bigint {
	const [whole, fraction = ""] = value.split(".");
	return BigInt(whole!) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
}

/** Ledger units back to the ledger's 8-decimal string shape. */
function formatLedgerUnits(units: bigint): string {
	return `${units / 100_000_000n}.${(units % 100_000_000n).toString().padStart(8, "0")}`;
}

/** Provider tokenizers/framing have no verified local bound. Reserve each
 * candidate's full catalog context window for input (including tools/media),
 * plus the explicit output budget. Unknown windows fail closed. */
export function reservationQuote(opts: {
	modelId: string; clientFallbacks?: string[]; allowedModels?: string[] | null;
	messages: unknown[]; tools?: unknown[]; max_tokens?: number;
}): { cents: number; maxTokens: number; pricingSnapshot: unknown[] } {
	const primary = getModelById(opts.modelId);
	if (!primary) throw new ProviderError("Model not found", 404);
	if (opts.allowedModels && !opts.allowedModels.includes(opts.modelId)) throw new ProviderError("This API key does not allow the requested model", 403, true);
	if (!isModelPrivacyAllowed(primary)) throw new ProviderError("This model is temporarily unavailable under the current privacy policy. Choose a private model.", 503);
	const maxTokens = opts.max_tokens ?? boundedDefaultOutput(primary);
	if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || (primary.maxOutputTokens && maxTokens > primary.maxOutputTokens)) throw new ProviderError("Invalid max_tokens for this model", 400, true);
	let cents = 0;
	const pricingSnapshot: unknown[] = [];
	for (const id of buildFallbackChain(opts.modelId, opts.clientFallbacks)) {
		if (opts.allowedModels && !opts.allowedModels.includes(id)) continue;
		const model = getModelById(id)!;
		if (!isModelPrivacyAllowed(model)) continue;
		if (model.disabledReason) continue;
		try { resolveProvider(model.provider, model); } catch (error) {
			if (error instanceof ProviderError && error.executionRejected) continue;
			throw error;
		}
		if (model.maxOutputTokens && maxTokens > model.maxOutputTokens) continue;
		const promptBound = model.contextWindow;
		if (!promptBound || !Number.isSafeInteger(promptBound)) throw new ProviderError("This request has no safe prepaid token bound", 400);
		const pricing = getModelPricing(id);
		pricingSnapshot.push({ model: id, provider: model.provider, contextWindow: promptBound, maxOutputTokens: maxTokens, pricing });
		for (const tier of [pricing, pricingForContext(pricing, promptBound)]) {
			const quote = ((promptBound * tier.inputPer1M + maxTokens * tier.outputPer1M) / 1_000_000) * 100 * (1 + tier.markup / 100);
			if (!Number.isFinite(quote) || quote < 0) throw new ProviderError("Model pricing is unavailable", 503);
			cents = Math.max(cents, quote);
		}
	}
	if (!pricingSnapshot.length) throw new ProviderError("This model has no configured eligible provider route", 503, true);
	// Round upward to the ledger's precision; never reserve less due to rounding.
	return { cents: Math.ceil(cents * 1e8) / 1e8, maxTokens, pricingSnapshot };
}

export async function reserveInferenceCredits(userId: string, requestId: string, cents: number, intent?: { requestedModel: string; pricingSnapshot: unknown[] }): Promise<void> {
	const amount = cents.toFixed(8);
	await db.transaction(async tx => {
		const held = await tx.execute(sql`INSERT INTO inference_credit_reservations(request_id,user_id,reserved_cents)
			VALUES (${requestId},${userId},${amount}::numeric) ON CONFLICT DO NOTHING RETURNING request_id`);
		if (!held.rows.length) throw new ProviderError("This request already has a credit reservation", 409);
		const debited = await tx.execute(sql`UPDATE credit_balances SET balance_cents=balance_cents-${amount}::numeric, updated_at=NOW()
			WHERE user_id=${userId} AND balance_cents>=${amount}::numeric RETURNING user_id`);
		if (!debited.rows.length) throw new ProviderError(`Insufficient credits. Add credits to continue (temporary maximum hold: $${(cents / 100).toFixed(4)}).`, 402);
		await tx.execute(sql`INSERT INTO inference_financial_receipts(request_id,requested_model,reserved_cents,pricing_snapshot)
			VALUES (${requestId},${intent?.requestedModel ?? null},${amount}::numeric,${JSON.stringify(intent?.pricingSnapshot ?? [])}::jsonb)`);
	});
}

/** Safe releases require evidence inference was rejected before execution.
 * Ambiguous network errors, provider timeouts and stream cancellations retain
 * the hold for reconciliation; never silently refund a possible provider bill. */
export async function failInferenceReservation(requestId: string, release: boolean): Promise<void> {
	await db.transaction(async tx => {
		const held = await tx.execute(sql`UPDATE inference_credit_reservations SET state=${release ? RESERVATION_STATE.Released : RESERVATION_STATE.Reconciliation},updated_at=NOW()
			WHERE request_id=${requestId} AND state=${RESERVATION_STATE.Held} RETURNING user_id,reserved_cents`);
		if (release && held.rows.length) {
			const row = held.rows[0];
			await tx.execute(sql`UPDATE credit_balances SET balance_cents=balance_cents+${String(row.reserved_cents)}::numeric,updated_at=NOW() WHERE user_id=${String(row.user_id)}`);
		}
		await tx.execute(sql`UPDATE inference_financial_receipts SET state=${release ? RESERVATION_STATE.Released : RESERVATION_STATE.Reconciliation},updated_at=NOW()
			WHERE request_id=${requestId} AND state=${RESERVATION_STATE.Held}`);
	});
}

/** Detached, content-free evidence remains even if the account vanishes while
 * the provider is running. Settled/released receipts are never overwritten by
 * late cancellation or duplicated billing callbacks. */
export async function recordFinancialOutcome(tx: BillingTransaction, data: {
	requestId: string; model: string; provider: string; providerResponseId?: string;
	promptTokens: number; outputTokens: number; costCents: number; chargedCents: number;
	costKnown: boolean; usageVerified: boolean;
	state: typeof RESERVATION_STATE.Settled | typeof RESERVATION_STATE.Reconciliation;
}): Promise<void> {
	await tx.execute(sql`UPDATE inference_financial_receipts SET model=${data.model},provider=${data.provider},provider_response_id=${data.providerResponseId?.slice(0,256) ?? null},
		input_tokens=${data.promptTokens},output_tokens=${data.outputTokens},cost_cents=${data.costCents.toFixed(8)}::numeric,charged_cents=${data.chargedCents.toFixed(8)}::numeric,
		cost_known=${data.costKnown},usage_verified=${data.usageVerified},state=${data.state},updated_at=NOW()
		WHERE request_id=${data.requestId} AND state IN (${RESERVATION_STATE.Held}, ${RESERVATION_STATE.Reconciliation})`);
}

/** Called in the same transaction as the unique usage receipt. */
export async function settleInferenceReservation(tx: BillingTransaction, userId: string, requestId: string, chargeCents: number, completed: boolean): Promise<boolean> {
	const result = await tx.execute(sql`SELECT user_id,reserved_cents,state FROM inference_credit_reservations WHERE request_id=${requestId} FOR UPDATE`);
	const hold = result.rows[0];
	if (!hold || hold.user_id !== userId || hold.state !== RESERVATION_STATE.Held) throw new ProviderError("Credit reservation requires reconciliation", 503);
	if (!completed) {
		await tx.execute(sql`UPDATE inference_credit_reservations SET state=${RESERVATION_STATE.Reconciliation},updated_at=NOW() WHERE request_id=${requestId}`);
		return true;
	}
	const charge = chargeCents.toFixed(8);
	const reserved = ledgerUnits(String(hold.reserved_cents));
	const charged = ledgerUnits(charge);
	if (charged > reserved) {
		await tx.execute(sql`UPDATE inference_credit_reservations SET state=${RESERVATION_STATE.Reconciliation},updated_at=NOW() WHERE request_id=${requestId}`);
		return false;
	}
	const unused = reserved - charged;
	const refund = formatLedgerUnits(unused);
	await tx.execute(sql`UPDATE credit_balances SET balance_cents=balance_cents+${refund}::numeric,
		total_used_cents=total_used_cents+${charge}::numeric,last_activity_at=NOW(),updated_at=NOW() WHERE user_id=${userId}`);
	await tx.execute(sql`UPDATE inference_credit_reservations SET state=${RESERVATION_STATE.Settled},updated_at=NOW() WHERE request_id=${requestId}`);
	return true;
}

/**
 * The charge a reconciliation resolution may settle at, as an 8-decimal
 * ledger string. An explicit operator charge wins; otherwise the receipt's
 * recorded `charged_cents` is the evidence. A charge above the hold is
 * refused — the hold stays in reconciliation for a human decision, exactly
 * as the settle path refuses an overcharge. Pure, so the money arithmetic
 * is unit-testable without a database.
 */
export function resolveReconciliationCharge(
	reservedCents: string,
	receiptChargedCents: string | null | undefined,
	requestedChargeCents?: number,
): string {
	let charge: string;
	if (requestedChargeCents !== undefined) {
		if (!Number.isFinite(requestedChargeCents) || requestedChargeCents < 0) {
			throw new ProviderError("Charge must be a finite, non-negative amount", 400, true);
		}
		charge = requestedChargeCents.toFixed(8);
	} else {
		if (receiptChargedCents == null) {
			throw new ProviderError("No financial receipt records a charge for this hold; pass an explicit chargeCents or release the hold", 409);
		}
		charge = formatLedgerUnits(ledgerUnits(String(receiptChargedCents)));
	}
	if (ledgerUnits(charge) > ledgerUnits(reservedCents)) {
		throw new ProviderError("Charge exceeds the reserved hold; the hold stays in reconciliation", 409);
	}
	return charge;
}

export interface ReconciliationResolutionResult {
	requestId: string;
	outcome: typeof RESERVATION_STATE.Settled | typeof RESERVATION_STATE.Released;
	chargedCents: string;
	refundedCents: string;
}

/**
 * The exit `reconciliation` never had. Until now a hold parked here kept the
 * user's credits forever: settle refused non-`held` rows, the fail path only
 * matched `held`, and the admin surface was read-only — only manual SQL
 * could free the money.
 *
 * `settle` charges the receipt's recorded charge (or an explicit operator
 * charge), refunds the unused remainder of the hold, and moves BOTH tables
 * to `settled` in one transaction. `release` refunds the whole hold and
 * moves both to `released` — an explicit operator decision, never an
 * automatic one: the provider may have billed, so nothing but a human (or
 * the evidence-based sweep below) may choose it. Guarded by
 * `state='reconciliation'` under a row lock, so a duplicate or late call
 * cannot double-refund.
 */
export async function resolveReconciliationReservation(
	requestId: string,
	resolution: { action: "settle"; chargeCents?: number } | { action: "release" },
): Promise<ReconciliationResolutionResult> {
	return db.transaction(async tx => {
		const result = await tx.execute(sql`SELECT user_id,reserved_cents,state FROM inference_credit_reservations WHERE request_id=${requestId} FOR UPDATE`);
		const hold = result.rows[0];
		if (!hold) throw new ProviderError("Credit hold not found", 404);
		if (hold.state !== RESERVATION_STATE.Reconciliation) throw new ProviderError("Credit hold is not in reconciliation", 409);
		const userId = String(hold.user_id);
		const reserved = String(hold.reserved_cents);

		if (resolution.action === "release") {
			await tx.execute(sql`UPDATE credit_balances SET balance_cents=balance_cents+${reserved}::numeric,updated_at=NOW() WHERE user_id=${userId}`);
			await tx.execute(sql`UPDATE inference_credit_reservations SET state=${RESERVATION_STATE.Released},updated_at=NOW() WHERE request_id=${requestId} AND state=${RESERVATION_STATE.Reconciliation}`);
			await tx.execute(sql`UPDATE inference_financial_receipts SET state=${RESERVATION_STATE.Released},updated_at=NOW() WHERE request_id=${requestId} AND state IN (${RESERVATION_STATE.Held}, ${RESERVATION_STATE.Reconciliation})`);
			return { requestId, outcome: RESERVATION_STATE.Released, chargedCents: "0.00000000", refundedCents: formatLedgerUnits(ledgerUnits(reserved)) };
		}

		const receipt = await tx.execute(sql`SELECT charged_cents FROM inference_financial_receipts WHERE request_id=${requestId}`);
		const charge = resolveReconciliationCharge(
			reserved,
			receipt.rows[0] ? String(receipt.rows[0].charged_cents) : null,
			resolution.chargeCents,
		);
		const refund = formatLedgerUnits(ledgerUnits(reserved) - ledgerUnits(charge));
		await tx.execute(sql`UPDATE credit_balances SET balance_cents=balance_cents+${refund}::numeric,
			total_used_cents=total_used_cents+${charge}::numeric,last_activity_at=NOW(),updated_at=NOW() WHERE user_id=${userId}`);
		await tx.execute(sql`UPDATE inference_credit_reservations SET state=${RESERVATION_STATE.Settled},updated_at=NOW() WHERE request_id=${requestId} AND state=${RESERVATION_STATE.Reconciliation}`);
		await tx.execute(sql`UPDATE inference_financial_receipts SET state=${RESERVATION_STATE.Settled},charged_cents=${charge}::numeric,updated_at=NOW() WHERE request_id=${requestId} AND state IN (${RESERVATION_STATE.Held}, ${RESERVATION_STATE.Reconciliation})`);
		return { requestId, outcome: RESERVATION_STATE.Settled, chargedCents: charge, refundedCents: refund };
	});
}

/**
 * Auto-settle the reconciliation rows whose evidence already arrived: the
 * financial receipt is `settled` (a recorded outcome with a recorded
 * charge) while the reservation row is still parked. Each row resolves
 * through the same writer the admin API uses, at the receipt's charge; a
 * row whose recorded charge exceeds its hold is skipped and left for a
 * human. Never throws — it runs on the settlement-drain schedule.
 */
export async function sweepReconciledReservations(limit = 50): Promise<{ scanned: number; settled: number; skipped: number }> {
	let due: { rows: Record<string, unknown>[] };
	try {
		due = await db.execute(sql`SELECT r.request_id AS "requestId" FROM inference_credit_reservations r
			JOIN inference_financial_receipts f ON f.request_id=r.request_id
			WHERE r.state=${RESERVATION_STATE.Reconciliation} AND f.state=${RESERVATION_STATE.Settled}
			ORDER BY r.updated_at LIMIT ${limit}`);
	} catch (err) {
		logger.error({ err }, "[reconciliation] could not read reconcilable reservations");
		return { scanned: 0, settled: 0, skipped: 0 };
	}
	let settled = 0;
	let skipped = 0;
	for (const row of due.rows) {
		const requestId = String(row.requestId);
		try {
			await resolveReconciliationReservation(requestId, { action: "settle" });
			settled++;
		} catch (err) {
			skipped++;
			logger.warn({ err, requestId }, "[reconciliation] sweep left a reservation for manual resolution");
		}
	}
	if (settled > 0) logger.info({ settled, skipped, scanned: due.rows.length }, "[reconciliation] sweep settled evidence-backed reservations");
	return { scanned: due.rows.length, settled, skipped };
}
