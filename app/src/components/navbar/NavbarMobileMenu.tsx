"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { CornerDownLeft, FileText, Key, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type RefObject, useEffect, useRef } from "react";
import { EASE_OUT, staggerContainer } from "@/lib/motion";
import { ApiStatus } from "../api-status";
import { useFocusTrap } from "./_hooks/useFocusTrap";
import { accountHrefs, isCurrentPath, mobileGroups } from "./_lib/nav-links";

interface NavbarMobileMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Mobile toggle button — focus is restored here when the menu closes. */
	toggleRef: RefObject<HTMLButtonElement | null>;
	isConnected: boolean;
	section: string;
	build: string;
}

// Mobile link stagger variant — subtle slide-in from the right.
const mobileLinkVariant = {
	hidden: { opacity: 0, x: 12 },
	show: { opacity: 1, x: 0, transition: { duration: 0.3, ease: EASE_OUT } },
} as const;

// Account card links — local to the mobile menu; not exported as they are
// not part of the primary nav.
const ACCOUNT_LINKS: { href: string; label: string; icon: typeof Key }[] = [
	{ href: "/dashboard", label: "dashboard", icon: Key },
	{ href: "/deposit", label: "deposit", icon: Zap },
	{ href: "/settings", label: "settings", icon: Settings },
	{ href: "/docs", label: "api docs", icon: FileText },
];

/**
 * Grouped card layout for the mobile navigation drawer. Owns its body-scroll
 * lock. Focus trap (Tab/Shift+Tab cycle, Escape close, focus restore on
 * close) is delegated to `useFocusTrap` with the toggle as the restore
 * target — identical to the original behavior.
 */
export function NavbarMobileMenu({
	open,
	onOpenChange,
	toggleRef,
	isConnected,
	section,
	build,
}: NavbarMobileMenuProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const pathname = usePathname();
	const prefersReduced = useReducedMotion();

	useFocusTrap({
		active: open,
		containerRef,
		restoreFocusRef: toggleRef,
		onClose: () => onOpenChange(false),
	});

	// Lock body scroll while open; cleanup restores the prior value (empty
	// string was the original default).
	useEffect(() => {
		document.body.style.overflow = open ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	const isAccountCardActive = accountHrefs.some((href) =>
		isCurrentPath(pathname, href),
	);

	return (
		<AnimatePresence>
			{open && (
				<>
					<m.div
						key="mobile-backdrop"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.2 }}
						className="fixed inset-0 top-14 z-40 bg-void/60 backdrop-blur-sm md:hidden"
						aria-hidden="true"
						onClick={() => onOpenChange(false)}
					/>
					<m.div
						key="mobile-menu"
						ref={containerRef}
						id="mobile-menu"
						role="dialog"
						aria-modal="true"
						aria-label="Mobile navigation"
						initial={
							prefersReduced ? { opacity: 0 } : { x: "100%", opacity: 0 }
						}
						animate={prefersReduced ? { opacity: 1 } : { x: 0, opacity: 1 }}
						exit={prefersReduced ? { opacity: 0 } : { x: "100%", opacity: 0 }}
						transition={{ duration: 0.35, ease: EASE_OUT }}
						className="fixed top-14 right-0 bottom-0 z-50 w-full max-w-sm overflow-y-auto border-l border-border bg-void font-mono md:hidden shadow-2xl"
					>
						<div className="mx-auto flex max-w-6xl flex-col px-4 py-4 sm:px-6">
							{/* Status row */}
							<div className="mb-4 flex items-center justify-between gap-3 text-[11px] text-text-muted">
								<span className="truncate">
									<span className="text-text-tertiary">~/ </span>
									<span className="text-text-secondary">{section}</span>
								</span>
								<span className="shrink-0">build {build}</span>
							</div>

							{/* Grouped card grid */}
							<div className="space-y-3">
								{mobileGroups.map((group, gi) => {
									const isCardActive = group.links.some((link) =>
										isCurrentPath(pathname, link.href),
									);
									return (
										<m.div
											key={group.title}
											initial="hidden"
											animate="show"
											variants={staggerContainer(0.04, gi * 0.05)}
											className={`rounded-sm border bg-surface/40 p-2 transition-colors ${
												isCardActive ? "border-accent/40" : "border-border"
											}`}
										>
											<div className="mb-2 flex items-baseline justify-between px-1">
												<p className="text-[11px] sm:text-xs uppercase tracking-widest text-accent font-semibold flex items-center gap-2">
													{group.title}
													{isCardActive && (
														<span
															className="h-1 w-1 rounded-full bg-accent"
															aria-label="Current section"
														/>
													)}
												</p>
												<p className="text-[11px] text-text-tertiary tabular-nums">
													{group.caption}
												</p>
											</div>
											<m.ul className="grid grid-cols-2 gap-1">
												{group.links.map((link) => {
													const Icon = link.icon;
													const isActive = isCurrentPath(pathname, link.href);
													return (
														<m.li key={link.href} variants={mobileLinkVariant}>
															<Link
																href={link.href}
																onClick={() => onOpenChange(false)}
																aria-current={isActive ? "page" : undefined}
																className={`group/m flex min-h-[44px] items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
																	isActive
																		? "bg-accent-dim text-accent"
																		: "text-text-secondary hover:bg-panel hover:text-text-bright"
																}`}
															>
																<Icon
																	className={`h-4 w-4 shrink-0 ${
																		isActive
																			? "text-accent"
																			: "text-text-muted group-hover/m:text-accent"
																	}`}
																	aria-hidden="true"
																/>
																<span className="truncate">{link.label}</span>
															</Link>
														</m.li>
													);
												})}
											</m.ul>
										</m.div>
									);
								})}

								{/* Account card */}
								<m.div
									initial="hidden"
									animate="show"
									variants={staggerContainer(0.04, mobileGroups.length * 0.05)}
									className={`rounded-sm border bg-surface/40 p-2 transition-colors ${
										isAccountCardActive ? "border-accent/40" : "border-border"
									}`}
								>
									<div className="mb-2 flex items-baseline justify-between px-1">
										<p className="text-[11px] sm:text-xs uppercase tracking-widest text-accent font-semibold flex items-center gap-2">
											account
											{isAccountCardActive && (
												<span
													className="h-1 w-1 rounded-full bg-accent"
													aria-label="Current section"
												/>
											)}
										</p>
										<p className="text-[11px] text-text-tertiary tabular-nums">
											{isConnected ? "connected" : "guest"}
										</p>
									</div>
									<m.ul className="grid grid-cols-2 gap-1">
										{ACCOUNT_LINKS.map((link) => {
											const Icon = link.icon;
											return (
												<m.li key={link.href} variants={mobileLinkVariant}>
													<Link
														href={link.href}
														onClick={() => onOpenChange(false)}
														className="group/m flex min-h-[44px] items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-panel hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
													>
														<Icon
															className="h-4 w-4 shrink-0 text-text-muted group-hover/m:text-accent"
															aria-hidden="true"
														/>
														<span className="truncate">{link.label}</span>
													</Link>
												</m.li>
											);
										})}
									</m.ul>
								</m.div>
							</div>

							{/* Bottom: API + GitHub + keyboard hint */}
							<div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-4 text-[11px] text-text-muted">
								<ApiStatus />
								<a
									href="https://github.com/oma-ai"
									target="_blank"
									rel="noopener noreferrer"
									className="shrink-0 hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
								>
									github ↗
								</a>
								<span className="hidden sm:inline-flex items-center gap-1 text-text-tertiary tabular-nums">
									<CornerDownLeft className="h-3 w-3" aria-hidden="true" />
									<span>esc to close</span>
								</span>
							</div>
						</div>
					</m.div>
				</>
			)}
		</AnimatePresence>
	);
}
