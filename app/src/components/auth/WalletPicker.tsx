"use client";

import { m } from "@/lib/framer-motion-client";
import { ChevronRight, Loader2, X } from "lucide-react";
import {
	type KeyboardEvent,
	type MouseEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from "react";
import { ConnectorIcon, classifyConnector } from "./ConnectorIcon";
import type { ConnectorView } from "./types";

interface WalletPickerProps {
	open: boolean;
	connectors: Array<{ id: string; name: string; icon?: string }>;
	/** id of the connector that the user just clicked + is awaiting a wallet popup */
	pendingId: string | null;
	onSelect: (id: string) => void;
	onClose: () => void;
}

/**
 * Picker dialog for choosing a wallet connector.
 *
 * Implements:
 *   - Click-outside close (mousedown on the backdrop or any element outside)
 *   - Escape close
 *   - Focus trap — focus stays inside the dialog while open
 *   - First-focusable auto-focused on mount for keyboard users
 *   - `aria-modal`, labelled by the heading, with `role="dialog"`
 *   - Centered modal on mobile, anchored near the trigger on desktop
 *     (positioning is purely visual; we don't read anchor geometry here)
 */
export function WalletPicker({
	open,
	connectors,
	pendingId,
	onSelect,
	onClose,
}: WalletPickerProps) {
	const dialogRef = useRef<HTMLDivElement | null>(null);
	// Capture the close callback in a ref so the effect doesn't re-run when the
	// parent hands down a fresh function reference (would steal focus).
	const onCloseRef = useRef(onClose);
	useEffect(() => {
		onCloseRef.current = onClose;
	}, [onClose]);

	// Stable view-model: classify each connector exactly once.
	const items: ConnectorView[] = useMemo(
		() =>
			connectors.map((c) => ({
				id: c.id,
				name: c.name,
				icon: c.icon,
				kind: classifyConnector(c.id, c.name),
			})),
		[connectors],
	);

	const handleBackdropClick = useCallback(
		(e: MouseEvent<HTMLButtonElement>) => {
			// The backdrop element only receives clicks on its own pixels, so a
			// single mousedown here unambiguously means "dismiss".
			e.preventDefault();
			onCloseRef.current();
		},
		[],
	);

	useEffect(() => {
		if (!open) return;
		const onKey = (e: globalThis.KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				onCloseRef.current();
				return;
			}
			// Focus trap on Tab.
			if (e.key === "Tab" && dialogRef.current) {
				const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
					'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
				);
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (e.shiftKey && document.activeElement === first) {
					e.preventDefault();
					last.focus();
				} else if (!e.shiftKey && document.activeElement === last) {
					e.preventDefault();
					first.focus();
				}
			}
		};
		document.addEventListener("keydown", onKey);
		// Focus first row on open.
		const firstRow = dialogRef.current?.querySelector<HTMLElement>(
			"button:not([disabled])",
		);
		firstRow?.focus();
		return () => document.removeEventListener("keydown", onKey);
	}, [open]);

	if (!open) return null;

	return (
		<>
			<button
				type="button"
				aria-label="Close wallet picker"
				onClick={handleBackdropClick}
				className="fixed inset-0 z-[80] bg-overlay/50 backdrop-blur-sm cursor-default"
			/>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="wallet-picker-title"
				className="fixed inset-x-4 top-[15vh] z-[81] mx-auto max-w-sm rounded-2xl border border-border bg-panel shadow-2xl shadow-overlay md:left-auto md:right-6 md:top-auto md:translate-y-0 md:mt-2"
				style={
					typeof window !== "undefined" && window.innerWidth >= 768
						? undefined
						: undefined
				}
			>
				{/* Anchor the picker below the Connect Wallet trigger on desktop. */}
				<div className="md:absolute md:right-0 md:top-full md:mt-2 md:w-80 md:inset-x-auto md:bottom-auto md:translate-y-0">
					<div className="flex items-center justify-between border-b border-border px-4 py-3">
						<div>
							<h3
								id="wallet-picker-title"
								className="text-sm font-semibold text-text-bright"
							>
								Connect a wallet
							</h3>
							<p className="text-[11px] text-text-muted mt-0.5">
								SIWE — your signature proves ownership. No transaction.
							</p>
						</div>
						<button
							type="button"
							onClick={onClose}
							aria-label="Close"
							className="rounded-lg p-2 text-text-muted hover:bg-surface hover:text-text transition-colors"
						>
							<X className="h-4 w-4" />
						</button>
					</div>
					<m.ul
						role="list"
						initial={{ opacity: 0, y: -4 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
						className="p-2"
					>
						{items.length === 0 ? (
							<li className="px-3 py-5 text-center space-y-3">
								<p className="text-xs text-text-muted leading-relaxed">
									No wallet connectors loaded. Refresh the page, or use{" "}
									<strong className="text-text-secondary">account number</strong>{" "}
									sign-in / x402 pay-per-request.
								</p>
								<div className="flex flex-wrap items-center justify-center gap-2 text-[11px]">
									<a
										href="https://metamask.io"
										target="_blank"
										rel="noopener noreferrer"
										className="text-accent hover:underline underline-offset-2"
									>
										MetaMask
									</a>
									<span className="text-text-tertiary">·</span>
									<a
										href="https://www.coinbase.com/wallet"
										target="_blank"
										rel="noopener noreferrer"
										className="text-accent hover:underline underline-offset-2"
									>
										Coinbase Wallet
									</a>
									<span className="text-text-tertiary">·</span>
									<a
										href="/login?method=account"
										className="text-accent hover:underline underline-offset-2"
									>
										Account number
									</a>
								</div>
							</li>
						) : (
							items.map((c) => {
								const pending = pendingId === c.id;
								return (
									<li key={c.id}>
										<button
											type="button"
											onClick={() => onSelect(c.id)}
											disabled={pending}
											aria-busy={pending}
											className="group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left text-sm text-text transition-all hover:bg-surface focus:bg-surface focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60 disabled:cursor-not-allowed"
										>
											<ConnectorIcon connector={c} />
											<span className="flex-1 font-medium">{c.name}</span>
											{pending ? (
												<Loader2
													className="h-4 w-4 animate-spin text-text-muted"
													aria-hidden="true"
												/>
											) : (
												<ChevronRight
													className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
													aria-hidden="true"
												/>
											)}
										</button>
									</li>
								);
							})
						)}
					</m.ul>
					<div className="border-t border-border px-4 py-2.5 text-[11px] text-text-muted">
						New to wallets?{" "}
						<a
							href="https://www.coinbase.com/wallet"
							target="_blank"
							rel="noopener noreferrer"
							className="text-accent hover:underline underline-offset-2"
						>
							Get started with Coinbase Wallet →
						</a>
					</div>
				</div>
			</div>
		</>
	);
}

/**
 * KeyboardEvent re-export for convenience — picker consumers don't need
 * to type out the React global union.
 */
export type { KeyboardEvent };
