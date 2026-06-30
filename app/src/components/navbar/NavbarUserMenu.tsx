"use client";

import { AnimatePresence, m, useReducedMotion } from "framer-motion";
import { Key, LogOut, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EASE_SPRING } from "@/lib/motion";
import { useClickOutside } from "./_hooks/useClickOutside";

interface NavbarUserMenuProps {
	evmAddress: string;
	onDisconnect: () => void | Promise<void>;
}

const shortAddress = (addr: string) =>
	addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : "";

/**
 * User dropdown shown only when the wallet is connected. Self-manages
 * open/close state. Click-outside closes via `useClickOutside`. Escape
 * closes without focus restore (matches the original user-menu behavior —
 * deliberately asymmetric with the tools dropdown).
 *
 * Resets to closed on route change to preserve the original navbar's
 * "all menus close on navigation" semantics.
 */
export function NavbarUserMenu({
	evmAddress,
	onDisconnect,
}: NavbarUserMenuProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);
	const prefersReduced = useReducedMotion();
	const _pathname = usePathname();

	useEffect(() => {
		setOpen(false);
	}, []);

	useClickOutside(containerRef, open, () => setOpen(false));

	useEffect(() => {
		if (!open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") setOpen(false);
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	// Guard: evmAddress may briefly be undefined during wallet connection.
	// Must be after all hooks to satisfy rules-of-hooks.
	if (!evmAddress) return null;

	const address = shortAddress(evmAddress);

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				className={`inline-flex h-9 items-center gap-2 rounded-sm border bg-surface px-3 text-xs text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
					open
						? "border-accent/60 bg-panel"
						: "border-border hover:border-accent/60 hover:bg-panel"
				}`}
				aria-label="Open user menu"
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls="user-menu"
			>
				<span className="relative flex h-1.5 w-1.5" aria-hidden="true">
					<span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
					<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
				</span>
				<span className="max-w-[6rem] truncate font-mono">{address}</span>
			</button>

			<AnimatePresence>
				{open && (
					<m.div
						key="user-menu"
						id="user-menu"
						role="menu"
						initial={
							prefersReduced
								? { opacity: 0 }
								: { opacity: 0, scale: 0.92, y: -6 }
						}
						animate={
							prefersReduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }
						}
						exit={
							prefersReduced
								? { opacity: 0 }
								: { opacity: 0, scale: 0.92, y: -6 }
						}
						transition={EASE_SPRING}
						style={{ transformOrigin: "top right" }}
						className="absolute right-0 mt-2 w-56 rounded-sm border border-border bg-void py-1 font-mono shadow-xl shadow-overlay z-[60]"
					>
						<div className="border-b border-border px-4 py-3">
							<p className="text-[11px] uppercase tracking-widest text-text-tertiary">
								Active session
							</p>
							<p className="mt-1 truncate text-xs text-accent">{evmAddress}</p>
						</div>
						<Link
							href="/dashboard"
							role="menuitem"
							className="flex items-center gap-3 px-4 py-3 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
							onClick={() => setOpen(false)}
						>
							<Key className="h-3 w-3" aria-hidden="true" />
							<span>api keys</span>
						</Link>
						<Link
							href="/deposit"
							role="menuitem"
							className="flex items-center gap-3 px-4 py-3 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
							onClick={() => setOpen(false)}
						>
							<Zap className="h-3 w-3" aria-hidden="true" />
							<span>add credits</span>
						</Link>
						<Link
							href="/settings"
							role="menuitem"
							className="flex items-center gap-3 px-4 py-3 text-xs text-text-secondary transition-colors hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
							onClick={() => setOpen(false)}
						>
							<Settings className="h-3 w-3" aria-hidden="true" />
							<span>settings</span>
						</Link>
						<div className="my-1 h-px bg-border" aria-hidden="true" />
						<button
							type="button"
							role="menuitem"
							onClick={async () => {
								// I4 fix: disconnect() already calls api.auth.logout() server-side,
								// which invalidates the JWT and the HttpOnly session cookie. Calling
								// fetch here too would produce two POSTs to /auth/logout per click.
								await onDisconnect();
								setOpen(false);
							}}
							className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs text-error/80 transition-colors hover:bg-error-dim hover:text-error focus-visible:outline-none focus-visible:bg-error-dim focus-visible:text-error"
						>
							<LogOut className="h-3 w-3" aria-hidden="true" />
							terminate session
						</button>
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}
