"use client";
import { Brain, Search, Sparkles, Star, Trophy, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import {
	formatPricePerToken,
	getModelsByTier,
	MODELS,
	PROVIDER_COLORS,
	TIER_COLORS,
	TIER_ORDER,
} from "@/lib/prices";

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

export default function ModelsPage() {
	const [search, setSearch] = useState("");
	const [selectedTier, setSelectedTier] = useState<string | null>(null);

	// Defensive: ensure MODELS is always an array
	const safeModels = useMemo(() => (Array.isArray(MODELS) ? MODELS : []), []);

	const filtered = useMemo(() => {
		let result = [...safeModels];
		if (search.trim()) {
			const q = search.toLowerCase();
			result = result.filter(
				(m) =>
					m &&
					typeof m.id === "string" &&
					typeof m.name === "string" &&
					(m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)),
			);
		}
		if (selectedTier) {
			result = result.filter((m) => m && m.tier === selectedTier);
		}
		return result;
	}, [search, selectedTier, safeModels]);

	const modelsByTier = useMemo(() => getModelsByTier(filtered), [filtered]);

	const groupedModels = useMemo(() => {
		return TIER_ORDER.map((tier) => ({
			tier,
			label: TIER_LABELS[tier] || tier,
			icon: TIER_ICONS[tier] ?? null,
			models: modelsByTier[tier] || [],
		})).filter((g) => g.models.length > 0);
	}, [modelsByTier]);

	const totalModels = safeModels.length;
	const visibleModels = filtered.length;

	return (
		<div className="min-h-screen bg-void">
			<div className="mx-auto max-w-7xl px-4 py-12">
				{/* Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-bold text-text-bright flex items-center gap-3">
						<Brain className="h-8 w-8 text-accent" />
						Models
					</h1>
					<p className="text-text-secondary mt-1">
						{totalModels} models available
						{visibleModels < totalModels && (
							<span className="text-text-muted"> · {visibleModels} shown</span>
						)}
					</p>
				</div>

				{/* Search Bar */}
				<div className="relative mb-6">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
					<input
						type="text"
						id="models-search"
						name="search"
						placeholder="Search models by name or ID…"
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="w-full rounded-xl border border-border bg-panel py-3 pl-10 pr-4 text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
						aria-label="Search models"
					/>
				</div>

				{/* Tier Filter Chips */}
				<div className="flex flex-wrap gap-2 mb-8">
					<button
						type="button"
						onClick={() => setSelectedTier(null)}
						className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
							!selectedTier
								? "bg-accent text-void"
								: "bg-panel text-text-secondary border border-border hover:border-accent"
						}`}
					>
						All
					</button>
					{TIER_ORDER.map((tier) => (
						<button
							type="button"
							key={tier}
							onClick={() =>
								setSelectedTier(selectedTier === tier ? null : tier)
							}
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

				{/* Model Grid by Tier */}
				{groupedModels.length > 0 ? (
					<div className="space-y-10">
						{groupedModels.map((group) => (
							<section key={group.tier}>
								<div className="flex items-center gap-2 mb-4">
									<span
										className={`p-1.5 rounded-md ${TIER_COLORS[group.tier]?.bg || "bg-panel"}`}
									>
										{group.icon}
									</span>
									<h2 className="text-xl font-bold text-text-bright">
										{group.label}
									</h2>
									<span className="text-xs text-text-muted">
										({group.models.length})
									</span>
								</div>

								<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
									{group.models.map((model) => {
										if (!model?.id) return null;
										const providerStyle =
											PROVIDER_COLORS[model.provider] ?? PROVIDER_COLORS.Venice;
										return (
											<div
												key={model.id}
												className="group relative rounded-xl border border-border bg-panel p-4 transition-all hover:border-accent/50 hover:shadow-[0_0_15px_rgba(255,153,51,0.08)]"
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
													{Array.isArray(model.capabilities) &&
														model.capabilities.slice(0, 3).map((cap) => (
															<span
																key={String(cap)}
																className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-surface text-text-secondary border border-border/50"
															>
																{String(cap)}
															</span>
														))}
													{Array.isArray(model.capabilities) &&
														model.capabilities.length > 3 && (
															<span
																className="px-1.5 py-0.5 rounded text-[10px] text-text-muted cursor-help"
																title={`Additional capabilities: ${model.capabilities.slice(3).join(", ")}`}
															>
																+{model.capabilities.length - 3}
															</span>
														)}
												</div>

												<div className="mt-3 flex items-center justify-between text-xs">
													<span className="text-text-secondary">
														{model.contextLength ?? "—"}
													</span>
													<div className="flex items-center gap-2 text-[10px] font-mono">
														<span className="text-accent" aria-hidden="true">
															$
															{typeof model.inputPricePer1M === "number"
																? model.inputPricePer1M.toFixed(2)
																: "—"}
															/1M in
														</span>
														<span
															className="text-text-muted"
															aria-hidden="true"
														>
															·
														</span>
														<span
															className="text-text-secondary"
															aria-hidden="true"
														>
															$
															{typeof model.outputPricePer1M === "number"
																? model.outputPricePer1M.toFixed(2)
																: "—"}
															/1M out
														</span>
													</div>
												</div>
												{/* Screen-reader-only full pricing context. The visible
                            prices above use abbreviated $/1M tokens; SR users
                            get the same data plus the per-token suffix. */}
												<span className="sr-only">
													{`Input ${typeof model.inputPricePer1M === "number" ? formatPricePerToken(model.inputPricePer1M) : "unknown"} per token, output ${typeof model.outputPricePer1M === "number" ? formatPricePerToken(model.outputPricePer1M) : "unknown"} per token`}
												</span>
											</div>
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
								setSearch("");
								setSelectedTier(null);
							}}
							className="mt-4 text-sm text-accent hover:underline"
						>
							Clear filters
						</button>
					</div>
				)}
			</div>
		</div>
	);
}
