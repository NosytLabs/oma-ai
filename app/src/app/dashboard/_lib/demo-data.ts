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
	CreditTransaction,
	UsageRecord,
} from "@/lib/api";
import { MODELS as CATALOG } from "@/lib/models-data";

function daysAgo(n: number, hour = 12): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	d.setHours(hour, (n * 7) % 60, 0, 0);
	return new Date(Math.min(d.getTime(), Date.now())).toISOString();
}

// Sample charges use the shared catalog, without inventing provider invoices.
const MODELS = ["claude-opus-5", "minimax-m2-7", "deepseek-v4-flash-0731"]
	.map(id => CATALOG.find(entry => entry.id === id))
	.filter(model => model !== undefined);

/** Synthetic usage spread across the last 14 days so range filters still chart. */
export function buildDemoUsage(): UsageRecord[] {
	if (MODELS.length === 0) return [];
	const rows: UsageRecord[] = [];
	for (let day = 0; day < 14; day++) {
		const calls = 4 + (day % 5);
		for (let i = 0; i < calls; i++) {
			const m = MODELS[(day + i) % MODELS.length];
			const prompt = 180 + day * 12 + i * 40;
			const isError = day === 2 && i === 0;
			const completion = isError ? 0 : 90 + i * 25;
			// Catalog rates are USD per million tokens; records store fractional cents.
			const total = isError ? "0" : ((prompt * m.inputPricePer1M
				+ completion * m.outputPricePer1M) / 1_000_000 * 100).toFixed(8);
			rows.push({
				id: `demo-usage-${day}-${i}`,
				requestId: `req_demo_${day}_${i}`,
				apiKeyId: i % 3 === 0 ? null : "demo-key-1",
				model: m.id,
				provider: m.provider,
				promptTokens: prompt,
				completionTokens: completion,
				// Cost split is omitted from the read-only customer demo. These
				// fields satisfy its usage shape; totalCents drives every display.
				costCents: "0",
				markupCents: "0",
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
	// The aggregate ledger includes card $50.00 + USDC $25.00.
	totalDepositedCents: "7500",
	// Lifetime usage includes requests before the tour's 14-day history window.
	totalUsedCents: "6215.50",
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

export function buildDemoTransactions(usage: UsageRecord[]): CreditTransaction[] {
	const latest = usage.filter(row => row.status === "completed")
		.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))[0];
	const transactions: CreditTransaction[] = [
		{ id: "demo-deposit-card", type: "deposit", amountCents: 5000,
			creditsIssued: 5000, status: "completed", createdAt: daysAgo(12) },
		{ id: "demo-deposit-usdc", type: "deposit", amountCents: 2500,
			creditsIssued: 2500, status: "completed", createdAt: daysAgo(3) },
	];
	if (latest) transactions.push({
		id: latest.id, type: "usage", amountCents: -Number(latest.totalCents),
		status: latest.status, createdAt: latest.createdAt, model: latest.model,
	});
	return transactions;
}
