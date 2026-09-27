"use client";

import {
	CornerDownLeft,
	Key,
	LayoutDashboard,
	LogIn,
	LogOut,
	Settings,
	X,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";
import { createPortal } from "react-dom";
import { ApiStatus } from "../api-status";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";
import { accountHrefs, isCurrentPath, mobileGroups } from "./_lib/nav-links";

interface NavbarMobileMenuProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Mobile toggle button — focus is restored here when the menu closes. */
	toggleRef: RefObject<HTMLButtonElement | null>;
	isConnected: boolean;
	section: string;
	/** Terminates the active session. Optional because the menu is also
	 * rendered during the brief pre-hydration window before the wallet
	 * provider has been mounted. */
	onDisconnect?: () => void | Promise<void>;
}

// Account card links — local to the mobile menu; not exported as they are
// not part of the primary nav.
const ACCOUNT_LINKS_AUTH: { href: string; label: string; icon: typeof Key }[] = [
	{ href: "/dashboard", label: "dashboard", icon: LayoutDashboard },
	{ href: "/dashboard?tab=api-keys", label: "api keys", icon: Key },
	{ href: "/deposit", label: "buy credits", icon: Zap },
	{ href: "/settings", label: "settings", icon: Settings },
];

const ACCOUNT_LINKS_GUEST: { href: string; label: string; icon: typeof Key }[] = [
	{ href: "/getting-started", label: "get started", icon: Zap },
	{ href: "/login", label: "sign in", icon: LogIn },
];

/**
 * Grouped card layout for the mobile navigation drawer. Owns its body-scroll
 * lock. Focus trap (Tab/Shift+Tab cycle, Escape close, focus restore on
 * close) is delegated to `useFocusTrap` with the toggle as the restore
 * target.
 *
 * Framer-free: backdrop + panel use CSS entrance animations
 * (`.motion-fade-in`, `.motion-slide-in-right`) gated behind
 * `prefers-reduced-motion` in globals.css, so framer-motion stays off the
 * critical marketing bundle. The drawer mounts/unmounts with `open`, so the
 * exit animation is dropped.
 */
export function NavbarMobileMenu({
	open,
	onOpenChange,
	toggleRef,
	isConnected,
	section,
	onDisconnect,
}: NavbarMobileMenuProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const pathname = usePathname();
	const [confirmDisconnect, setConfirmDisconnect] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);
	const [mounted, setMounted] = useState(false);
	const visibleGroups = mobileGroups
		.map((group) => ({
			...group,
			links: group.links,
		}))
		.filter((group) => group.links.length > 0);

	useFocusTrap({
		active: open && mounted,
		containerRef,
		restoreFocusRef: toggleRef,
		onClose: () => onOpenChange(false),
	});

	// Lock body scroll while open; cleanup restores the prior value.
	useEffect(() => {
		document.body.style.overflow = open ? "hidden" : "";
		return () => {
			document.body.style.overflow = "";
		};
	}, [open]);

	// Reset any in-flight confirm/disconnect state when the drawer closes.
	useEffect(() => {
		if (!open) {
			setConfirmDisconnect(false);
			setDisconnecting(false);
		}
	}, [open]);

	const handleConfirmDisconnect = async () => {
		if (!onDisconnect || disconnecting) return;
		setDisconnecting(true);
		try {
			await onDisconnect();
			onOpenChange(false);
		} finally {
			setDisconnecting(false);
		}
	};

	const isAccountCardActive = accountHrefs.some((href) =>
		isCurrentPath(pathname ?? "/", href.replace(/#.*$/, "")),
	);

	// Portal to document.body. The sticky header uses backdrop-blur / glass,
	// which creates a fixed-position containing block — so a drawer rendered
	// inside the header collapses to height 0. Portaling escapes that trap.
	useEffect(() => {
		setMounted(true);
	}, []);

	const drawer = open ? (
		<>
			<div
				key="mobile-backdrop"
				className="motion-fade-in fixed inset-0 z-[60] bg-void/70 backdrop-blur-sm lg:hidden"
				aria-hidden="true"
				onClick={() => onOpenChange(false)}
			/>
			<div
				key="mobile-menu"
				ref={containerRef}
				id="mobile-menu"
				role="dialog"
				aria-modal="true"
				aria-label="Mobile navigation"
				className="motion-slide-in-right fixed inset-y-0 right-0 z-[70] w-full overflow-y-auto border-l border-border bg-void font-mono shadow-2xl sm:max-w-sm lg:hidden"
			>
				<div className="mx-auto flex max-w-6xl flex-col px-4 py-4 sm:px-6">
					{/* Status row */}
					<div className="mb-4 flex items-center justify-between gap-3 text-[11px] text-text-muted">
						<span className="truncate">
							<span className="text-text-tertiary">~/ </span>
							<span className="text-text-secondary">{section}</span>
						</span>
						<button
							type="button"
							onClick={() => onOpenChange(false)}
							aria-label="Close navigation menu"
							className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-sm border border-border bg-surface text-text-secondary transition-colors hover:bg-surface-hi hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						>
							<X className="h-4 w-4" aria-hidden="true" />
						</button>
					</div>

					{/* Grouped card grid */}
					<div className="space-y-3">
						{visibleGroups.map((group) => {
							const isCardActive = group.links.some((link) =>
								isCurrentPath(pathname ?? "/", link.href.replace(/#.*$/, "")),
							);
							return (
								<div
									key={group.title}
									className={`rounded-sm border bg-surface/40 p-2 transition-colors duration-200 ease-out ${
										isCardActive ? "border-accent/40" : "border-border"
									}`}
								>
									<div className="mb-2 flex items-baseline justify-between px-3">
										<p className="text-[11px] sm:text-xs uppercase tracking-widest text-accent font-semibold flex items-center gap-2">
											{group.title}
											{isCardActive && (
												<span
													className="h-1 w-1 rounded-full bg-accent"
													aria-hidden="true"
												/>
											)}
										</p>
										<p className="text-[11px] text-text-tertiary tabular-nums">
											{group.caption}
										</p>
									</div>
									<ul className="grid grid-cols-2 gap-1">
										{group.links.map((link) => {
											const Icon = link.icon;
											const isActive = isCurrentPath(pathname ?? "/", link.href);
											return (
												<li key={link.href}>
													<Link
														href={link.href}
														onClick={() => onOpenChange(false)}
														aria-current={isActive ? "page" : undefined}
														className={`group/m flex min-h-[44px] items-center gap-2 rounded-sm px-3 py-2 text-sm transition-colors duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
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
												</li>
											);
										})}
									</ul>
								</div>
							);
						})}

						{/* Account card */}
						<div
							className={`rounded-sm border bg-surface/40 p-2 transition-colors duration-200 ease-out ${
								isAccountCardActive ? "border-accent/40" : "border-border"
							}`}
						>
							<div className="mb-2 flex items-baseline justify-between px-3">
								<p className="text-[11px] sm:text-xs uppercase tracking-widest text-accent font-semibold flex items-center gap-2">
									account
									{isAccountCardActive && (
										<span
											className="h-1 w-1 rounded-full bg-accent"
											aria-hidden="true"
										/>
									)}
								</p>
								<p className="text-[11px] text-text-tertiary tabular-nums">
									{isConnected ? "connected" : "guest"}
								</p>
							</div>
							<ul className="grid grid-cols-2 gap-1">
								{(isConnected ? ACCOUNT_LINKS_AUTH : ACCOUNT_LINKS_GUEST).map((link) => {
									const Icon = link.icon;
									return (
										<li key={link.href}>
											<Link
												href={link.href}
												onClick={() => onOpenChange(false)}
												className="group/m flex min-h-[44px] items-center gap-2 rounded-sm px-3 py-2 text-sm text-text-secondary transition-colors duration-200 ease-out hover:bg-panel hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
											>
												<Icon
													className="h-4 w-4 shrink-0 text-text-muted group-hover/m:text-accent"
													aria-hidden="true"
												/>
												<span className="truncate">{link.label}</span>
											</Link>
										</li>
									);
								})}
							</ul>
							{isConnected && onDisconnect && !confirmDisconnect && (
								<button
									type="button"
									onClick={() => setConfirmDisconnect(true)}
									className="mt-2 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-sm border border-error/30 px-3 py-2 text-sm font-medium text-error/80 transition-[color,border-color,background-color,transform] duration-200 ease-out hover:border-error/50 hover:bg-error/10 hover:text-error active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
								>
									<LogOut className="h-4 w-4" aria-hidden="true" />
									<span>Sign out</span>
								</button>
							)}
							{isConnected && onDisconnect && confirmDisconnect && (
								<div
									role="alertdialog"
									aria-labelledby="mobile-disconnect-title"
									aria-describedby="mobile-disconnect-body"
									className="mt-2 rounded-sm border border-error/40 bg-error/5 p-3"
								>
									<p
										id="mobile-disconnect-title"
										className="text-xs font-semibold text-error"
									>
										Sign out?
									</p>
									<p
										id="mobile-disconnect-body"
										className="mt-1 text-[11px] leading-relaxed text-text-secondary"
									>
										You&apos;ll need your wallet or magic-link email to sign
										back in.
									</p>
									<div className="mt-2 grid grid-cols-2 gap-1">
										<button
											type="button"
											onClick={() => setConfirmDisconnect(false)}
											disabled={disconnecting}
											className="min-h-[44px] rounded-sm border border-border bg-surface px-3 py-2 text-xs font-medium text-text transition-[color,background-color,transform] duration-200 ease-out hover:bg-panel active:scale-[0.97] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
										>
											Cancel
										</button>
										<button
											type="button"
											onClick={handleConfirmDisconnect}
											disabled={disconnecting}
											className="min-h-[44px] rounded-sm border border-error/40 bg-error/10 px-3 py-2 text-xs font-semibold text-error transition-colors duration-200 ease-out hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error active:scale-[0.97]"
										>
											{disconnecting ? "Signing out…" : "Sign out"}
										</button>
									</div>
								</div>
							)}
						</div>
					</div>

					{/* Bottom: API + GitHub + keyboard hint */}
					<div className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-border pt-4 text-[11px] text-text-muted">
						<ApiStatus />
						<a
							href="https://github.com/NosytLabs"
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
			</div>
		</>
	) : null;

	if (!mounted) return null;
	return createPortal(drawer, document.body);
}
