"use client";

/**
 * ThemeToggle — accent theme switcher (dark void is fixed).
 */

import { Check, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
	THEME_ACCENTS,
	THEME_LIST,
	useTheme,
	type Theme,
} from "./ThemeProvider";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const swatch = THEME_ACCENTS[theme];
	const activeLabel = THEME_LIST.find((t) => t.id === theme)?.name ?? theme;

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
				aria-label={`Theme: ${activeLabel}`}
				title={`Theme · ${activeLabel}`}
				data-theme-toggle
				className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-[var(--radius-md)] text-text-tertiary hover:text-text-bright hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] transition-[color,background-color,transform] duration-200 ease-out"
			>
				<span
					aria-hidden="true"
					className="relative inline-flex h-3.5 w-3.5 items-center justify-center"
				>
					<span
						className="absolute inset-0 rounded-full ring-1 ring-white/15"
						style={{
							background: swatch,
							boxShadow: `0 0 10px ${swatch}88`,
						}}
					/>
				</span>
				<span className="text-xs font-mono lowercase tracking-tight text-text-secondary hidden sm:inline">
					{theme}
				</span>
				<Palette className="h-3 w-3 opacity-50 sm:hidden" aria-hidden="true" />
			</button>

			{open && (
				<div
					id="theme-menu"
					role="menu"
					aria-label="Choose theme"
					className="absolute right-0 top-full mt-2 w-60 rounded-[var(--radius-lg)] border border-border-hi bg-void/95 backdrop-blur-md p-2 shadow-2xl z-[60] font-mono"
				>
					<p className="px-3 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
						Accent theme
					</p>
					<ul className="space-y-0.5">
						{THEME_LIST.map((t) => {
							const isActive = t.id === theme;
							const swatchColor = THEME_ACCENTS[t.id as Theme];
							return (
								<li key={t.id} role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={isActive}
										aria-label={t.name}
										onClick={() => {
											setTheme(t.id);
											setOpen(false);
											toggleRef.current?.focus();
										}}
										className={`group flex w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
											isActive
												? "bg-accent-dim text-accent"
												: "text-text-secondary hover:bg-surface hover:text-text-bright"
										}`}
									>
										<span
											aria-hidden="true"
											className="inline-block h-4 w-4 shrink-0 rounded-full ring-1 ring-white/15"
											style={{
												background: swatchColor,
												boxShadow: isActive
													? `0 0 12px ${swatchColor}`
													: "none",
											}}
										/>
										<span className="flex min-w-0 flex-1 flex-col">
											<span className="text-xs leading-tight font-medium">
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
					<p className="px-3 pt-2 pb-1 text-[10px] text-text-tertiary leading-relaxed">
						Surfaces stay dark. Only the accent shifts.
					</p>
				</div>
			)}
		</div>
	);
}
