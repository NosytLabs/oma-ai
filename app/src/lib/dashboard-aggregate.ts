import type { UsageRecord } from "@/lib/api"

export interface UsageByDay {
	date: string
	requests: number
	cost: number
}

export interface ModelSlice {
	name: string
	value: number
	color: string
}

const MODEL_PALETTE = ["#46d39a", "#3b82f6", "#f59e0b", "#ec4899", "#a855f7", "#ef4444"]
const TOP_MODELS = 5

/** Aggregates usage records into per-day totals for the requests/cost chart. */
export function buildUsageByDay(usage: UsageRecord[]): UsageByDay[] {
	const byDay = new Map<string, UsageByDay>()
	for (const r of usage) {
		const day = r.createdAt.slice(0, 10)
		const prev = byDay.get(day) ?? { date: day, requests: 0, cost: 0 }
		prev.requests += 1
		prev.cost += Number(r.totalCents ?? "0") / 100
		byDay.set(day, prev)
	}
	return Array.from(byDay.values()).sort((a, b) => (a.date < b.date ? -1 : 1))
}

/**
	* Aggregates usage records into the top models by cost, bucketing the tail
	* into an "Other (N)" slice so the donut legend stays readable.
	*/
export function buildTopModels(usage: UsageRecord[]): ModelSlice[] {
	const byModel = new Map<string, { name: string; value: number; cost: number }>()
	for (const r of usage) {
		const prev = byModel.get(r.model) ?? { name: r.model, value: 0, cost: 0 }
		prev.value += 1
		prev.cost += Number(r.totalCents ?? "0") / 100
		byModel.set(r.model, prev)
	}
	// Sort by cost (not request count) so the "expensive" models surface
	// first — matches the chart title "Top models by cost" semantics.
	const sorted = Array.from(byModel.values()).sort((a, b) => b.cost - a.cost)
	const top = sorted.slice(0, TOP_MODELS)
	const rest = sorted.slice(TOP_MODELS)
	const restRequests = rest.reduce((sum, m) => sum + m.value, 0)
	const result = top.map((m, i) => ({
		name: m.name,
		value: m.value,
		color: MODEL_PALETTE[i % MODEL_PALETTE.length],
	}))
	if (rest.length > 0) {
		result.push({
			name: `Other (${rest.length})`,
			value: restRequests,
			color: MODEL_PALETTE[TOP_MODELS % MODEL_PALETTE.length],
		})
	}
	return result
}