"use client";

import { ChevronDown, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { formatAddress } from "@/lib/utils";
import { useNavDisclosure } from "./_hooks/useNavDisclosure";
import { accountLinks, isCurrentNavLink } from "./_lib/nav-links";
import { NavbarSignOut } from "./NavbarSignOut";

interface NavbarUserMenuProps {
	evmAddress: string | null;
	email?: string | null;
	onSignOut: () => Promise<void>;
}

export function NavbarUserMenu({ evmAddress, email, onSignOut }: NavbarUserMenuProps) {
	const [open, setOpen] = useState(false);
	const pathname = usePathname() ?? "/";
	const { containerRef, toggleRef, panelRef, onKeyDown, onBlur } = useNavDisclosure(open, setOpen);
	const identity = evmAddress ? formatAddress(evmAddress) : email ?? "Account";

	useEffect(() => { setOpen(false); }, [pathname]);

	return (
		<div ref={containerRef} onKeyDown={onKeyDown} onBlur={onBlur} className="relative">
			<button ref={toggleRef} type="button" onClick={() => setOpen(!open)} aria-label="Account menu" aria-expanded={open} aria-controls="user-menu"
				className={`inline-flex h-11 items-center gap-2 rounded-sm border px-3 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${open ? "border-accent/60 bg-surface text-accent" : "border-border text-text-secondary hover:bg-surface hover:text-text-bright"}`}>
				<UserRound className="h-4 w-4" aria-hidden="true" />
				<span className="hidden max-w-28 truncate sm:inline">{identity}</span>
				<ChevronDown className={`hidden h-3 w-3 transition-transform sm:block ${open ? "rotate-180" : ""}`} aria-hidden="true" />
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
						transition={springs.soft}
						style={{ transformOrigin: "top right" }}
						className="absolute right-0 mt-2 w-56 rounded-sm border border-border bg-void py-1 font-mono shadow-xl shadow-overlay z-[60]"
					>
						<div className="border-b border-border px-4 py-3">
							<p className="text-[11px] uppercase tracking-widest text-text-tertiary">
								Logged in
							</p>
							<p className="mt-1 truncate text-xs text-accent">
								{evmAddress ?? email ?? "Email account"}
							</p>
						</div>
						<Link
							href="/dashboard"
							role="menuitem"
							className="flex items-center gap-3 px-4 py-3 text-xs text-text-secondary transition-colors duration-200 ease-out hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
							onClick={() => setOpen(false)}
						>
							<LayoutDashboard className="h-3 w-3" aria-hidden="true" />
							<span>dashboard</span>
						</Link>
						<Link
							href="/dashboard?tab=api-keys"
							role="menuitem"
							className="flex items-center gap-3 px-4 py-3 text-xs text-text-secondary transition-colors duration-200 ease-out hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
							onClick={() => setOpen(false)}
						>
							<Key className="h-3 w-3" aria-hidden="true" />
							<span>api keys</span>
						</Link>
						<Link
							href="/deposit"
							role="menuitem"
							className="flex items-center gap-3 px-4 py-3 text-xs text-text-secondary transition-colors duration-200 ease-out hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
							onClick={() => setOpen(false)}
						>
							<Zap className="h-3 w-3" aria-hidden="true" />
							<span>buy credits</span>
						</Link>
						<Link
							href="/settings"
							role="menuitem"
							className="flex items-center gap-3 px-4 py-3 text-xs text-text-secondary transition-colors duration-200 ease-out hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:bg-surface focus-visible:text-text-bright"
							onClick={() => setOpen(false)}
						>
							<Settings className="h-3 w-3" aria-hidden="true" />
							<span>settings</span>
						</Link>
						<div className="my-1 h-px bg-border" aria-hidden="true" />
						{!confirming ? (
							<button
								type="button"
								role="menuitem"
								onClick={() => setConfirming(true)}
								className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs text-error/80 transition-colors duration-200 ease-out hover:bg-error-dim hover:text-error focus-visible:outline-none focus-visible:bg-error-dim focus-visible:text-error"
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
								Sign in again with your email or wallet to return to your account.
								</p>
								<div className="mt-2 grid grid-cols-2 gap-1">
									<button
										type="button"
										onClick={() => setConfirming(false)}
										disabled={disconnecting}
										className="rounded-sm border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-text transition-colors duration-200 ease-out hover:bg-panel disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
									>
										Cancel
									</button>
									<button
										type="button"
										onClick={handleConfirmDisconnect}
										disabled={disconnecting}
										className="rounded-sm border border-error/40 bg-error/10 px-2 py-1.5 text-[11px] font-semibold text-error transition-colors duration-200 ease-out hover:bg-error/20 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error active:scale-[0.97]"
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
