"use client";

/**
 * MODEL SELECTOR REDESIGN — "Terminal Noir" Aesthetic
 *
 * Key changes:
 * - Glassmorphism dropdown with animated gradient border
 * - Model items have subtle hover glow that matches tier color
 * - Search input has a pulsing accent border when focused
 * - Tier filter pills use filled+outlined states for clear selection
 * - Selected model gets a left accent bar indicator
 * - Smooth spring transitions on open/close
 */

import { AnimatePresence, m } from "@/lib/framer-motion-client";
import { ChevronDown, Lock, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { displayName, isFreeChatModel } from "@/lib/model-utils";
import { type TierFilter, useSharedLiveModels } from "./chat-message-shared";
import { ModelLogo } from "@/components/ui/model-logo";

interface ModelSelectorProps {
	model: string;
	setModel: (m: string) => void;
	compact?: boolean;
	/** Whether the current user is authenticated (guest = false) */
	isAuthenticated?: boolean;
	/** Called when a guest tries to select a paid model */
	onAuthRequired?: (modelName: string) => void;
}

// Tier colors — more vivid, with glow variants
const tierStyles: Record<
	TierFilter,
	{ bg: string; text: string; glow: string; border: string }
> = {
	all: {
		bg: "bg-surface-elevated",
		text: "text-text-muted",
		glow: "transparent",
		border: "var(--color-border)",
	},
	frontier: {
		bg: "bg-amber/20",
		text: "text-amber",
		glow: "var(--color-amber-dim)",
		border: "var(--color-amber)",
	},
	premium: {
		bg: "bg-[color-mix(in_srgb,var(--color-violet)_20%,transparent)]",
		text: "text-[var(--color-violet)]",
		glow: "var(--color-violet-dim)",
		border: "var(--color-violet)",
	},
	mid: {
		bg: "bg-accent/10",
		text: "text-accent",
		glow: "var(--color-accent-glow)",
		border: "var(--color-accent)",
	},
	budget: {
		bg: "bg-accent/20",
		text: "text-accent",
		glow: "var(--color-accent-glow)",
		border: "var(--color-accent)",
	},
	reasoning: {
		bg: "bg-warning/20",
		text: "text-warning",
		glow: "var(--color-secondary-dim)",
		border: "var(--color-warning)",
	},
	coding: {
		bg: "bg-pink/20",
		text: "text-pink",
		glow: "var(--color-pink-dim)",
		border: "var(--color-pink)",
	},
	uncensored: {
		bg: "bg-error/20",
		text: "text-error",
		glow: "var(--color-error-dim)",
		border: "var(--color-error)",
	},
};

const dropdownVariants = {
	hidden: { opacity: 0, y: -12, scale: 0.96 },
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		transition: { type: "spring" as const, stiffness: 320, damping: 28 },
	},
	exit: {
		opacity: 0,
		y: -8,
		scale: 0.97,
		transition: { duration: 0.12 },
	},
};

const itemVariants = {
	hidden: { opacity: 0, x: -6 },
	visible: (i: number) => ({
		opacity: 1,
		x: 0,
		transition: {
			delay: i * 0.02,
			type: "spring" as const,
			stiffness: 400,
			damping: 30,
		},
	}),
};

export function ModelSelector({
	model,
	setModel,
	compact = false,
	isAuthenticated = false,
	onAuthRequired,
}: ModelSelectorProps) {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [tierFilter, setTierFilter] = useState<TierFilter>("all");
	const dropdownRef = useRef<HTMLDivElement>(null);
	const MODELS = useSharedLiveModels();

	useEffect(() => {
		if (!open) return;
		function handleClickOutside(e: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("click", handleClickOutside);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("click", handleClickOutside);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [open]);

	// Show ALL models in the dropdown. Free models work without auth;
	// paid models (Venice) require sign-in. Guests see a lock icon on
	// paid models and trigger the auth prompt on click. Use isFreeChatModel
	// (which checks the FREE_CHAT_MODEL_IDS set) so model-id-based free
	// detection works regardless of whether the live API returned
	// `provider` or `owned_by`.
	const isFreeModel = (m: { id: string; provider?: string }) =>
		isFreeChatModel(m.id, m.provider);

	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return MODELS.filter((m) => {
			const name = displayName(m.id, m.name);
			const matchesSearch =
				!q || name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
			// Tier pills (incl. reasoning/coding/uncensored) match against
			// `category`. To make the capability pills functional, derive
			// them from the id/name when category doesn't carry the tag.
			// (Deferred: plumb capabilities through ModelOption.)
			let matchesTier = tierFilter === "all";
			if (!matchesTier) {
				if (m.category === tierFilter) matchesTier = true;
				else if (tierFilter === "reasoning" && /(?:reason|r1|deepseek-r|o1|o3)/i.test(m.id)) matchesTier = true;
				else if (tierFilter === "coding" && /(?:coder|codex|codestral|deepseek-coder|qwen.*coder)/i.test(m.id)) matchesTier = true;
				else if (tierFilter === "uncensored" && /(?:uncensored|heretic|llama-3.1-unc)/i.test(m.id)) matchesTier = true;
			}
			return matchesSearch && matchesTier;
		});
	}, [search, tierFilter, MODELS]);

	const selectedModel = useMemo(
		() => MODELS.find((m) => m.id === model),
		[model, MODELS],
	);
	const selectedName = selectedModel
		? displayName(selectedModel.id, selectedModel.name)
		: null;

	return (
		<div ref={dropdownRef} className="relative">
			{/* ─── TRIGGER BUTTON ─── */}
			<button
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-haspopup="listbox"
				aria-label={`Select AI model — ${selectedName || "SELECT MODEL"}`}
				className={`
          flex items-center gap-2 bg-surface/70 border border-border-hi
          hover:border-accent/40 hover:bg-surface transition-[background-color,border-color,box-shadow,transform] duration-200 ease-out active:scale-[0.97]
          min-w-0 group rounded-md
          ${compact ? "w-full justify-between px-2 py-1.5" : "px-2.5 py-1.5"}
        `}
			>
				{/* Status dot — static emerald indicator for active selection */}
				<span className="relative flex h-2 w-2 shrink-0">
					<span className="relative inline-flex rounded-full h-2 w-2 bg-accent" />
				</span>
				<span className="text-[12px] text-text-bright font-mono truncate min-w-0 max-w-[12rem]">
					{selectedName || "SELECT MODEL"}
				</span>
				<ChevronDown
					className={`
            w-3.5 h-3.5 text-text-muted shrink-0 transition-transform duration-200
            ${open ? "rotate-180" : ""}
          `}
				/>
			</button>

			{/* ─── DROPDOWN ─── */}
			<AnimatePresence>
				{open && (
					<m.div
						initial="hidden"
						animate="visible"
						exit="exit"
						variants={dropdownVariants}
						className="
              glass-strong absolute top-full left-0 mt-1.5 w-[calc(100vw-2rem)] max-w-sm sm:w-80 overflow-hidden z-50
            "
						style={{
							boxShadow: "var(--shadow-dropdown)",
							transformOrigin: "top left",
						}}
						role="listbox"
						aria-label="Available AI models"
					>
						{/* ─── Search + Tier Filters ─── */}
						{!compact && (
							<div className="p-2 border-b border-border/50">
								<div className="relative">
									<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
									<input
										type="text"
										name="model-search"
										value={search}
										onChange={(e) => setSearch(e.target.value)}
										placeholder="SEARCH MODELS..."
										aria-label="Search models"
										className="
                      w-full pl-9 pr-3 py-2 bg-void border border-border
                      text-sm text-text-secondary font-mono placeholder-text-muted
                      focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void
                      transition-[border-color,box-shadow] duration-200 ease-out
                    "
									/>
								</div>
								{/* Tier filter pills */}
								<div className="flex gap-1 mt-2 flex-wrap">
									{(
										[
											"all",
											"frontier",
											"premium",
											"mid",
											"budget",
											"reasoning",
											"coding",
											"uncensored",
										] as TierFilter[]
									).map((tier) => {
										const isActive = tierFilter === tier;
										const style = tierStyles[tier];
										return (
											<button
												type="button"
												key={tier}
												onClick={(e) => {
													e.stopPropagation();
													setTierFilter(tier);
												}}
												aria-label={`Filter by ${tier} tier`}
												aria-pressed={isActive}
												className={`
                          px-2 py-1.5 min-h-[36px] text-[10px] font-mono uppercase tracking-wider
                          transition-[background-color,color,border-color,box-shadow,transform] duration-150 ease-out active:scale-[0.97] rounded-[var(--radius-sm)]
                          ${
														isActive
															? `${style.bg} ${style.text} border`
															: "bg-surface/50 text-text-muted hover:text-text-secondary border border-transparent"
													}
                          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                          focus-visible:ring-offset-1 focus-visible:ring-offset-void
                        `}
												style={
													isActive ? { borderColor: style.border } : undefined
												}
											>
												{tier}
											</button>
										);
									})}
								</div>
							</div>
						)}

						{/* ─── Model List ─── */}
						<div
							className={`overflow-y-auto p-1.5 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent ${compact ? "max-h-72" : "max-h-64"}`}
						>
							{filtered.length === 0 ? (
								<div className="p-4 text-center text-xs text-text-muted font-mono">
									NO MODELS FOUND
								</div>
							) : (
								filtered.map((modelItem, i) => {
									const name = displayName(modelItem.id, modelItem.name);
									const isSelected = modelItem.id === model;
									const free = isFreeModel(modelItem);
									const locked = !isAuthenticated && !free;
									const tierStyle =
										tierStyles[modelItem.category as TierFilter] ||
										tierStyles.all;
									return (
										<m.button
											key={modelItem.id}
											custom={i}
											variants={itemVariants}
											initial="hidden"
											animate="visible"
											onClick={() => {
												if (locked) {
													onAuthRequired?.(name);
													setOpen(false);
													return;
												}
												setModel(modelItem.id);
												setOpen(false);
												setSearch("");
												setTierFilter("all");
											}}
											role="option"
											aria-selected={isSelected}
											aria-label={`${name}, ${modelItem.category} tier, ${modelItem.ctx} context${locked ? ", requires sign-in" : ", free"}`}
											className={`
                        w-full flex items-center justify-between text-left
                        ${compact ? "px-2 py-1.5" : "px-3 py-2.5"}
                        transition-[background-color,color] duration-150 ease-out relative
                        ${
													isSelected
														? "bg-accent/10 text-accent"
														: locked
															? "hover:bg-surface/40 text-text-muted/60"
															: "hover:bg-surface/80 text-text-secondary"
												}
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent
                        focus-visible:ring-offset-1 focus-visible:ring-offset-void
                      `}
										>
											{/* Left accent bar for selected */}
											{isSelected && (
												<div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-accent" />
											)}
											<div className="min-w-0">
												<div className="text-sm font-mono truncate flex items-center gap-1.5">
													<ModelLogo modelId={modelItem.id} size={16} />
													{name}
													{free && (
														<span className="text-[9px] px-1 py-0.5 bg-accent/15 text-accent font-mono uppercase tracking-wide shrink-0">
															Free
														</span>
													)}
												</div>
												<div className="text-[10px] text-text-muted font-mono truncate">
													{modelItem.ctx} CTX · {modelItem.id}
												</div>
											</div>
											<div className="text-right shrink-0 ml-2 flex items-center gap-1.5">
												{locked && (
													<Lock className="w-3 h-3 text-text-muted/50" />
												)}
												<div>
													<div
														className={`
                            text-[10px] px-1.5 py-0.5 font-mono uppercase
                            ${tierStyle.bg} ${tierStyle.text}
                          `}
													>
														{modelItem.category}
													</div>
													<div className="text-[10px] text-text-muted font-mono mt-1">
														{free ? "$0.00" : `$${modelItem.inputPer1M.toFixed(2)}`}/1M IN
													</div>
												</div>
											</div>
										</m.button>
									);
								})
							)}
						</div>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}
