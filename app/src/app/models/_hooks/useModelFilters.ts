"use client";

import { useEffect, useMemo, useState } from "react";
import { useUrlFilters } from "@/components/shared/useUrlFilters";
import { MODALITY_LABELS, MODALITY_ORDER, MODELS, TIER_ORDER, distinctProviders, getModelsByTier, loadModels, type Model } from "@/lib/models-data";
import { TIER_LABELS } from "../_lib/labels";
import { selectAvailableModels } from "@/lib/model-availability";

export type SortKey = "name" | "price-in" | "price-out" | "tier" | "context";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
	{ value: "name", label: "Name" },
	{ value: "price-in", label: "Input Price" },
	{ value: "price-out", label: "Output Price" },
	{ value: "context", label: "Context Window" },
	{ value: "tier", label: "Tier" },
];

const TIER_SORT: Record<string, number> = {
	budget: 0,
	mid: 1,
	premium: 2,
	frontier: 3,
};

function contextTokens(label: string): number {
	const s = label.trim();
	if (!s || s === "—") return 0;
	const last = s.slice(-1);
	const num = parseFloat(s);
	if (!Number.isFinite(num)) return 0;
	if (last === "M") return num * 1_000_000;
	if (last === "K") return num * 1_000;
	return num;
}

function sortModels(models: Model[], sort: SortKey): Model[] {
	const sorted = [...models];
	switch (sort) {
		case "price-in":
			return sorted.sort(
				(a, b) => (a.inputPricePer1M ?? 0) - (b.inputPricePer1M ?? 0),
			);
		case "price-out":
			return sorted.sort(
				(a, b) => (a.outputPricePer1M ?? 0) - (b.outputPricePer1M ?? 0),
			);
		case "context":
			return sorted.sort(
				(a, b) =>
					contextTokens(b.contextLength) - contextTokens(a.contextLength),
			);
		case "tier":
			return sorted.sort(
				(a, b) => (TIER_SORT[a.tier] ?? 0) - (TIER_SORT[b.tier] ?? 0),
			);
		default:
			return sorted.sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
	}
}

export function formatContextRange(tokens: number): string {
	if (!Number.isFinite(tokens) || tokens <= 0) return "—";
	if (tokens >= 1_000_000) {
		const m = tokens / 1_000_000;
		const rounded = Math.round(m * 10) / 10;
		return `${rounded}M`;
	}
	const k = Math.round(tokens / 1000);
	return `${k}K`;
}

export function formatPriceRange(price: number): string {
	if (!Number.isFinite(price) || price <= 0) return "$0.00";
	// Round UP to the nearest $0.05 to match standard catalog pricing.
	const rounded = Math.ceil(price * 20) / 20;
	return `$${rounded.toFixed(2)}`;
}

interface ModelGroup {
	tier: string;
	label: string;
	models: Model[];
}

export function useModelFilters() {
	const {
		tier: urlTier,
		provider: urlProvider,
		search: urlSearch,
		sort: urlSort,
		setParam,
		copyFilterUrl,
	} = useUrlFilters();

	const [localSearch, setLocalSearch] = useState(urlSearch);
	const [selectedTier, setSelectedTier] = useState<string | null>(urlTier);
	const [selectedProvider, setSelectedProvider] = useState<string | null>(
		urlProvider,
	);
	const [sortBy, setSortBy] = useState<SortKey>((urlSort as SortKey) || "name");
	const [copied, setCopied] = useState(false);
	const [sortOpen, setSortOpen] = useState(false);
	const [isLoadingModels, setIsLoadingModels] = useState(true);
	const [liveModels, setLiveModels] = useState<Model[] | null>(null);

	// Filter controls state
	const [inputModalities, setInputModalities] = useState<string[]>([]);
	const [outputModalities, setOutputModalities] = useState<string[]>([]);
	const [capabilities, setCapabilities] = useState<string[]>([]);
	const [contextRange, setContextRange] = useState<[number, number]>([
		0, 2000000,
	]); // 0 to 2M tokens
	const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]); // $0 to $1000 per 1M tokens

	// Load the full model catalog from the API on mount.
	useEffect(() => {
		let cancelled = false;
		loadModels().then((models) => {
			if (!cancelled) setLiveModels(models);
		}).catch(() => {
			// Keep the fallback catalog, without claiming its models are live.
		}).finally(() => {
			if (!cancelled) setIsLoadingModels(false);
		});
		return () => {
			cancelled = true;
		};
	}, []);

	const safeModels = useMemo(
		() =>
			Array.isArray(liveModels)
				? liveModels
				: Array.isArray(MODELS)
					? MODELS
					: [],
		[liveModels],
	);

	// Extract unique values for filter options
	const allInputModalities = useMemo(() => {
		const modalities = new Set<string>();
		safeModels.forEach((model) => {
			(model.inputModalities ?? ["text"]).forEach((modality) => {
				modalities.add(modality);
			});
		});
		return Array.from(modalities).sort();
	}, [safeModels]);

	const allOutputModalities = useMemo(() => {
		const modalities = new Set<string>();
		safeModels.forEach((model) => {
			(model.outputModalities ?? ["text"]).forEach((modality) => {
				modalities.add(modality);
			});
		});
		return Array.from(modalities).sort();
	}, [safeModels]);

	const allCapabilities = useMemo(() => {
		const caps = new Set<string>();
		safeModels.forEach((model) => {
			model.capabilities.forEach((cap) => {
				caps.add(cap);
			});
		});
		return Array.from(caps).sort();
	}, [safeModels]);

	// Apply filters
	const filtered = useMemo(() => {
		let result = [...safeModels];

		// Text search
		if (localSearch.trim()) {
			const q = localSearch.toLowerCase();
			result = result.filter(
				(m) =>
					m &&
					typeof m.id === "string" &&
					typeof m.name === "string" &&
					(m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
			);
		}

		// Tier filter
		if (selectedTier) {
			result = result.filter((m) => m && m.tier === selectedTier);
		}

		// Provider filter
		if (selectedProvider) {
			result = result.filter((m) => m && m.provider === selectedProvider);
		}

		// Input modalities filter (any selected modality matches)
		if (inputModalities.length > 0) {
			result = result.filter((m) => {
				const mods = (m.inputModalities ?? ["text"]) as string[];
				return inputModalities.some((mod) => mods.includes(mod));
			});
		}

		// Output modalities filter
		if (outputModalities.length > 0) {
			result = result.filter((m) => {
				const mods = (m.outputModalities ?? ["text"]) as string[];
				return outputModalities.some((mod) => mods.includes(mod));
			});
		}

		// Capabilities filter
		if (capabilities.length > 0) {
			result = result.filter((m) => {
				const caps = (m.capabilities ?? []) as string[];
				return capabilities.some((cap) => caps.includes(cap));
			});
		}

		// Context range filter
		if (contextRange[0] > 0 || contextRange[1] < 2_000_000) {
			result = result.filter((m) => {
				const ctx = m.contextTokens ?? 0;
				return ctx >= contextRange[0] && ctx <= contextRange[1];
			});
		}

		// Price range filter (input price)
		if (priceRange[0] > 0 || priceRange[1] < 1000) {
			result = result.filter((m) => {
				const price = m.inputPricePer1M ?? 0;
				return price >= priceRange[0] && price <= priceRange[1];
			});
		}

		return sortModels(result, sortBy);
	}, [
		localSearch,
		selectedTier,
		selectedProvider,
		sortBy,
		safeModels,
		inputModalities,
		outputModalities,
		capabilities,
		contextRange,
		priceRange,
	]);

	const modelsByTier = useMemo(() => getModelsByTier(filtered), [filtered]);
	const availableProviders = useMemo(
		() => distinctProviders(safeModels),
		[safeModels],
	);

	const groupedModels = useMemo(() => {
		if (sortBy === "tier") {
			const sections: ModelGroup[] = [];

			for (const tier of TIER_ORDER) {
				const ms = modelsByTier[tier] || [];
				if (ms.length > 0) {
					sections.push({
						tier,
						label: TIER_LABELS[tier] || tier,
						models: ms,
					});
				}
			}

			// Non-chat modality buckets — render each only if it has models.
			const chatModels = new Set(sections.flatMap((s) => s.models));
			for (const modality of MODALITY_ORDER) {
				if (modality === "chat") continue;
				const ms = filtered.filter(
					(m) => m.modality === modality && !chatModels.has(m),
				);
				if (ms.length > 0) {
					sections.push({
						tier: `__modality_${modality}`,
						label: `${MODALITY_LABELS[modality]} (${ms.length})`,
						models: ms,
					});
				}
			}

			return sections;
		}

		// Flat list when sorting by name/price/context/etc
		if (filtered.length === 0) return [];
		const labelBySort: Record<SortKey, string> = {
			name: "All Models (A-Z)",
			"price-in": "All Models (Input Price)",
			"price-out": "All Models (Output Price)",
			context: "All Models (Context Window)",
			tier: "All Models",
		};
		return [
			{
				tier: "__all",
				label: labelBySort[sortBy] ?? "All Models",
				models: filtered,
			},
		];
	}, [filtered, modelsByTier, sortBy]);

	const totalModels = safeModels.length;
	const visibleModels = filtered.length;
	// loadModels returns the exact MODELS reference on a network failure.
	// That fallback describes the catalog, not current route availability.
	const availableCount = useMemo(
		() => liveModels !== null && liveModels !== MODELS
			? selectAvailableModels(liveModels).length
			: null,
		[liveModels],
	);

	const handleSearch = (value: string) => {
		setLocalSearch(value);
		setParam("q", value || null);
	};

	const handleTier = (tier: string | null) => {
		setSelectedTier(tier);
		setParam("tier", tier);
	};

	const handleProvider = (provider: string | null) => {
		setSelectedProvider(provider);
		setParam("provider", provider);
	};

	const handleSort = (key: SortKey) => {
		setSortBy(key);
		setParam("sort", key === "name" ? null : key);
		setSortOpen(false);
	};

	const handleCopy = async () => {
		const ok = await copyFilterUrl();
		if (!ok) return;
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const hasFilters =
		!!selectedTier ||
		!!selectedProvider ||
		!!localSearch ||
		inputModalities.length > 0 ||
		outputModalities.length > 0 ||
		capabilities.length > 0 ||
		contextRange[0] !== 0 ||
		contextRange[1] !== 2000000 ||
		priceRange[0] !== 0 ||
		priceRange[1] !== 1000;

	const resetFilters = () => {
		handleSearch("");
		handleTier(null);
		handleProvider(null);
		setInputModalities([]);
		setOutputModalities([]);
		setCapabilities([]);
		setContextRange([0, 2000000]);
		setPriceRange([0, 1000]);
	};

	return {
		// State
		localSearch,
		selectedTier,
		selectedProvider,
		sortBy,
		copied,
		sortOpen,
		setSortOpen,
		isLoadingModels,
		inputModalities,
		setInputModalities,
		outputModalities,
		setOutputModalities,
		capabilities,
		setCapabilities,
		contextRange,
		setContextRange,
		priceRange,
		setPriceRange,

		// Derived
		safeModels,
		allInputModalities,
		allOutputModalities,
		allCapabilities,
		filtered,
		modelsByTier,
		availableProviders,
		groupedModels,
		totalModels,
		visibleModels,
		availableCount,
		hasFilters,

		// Handlers
		handleSearch,
		handleTier,
		handleProvider,
		handleSort,
		handleCopy,
		resetFilters,
	};
}
