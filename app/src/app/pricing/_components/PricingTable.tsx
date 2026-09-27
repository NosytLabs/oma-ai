"use client";

import { useMemo, useState } from "react";
import { ArrowUpDown, ChevronDown, Search } from "lucide-react";
import { ModelLogo } from "@/components/ui/model-logo";
import { fmtPrice } from "../_lib/pricing-utils";
import type { PricedModel, Category, AvailabilityStatus } from "../_lib/pricing-utils";

interface PricingTableProps {
	models: PricedModel[];
	availabilityStatus?: AvailabilityStatus;
	category: Category;
	setCategory: (cat: Category) => void;
	categories: { key: Category; label: string }[];
	categoryStyles: Record<Category, { active: string; inactive: string }>;
}

type SortField = "name" | "inputPrice" | "outputPrice" | "context";
type SortOrder = "asc" | "desc";

export function PricingTable({
	models,
	availabilityStatus = "live",
	category,
	setCategory,
	categories,
	categoryStyles,
}: PricingTableProps) {
	// Search, provider filter, context filter
	const [searchQuery, setSearchQuery] = useState("");
	const [selectedProvider, setSelectedProvider] = useState<string>("all");
	const [minContext, setMinContext] = useState<number>(0);

	// Sort state
	const [sortField, setSortField] = useState<SortField>("inputPrice");
	const [sortOrder, setSortOrder] = useState<SortOrder>("asc");

	// Get all distinct providers from the model list for the provider dropdown
	const providers = useMemo(() => {
		const set = new Set<string>();
		for (const m of models) {
			if (m.provider) {
				set.add(m.provider);
			}
		}
		return Array.from(set).sort();
	}, [models]);

	// Filter logic
	const filteredModels = useMemo(() => {
		return models.filter((m) => {
			// Category filter (by tier)
			if (category !== "all" && m.category !== category) return false;

			// Provider filter
			if (selectedProvider !== "all" && m.provider !== selectedProvider) return false;

			// Context window filter (contextTokens represents the raw number of tokens)
			if (minContext > 0 && m.contextTokens < minContext) return false;

			// Search query filter (matches model name, model ID, or provider)
			if (searchQuery) {
				const query = searchQuery.toLowerCase();
				const nameMatch = m.name.toLowerCase().includes(query);
				const idMatch = m.id.toLowerCase().includes(query);
				const providerMatch = m.provider.toLowerCase().includes(query);
				if (!nameMatch && !idMatch && !providerMatch) return false;
			}

			return true;
		});
	}, [models, category, selectedProvider, minContext, searchQuery]);

	// Sorting logic
	const sortedModels = useMemo(() => {
		const sorted = [...filteredModels];
		sorted.sort((a, b) => {
			let comparison = 0;
			if (sortField === "name") {
				comparison = a.name.localeCompare(b.name);
			} else if (sortField === "inputPrice") {
				comparison = a.inputPer1M - b.inputPer1M;
			} else if (sortField === "outputPrice") {
				comparison = a.outputPer1M - b.outputPer1M;
			} else if (sortField === "context") {
				comparison = a.contextTokens - b.contextTokens;
			}

			return sortOrder === "asc" ? comparison : -comparison;
		});
		return sorted;
	}, [filteredModels, sortField, sortOrder]);

	const toggleSort = (field: SortField) => {
		if (sortField === field) {
			setSortOrder(sortOrder === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortOrder("asc");
		}
	};

	return (
		<div className="rounded-[var(--radius-xl)] border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden shadow-[var(--shadow-md)]">
			{/* Filter & Search Toolbar */}
			<div className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]/30 p-4 sm:px-6">
				{/* Category Tiers Tabs */}
				<div className="flex flex-wrap gap-2 mb-4">
					{categories.map((cat) => {
						const active = category === cat.key;
						return (
							<button
								type="button"
								key={cat.key}
								onClick={() => setCategory(cat.key)}
								aria-label={`Filter models by ${cat.label} tier`}
								aria-pressed={active}
								className={`relative px-3 py-2 min-h-[44px] min-w-[44px] text-xs font-mono font-medium rounded-full transition-[color,transform] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)] active:scale-[0.97] ${
									active
										? categoryStyles[cat.key].active
										: categoryStyles[cat.key].inactive
								}`}
							>
								{cat.label}
							</button>
						);
					})}
				</div>

				{/* Advanced Filters Grid */}
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
					{/* Search */}
					<div className="relative">
						<label htmlFor="search-models" className="sr-only">
							Search AI Models
						</label>
						<div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
							<Search className="h-4 w-4 text-text-muted" aria-hidden="true" />
						</div>
						<input
							type="text"
							id="search-models"
							aria-label="Search models by name, provider, or ID"
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search models..."
							className="h-11 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] pl-10 pr-4 text-sm text-text-bright placeholder-text-muted focus:border-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
						/>
					</div>

					{/* Provider Select */}
					<div className="relative">
						<label htmlFor="filter-provider" className="sr-only">
							Filter by Provider
						</label>
						<select
							id="filter-provider"
							aria-label="Filter models by provider"
							value={selectedProvider}
							onChange={(e) => setSelectedProvider(e.target.value)}
							className="h-11 w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pr-10 text-sm text-text-bright focus:border-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
						>
							<option value="all">All Providers</option>
							{providers.map((p) => (
								<option key={p} value={p}>
									{p}
								</option>
							))}
						</select>
						<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
							<ChevronDown className="h-4 w-4 text-text-muted" aria-hidden="true" />
						</div>
					</div>

					{/* Context Window Select */}
					<div className="relative">
						<label htmlFor="filter-context" className="sr-only">
							Filter by Context Window
						</label>
						<select
							id="filter-context"
							aria-label="Filter models by minimum context window size"
							value={minContext}
							onChange={(e) => setMinContext(Number(e.target.value))}
							className="h-11 w-full appearance-none rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 pr-10 text-sm text-text-bright focus:border-[var(--color-accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
						>
							<option value={0}>Any Context Window</option>
							<option value={8000}>&ge; 8K tokens</option>
							<option value={32000}>&ge; 32K tokens</option>
							<option value={128000}>&ge; 128K tokens</option>
							<option value={200000}>&ge; 200K tokens</option>
							<option value={1000000}>&ge; 1M tokens</option>
						</select>
						<div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
							<ChevronDown className="h-4 w-4 text-text-muted" aria-hidden="true" />
						</div>
					</div>
				</div>

				<div className="mt-4 flex items-center justify-between text-xs text-text-muted font-mono">
					<span aria-live="polite">
						Showing {sortedModels.length} of {models.filter(m => category === "all" || m.category === category).length} models
					</span>
					{(searchQuery || selectedProvider !== "all" || minContext > 0) && (
						<button
							type="button"
							onClick={() => {
								setSearchQuery("");
								setSelectedProvider("all");
								setMinContext(0);
							}}
							aria-label="Clear all search and filter criteria"
							className="rounded px-1 text-[var(--color-accent)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
						>
							Clear filters
						</button>
					)}
				</div>
			</div>

			{/* Horizontal scroll wrapper with gradient hint. `min-w-0` matters:
			    without it this block is a grid/flex item in some viewports and
			    the `min-w-[36rem]` table widens the track instead of scrolling. */}
			<div className="relative min-w-0 max-w-full">
				{/* Right gradient hint for scrollable content */}
				<div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent pointer-events-none z-10 hidden sm:block" />

				<div className="max-w-full min-w-0 overflow-x-auto overscroll-x-contain scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent [-webkit-overflow-scrolling:touch]" tabIndex={0} role="region" aria-label="Pricing comparison table. Use horizontal scrolling to view all columns.">
					<table
						className="w-full min-w-[36rem] text-left table-fixed"
						aria-label="Model pricing by tier"
					>
						<colgroup>
							<col className="w-1/3 min-w-[12rem]" />
							<col className="w-1/6 min-w-[6rem]" />
							<col className="w-1/6 min-w-[6rem]" />
							<col className="w-1/6 min-w-[6rem]" />
							<col className="w-1/6 min-w-[4rem]" />
						</colgroup>
						<thead>
							<tr className="border-b border-[var(--color-border)] bg-[var(--color-surface-elevated)]">
								<th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted">
									<button
										type="button"
										onClick={() => toggleSort("name")}
										aria-label={`Model, sort by model name. Current order: ${sortField === "name" ? sortOrder : "none"}`}
										className="group inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded px-1 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
									>
										Model
										<ArrowUpDown className="h-3 w-3 text-text-muted group-hover:text-text-bright transition-colors" />
									</button>
								</th>
								<th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted">
									Provider
								</th>
								<th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right">
									<button
										type="button"
										onClick={() => toggleSort("inputPrice")}
										aria-label={`Input / 1M, sort by input price. Current order: ${sortField === "inputPrice" ? sortOrder : "none"}`}
										className="group ml-auto inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded px-1 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
									>
										Input / 1M
										<ArrowUpDown className="h-3 w-3 text-text-muted group-hover:text-text-bright transition-colors" />
									</button>
								</th>
								<th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right">
									<button
										type="button"
										onClick={() => toggleSort("outputPrice")}
										aria-label={`Output / 1M, sort by output price. Current order: ${sortField === "outputPrice" ? sortOrder : "none"}`}
										className="group ml-auto inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded px-1 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
									>
										Output / 1M
										<ArrowUpDown className="h-3 w-3 text-text-muted group-hover:text-text-bright transition-colors" />
									</button>
								</th>
								<th scope="col" className="px-4 py-4 text-xs font-display font-semibold uppercase tracking-widest text-text-muted text-right">
									<button
										type="button"
										onClick={() => toggleSort("context")}
										aria-label={`Ctx, sort by context length. Current order: ${sortField === "context" ? sortOrder : "none"}`}
										className="group ml-auto inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded px-1 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
									>
										Ctx
										<ArrowUpDown className="h-3 w-3 text-text-muted group-hover:text-text-bright transition-colors" />
									</button>
								</th>
							</tr>
						</thead>
						{/* key=category re-triggers stagger on filter change */}
						<tbody key={`${category}-${sortField}-${sortOrder}-${selectedProvider}-${minContext}-${searchQuery}`}>
							{sortedModels.length > 0 ? (
								sortedModels.map((mm, i) => (
									<tr
										key={mm.id}
										style={{
											animation: `fadeInUp 0.3s ease-out ${Math.min(i, 20) * 0.035}s both`,
										}}
										className={`border-b border-[var(--color-border)]/50 transition-colors duration-200 ease-out hover:bg-[var(--color-surface-elevated)]/50 ${i % 2 === 1 ? "bg-[var(--color-surface-elevated)]/30" : ""}`}
									>
										<td className="px-4 py-3">
											<div className="flex items-center gap-2">
												<ModelLogo modelId={mm.id} size={18} />
												<span className="text-sm font-medium text-text-bright truncate">
													{mm.name}
												</span>
												{/* `available:false` = the backing provider's key is missing
												    or a placeholder, so the model 503s. This is the
												    page where visitors commit to buying, so say so
												    instead of quoting a price for a dead model. */}
												{availabilityStatus !== "live" ? (
													<span className="shrink-0 rounded-[var(--radius-sm)] border border-border px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-text-muted">
														{availabilityStatus === "checking" ? "Checking" : "Unverified"}
													</span>
												) : mm.available === false && (
													<span
														title="This model is currently unavailable. The listed price applies when it is available."
														className="shrink-0 rounded-[var(--radius-sm)] border border-amber/30 bg-amber/10 px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-amber"
													>
														Unavailable
													</span>
												)}
												</div>
											<span className="ml-7 mt-0.5 hidden max-w-[200px] truncate font-mono text-xs text-text-secondary sm:block">
												{mm.id}
											</span>
										</td>
										<td className="px-4 py-3">
											<span
												className={`inline-flex items-center rounded-[var(--radius-sm)] px-2 py-1 text-xs font-mono font-medium ${
													mm.provider === "Venice"
														? "bg-[color-mix(in_srgb,var(--color-accent)_20%,transparent)] text-[var(--color-accent)]"
														: mm.provider === "OMA-AI"
															? "bg-[color-mix(in_srgb,var(--color-provider-oma-ai)_20%,transparent)] text-[var(--color-provider-oma-ai)]"
															: "bg-[color-mix(in_srgb,var(--color-secondary)_20%,transparent)] text-[var(--color-secondary)]"
												}`}
											>
												{mm.provider}
											</span>
										</td>
										{/* An unavailable model must not render its price in the
										    accent colour: a dimmed row with a live-looking green
										    price implies the model can actually be bought. The same
										    treatment has to cover BOTH price columns -- striking the
										    input while leaving the output in text-text-secondary (the
										    exact colour a live value uses) made half a dead model's
										    price read as buyable. Context is muted but not struck:
										    a line through "128K" reads as a typo, not as unavailable. */}
										<td
											className={`px-4 py-3 text-right font-mono tabular-nums text-sm font-medium ${
												availabilityStatus !== "live" ? "text-text-muted" : mm.available === false
													? "text-text-muted line-through"
													: "text-[var(--color-accent)]"
											}`}
										>
											{fmtPrice(mm.inputPer1M)}
										</td>
										<td
											className={`px-4 py-3 text-right font-mono tabular-nums text-sm font-medium ${
												availabilityStatus !== "live" ? "text-text-muted" : mm.available === false
													? "text-text-muted line-through"
													: "text-text-secondary"
											}`}
										>
											{fmtPrice(mm.outputPer1M)}
										</td>
										<td
											className={`px-4 py-3 text-right text-xs font-mono tabular-nums ${
												availabilityStatus !== "live" || mm.available === false
													? "text-text-muted"
													: "text-text-secondary"
											}`}
										>
											{mm.ctx}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={5} className="px-4 py-12 text-center text-sm text-text-secondary">
										No models found matching your filters.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				{/* Mobile scroll indicator - swipe hint */}
				<div className="sm:hidden flex items-center justify-center py-2 text-[10px] sm:text-xs text-text-muted">
					<span className="font-mono">Swipe to scroll &rarr;</span>
				</div>
			</div>
		</div>
	);
}
