/**
	* Sample dashboard data for `?demo=1` / demo-cookie tours.
	* Shapes match live API types so charts and stats reuse production code paths.
	*
	* Model ids MUST be in the live catalog (server/src/inference/models.ts)
	* — keep this list aligned with `MODELS` in app/src/lib/models-data.ts.
	* Stale ids render as raw slugs on the "Spend by model" donut and the
	* "Recent activity" rows, which makes the demo tour look broken.
	*/
import type {
	ApiKey,
	BalanceResponse,
	CreditBatch,
	CreditTransaction,
	UsageRecord,
} from "@/lib/api";

function daysAgo(n: number, hour = 12): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	d.setHours(hour, (n * 7) % 60, 0, 0);
	return d.toISOString();
}

// Curated mix: one frontier (Venice), one premium (OMA-AI), one budget
// (Venice) — gives the donut chart three distinct slices at different
// price points so visitors see the catalog tier spread at a glance.
const MODELS = [
	{ model: "claude-opus-5", provider: "Venice" },
	{ model: "deepseek-v4-flash-0731-openbroker", provider: "OMA-AI" },
	{ model: "deepseek-v4-flash-0731", provider: "Venice" },
] as const;

/** Synthetic usage spread across the last 14 days so range filters still chart. */
export function buildDemoUsage(): UsageRecord[] {
	const rows: UsageRecord[] = [];
	for (let day = 0; day < 14; day++) {
		const calls = 4 + (day % 5);
		for (let i = 0; i < calls; i++) {
			const m = MODELS[(day + i) % MODELS.length];
			const prompt = 180 + day * 12 + i * 40;
			const completion = 90 + i * 25;
			const cost = (0.08 + day * 0.01 + i * 0.02).toFixed(2);
			const markup = (Number(cost) * 0.15).toFixed(2);
			const total = (Number(cost) + Number(markup)).toFixed(2);
			const isError = day === 2 && i === 0;
			rows.push({
				id: `demo-usage-${day}-${i}`,
				requestId: `req_demo_${day}_${i}`,
				model: m.model,
				provider: m.provider,
				promptTokens: prompt,
				completionTokens: completion,
				costCents: cost,
				markupCents: markup,
				totalCents: total,
				latencyMs: isError ? null : 420 + day * 15 + i * 30,
				status: isError ? "error" : "completed",
				createdAt: daysAgo(day, 9 + i),
			});
		}
	}
	return rows;
}

export const DEMO_BALANCE: BalanceResponse = {
	balanceCents: "1284.50",
	totalDepositedCents: "5000",
	totalUsedCents: "3715.50",
	lastActivityAt: daysAgo(0, 10),
};

export const DEMO_API_KEYS: ApiKey[] = [
	{
		id: "demo-key-1",
		name: "Production",
		prefix: "oma_live_ab",
		createdAt: daysAgo(40),
		lastUsedAt: daysAgo(0, 9),
	},
	{
		id: "demo-key-2",
		name: "Local dev",
		prefix: "oma_test_cd",
		createdAt: daysAgo(12),
		lastUsedAt: daysAgo(1, 15),
	},
];

export const DEMO_BATCHES: CreditBatch[] = [
	{
		id: "demo-batch-1",
		amountCents: "2500",
		remainingCents: "1284.50",
		expiresAt: daysAgo(-60),
		paymentMethod: "usdc",
	},
];

export const DEMO_TRANSACTIONS: CreditTransaction[] = [
	{
		id: "demo-tx-1",
		type: "deposit",
		amountCents: 1000,
		creditsIssued: 1000,
		status: "confirmed",
		createdAt: daysAgo(3),
		txHash: "0xdemo0000000000000000000000000000000000000000000000000000000001",
	},
	{
		id: "demo-tx-2",
		type: "usage",
		amountCents: -42,
		status: "completed",
		createdAt: daysAgo(0, 9),
		model: "deepseek-v4-flash-0731-openbroker",
	},
];
