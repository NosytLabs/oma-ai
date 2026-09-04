"use client";

import type React from "react";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { PROVIDER_COLORS } from "@/lib/models-data";
import {
	formatContextRange,
	formatPriceRange,
} from "../_hooks/useModelFilters";
import { TIER_LABELS } from "../_lib/labels";

interface ModelFiltersSidebarProps {
	TIER_ORDER: readonly ("budget" | "mid" | "premium" | "frontier")[];
	TIER_ICONS: Record<string, React.ReactNode>;
	selectedTier: string | null;
	handleTier: (tier: string | null) => void;
	availableProviders: string[];
	selectedProvider: string | null;
	handleProvider: (provider: string | null) => void;
	allInputModalities: string[];
	inputModalities: string[];
	setInputModalities: React.Dispatch<React.SetStateAction<string[]>>;
	allOutputModalities: string[];
	outputModalities: string[];
	setOutputModalities: React.Dispatch<React.SetStateAction<string[]>>;
	allCapabilities: string[];
	capabilities: string[];
	setCapabilities: React.Dispatch<React.SetStateAction<string[]>>;
	contextRange: [number, number];
	setContextRange: React.Dispatch<React.SetStateAction<[number, number]>>;
	priceRange: [number, number];
	setPriceRange: React.Dispatch<React.SetStateAction<[number, number]>>;
}

export const ModelFiltersSidebar: React.FC<ModelFiltersSidebarProps> = ({
	TIER_ORDER,
	TIER_ICONS,
	selectedTier,
	handleTier,
	availableProviders,
	selectedProvider,
	handleProvider,
	allInputModalities,
	inputModalities,
	setInputModalities,
	allOutputModalities,
	outputModalities,
	setOutputModalities,
	allCapabilities,
	capabilities,
	setCapabilities,
	contextRange,
	setContextRange,
	priceRange,
	setPriceRange,
}) => {
	const [moreOpen, setMoreOpen] = useState(false);
	const advancedCount =
		inputModalities.length +
		outputModalities.length +
		capabilities.length +
		(contextRange[0] > 0 || contextRange[1] < 2_000_000 ? 1 : 0) +
		(priceRange[0] > 0 || priceRange[1] < 1000 ? 1 : 0);

	return (
		<div className="space-y-4">
			{/* Tier Filter Chips */}
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={() => handleTier(null)}
					className={`px-3 py-1.5 rounded-full text-xs font-medium transition-[color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
						className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-[color,transform] duration-200 ease-out active:scale-[0.97] ${
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

			{/* Provider Filter Chips */}
			{availableProviders.length > 1 && (
				<div className="flex flex-wrap gap-2">
					<button
						type="button"
						onClick={() => handleProvider(null)}
						className={`px-3 py-1.5 rounded-full text-xs font-medium transition-[color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
							!selectedProvider
								? "bg-text-bright text-void"
								: "bg-panel text-text-secondary border border-border hover:border-text-bright"
						}`}
					>
						All Providers
					</button>
					{availableProviders.map((p) => {
						const pStyle =
							PROVIDER_COLORS[p as keyof typeof PROVIDER_COLORS] ||
							PROVIDER_COLORS.Venice;
						return (
							<button
								type="button"
								key={p}
								onClick={() =>
									handleProvider(selectedProvider === p ? null : p)
								}
								className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-[color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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

			<button
				type="button"
				onClick={() => setMoreOpen((open) => !open)}
				aria-expanded={moreOpen}
				className="flex min-h-11 w-full items-center justify-between rounded-[var(--radius-lg)] border border-border bg-panel px-3 text-xs font-medium text-text-secondary transition-[border-color,background-color,color,transform] duration-200 ease-out hover:border-accent hover:text-text-bright active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent lg:hidden"
			>
				<span>
					More filters
					{advancedCount > 0 ? (
						<span className="ml-2 rounded-full bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
							{advancedCount}
						</span>
					) : null}
				</span>
				<ChevronDown
					className={`h-3.5 w-3.5 transition-transform duration-200 ${moreOpen ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>

		{/* Input Modalities — hidden while the catalog exposes a single
			option (today: text-only). Reappears automatically if a new
			modality lands in the catalog. */}
		<div className={`${moreOpen ? "block" : "hidden"} space-y-4 lg:block`}>
		<div className={allInputModalities.length > 1 ? undefined : "hidden"}>
				<h2 className="font-mono text-xs uppercase tracking-widest text-text mb-2">
					Input Modalities
				</h2>
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
							className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-[color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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

		{/* Output Modalities — same single-option rule as inputs. */}
		<div className={allOutputModalities.length > 1 ? undefined : "hidden"}>
				<h2 className="font-mono text-xs uppercase tracking-widest text-text mb-2">
					Output Modalities
				</h2>
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
							className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-[color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
				<h2 className="font-mono text-xs uppercase tracking-widest text-text mb-2">
					Capabilities
				</h2>
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
							className={`flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-[color,transform] duration-200 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
								capabilities.includes(cap)
									? "bg-accent text-void"
									: "bg-panel text-text-secondary border border-border hover:border-accent"
							}`}
						>
							{cap.charAt(0).toUpperCase() + cap.slice(1)}
						</button>
					))}
				</div>
			</div>

			{/* Context Range Slider */}
			<div>
				<h2 className="font-mono text-xs uppercase tracking-widest text-text mb-2">
				Context Window
			</h2>
			<div className="space-y-2">
				<div className="flex justify-between text-xs text-text-muted">
					<span>{contextRange[0] <= 0 ? "Any" : formatContextRange(contextRange[0])}</span>
						<span>{formatContextRange(contextRange[1])}</span>
					</div>
					<div className="relative h-8">
						<input
							type="range"
							min={0}
							max={2000000}
							step={1000}
							value={contextRange[0]}
							onChange={(e) => {
								const v = Number(e.target.value);
								setContextRange([
									Math.min(v, contextRange[1]),
									contextRange[1],
								]);
							}}
							aria-label="Minimum context window"
							suppressHydrationWarning
							className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
						/>
						<input
							type="range"
							min={0}
							max={2000000}
							step={1000}
							value={contextRange[1]}
							onChange={(e) => {
								const v = Number(e.target.value);
								setContextRange([
									contextRange[0],
									Math.max(v, contextRange[0]),
								]);
							}}
							aria-label="Maximum context window"
							suppressHydrationWarning
							className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
						/>
						<div
							aria-hidden
							className="absolute top-1/2 -translate-y-1/2 h-1 bg-accent/40 rounded-full"
							style={{
								left: `${(contextRange[0] / 2000000) * 100}%`,
								right: `${100 - (contextRange[1] / 2000000) * 100}%`,
							}}
						/>
					</div>
				</div>
			</div>

			{/* Price Range Slider */}
			<div>
				<h2 className="font-mono text-xs uppercase tracking-widest text-text mb-2">
					Price (per 1M tokens)
				</h2>
				<div className="space-y-2">
					<div className="flex justify-between text-xs text-text-muted">
						<span>{formatPriceRange(priceRange[0])}</span>
						<span>{formatPriceRange(priceRange[1])}</span>
					</div>
					<div className="relative h-8">
						<input
							type="range"
							min={0}
							max={1000}
							step={0.1}
							value={priceRange[0]}
							onChange={(e) => {
								const v = Number(e.target.value);
								setPriceRange([Math.min(v, priceRange[1]), priceRange[1]]);
							}}
							aria-label="Minimum input price"
							suppressHydrationWarning
							className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
						/>
						<input
							type="range"
							min={0}
							max={1000}
							step={0.1}
							value={priceRange[1]}
							onChange={(e) => {
								const v = Number(e.target.value);
								setPriceRange([priceRange[0], Math.max(v, priceRange[0])]);
							}}
							aria-label="Maximum input price"
							suppressHydrationWarning
							className="absolute inset-0 w-full h-full appearance-none bg-transparent pointer-events-none [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent [&::-webkit-slider-thumb]:cursor-grab [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-accent [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-grab"
						/>
						<div
							aria-hidden
							className="absolute top-1/2 -translate-y-1/2 h-1 bg-accent/40 rounded-full"
							style={{
								left: `${(priceRange[0] / 1000) * 100}%`,
								right: `${100 - (priceRange[1] / 1000) * 100}%`,
							}}
						/>
					</div>
				</div>
			</div>
			</div>
		</div>
	);
};
