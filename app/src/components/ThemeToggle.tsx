"use client";

/**
	* ThemeToggle — accent theme switcher (dark void is fixed).
	*/

import { Check, Palette } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
	THEME_ACCENTS,
	THEME_LIST,
	useTheme,
	type Theme,
} from "./ThemeProvider";

export function ThemeToggle() {
	const { theme, setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const [mounted, setMounted] = useState(false);
	const [menuPos, setMenuPos] = useState({ top: 0, left: 8 });
	const initialFocus = useRef<"first" | "last" | "selected">("selected");
	const containerRef = useRef<HTMLDivElement | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const menuRef = useRef<HTMLDivElement | null>(null);
	const swatch = THEME_ACCENTS[theme];
	const activeLabel = THEME_LIST.find((t) => t.id === theme)?.name ?? theme;

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		if (!open || !toggleRef.current) return;
		const place = () => {
			const rect = toggleRef.current?.getBoundingClientRect();
			if (!rect) return;
			setMenuPos({
				top: rect.bottom + 8,
				left: Math.min(Math.max(8, rect.right - 240), Math.max(8, window.innerWidth - 248)),
			});
		};
		place();
		window.addEventListener("resize", place);
		return () => window.removeEventListener("resize", place);
	}, [open]);

	useEffect(() => {
		if (!open) return;
		function onDocClick(e: MouseEvent) {
			const target = e.target as Node;
			if (
				containerRef.current?.contains(target) ||
				menuRef.current?.contains(target)
			) {
				return;
			}
			setOpen(false);
		}
		function onFocus(event: FocusEvent) {
			const target = event.target as Node;
			if (!containerRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
		}
		document.addEventListener("pointerdown", onDocClick);
		document.addEventListener("focusin", onFocus);
		return () => {
			document.removeEventListener("pointerdown", onDocClick);
			document.removeEventListener("focusin", onFocus);
		};
	}, [open]);

	useEffect(() => {
		if (!open) return;
		const items = menuRef.current?.querySelectorAll<HTMLButtonElement>("button");
		const selected = menuRef.current?.querySelector<HTMLButtonElement>('[aria-checked="true"]');
		const target = initialFocus.current === "last" ? items?.[items.length - 1]
			: initialFocus.current === "first" ? items?.[0] : selected ?? items?.[0];
		target?.focus();
	}, [open]);

	function onMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
		if (event.key === "Escape" || event.key === "Tab") {
			if (event.key === "Escape") {
				event.preventDefault();
				event.stopPropagation();
			}
			setOpen(false);
			toggleRef.current?.focus();
			return;
		}
		const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? []);
		const current = items.indexOf(document.activeElement as HTMLButtonElement);
		let next: number;
		switch (event.key) {
			case "ArrowDown": next = (current + 1) % items.length; break;
			case "ArrowUp": next = (current - 1 + items.length) % items.length; break;
			case "Home": next = 0; break;
			case "End": next = items.length - 1; break;
			default: {
				if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return;
				next = items.findIndex((item, index) => index > current && item.getAttribute("aria-label")?.toLowerCase().startsWith(event.key.toLowerCase()));
				if (next < 0) next = items.findIndex((item) => item.getAttribute("aria-label")?.toLowerCase().startsWith(event.key.toLowerCase()));
				if (next < 0) return;
			}
		}
		event.preventDefault();
		items[next]?.focus();
	}

	const menu = open ? (
				<div
					ref={menuRef}
					id="theme-menu"
					role="menu"
					aria-label="Choose theme"
					style={{ top: menuPos.top, left: menuPos.left }}
					onKeyDown={onMenuKeyDown}
					className="fixed z-[80] w-60 max-w-[calc(100vw-1rem)] rounded-[var(--radius-lg)] border border-border-hi bg-void/95 backdrop-blur-md p-2 shadow-2xl font-mono"
				>
					<p className="px-3 pt-2 pb-1.5 text-[10px] uppercase tracking-[0.18em] text-text-tertiary">
						Accent theme
					</p>
					<ul className="space-y-0.5" role="none">
						{THEME_LIST.map((t) => {
							const isActive = t.id === theme;
							const swatchColor = THEME_ACCENTS[t.id as Theme];
							return (
								<li key={t.id} role="none">
									<button
										type="button"
										role="menuitemradio"
										tabIndex={-1}
										aria-checked={isActive}
										aria-label={t.name}
										onClick={() => {
											setTheme(t.id);
											setOpen(false);
											toggleRef.current?.focus();
										}}
										className={`group flex min-h-11 w-full items-center gap-3 rounded-[var(--radius-md)] px-2.5 py-2 text-left transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
	) : null;

	return (
		<div ref={containerRef} className="relative">
			<button
				ref={toggleRef}
				type="button"
				onClick={() => {
					initialFocus.current = "selected";
					setOpen((value) => !value);
				}}
				onKeyDown={(event) => {
					if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
					event.preventDefault();
					initialFocus.current = event.key === "ArrowUp" ? "last" : "first";
					setOpen(true);
				}}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls="theme-menu"
				aria-label={`Accent theme: ${activeLabel}. Change accent theme`}
				title={`Accent theme · ${activeLabel}`}
				data-theme-toggle
				className="inline-flex items-center gap-1.5 h-11 px-2.5 rounded-[var(--radius-md)] text-text-tertiary hover:text-text-bright hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent active:scale-[0.97] transition-[color,background-color,transform] duration-200 ease-out"
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
				<Palette className="h-3 w-3 opacity-40" aria-hidden="true" />
			</button>
			{mounted && menu ? createPortal(menu, document.body) : null}
		</div>
	);
}
