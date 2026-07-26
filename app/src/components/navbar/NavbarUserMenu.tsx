"use client";

import { formatAddress } from "@/lib/utils";
import { AnimatePresence, m, useReducedMotion } from "@/lib/framer-motion-client";
import { Key, LogOut, Settings, Zap } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { EASE_SPRING } from "@/lib/motion";
import type { AuthMethod } from "../wallet-context";
import { useClickOutside } from "./_hooks/useClickOutside";

interface NavbarUserMenuProps {
	/**
	 * The connected EVM address, if any. Account-number-only users
	 * (`authMethod === "account-number"`) have no EVM address; the menu
	 * still renders for them with a hashed account-number label.
	 */
	evmAddress: string | undefined;
	authMethod: AuthMethod;
	accountNumber: string | null;
	onDisconnect: () => void | Promise<void>;
}

const shortAddress = (addr: string) => (addr ? formatAddress(addr) : "");

/**
 * Format an account number for the trigger label. We don't want to
 * surface the full 16 digits in a 6rem-wide pill (would truncate
 * inconsistently across locales), so we show a stable 4-digit prefix
 * + 4-digit suffix with a dot separator. This is the same approach
 * Mullvad VPN uses for its account number UI.
 */
const shortAccountNumber = (n: string) =>
	n.length >= 9 ? `${n.slice(0, 4)}…${n.slice(-4)}` : n;

/**
 * User dropdown shown only when the wallet is connected. Self-manages
 * open/close state. Click-outside closes via `useClickOutside`. Escape
 * closes without focus restore (matches the original user-menu behavior —
 * deliberately asymmetric with the tools dropdown).
 *
 * Resets to closed on route change to preserve the original navbar's
 * "all menus close on navigation" semantics.
 *
 * Logout requires a confirmation prompt because the JWT is the only
 * credential — particularly for account-number users, where the number
 * itself is the secret. A click that nukes the session without an
 * "are you sure?" is a real footgun (e.g. on touch devices where a
 * stray tap fires instantly).
 */
export function NavbarUserMenu({
	evmAddress,
	authMethod,
	accountNumber,
	onDisconnect,
}: NavbarUserMenuProps) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const [open, setOpen] = useState(false);
	const [confirming, setConfirming] = useState(false);
	const [disconnecting, setDisconnecting] = useState(false);
	const prefersReduced = useReducedMotion();
	const pathname = usePathname();

	// Close the user menu on every route change.
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

	// Reset confirm/disconnect state when the menu closes so reopening
	// it starts clean — without this, the next open could land in a
	// half-armed "are you sure?" state.
	useEffect(() => {
		if (!open) {
			setConfirming(false);
			setDisconnecting(false);
		}
	}, [open]);

	// Render trigger label based on auth method. Wallet users get the
	// short address; account-number users get a 4-dot-4 sample of their
	// number. Either way the trigger never reveals the *full* secret in
	// the navbar.
	const triggerLabel = evmAddress
		? shortAddress(evmAddress)
		: accountNumber
			? shortAccountNumber(accountNumber)
			: "session";

	const triggerTitle = evmAddress
		? evmAddress
		: accountNumber
			? `Account number ${accountNumber}`
			: "Active session";

	const handleConfirmDisconnect = async () => {
		if (disconnecting) return;
		setDisconnecting(true);
		try {
			await onDisconnect();
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
				<span className="relative flex h-1.5 w-1.5" aria-hidden="true">
					<span className="absolute inline-flex h-full w-full rounded-full bg-accent opacity-75 animate-ping" />
					<span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
				</span>
				<span className="max-w-[6rem] truncate font-mono">{triggerLabel}</span>
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
							<p className="mt-1 truncate text-xs text-accent">
								{evmAddress ?? (accountNumber ? `account:${accountNumber}` : "session")}
							</p>
							{authMethod === "account-number" && !evmAddress && (
								<p className="mt-0.5 text-[10px] uppercase tracking-widest text-text-muted">
									account-number login
								</p>
							)}
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
						{!confirming ? (
							<button
								type="button"
								role="menuitem"
								onClick={() => setConfirming(true)}
								className="flex w-full items-center gap-3 px-4 py-3 text-left text-xs text-error/80 transition-colors hover:bg-error-dim hover:text-error focus-visible:outline-none focus-visible:bg-error-dim focus-visible:text-error"
							>
								<LogOut className="h-3 w-3" aria-hidden="true" />
								terminate session
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
									Terminate session?
								</p>
								<p
									id="user-disconnect-body"
									className="mt-1 text-[10px] leading-relaxed text-text-secondary"
								>
									{authMethod === "account-number"
										? "You'll need your account number to sign back in. There's no recovery — write it down first."
										: "You'll need your wallet to sign back in."}
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
