/**
 * Shared mock payloads for demo-mode browsing (`?demo=1` / oma-demo cookie).
 * Keep shapes aligned with live API types so UI renders without special-casing
 * beyond `isDemo` gates.
 */

import type { CreditTransaction } from "@/lib/api/credits";
import type {
	ApiKey,
	BalanceResponse,
	CreditBatch,
	Model,
	UsageRecord,
} from "@/lib/api/types";

export const DEMO_BALANCE: BalanceResponse = {
	balanceCents: "1250",
	totalDepositedCents: "2500",
	totalUsedCents: "1250",
	lastActivityAt: new Date(Date.now() - 3600000).toISOString(),
};

export const DEMO_API_KEYS: ApiKey[] = [
	{
		id: "demo-key-1",
		name: "demo-playground",
		prefix: "oma_sk_demo",
		createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
		lastUsedAt: new Date(Date.now() - 3600000).toISOString(),
	},
];

export const DEMO_USAGE: UsageRecord[] = [
	{
		id: "demo-u1",
		model: "llama-3.2-3b",
		provider: "venice",
		promptTokens: 420,
		completionTokens: 180,
		costCents: "4",
		latencyMs: 280,
		status: "ok",
		createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
	},
	{
		id: "demo-u2",
		model: "llama-3.3-70b",
		provider: "venice",
		promptTokens: 1200,
		completionTokens: 640,
		costCents: "120",
		latencyMs: 890,
		status: "ok",
		createdAt: new Date(Date.now() - 86400000).toISOString(),
	},
	{
		id: "demo-u3",
		model: "llama-3.3-70b",
		provider: "venice",
		promptTokens: 920,
		completionTokens: 480,
		costCents: "1",
		latencyMs: 210,
		status: "ok",
		createdAt: new Date().toISOString(),
	},
];

export const DEMO_BATCHES: CreditBatch[] = [];

export const DEMO_TRANSACTIONS: CreditTransaction[] = [
	{
		id: "demo-tx-1",
		type: "deposit",
		amountCents: 1000,
		creditsIssued: 1000,
		status: "completed",
		createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
	},
	{
		id: "demo-tx-2",
		type: "usage",
		amountCents: -12,
		status: "completed",
		createdAt: new Date(Date.now() - 7200000).toISOString(),
		model: "llama-3.2-3b",
	},
];

/** Minimal model list so dashboard model count is non-zero in demo. */
export const DEMO_MODELS: Model[] = [
	{
		id: "llama-3.2-3b",
		object: "model",
		created: 0,
		owned_by: "oma",
	},
	{
		id: "llama-3.3-70b",
		object: "model",
		created: 0,
		owned_by: "oma",
	},
];
