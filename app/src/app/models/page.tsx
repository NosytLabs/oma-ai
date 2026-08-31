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
import { Suspense, useMemo } from "react";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { InViewFade } from "@/components/motion/in-view-fade";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { Button } from "@/components/ui/button";
import { springs } from "@/lib/animation";
import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { TIER_COLORS, TIER_ORDER } from "@/lib/models-data";
import { ModelCard } from "./_components/ModelCard";
import { ModelFiltersSidebar } from "./_components/ModelFiltersSidebar";
import { SORT_OPTIONS, useModelFilters } from "./_hooks/useModelFilters";

const TIER_ICONS: Record<string, React.ReactNode> = {
	budget: <Zap className="h-4 w-4" />,
	mid: <Star className="h-4 w-4" />,
	premium: <Sparkles className="h-4 w-4" />,
	frontier: <Trophy className="h-4 w-4" />,
};

function ModelsPageInner() {
	const {
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
		availableProviders,
		groupedModels,
		totalModels,
		visibleModels,
		hasFilters,
		allInputModalities,
		allOutputModalities,
		allCapabilities,

		// Handlers
		handleSearch,
		handleTier,
		handleProvider,
		handleSort,
		handleCopy,
		resetFilters,
	} = useModelFilters();

	const activeGroupIcons = useMemo(() => {
		const icons: Record<string, React.ReactNode> = {};
		for (const tier of TIER_ORDER) {
			icons[tier] = TIER_ICONS[tier];
		}
		return icons;
	}, []);

	return (
		<div className="bg-void">
			<div className="container-page py-14 sm:py-18 lg:py-22">
				{/* Breadcrumb */}
				<Breadcrumb items={[{ label: "Models" }]} />

				{/* Header */}
				<div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<span className="section-eyebrow-caps">AI Model Catalog</span>
						<h1 className="display-headline mt-3 text-text-bright">
							Every model, one&nbsp;catalog.
						</h1>
						<p className="page-intro mt-4 max-w-2xl">
							Curated chat models from Venice and OMA-AI, all reachable
							through one OpenAI-compatible endpoint. Filter by tier,
							provider, capabilities, or context window to find what you
							need.
						</p>
						<p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
							{totalModels} models available
							{isLoadingModels && (
								<span className="ml-2 text-text-tertiary normal-case tracking-normal">
									· loading full catalog…
								</span>
							)}
							{visibleModels < totalModels && (
								<span className="text-text-tertiary">
									{" "}
									·{" "}
									<span className="text-accent">{visibleModels}</span>{" "}
									shown
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
							leftIcon={
								copied ? (
									<Check className="h-3.5 w-3.5" />
								) : (
									<Link2 className="h-3.5 w-3.5" />
								)
							}
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
							suppressHydrationWarning
							className="w-full rounded-[var(--radius-xl)] border border-border bg-panel py-3 pl-10 pr-4 text-text placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
							aria-label="Search models by name or ID"
						/>
					</div>

					{/* Sort Dropdown */}
					<div className="relative">
						<button
							type="button"
							onClick={() => setSortOpen(!sortOpen)}
							className="flex items-center gap-2 rounded-[var(--radius-xl)] border border-border bg-panel px-4 py-3 text-sm text-text-secondary hover:border-accent transition-[color,transform,border-color] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
							aria-haspopup="listbox"
							aria-expanded={sortOpen}
						>
							<span className="text-text-muted">Sort:</span>
							<span className="text-text-bright">
								{SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
							</span>
							<ChevronDown className="h-3.5 w-3.5 text-text-muted" />
						</button>
						<AnimatePresence>
							{sortOpen && (
								<m.div
									initial={{ opacity: 0, scale: 0.95 }}
									animate={{ opacity: 1, scale: 1 }}
									exit={{ opacity: 0, scale: 0.95 }}
									transition={springs.soft}
									className="absolute right-0 mt-1 z-50 w-48 rounded-[var(--radius-xl)] border border-border bg-panel shadow-xl origin-top-right"
									role="listbox"
								>
									{SORT_OPTIONS.map((opt) => (
										<button
											type="button"
											key={opt.value}
											onClick={() => handleSort(opt.value)}
											className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors duration-200 ease-out ${
												sortBy === opt.value
													? "text-accent bg-surface"
													: "text-text-secondary hover:bg-surface hover:text-text-bright"
											}`}
											role="option"
											aria-selected={sortBy === opt.value}
										>
											{opt.label}
											{sortBy === opt.value && (
												<Check className="h-3.5 w-3.5" />
											)}
										</button>
									))}
								</m.div>
							)}
						</AnimatePresence>
					</div>
				</div>

				{/* Advanced Filters Sidebar */}
				<div className="grid gap-6 mb-8 lg:grid-cols-12">
					<div className="lg:col-span-3">
						<ModelFiltersSidebar
							TIER_ORDER={TIER_ORDER}
							TIER_ICONS={TIER_ICONS}
							selectedTier={selectedTier}
							handleTier={handleTier}
							availableProviders={availableProviders}
							selectedProvider={selectedProvider}
							handleProvider={handleProvider}
							allInputModalities={allInputModalities}
							inputModalities={inputModalities}
							setInputModalities={setInputModalities}
							allOutputModalities={allOutputModalities}
							outputModalities={outputModalities}
							setOutputModalities={setOutputModalities}
							allCapabilities={allCapabilities}
							capabilities={capabilities}
							setCapabilities={setCapabilities}
							contextRange={contextRange}
							setContextRange={setContextRange}
							priceRange={priceRange}
							setPriceRange={setPriceRange}
						/>
					</div>

					{/* Model Grid */}
					<div className="lg:col-span-9">
						{groupedModels.length > 0 ? (
							<div className="space-y-10">
								{groupedModels.map((group) => {
									const groupIcon = activeGroupIcons[group.tier];
									return (
										<InViewFade key={group.tier} eager delay={0}>
											<section>
												<div className="flex items-center gap-2 mb-4">
													{groupIcon && (
														<span
															className={`p-1.5 rounded-[var(--radius-md)] ${
																TIER_COLORS[
																	group.tier as keyof typeof TIER_COLORS
																]?.bg || "bg-panel"
															}`}
														>
															{groupIcon}
														</span>
													)}
													<h2 className="font-display text-xl font-medium text-text-bright">
														{group.label}
													</h2>
													<span className="text-xs text-text-muted font-geometric tabular-nums">
														({group.models.length})
													</span>
												</div>

												<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
													{group.models.map((model, i) => (
														<ModelCard key={model.id} model={model} index={i} />
													))}
												</div>
											</section>
										</InViewFade>
									);
								})}
							</div>
						) : (
							<div className="text-center py-20">
								<Brain className="h-12 w-12 text-text-muted mx-auto mb-4" />
								<p className="text-text-secondary">
									No models match your search.
								</p>
								<button
									type="button"
									onClick={resetFilters}
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

export { formatPriceRange } from "./_hooks/useModelFilters";

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
					<div className="bg-void">
						<div className="container-page py-14 sm:py-18 lg:py-22">
							<div className="h-8 w-32 bg-panel rounded-[var(--radius-sm)] animate-pulse mb-8" />
							<div className="h-10 w-64 bg-panel rounded-[var(--radius-sm)] animate-pulse mb-4" />
							<div className="h-4 w-48 bg-panel rounded-[var(--radius-sm)] animate-pulse mb-6" />
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
								{Array.from({ length: 8 }).map((_, i) => (
									<div
										key={i}
										className="h-36 bg-panel rounded-[var(--radius-xl)] animate-pulse"
									/>
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
