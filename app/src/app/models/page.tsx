"use client";

import {
  Brain,
  Check,
  ChevronDown,
  Link2,
  Search,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  getModelsByTier,
  loadModels,
  MODELS,
  distinctProviders,
  PROVIDER_COLORS,
  TIER_COLORS,
  TIER_ORDER,
  type Model,
} from "@/lib/models-data";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { useUrlFilters } from "@/components/shared/useUrlFilters";
import { Button } from "@/components/ui/button";

const TIER_LABELS: Record<string, string> = {
  budget: "Budget",
  mid: "Mid-Range",
  premium: "Premium",
  frontier: "Frontier",
};

const TIER_ICONS: Record<string, React.ReactNode> = {
  budget: <Zap className="h-4 w-4" />,
  mid: <Star className="h-4 w-4" />,
  premium: <Sparkles className="h-4 w-4" />,
  frontier: <Trophy className="h-4 w-4" />,
};

type SortKey =
  | "name"
  | "price-in"
  | "price-out"
  | "tier"
  | "context"
  | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "name", label: "Name" },
  { value: "price-in", label: "Input Price" },
  { value: "price-out", label: "Output Price" },
  { value: "context", label: "Context Window" },
  { value: "newest", label: "Newest" },
  { value: "tier", label: "Tier" },
];

const TIER_SORT: Record<string, number> = {
  budget: 0,
  mid: 1,
  premium: 2,
  frontier: 3,
};

function sortModels(models: Model[], sort: SortKey): Model[] {
  const sorted = [...models];
  switch (sort) {
    case "price-in":
      return sorted.sort(
        (a, b) => (a.inputPricePer1M ?? 0) - (b.inputPricePer1M ?? 0)
      );
    case "price-out":
      return sorted.sort(
        (a, b) => (a.outputPricePer1M ?? 0) - (b.outputPricePer1M ?? 0)
      );
    case "context":
      return sorted.sort(
        (a, b) =>
          parseInt(b.contextLength.replace(/[KM]/g, "")) -
          parseInt(a.contextLength.replace(/[KM]/g, ""))
      );
    case "newest":
      // For now, we'll sort by name as we don't have a reliable date field
      // In a real implementation, we'd use the created timestamp from the API
      return sorted.sort((a, b) =>
        a.name.localeCompare(b.name)
      );
    case "tier":
      return sorted.sort(
        (a, b) => (TIER_SORT[a.tier] ?? 0) - (TIER_SORT[b.tier] ?? 0)
      );
    case "name":
    default:
      return sorted.sort((a, b) =>
        (a.name ?? "").localeCompare(b.name ?? "")
      );
  }
}

function ModelsPageInner() {
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
    urlProvider
  );
  const [sortBy, setSortBy] = useState<SortKey>(urlSort as SortKey);
  const [copied, setCopied] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(true);
  const [liveModels, setLiveModels] = useState<Model[] | null>(null);

  // Filter controls state
  const [inputModalities, setInputModalities] = useState<string[]>([]);
  const [outputModalities, setOutputModalities] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [contextRange, setContextRange] = useState<[number, number]>([0, 2000000]); // 0 to 2M tokens
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 1000]); // $0 to $1000 per 1M tokens

  // Load the full model catalog from the API on mount.
  useEffect(() => {
    let cancelled = false;
    loadModels().then((models) => {
      if (!cancelled) {
        setLiveModels(models);
        setIsLoadingModels(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const safeModels = useMemo(
    () => (Array.isArray(liveModels) ? liveModels : Array.isArray(MODELS) ? MODELS : []),
    [liveModels]
  );

  // Extract unique values for filter options
  const allInputModalities = useMemo(() => {
    const modalities = new Set<string>();
    safeModels.forEach((model) => {
      // Since we don't have modality info in our Model type, we'll need to get it from the raw API data
      // For now, we'll use common modalities based on what we saw in the API
      ["text", "image", "audio", "video"].forEach((mod) => modalities.add(mod));
    });
    return Array.from(modalities).sort();
  }, [safeModels]);

  const allOutputModalities = useMemo(() => {
    const modalities = new Set<string>();
    safeModels.forEach((model) => {
      ["text", "image", "audio", "video"].forEach((mod) => modalities.add(mod));
    });
    return Array.from(modalities).sort();
  }, [safeModels]);

  const allCapabilities = useMemo(() => {
    const caps = new Set<string>();
    safeModels.forEach((model) => {
      model.capabilities.forEach((cap) => caps.add(cap));
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
          (m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q))
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
    [safeModels]
  );

  const groupedModels = useMemo(() => {
    if (sortBy === "tier") {
      return TIER_ORDER.map((tier) => ({
        tier,
        label: TIER_LABELS[tier] || tier,
        icon: TIER_ICONS[tier] ?? null,
        models: modelsByTier[tier] || [],
      })).filter((g) => g.models.length > 0);
    }
    // Flat list when sorting by name/price/context/etc
    if (filtered.length === 0) return [];
    return [
      {
        tier: "__all",
        label:
          sortBy === "name"
            ? "All Models (A-Z)"
            : sortBy === "price-in"
              ? "All Models (Input Price)"
              : sortBy === "price-out"
                ? "All Models (Output Price)"
                : sortBy === "context"
                  ? "All Models (Context Window)"
                  : sortBy === "newest"
                    ? "All Models (Newest)"
                    : "All Models",
        icon: null,
        models: filtered,
      },
    ];
  }, [filtered, modelsByTier, sortBy]);

  const totalModels = safeModels.length;
  const visibleModels = filtered.length;

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
    selectedTier ||
    selectedProvider ||
    localSearch ||
    inputModalities.length > 0 ||
    outputModalities.length > 0 ||
    capabilities.length > 0 ||
    contextRange[0] !== 0 ||
    contextRange[1] !== 2000000 ||
    priceRange[0] !== 0 ||
    priceRange[1] !== 1000;

  return (
    <div className="min-h-screen bg-void">
      <div className="mx-auto max-w-7xl px-4 py-12">
        {/* Breadcrumb */}
        <Breadcrumb items={[ { label: "Models" } ]} />

        {/* Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-text-bright flex items-center gap-3">
              <Brain className="h-8 w-8 text-accent" />
              Models
            </h1>
            <p className="text-text-secondary mt-1 font-mono text-sm">
              {totalModels} models available
              {isLoadingModels && (
                <span className="text-text-muted ml-2">(loading full catalog…)</span>
              )}
              {visibleModels < totalModels && (
                <span className="text-text-muted">
                  {" "}·{" "}
                  <span className="text-accent">{visibleModels}</span> shown
                </span>
              )}
            </p>
          </div>

          {/* Copy Filter URL */}
          {hasFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              leftIcon={copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Link2 className="h-3.5 w-3.5" />
              )}
            >
              {copied ? "Copied!" : "Share Filters"}
            </Button>
          )}
        </div>

        {/* Search + Sort Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              id="models-search"
              name="search"
              placeholder="Search models by name or ID..."
              value={localSearch}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-xl border border-border bg-panel py-3 pl-10 pr-4 text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
              aria-label="Search models"
            />
          </div>

          {/* Sort Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setSortOpen(!sortOpen)}
              className="flex items-center gap-2 rounded-xl border border-border bg-panel px-4 py-3 text-sm text-text-secondary hover:border-accent transition-colors"
              aria-haspopup="listbox"
              aria-expanded={sortOpen}
            >
              <span className="text-text-muted">Sort:</span>
              <span className="text-text-bright">
                {SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-text-muted" />
            </button>
            {sortOpen && (
              <div
                className="absolute right-0 mt-1 z-50 w-48 rounded-xl border border-border bg-panel shadow-xl"
                role="listbox"
              >
                {SORT_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => handleSort(opt.value)}
                    className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                      sortBy === opt.value
                        ? "text-accent bg-surface"
                        : "text-text-secondary hover:bg-surface hover:text-text-bright"
                    }`}
                    role="option"
                    aria-selected={sortBy === opt.value}
                  >
                    {opt.label}
                    {sortBy === opt.value && <Check className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Advanced Filters Sidebar */}
        <div className="grid gap-6 mb-8">
          <div className="lg:col-span-3">
            <div className="space-y-4">
              
              {/* Tier Filter Chips */}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleTier(null)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    !selectedTier
                      ? "bg-accent text-void"
                      : "bg-panel text-text-secondary border border-border hover:border-accent"
                  }`}
                >
                  All Tiers
                </button>
                {TIER_ORDER.map((tier) => (
                  <button
                    type="button"
                    key={tier}
                    onClick={() => handleTier(selectedTier === tier ? null : tier)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                      selectedTier === tier
                        ? "bg-accent text-void"
                        : "bg-panel text-text-secondary border border-border hover:border-accent"
                    }`}
                  >
                    {TIER_ICONS[tier]}
                    {TIER_LABELS[tier] || tier}
                  </button>
                ))}
              </div>

              {/* Provider Filter Chips (only show providers that exist in catalog) */}
              {availableProviders.length > 1 && (
                <div className="flex flex-wrap gap-2" aria-label="Filter by provider">
                  <button
                    type="button"
                    onClick={() => handleProvider(null)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      !selectedProvider
                        ? "bg-text-bright text-void"
                        : "bg-panel text-text-secondary border border-border hover:border-text-bright"
                    }`}
                  >
                    All Providers
                  </button>
                  {availableProviders.map((p) => {
                    const pStyle = PROVIDER_COLORS[p];
                    return (
                      <button
                        type="button"
                        key={p}
                        onClick={() =>
                          handleProvider(selectedProvider === p ? null : p)
                        }
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                          selectedProvider === p
                            ? `${pStyle.bg} ${pStyle.text} ${pStyle.border} border`
                            : "bg-panel text-text-secondary border border-border hover:border-text-bright"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Input Modalities */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted mb-2">
                  Input Modalities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {allInputModalities.map((mod) => (
                    <button
                      key={`input-${mod}`}
                      type="button"
                      onClick={() => {
                        const newMods = inputModalities.includes(mod)
                          ? inputModalities.filter((m) => m !== mod)
                          : [...inputModalities, mod];
                        setInputModalities(newMods);
                      }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      inputModalities.includes(mod)
                        ? "bg-accent text-void"
                        : "bg-panel text-text-secondary border border-border hover:border-accent"
                    }`}
                    >
                      {mod.charAt(0).toUpperCase() + mod.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Output Modalities */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted mb-2">
                  Output Modalities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {allOutputModalities.map((mod) => (
                    <button
                      key={`output-${mod}`}
                      type="button"
                      onClick={() => {
                        const newMods = outputModalities.includes(mod)
                          ? outputModalities.filter((m) => m !== mod)
                          : [...outputModalities, mod];
                        setOutputModalities(newMods);
                      }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      outputModalities.includes(mod)
                        ? "bg-accent text-void"
                        : "bg-panel text-text-secondary border border-border hover:border-accent"
                    }`}
                    >
                      {mod.charAt(0).toUpperCase() + mod.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Capabilities */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted mb-2">
                  Capabilities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {allCapabilities.map((cap) => (
                    <button
                      key={`cap-${cap}`}
                      type="button"
                      onClick={() => {
                        const newCaps = capabilities.includes(cap)
                          ? capabilities.filter((c) => c !== cap)
                          : [...capabilities, cap];
                        setCapabilities(newCaps);
                      }}
                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
                      capabilities.includes(cap)
                        ? "bg-accent text-void"
                        : "bg-panel text-text-secondary border border-hover:border-accent"
                    }`}
                    >
                      {cap.charAt(0).toUpperCase() + cap.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Context Range Slider */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted mb-2">
                  Context Window
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>{formatContextRange(contextRange[0])}</span>
                    <span>{formatContextRange(contextRange[1])}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2000000}
                    step={1000}
                    value={JSON.stringify([contextRange[0], contextRange[1]])}
                    onChange={(e) => {
                      try {
                        const [min, max] = JSON.parse(e.target.value);
                        setContextRange([Math.min(min, max), Math.max(min, max)]);
                      } catch {
                        // Handle invalid JSON
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Price Range Slider */}
              <div>
                <h3 className="font-mono text-xs uppercase tracking-widest text-text-muted mb-2">
                  Price (per 1M tokens)
                </h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-text-muted">
                    <span>${formatPriceRange(priceRange[0])}</span>
                    <span>${formatPriceRange(priceRange[1])}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1000}
                    step={0.1}
                    value={JSON.stringify([priceRange[0], priceRange[1]])}
                    onChange={(e) => {
                      try {
                        const [min, max] = JSON.parse(e.target.value);
                        setPriceRange([Math.min(min, max), Math.max(min, max)]);
                      } catch {
                        // Handle invalid JSON
                      }
                    }}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Model Grid */}
          <div className="lg:col-span-9">
            {groupedModels.length > 0 ? (
              <div className="space-y-10">
                {groupedModels.map((group) => (
                  <section key={group.tier}>
                    <div className="flex items-center gap-2 mb-4">
                      {group.icon && (
                        <span
                          className={`p-1.5 rounded-md ${TIER_COLORS[group.tier]?.bg || "bg-panel"}`}
                        >
                          {group.icon}
                        </span>
                      )}
                      <h2 className="text-xl font-bold text-text-bright">
                        {group.label}
                      </h2>
                      <span className="text-xs text-text-muted font-mono">
                        ({group.models.length})
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {group.models.map((model) => {
                        if (!model?.id) return null;
                        const providerStyle =
                          PROVIDER_COLORS[model.provider] ?? PROVIDER_COLORS.Venice;
                        return (
                          <Link
                            key={model.id}
                            href={`/models/${model.id}`}
                            className="group relative rounded-md border border-border bg-panel p-4 transition-[border-color,box-shadow] hover:border-accent/50 hover:shadow-[0_0_15px_var(--color-accent-dim)] h-full flex flex-col"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-text-bright truncate">
                                  {model.name ?? "Unknown"}
                                </p>
                                <p className="text-xs text-text-muted mt-0.5 font-mono truncate">
                                  {model.id}
                                </p>
                              </div>
                              {model.provider && (
                                <span
                                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border ${providerStyle.bg} ${providerStyle.text} ${providerStyle.border}`}
                                >
                                  {model.provider}
                                </span>
                              )}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-1.5">
                              {/* Input/Output Modality Badges */}
                              <div className="flex flex-wrap gap-1">
                                {/* In a real implementation, we'd get actual modality data */}
                                <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-surface text-text-secondary border border-border/50">
                                  T
                                </span>
                                {/* Placeholder for image/audio/video badges */}
                              </div>

                              {/* Capability Tags */}
                              <div className="flex flex-wrap gap-1">
                                {model.capabilities.slice(0, 3).map((cap) => (
                                  <span
                                    key={String(cap)}
                                    className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-text-secondary border border-border/50"
                                  >
                                    {cap.charAt(0).toUpperCase() + cap.slice(1)}
                                  </span>
                                ))}
                                {model.capabilities.length > 3 && (
                                  <span
                                    className="px-1.5 py-0.5 rounded text-[10px] text-text-muted cursor-help"
                                    title={`Additional capabilities: ${model.capabilities
                                      .slice(3)
                                      .join(", ")}`}
                                  >
                                    +{model.capabilities.length - 3}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-xs">
                              <span className="text-text-secondary font-mono">
                                {model.contextLength ? `${model.contextLength} ctx` : "—"}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] font-mono">
                                <span className="text-accent" aria-hidden="true">
                                  $
                                  {typeof model.inputPricePer1M === "number"
                                    ? model.inputPricePer1M < 0.01
                                      ? model.inputPricePer1M.toFixed(4)
                                      : model.inputPricePer1M.toFixed(2)
                                    : "—"}
                                </span>
                                <span className="text-text-muted" aria-hidden="true">
                                  &middot;
                                </span>
                                <span className="text-text-secondary" aria-hidden="true">
                                  $
                                  {typeof model.outputPricePer1M === "number"
                                    ? model.outputPricePer1M < 0.01
                                      ? model.outputPricePer1M.toFixed(4)
                                      : model.outputPricePer1M.toFixed(2)
                                    : "—"}
                                </span>
                              </div>
                            </div>
                            <span className="sr-only">
                              {`Input $${(typeof model.inputPricePer1M === "number" ? model.inputPricePer1M.toFixed(model.inputPricePer1M < 0.01 ? 4 : 2) : "?")} per 1M tokens, output $${(typeof model.outputPricePer1M === "number" ? model.outputPricePer1M.toFixed(model.outputPricePer1M < 0.01 ? 4 : 2) : "?")} per 1M tokens`}
                            </span>
                          </Link>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Brain className="h-12 w-12 text-text-muted mx-auto mb-4" />
                <p className="text-text-secondary">No models match your search.</p>
                <button
                  type="button"
                  onClick={() => {
                    handleSearch("");
                    handleTier(null);
                    handleProvider(null);
                    setInputModalities([]);
                    setOutputModalities([]);
                    setCapabilities([]);
                    setContextRange([0, 2000000]);
                    setPriceRange([0, 1000]);
                  }}
                  className="mt-4 text-sm text-accent hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function formatContextRange(tokens: number): string {
  if (!Number.isFinite(tokens) || tokens <= 0) return "—";
  if (tokens >= 1_000_000) {
    const m = tokens / 1_000_000;
    const rounded = Math.round(m * 10) / 10;
    return `${rounded}M`;
  }
  const k = Math.round(tokens / 1000);
  return `${k}K`;
}

function formatPriceRange(price: number): string {
  if (!Number.isFinite(price) || price < 0) return "0.00";
  if (price < 0.01) return `$${price.toFixed(4)}`;
  if (price < 1) return `$${price.toFixed(3)}`;
  return `$${price.toFixed(2)}`;
}

export default function ModelsPage() {
  return (
    <>
      <BreadcrumbListJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Models", url: "/models" },
        ]}
      />
      <Suspense
        fallback={
          <div className="min-h-screen bg-void">
            <div className="mx-auto max-w-7xl px-4 py-12">
              <div className="h-8 w-32 bg-panel rounded animate-pulse mb-8" />
              <div className="h-10 w-64 bg-panel rounded animate-pulse mb-4" />
              <div className="h-4 w-48 bg-panel rounded animate-pulse mb-6" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-36 bg-panel rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
          </div>
        }
      >
        <ModelsPageInner />
      </Suspense>
    </>
  );
}