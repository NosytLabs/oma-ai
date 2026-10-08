import { MODEL_NAME_OVERRIDES, MODELS, type Model } from "@/lib/models-data"
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

// Brand-harmonized slice colors: emerald/teal first, warm hues only for
// the long tail (brand rule: no orange/red as primary data colors).
const MODEL_PALETTE = ["#46d39a", "#2dd4bf", "#3b82f6", "#a855f7", "#ec4899", "#f59e0b"]
const TOP_MODELS = 5

function localDayKey(iso: string): string {
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
	const y = d.getFullYear()
	const m = String(d.getMonth() + 1).padStart(2, "0")
	const day = String(d.getDate()).padStart(2, "0")
	return `${y}-${m}-${day}`
}

// Resolve a usage record's raw model id into the customer-facing display
// name. UsageRecord.model is the upstream API id (e.g. "openai-gpt-56-sol"),
// which looks technical in the donut legend and Recent activity rows. We
// look it up in the static SSR catalog first (fast, covers everything in
// MODELS); on miss we fall back to the id slug so the chart never shows
// "undefined" or an empty label.
const MODEL_NAME_BY_ID: Map<string, string> = (() => {
	const m = new Map<string, string>()
	for (const entry of MODELS as readonly Model[]) {
		m.set(entry.id, entry.name)
		m.set(entry.modelId, entry.name)
	}
	return m
})()

export function resolveModelDisplayName(id: string | undefined | null): string {
	if (!id) return "Unknown model"
	const trimmed = id.trim()
	if (!trimmed) return "Unknown model"
	const override = MODEL_NAME_OVERRIDES[trimmed.toLowerCase()]
	if (override) return override
	const fromCatalog = MODEL_NAME_BY_ID.get(trimmed)
	if (fromCatalog) return fromCatalog
	// Last-resort prettifier: "openai-gpt-56-sol" → "Openai Gpt 56 Sol".
	// The catalog covers the curated 20, so this only fires for stale
	// server data (e.g. a model was retired but usage logs lag behind).
	return trimmed
		.split(/[-_]/)
		.map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : ""))
		.filter(Boolean)
		.join(" ")
}

/** Aggregates usage records into per-day totals for the requests/cost chart. */
export function buildUsageByDay(usage: UsageRecord[]): UsageByDay[] {
	const byDay = new Map<string, UsageByDay>()
	for (const r of usage) {
		const day = localDayKey(r.createdAt)
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
		const displayName = resolveModelDisplayName(r.model)
		const prev = byModel.get(displayName) ?? { name: displayName, value: 0, cost: 0 }
		prev.value += 1
		prev.cost += Number(r.totalCents ?? "0") / 100
		byModel.set(displayName, prev)
	}
	// Sort by cost (not request count) so the "expensive" models surface
	// first — matches the chart title "Top models by cost" semantics.
	const sorted = Array.from(byModel.values()).sort((a, b) => b.cost - a.cost)
	const top = sorted.slice(0, TOP_MODELS)
	const rest = sorted.slice(TOP_MODELS)
	const result = top.map((m, i) => ({
		name: m.name,
		value: m.cost,
		color: MODEL_PALETTE[i % MODEL_PALETTE.length],
	}))
	if (rest.length > 0) {
		const restCost = rest.reduce((sum, m) => sum + m.cost, 0)
		result.push({
			name: `Other (${rest.length})`,
			value: restCost,
			color: MODEL_PALETTE[TOP_MODELS % MODEL_PALETTE.length],
		})
	}
	return result
}
