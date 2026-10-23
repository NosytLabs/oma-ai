"use client";

import { ChevronRight, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDialog } from "@/lib/use-dialog";
import { NAV_ITEMS, type NavItem } from "../_lib/nav-data";
import { revealDocAnchor } from "../_lib/use-initial-doc-anchor";

interface SearchResult {
	item: NavItem;
	matchedOn: string;
	isHeading?: boolean;
	headingId?: string;
	headingLabel?: string;
}

function searchDocs(query: string): SearchResult[] {
	const q = query.trim().toLowerCase();
	if (!q || q.length < 2) return [];

	const results: SearchResult[] = [];

	for (const item of NAV_ITEMS) {
		let score = 0;
		const matches: string[] = [];

		// Direct label match (highest priority)
		if (item.label.toLowerCase().includes(q)) {
			score += 10;
			matches.push(item.label);
		}
		// ID match
		if (item.id.toLowerCase().includes(q)) {
			score += 5;
			matches.push(item.id);
		}
		// Keyword match
		for (const kw of item.keywords) {
			if (kw.toLowerCase().includes(q)) {
				score += 3;
				matches.push(kw);
			}
		}

		if (score > 0) {
			results.push({
				item,
				matchedOn: matches[0] ?? item.label,
			});
		}

		// Search headings too
		for (const h of item.headings) {
			if (h.label.toLowerCase().includes(q) || h.id.toLowerCase().includes(q)) {
				results.push({
					item,
					matchedOn: h.label,
					isHeading: true,
					headingId: h.id,
					headingLabel: h.label,
				});
			}
		}
	}

	// Deduplicate by headingId + item.id
	const seen = new Set<string>();
	return results.filter((r) => {
		const key = `${r.item.id}-${r.headingId ?? "section"}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export function DocsSearch() {
	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const inputRef = useRef<HTMLInputElement>(null);
	const { panelRef } = useDialog({ open, onClose: () => setOpen(false), initialFocusRef: inputRef });

	const results = useMemo(() => searchDocs(query), [query]);

	const handleSelect = useCallback((result: SearchResult | undefined) => {
		if (!result) return;
		const targetId = result.headingId ?? result.item.id;
		const el = document.getElementById(targetId);
		if (!el) return; // Heading/section not present in DOM — don't silently swallow.
		revealDocAnchor(targetId, "smooth");
		// Update URL hash so the result is shareable and back/forward works.
		if (typeof history !== "undefined") {
			history.replaceState(null, "", `#${targetId}`);
		}
		setOpen(false);
		setQuery("");
	}, []);

	// Clamp selection whenever the result set changes so keyboard users can
	// never target a stale index (or undefined after filtering down).
	useEffect(() => {
		setSelectedIndex(0);
	}, [query]);

	// Clamp on every result change too, in case a deeper effect updates it.
	useEffect(() => {
		if (results.length === 0) {
			setSelectedIndex(0);
			return;
		}
		setSelectedIndex((i) => (i >= results.length ? results.length - 1 : i));
	}, [results.length]);

	useEffect(() => {
		function onKeyDown(e: KeyboardEvent) {
			// Cmd/Ctrl + K to open
			if ((e.metaKey || e.ctrlKey) && e.key === "k") {
				e.preventDefault();
				setOpen(true);
				setTimeout(() => inputRef.current?.focus(), 50);
				return;
			}
			// Escape to close
			if (e.key === "Escape" && open) {
				setOpen(false);
				setQuery("");
				return;
			}
			// Arrow navigation when open
		if (!open || results.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((i) => (i + 1) % results.length);
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((i) => (i - 1 + results.length) % results.length);
		} else if (e.key === "Enter") {
			e.preventDefault();
			handleSelect(results[selectedIndex]);
		} else if (e.key === "Home") {
			e.preventDefault();
			setSelectedIndex(0);
		} else if (e.key === "End") {
			e.preventDefault();
			setSelectedIndex(results.length - 1);
		}
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, results, selectedIndex, handleSelect]);

	return (
		<>
			{/* Trigger button */}
			<button
				type="button"
				onClick={() => {
					setOpen(true);
					setTimeout(() => inputRef.current?.focus(), 50);
				}}
				className="flex min-h-10 items-center gap-2 rounded-[var(--radius-lg)] border border-border bg-surface/60 px-3 py-1.5 text-sm text-text-muted transition-[background-color,border-color,color] hover:border-border-bright hover:bg-surface hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-void"
				aria-label="Search docs ⌘K"
			>
				<Search className="h-3.5 w-3.5" aria-hidden="true" />
				<span className="hidden sm:inline">Search docs</span>
				<kbd
					className="ml-2 hidden rounded-[var(--radius-sm)] border border-border bg-panel px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary lg:inline"
					aria-hidden="true"
				>
					⌘K
				</kbd>
			</button>

			{/* Modal overlay */}
			{open && (
				<div
					className="fixed inset-0 z-[60] flex items-start justify-center pt-[15vh]"
					role="dialog"
					aria-modal="true"
					aria-label="Search documentation"
				>
					<div
						className="absolute inset-0 bg-void/70 backdrop-blur-sm"
						onClick={() => {
							setOpen(false);
							setQuery("");
						}}
					/>
					<div
						ref={panelRef}
						tabIndex={-1}
						className="relative w-full max-w-xl mx-4 overflow-hidden rounded-[var(--radius-2xl)] border border-border bg-panel shadow-2xl focus:outline-none"
					>
						{/* Search input */}
						<div className="flex items-center gap-3 border-b border-border px-4 py-3">
							<Search className="h-4 w-4 text-text-muted shrink-0" />
							<input
								ref={inputRef}
								value={query}
								onChange={(e) => setQuery(e.target.value)}
								placeholder="Search docs..."
								className="flex-1 bg-transparent text-sm text-text placeholder:text-text-muted outline-none"
								aria-label="Search query"
							/>
							{query && (
								<button
									type="button"
									onClick={() => {
										setQuery("");
										inputRef.current?.focus();
									}}
									className="rounded-[var(--radius-sm)] p-0.5 text-text-muted hover:text-text"
									aria-label="Clear search"
								>
									<X className="h-3.5 w-3.5" />
								</button>
							)}
							<kbd className="hidden rounded-[var(--radius-sm)] border border-border bg-surface px-1.5 py-0.5 text-[10px] font-mono text-text-tertiary sm:inline">
								ESC
							</kbd>
						</div>

						{/* Results */}
				<div className="max-h-[50vh] overflow-y-auto">
							{query.length < 2 ? (
								<div className="px-4 py-8 text-center text-sm text-text-muted">
									Type at least 2 characters to search
								</div>
							) : results.length === 0 ? (
								<div className="px-4 py-8 text-center text-sm text-text-muted">
									No results for &ldquo;{query}&rdquo;
								</div>
							) : (
								<ul className="py-2">
									{results.map((result, i) => (
										<li
											key={`${result.item.id}-${result.headingId ?? "section"}`}
										>
											<button
												type="button"
												onClick={() => handleSelect(result)}
												className={`flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm transition-colors duration-200 ease-out ${
													i === selectedIndex
														? "bg-accent/10 text-accent"
														: "text-text-muted hover:bg-surface hover:text-text"
												}`}
												aria-current={i === selectedIndex ? "true" : undefined}
											>
												<ChevronRight
													className={`h-3.5 w-3.5 shrink-0 ${i === selectedIndex ? "text-accent" : "text-text-tertiary"}`}
												/>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2">
														<span className="font-medium truncate">
															{result.item.label}
														</span>
														{result.isHeading && (
															<>
																<span className="text-text-tertiary">›</span>
																<span className="truncate">
																	{result.headingLabel}
																</span>
															</>
														)}
													</div>
													<div className="text-xs text-text-tertiary truncate">
														Matched: {result.matchedOn}
													</div>
												</div>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>

						{/* Footer */}
						<div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-text-tertiary">
							<div className="flex items-center gap-3">
								<span>↑↓ Navigate</span>
								<span>↵ Select</span>
							</div>
							<span>
								{results.length} result{results.length !== 1 ? "s" : ""}
							</span>
						</div>
					</div>
				</div>
			)}
		</>
	);
}
