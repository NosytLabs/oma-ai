"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MODELS, normalizeProvider } from "@/lib/models-data";
import { type LiveModelRaw, mapLiveModel } from "@/lib/model-utils";
import type { ModelOption } from "@/lib/types/model";

/**
	* Validate that an unknown value conforms to the LiveModelRaw shape.
	* Replaces `as unknown as` casts with a runtime check that narrows the type.
	*/
function isLiveModelRaw(v: unknown): v is LiveModelRaw {
	if (typeof v !== "object" || v === null) return false;
	const obj = v as Record<string, unknown>;
	return (
		typeof obj.id === "string" &&
		(obj.display_name === undefined || typeof obj.display_name === "string") &&
		(obj.category === undefined || typeof obj.category === "string") &&
		(obj.context_length === undefined ||
			typeof obj.context_length === "number") &&
		(obj.provider === undefined || typeof obj.provider === "string") &&
		(obj.pricing === undefined ||
			(typeof obj.pricing === "object" && obj.pricing !== null))
	);
}

export interface SearchResult {
	title: string;
	url: string;
	snippet: string;
	favicon?: string;
}

export interface Message {
	id?: string;
	role: "user" | "assistant" | "system";
	content: string;
	/** Rendering contract selected when the assistant placeholder is created. */
	format?: "text" | "openui" | "a2ui";
	timestamp: number;
	tokens?: number;
	latency?: number;
	inputTokens?: number;
	outputTokens?: number;
	searchResults?: SearchResult[];
	// Reasoning models (DeepSeek R1, Claude extended thinking, etc.) emit a
	// separate `reasoning_content` stream. Captured alongside `content` so the
	// thinking phase is visible instead of blank.
	reasoning?: string;
	// Upstream returned `finish_reason: "length"` — the response was cut off
	// mid-stream (most often because the reasoning phase consumed too much of
	// the token budget). The UI shows a RETRY hint so the user knows the
	// answer is incomplete rather than reacting to unbalanced markdown.
	truncated?: boolean;
	finishReason?: "stop" | "length" | "content_filter" | "tool_calls" | "function_call" | null;
	/** Catalog id that served the reply (may differ from the selected model after failover). */
	model?: string;
	/** True when the server routed via a fallback peer (`x-oma-fallback: 1`). */
	viaFallback?: boolean;
	/**
	 * BUG-D (audit 2026-09-01-userflow.md): true when the streamed
	 * content is degenerate (high repetition, e.g. a fallback peer
	 * returning "responseek" × hundreds). The UI surfaces a
	 * "low-quality response" hint so the user doesn't mistake the
	 * wall of repeated tokens for a real answer.
	 */
	degenerate?: boolean;
}

export type TierFilter =
	| "all"
	| "frontier"
	| "premium"
	| "mid"
	| "budget"
	| "reasoning"
	| "coding"
	| "uncensored";

const FALLBACK_MODELS: ModelOption[] = MODELS.map((m) => {
	const validCats: ModelOption["category"][] = [
		"frontier",
		"premium",
		"mid",
		"budget",
		"reasoning",
		"coding",
		"uncensored",
	];
	const cat = validCats.includes(m.tier as ModelOption["category"])
		? (m.tier as ModelOption["category"])
		: "mid";
	const provider: ModelOption["provider"] =
		normalizeProvider(m.provider);
	return {
		id: m.id,
		name: m.name,
		category: cat,
		provider,
		inputPer1M: m.inputPricePer1M,
		outputPer1M: m.outputPricePer1M,
		ctx: m.contextLength,
	};
});

const LIVE_MODELS_TTL_MS = 5 * 60 * 1000;
const LIVE_MODELS_CACHE_VERSION = 4; // bump to invalidate stale caches after display-name fix
let liveModelsCache: { data: ModelOption[]; ts: number; v: number } | null = null;
// Dedupes concurrent mounts: while a fetch is in flight, further consumers
// subscribe to the same promise instead of firing their own request.
let liveModelsInFlight: Promise<ModelOption[]> | null = null;

function fetchLiveModels(): Promise<ModelOption[]> {
	if (liveModelsInFlight) return liveModelsInFlight;
	// Bind to a local so TS can narrow the type — the reassignment below
	// widens `liveModelsInFlight` to `Promise<ModelOption[]> | null` and
	// we don't want that leak to contaminate the return type.
	const promise = api
		.models.list()
		.then((data) => {
			if (!data?.data?.length) return [] as ModelOption[];
			const mapped = (data.data as unknown[])
				.filter(
					(m): m is LiveModelRaw =>
						isLiveModelRaw(m) && (m as LiveModelRaw).modality !== "video",
				)
				.map((model) => ({
					...mapLiveModel(model),
					pricingAvailable: [model.pricing?.prompt, model.pricing?.completion].every(
						(price) =>
							(typeof price === "number" || (typeof price === "string" && price.trim() !== "")) &&
							Number.isFinite(Number(price)) && Number(price) >= 0,
					),
				}));
			return mapped;
		})
		.finally(() => {
			liveModelsInFlight = null;
		});
	liveModelsInFlight = promise;
	return promise;
}

interface LiveModelCatalog {
	models: ModelOption[];
	status: "loading" | "live" | "fallback";
}

function currentCatalog(): LiveModelCatalog {
	if (liveModelsCache && liveModelsCache.v === LIVE_MODELS_CACHE_VERSION && Date.now() - liveModelsCache.ts < LIVE_MODELS_TTL_MS) {
		return { models: liveModelsCache.data, status: "live" };
	}
	return { models: FALLBACK_MODELS, status: "loading" };
}

/** Keep fallback names usable without presenting their prices as live quotes. */
function useLiveModelCatalog(enabled = true): LiveModelCatalog {
	const [catalog, setCatalog] = useState<LiveModelCatalog>(currentCatalog);
	useEffect(() => {
		if (!enabled) return;
		const cached = currentCatalog();
		if (cached.status === "live") {
			setCatalog(cached);
			return;
		}
		let cancelled = false;
		fetchLiveModels()
			.then((mapped) => {
				if (mapped.length > 0) {
					liveModelsCache = { data: mapped, ts: Date.now(), v: LIVE_MODELS_CACHE_VERSION };
				}
				if (cancelled) return;
				setCatalog(mapped.length > 0
					? { models: mapped, status: "live" }
					: { models: FALLBACK_MODELS, status: "fallback" });
			})
			.catch(() => {
				if (!cancelled) setCatalog({ models: FALLBACK_MODELS, status: "fallback" });
			});
		return () => { cancelled = true; };
	}, [enabled]);
	return catalog;
}

export function useLiveModels(enabled = true): ModelOption[] {
	return useLiveModelCatalog(enabled).models;
}

const LiveModelsContext = createContext<LiveModelCatalog | null>(null);

export function LiveModelsProvider({ children }: { children: React.ReactNode }) {
	const catalog = useLiveModelCatalog();
	return <LiveModelsContext.Provider value={catalog}>{children}</LiveModelsContext.Provider>;
}

export function useSharedLiveModelCatalog(): LiveModelCatalog {
	const context = useContext(LiveModelsContext);
	const fallback = useLiveModelCatalog(context === null);
	return context ?? fallback;
}

export function useSharedLiveModels(): ModelOption[] {
	return useSharedLiveModelCatalog().models;
}
