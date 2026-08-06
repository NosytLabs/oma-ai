"use client";

import { formatAddress } from "@/lib/utils";
import { AnimatePresence, m, useReducedMotion } from "@/lib/framer-motion-client";
import { ChevronDown, Key, LogOut, Settings, ShieldCheck, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useClickOutside } from "./_hooks/useClickOutside";

interface NavbarUserMenuProps {
	evmAddress: string | null;
	onSignOut: () => Promise<void>;
	isAdmin?: boolean;
}

const shortAddress = (addr: string) => (addr ? formatAddress(addr) : "");

/**
 * User dropdown — only rendered when a Better Auth session is active.
 * Shows the linked EVM address (if any), API keys / settings / credits
 * links, and a confirmation-gated sign-out.
 */
export function NavbarUserMenu({ evmAddress, onSignOut, isAdmin = false }: NavbarUserMenuProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);
	const prefersReduced = useReducedMotion();
	const pathname = usePathname();

	useEffect(() => {
		setOpen(false);
		setConfirming(false);
	}, [pathname]);

	useClickOutside(containerRef, open, () => {
		setOpen(false);
		setConfirming(false);
	});

	useEffect(() => {
		if (!open) return;
		function onKey(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setOpen(false);
				setConfirming(false);
			}
		}
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	useEffect(() => {
		if (!open) {
			setConfirming(false);
			setDisconnecting(false);
		}
	}, [open]);

	const triggerLabel = evmAddress ? shortAddress(evmAddress) : "Account";
	const triggerTitle = evmAddress
		? `Logged in · ${evmAddress}`
		: "Logged in";

	const handleConfirmDisconnect = async () => {
		if (disconnecting) return;
		setDisconnecting(true);
		try {
			await onSignOut();
		} finally {
			setDisconnecting(false);
			setOpen(false);
			setConfirming(false);
		}
	};

	return (
		<div className="relative" ref={containerRef}>
			<button
				type="button"
				onClick={() => setOpen(!open)}
				title={triggerTitle}
				className={`inline-flex h-9 items-center gap-2 rounded-sm border bg-surface px-3 text-xs text-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
					open
						? "border-accent/60 bg-panel"
						: "border-border hover:border-accent/60 hover:bg-panel"
				}`}
				aria-label={`Open user menu (${triggerTitle})`}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-controls="user-menu"
			>
				<span className="max-w-[6rem] truncate font-mono">{triggerLabel}</span>
				<ChevronDown
					className={`h-3 w-3 text-text-tertiary transition-transform duration-200 ${
						open ? "rotate-180" : ""
					}`}
					aria-hidden="true"
				/>
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
						transition={{ type: "spring", duration: 0.3, bounce: 0 }}
						style={{ transformOrigin: "top right" }}
						className="absolute right-0 mt-2 w-56 rounded-sm border border-border bg-void py-1 font-mono shadow-xl shadow-overlay z-[60]"
					>
						<div className="border-b border-border px-4 py-3">
							<p className="text-[11px] uppercase tracking-widest text-text-tertiary">
								Logged in
							</p>
							<p className="mt-1 truncate text-xs text-accent">
								{evmAddress ?? "Email account"}
							</p>
						</div>
						<Link
							href="/dashboard?tab=api-keys"
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
						{isAdmin && (
							<Link
								href="/admin"
								role="menuitem"
								className="flex items-center gap-3 px-4 py-3 text-xs text-accent transition-colors hover:bg-accent-dim focus-visible:outline-none focus-visible:bg-accent-dim"
								onClick={() => setOpen(false)}
							>
								<ShieldCheck className="h-3 w-3" aria-hidden="true" />
								<span>admin dashboard</span>
							</Link>
						)}
						<div className="my-1 h-px bg-border" aria-hidden="true" />
						{!confirming ? (
							<button
								type="button"
								role="menuitem"
								onClick={() => setConfirming(true)}
								className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs text-error/80 transition-colors hover:bg-error-dim hover:text-error focus-visible:outline-none focus-visible:bg-error-dim focus-visible:text-error"
							>
								<LogOut className="h-3 w-3" aria-hidden="true" />
								sign out
							</button>
						) : (
							<div
								role="alertdialog"
								aria-labelledby="user-disconnect-title"
								aria-describedby="user-disconnect-body"
								className="mx-2 mb-1 rounded-sm border border-error/40 bg-error/5 p-3"
							>
								<p
									id="user-disconnect-title"
									className="text-[11px] font-semibold text-error"
								>
									Sign out?
								</p>
								<p
									id="user-disconnect-body"
									className="mt-1 text-[10px] leading-relaxed text-text-secondary"
								>
								You&apos;ll need to sign in again with the same method
								(magic link, guest, or wallet).
								</p>
								<div className="mt-2 grid grid-cols-2 gap-1">
									<button
										type="button"
										onClick={() => setConfirming(false)}
										disabled={disconnecting}
										className="rounded-sm border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-text transition-colors hover:bg-panel disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleConfirmDisconnect}
										disabled={disconnecting}
										className="rounded-sm border border-error/40 bg-error/10 px-2 py-1.5 text-[11px] font-semibold text-error transition-colors hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
									>
										{disconnecting ? "Signing out…" : "Sign out"}
									</button>
								</div>
							</div>
						)}
					</m.div>
				)}
			</AnimatePresence>
		</div>
	);
}