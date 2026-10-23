"use client";

import {
	Brain,
	Check,
	Link2,
	Search,
	Sparkles,
	Star,
	Trophy,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { Suspense, useMemo } from "react";
import { BreadcrumbListJsonLd } from "@/components/json-ld";
import { InViewFade } from "@/components/motion/in-view-fade";
import { Breadcrumb } from "@/components/shared/Breadcrumb";
import { MODEL_PAGES, TIER_COLORS, TIER_ORDER } from "@/lib/models-data";
import { ModelCard } from "./_components/ModelCard";
import { ModelFiltersSidebar } from "./_components/ModelFiltersSidebar";
import { SORT_OPTIONS, useModelFilters, type SortKey } from "./_hooks/useModelFilters";

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
		availableCount,
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
						<p className="page-intro max-w-2xl">
							Compare chat models, token prices, and context windows.
							Choose a model to explore its capabilities or try it in chat.
						</p>
						<p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
							{totalModels} provider routes in the catalog
							{availableCount !== null && (
								<>
									{" "}
									·{" "}
									<span className="text-accent">{availableCount}</span> enabled
								</>
							)}
							{availableCount === null && (
								<span className="ml-2 text-text-tertiary normal-case tracking-normal">
									· {isLoadingModels ? "loading live catalog…" : "live catalog unavailable"}
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
						<div className="flex shrink-0 flex-wrap items-center gap-2 sm:pt-1">
						<button type="button" onClick={resetFilters} className="btn-mono btn-outline">Clear filters</button>
						<button
							type="button"
							onClick={handleCopy}
							className="btn-mono btn-outline flex items-center gap-1.5"
						>
							{copied ? (
								<Check className="h-3.5 w-3.5" />
							) : (
								<Link2 className="h-3.5 w-3.5" />
							)}
							{copied ? "Copied!" : "Share Filters"}
						</button>
						</div>
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

					<div className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-border bg-panel px-4">
						<label htmlFor="models-sort" className="text-sm text-text-muted">Sort by</label>
						<select
							id="models-sort"
							value={sortBy}
							onChange={(event) => handleSort(event.target.value as SortKey)}
							className="min-h-12 flex-1 bg-panel py-3 pr-2 text-sm text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							{SORT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
						</select>
					</div>
				</div>

				{/* Advanced Filters Sidebar */}
				<div className="grid items-start gap-6 mb-8 lg:grid-cols-12">
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
					<div className="min-w-0 lg:col-span-9">
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

												<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
									Show all models
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

function ModelsSeoFallback() {
	return (
		<div className="bg-void">
			<div className="container-page py-14 sm:py-18 lg:py-22">
				<Breadcrumb items={[{ label: "Models" }]} />
				<span className="section-eyebrow-caps">AI Model Catalog</span>
				<h1 className="display-headline mt-3 text-text-bright">
					Every model, one catalog.
				</h1>
				<p className="page-intro max-w-2xl">
					Browse OMA&apos;s curated language-model catalog before the interactive
					filters load. Each model page includes provider, context window,
					capabilities, pricing, and copy-paste API examples.
				</p>
				<p className="mt-4 font-mono text-xs uppercase tracking-[0.18em] text-text-muted">
					{MODEL_PAGES.length} model pages · live provider availability loads in the browser
				</p>

				<section className="mt-10" aria-labelledby="static-model-list-heading">
					<h2
						id="static-model-list-heading"
						className="font-display text-xl font-medium text-text-bright"
					>
						Browse model pages
					</h2>
					<div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{MODEL_PAGES.map((model) => (
							<Link
								key={model.id}
								href={`/models/${model.id}`}
								className="rounded-[var(--radius-lg)] border border-border bg-panel p-4 transition-colors hover:border-accent/40"
							>
								<span className="block text-sm font-semibold text-text-bright">
									{model.name}
								</span>
								<span className="mt-1 block text-xs text-text-muted">
									{model.provider} · {model.tier} · {model.contextLength} context
								</span>
								<span className="mt-2 block font-mono text-[11px] text-accent">
									{model.id}
								</span>
							</Link>
						))}
					</div>
				</section>

				<nav
					aria-label="Model catalog resources"
					className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-border pt-5 text-sm text-text-secondary"
				>
					<Link href="/pricing" className="hover:text-accent">Compare pricing</Link>
					<Link href="/docs" className="hover:text-accent">API documentation</Link>
					<Link href="/getting-started" className="hover:text-accent">Getting started</Link>
					<Link href="/chat" className="hover:text-accent">Try the playground</Link>
				</nav>
			</div>
		</div>
	);
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
			<Suspense fallback={<ModelsSeoFallback />}>
				<ModelsPageInner />
			</Suspense>
		</>
	);
}
