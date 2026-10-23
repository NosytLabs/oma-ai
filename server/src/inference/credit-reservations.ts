import { sql } from "drizzle-orm";
import { db } from "../db/client.js";
import { getModelById } from "./models.js";
import { getModelPricing, pricingForContext } from "./billing-service.js";
import { buildFallbackChain } from "./fallback.js";
import { boundedDefaultOutput } from "./token-utils.js";
import { ProviderError, isModelPrivacyAllowed, resolveProvider } from "./provider-route.js";

export type BillingTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

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
		const held = await tx.execute(sql`UPDATE inference_credit_reservations SET state=${release ? "released" : "reconciliation"},updated_at=NOW()
			WHERE request_id=${requestId} AND state='held' RETURNING user_id,reserved_cents`);
		if (release && held.rows.length) {
			const row = held.rows[0];
			await tx.execute(sql`UPDATE credit_balances SET balance_cents=balance_cents+${String(row.reserved_cents)}::numeric,updated_at=NOW() WHERE user_id=${String(row.user_id)}`);
		}
		await tx.execute(sql`UPDATE inference_financial_receipts SET state=${release ? "released" : "reconciliation"},updated_at=NOW()
			WHERE request_id=${requestId} AND state='held'`);
	});
}

/** Detached, content-free evidence remains even if the account vanishes while
 * the provider is running. Settled/released receipts are never overwritten by
 * late cancellation or duplicated billing callbacks. */
export async function recordFinancialOutcome(tx: BillingTransaction, data: {
	requestId: string; model: string; provider: string; providerResponseId?: string;
	promptTokens: number; outputTokens: number; costCents: number; chargedCents: number;
	costKnown: boolean; usageVerified: boolean; state: "settled" | "reconciliation";
}): Promise<void> {
	await tx.execute(sql`UPDATE inference_financial_receipts SET model=${data.model},provider=${data.provider},provider_response_id=${data.providerResponseId?.slice(0,256) ?? null},
		input_tokens=${data.promptTokens},output_tokens=${data.outputTokens},cost_cents=${data.costCents.toFixed(8)}::numeric,charged_cents=${data.chargedCents.toFixed(8)}::numeric,
		cost_known=${data.costKnown},usage_verified=${data.usageVerified},state=${data.state},updated_at=NOW()
		WHERE request_id=${data.requestId} AND state IN ('held','reconciliation')`);
}

/** Called in the same transaction as the unique usage receipt. */
export async function settleInferenceReservation(tx: BillingTransaction, userId: string, requestId: string, chargeCents: number, completed: boolean): Promise<boolean> {
	const result = await tx.execute(sql`SELECT user_id,reserved_cents,state FROM inference_credit_reservations WHERE request_id=${requestId} FOR UPDATE`);
	const hold = result.rows[0];
	if (!hold || hold.user_id !== userId || hold.state !== "held") throw new ProviderError("Credit reservation requires reconciliation", 503);
	if (!completed) {
		await tx.execute(sql`UPDATE inference_credit_reservations SET state='reconciliation',updated_at=NOW() WHERE request_id=${requestId}`);
		return true;
	}
	const ledgerUnits = (value: string) => {
		const [whole, fraction = ""] = value.split(".");
		return BigInt(whole!) * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
	};
	const charge = chargeCents.toFixed(8);
	const reserved = ledgerUnits(String(hold.reserved_cents));
	const charged = ledgerUnits(charge);
	if (charged > reserved) {
		await tx.execute(sql`UPDATE inference_credit_reservations SET state='reconciliation',updated_at=NOW() WHERE request_id=${requestId}`);
		return false;
	}
	const unused = reserved - charged;
	const refund = `${unused / 100_000_000n}.${(unused % 100_000_000n).toString().padStart(8, "0")}`;
	await tx.execute(sql`UPDATE credit_balances SET balance_cents=balance_cents+${refund}::numeric,
		total_used_cents=total_used_cents+${charge}::numeric,last_activity_at=NOW(),updated_at=NOW() WHERE user_id=${userId}`);
	await tx.execute(sql`UPDATE inference_credit_reservations SET state='settled',updated_at=NOW() WHERE request_id=${requestId}`);
	return true;
}
