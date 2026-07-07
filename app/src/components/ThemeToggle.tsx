"use client";

/**
 * ThemeToggle — 4-state theme switcher.
 *
 * Renders a dropdown that lists all available themes with a color swatch.
 * Selecting a theme sets `data-theme` on `<html>` and persists to
 * localStorage. The currently active theme is highlighted.
 *
 * Click-outside / Escape handlers close the menu.
 */

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { THEME_LIST, useTheme, type Theme } from "./ThemeProvider";

/**
 * Swatch colors are picked to match the accent of each theme on the
 * dark `bg-void` background. They are intentionally literal — this is
 * a "color picker" affordance, so the user should see the actual hue.
 */
const SWATCH: Record<Theme, string> = {
	emerald: "#10b981",
	amber: "#f59e0b",
	mono: "#d4d4d4",
	synth: "#a78bfa",
};

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const swatch = SWATCH[theme];
	const activeLabel = THEME_LIST.find((t) => t.id === theme)?.name ?? theme;

	// Close on outside click
	useEffect(() => {
		if (!open) return;
		function onDocClick(e: MouseEvent) {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setOpen(false);
			}
		}
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setOpen(false);
				toggleRef.current?.focus();
			}
		}
		document.addEventListener("mousedown", onDocClick);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDocClick);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	return (
		<div ref={containerRef} className="relative">
			<button
				ref={toggleRef}
				type="button"
				onClick={() => setOpen((o) => !o)}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls="theme-menu"
				aria-label={`Theme · ${activeLabel}. Click to choose.`}
				title={`Theme · ${activeLabel}`}
				data-theme-toggle
				className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-sm text-text-tertiary hover:text-text-bright hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-95 transition-all duration-150"
			>
				<span
					aria-hidden="true"
					className="inline-block h-3.5 w-3.5 rounded-full ring-1 ring-white/10 transition-colors duration-200"
					style={{
						background: swatch,
						boxShadow: `0 0 8px ${swatch}66`,
					}}
				/>
				<span className="text-xs font-mono lowercase tracking-tight hidden sm:inline">
					{theme}
				</span>
			</button>

			{open && (
				<div
					id="theme-menu"
					role="menu"
					aria-label="Choose theme"
					className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-void/95 backdrop-blur-md p-2 shadow-2xl z-[60] font-mono"
				>
					<p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
						Theme · color picker
					</p>
					<ul className="space-y-0.5">
						{THEME_LIST.map((t) => {
							const isActive = t.id === theme;
							const swatchColor = SWATCH[t.id];
							return (
								<li key={t.id} role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={isActive}
										onClick={() => {
											setTheme(t.id);
											setOpen(false);
											toggleRef.current?.focus();
										}}
										className={`group flex w-full items-center gap-3 rounded-sm px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
											isActive
												? "bg-accent-dim text-accent"
												: "text-text-secondary hover:bg-surface hover:text-text-bright"
										}`}
									>
										<span
											aria-hidden="true"
											className="inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-white/10"
											style={{
												background: swatchColor,
												boxShadow: isActive
													? `0 0 10px ${swatchColor}`
													: "none",
											}}
										/>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="text-xs leading-tight">
												{t.name}
											</span>
											<span className="text-[10px] text-text-tertiary leading-tight mt-0.5">
												{t.hint}
											</span>
										</span>
										{isActive && (
											<Check
												className="h-3.5 w-3.5 shrink-0 text-accent"
												aria-hidden="true"
											/>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}