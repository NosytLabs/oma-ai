"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { normalizeProvider } from "@/lib/models-data";
import { type LiveModelRaw, mapLiveModel } from "@/lib/model-utils";
import { MODELS } from "@/lib/models-data";

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
}

export interface ModelOption {
	id: string;
	name: string;
	category:
		| "frontier"
		| "premium"
		| "mid"
		| "budget"
		| "reasoning"
		| "coding"
		| "uncensored";
	provider: "Venice" | "OMA-AI" | "Both" | "Surplus" | "Tinyfish";
	inputPer1M: number;
	outputPer1M: number;
	ctx: string;
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

export const FALLBACK_MODELS: ModelOption[] = MODELS.map((m) => {
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
let liveModelsCache: { data: ModelOption[]; ts: number } | null = null;

// shared `["models"]` key so dashboard / settings / chat all
// invalidate the same cache. Returns the active ModelOption[]; falls back
// to FALLBACK_MODELS while the first request is in flight or on error.
export function useLiveModels(): ModelOption[] {
	const [models, setModels] = useState<ModelOption[]>(() =>
		liveModelsCache && Date.now() - liveModelsCache.ts < LIVE_MODELS_TTL_MS
			? liveModelsCache.data
			: FALLBACK_MODELS,
	);

	useEffect(() => {
		if (liveModelsCache && Date.now() - liveModelsCache.ts < LIVE_MODELS_TTL_MS)
			return;
		let cancelled = false;
		api
			.models.list()
			.then((data) => {
				if (cancelled || !data?.data?.length) return;
				const mapped = (data.data as unknown[])
					.filter(
						(m): m is LiveModelRaw =>
							isLiveModelRaw(m) && m.category !== "video",
					)
					.map(mapLiveModel);
				if (mapped.length === 0) return;
				liveModelsCache = { data: mapped, ts: Date.now() };
				setModels(mapped);
			})
			.catch(() => {
				/* keep fallback on error */
			});
		return () => {
			cancelled = true;
		};
	}, []);

	return models;
}

/**
 * LiveModelsContext — shares a single useLiveModels fetch across all consumers.
 * Wrap the component tree (or a subtree) with <LiveModelsProvider> to avoid
 * duplicate fetches on every render of ModelSelector, CostEstimate, etc.
 */
const LiveModelsContext = createContext<ModelOption[] | null>(null);

interface LiveModelsProviderProps {
	children: React.ReactNode;
}

export function LiveModelsProvider({ children }: LiveModelsProviderProps) {
	const models = useLiveModels();
	return (
		<LiveModelsContext.Provider value={models}>
			{children}
		</LiveModelsContext.Provider>
	);
}

/**
 * Hook to consume shared live models. Must be used within a LiveModelsProvider.
 * Falls back to the standalone useLiveModels() if no provider is present
 * (useful for components that might render outside the provider).
 */
export function useSharedLiveModels(): ModelOption[] {
	const context = useContext(LiveModelsContext);
	// Always call the hook to satisfy rules-of-hooks, then return conditionally.
	const fallback = useLiveModels();
	return context !== null ? context : fallback;
}
