"use client";

import { AnimatePresence, m, useReducedMotion } from "@/lib/framer-motion-client";
import { ChevronDown, Wand2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { EASE_SPRING, EASE_SPRING_SOFT } from "@/lib/motion";
import { useClickOutside } from "./_hooks/useClickOutside";
import { isCurrentPath, toolsLinks } from "./_lib/nav-links";

interface NavbarToolsDropdownProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

/**
 * Tools dropdown (desktop only). Click-outside closes via `useClickOutside`.
 * Escape closes AND restores focus to the toggle button — that asymmetry vs
 * `NavbarUserMenu` is intentional (the original tools-menu behavior) and is
 * implemented as a separate keydown effect here so `useClickOutside` can
 * stay single-purpose.
 */
export function NavbarToolsDropdown({
	open,
	onOpenChange,
}: NavbarToolsDropdownProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const toggleRef = useRef<HTMLButtonElement | null>(null);
	const pathname = usePathname();
	const prefersReduced = useReducedMotion();
	const isToolsActive = toolsLinks.some((l) => isCurrentPath(pathname ?? "/", l.href));

	useClickOutside(containerRef, open, () => onOpenChange(false));

	useEffect(() => {
		if (!open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				e.preventDefault();
				onOpenChange(false);
				toggleRef.current?.focus();
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open, onOpenChange]);

	return (
		<div ref={containerRef} className="relative hidden md:block">
			<m.div
				whileHover={prefersReduced ? undefined : { y: -1 }}
				whileTap={prefersReduced ? undefined : { scale: 0.96 }}
				transition={EASE_SPRING}
				className="inline-block"
			>
				<button
					ref={toggleRef}
					type="button"
					onClick={() => onOpenChange(!open)}
					aria-haspopup="menu"
					aria-expanded={open}
					aria-controls="tools-menu"
					aria-label="Tools menu"
					className={`relative inline-flex h-9 items-center gap-2 rounded-sm px-3 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
						isToolsActive
							? "text-accent"
							: "text-text-secondary hover:text-text-bright"
					}`}
				>
					{isToolsActive && !open && (
						<m.span
							layoutId="nav-active"
							aria-hidden="true"
							className="absolute inset-0 rounded-sm bg-accent-dim"
							transition={EASE_SPRING_SOFT}
						/>
					)}
					<Wand2
						className="relative z-10 h-3 w-3 opacity-70"
						aria-hidden="true"
					/>
					<span className="relative z-10">tools</span>
					<ChevronDown
						className={`relative z-10 h-3 w-3 opacity-60 transition-transform duration-200 ${
							open ? "rotate-180" : ""
						}`}
						aria-hidden="true"
					/>
				</button>
			</m.div>

			<AnimatePresence>
				{open && (
					<m.div
						key="tools-menu"
						id="tools-menu"
						role="menu"
						initial={
							prefersReduced
								? { opacity: 0 }
								: { opacity: 0, y: -6, scale: 0.97 }
						}
						animate={
							prefersReduced ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }
						}
						exit={
							prefersReduced
								? { opacity: 0 }
								: { opacity: 0, y: -6, scale: 0.97 }
						}
						transition={EASE_SPRING_SOFT}
						style={{ transformOrigin: "top left" }}
						className={`absolute left-0 top-full mt-2 w-72 rounded-sm border border-border bg-void/95 backdrop-blur-md p-2 shadow-2xl shadow-overlay font-mono z-[60]`}
					>
						<p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-widest text-text-tertiary">
							tools
						</p>
						<ul className="space-y-1">
							{toolsLinks.map((link) => {
								const Icon = link.icon;
								const isActive = isCurrentPath(pathname ?? "/", link.href);
								return (
									<li key={link.href} role="none">
										<Link
											href={link.href}
											role="menuitem"
											onClick={() => onOpenChange(false)}
											aria-current={isActive ? "page" : undefined}
											className={`group/item flex items-start gap-3 rounded-sm px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
												isActive
													? "bg-accent-dim text-accent"
													: "text-text-secondary hover:bg-surface hover:text-text-bright"
											}`}
										>
											<Icon
												className={`mt-0.5 h-4 w-4 shrink-0 ${
													isActive
														? "text-accent"
														: "text-text-muted group-hover/item:text-accent"
												}`}
												aria-hidden="true"
											/>
											<span className="flex min-w-0 flex-col">
												<span className="text-xs leading-tight">
													{link.label}
												</span>
												{link.desc && (
													<span className="text-[11px] text-text-muted leading-tight mt-1">
														{link.desc}
													</span>
												)}
											</span>
										</Link>
									</li>
								);
							})}
						</ul>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}
