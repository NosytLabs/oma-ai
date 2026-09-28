"use client";

import { LogOut } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/** Shared sign-out flow for both navigation layouts. */
export function NavbarSignOut({ onSignOut, onComplete }: {
	onSignOut: () => void | Promise<void>;
	onComplete: () => void;
}) {
	const [confirming, setConfirming] = useState(false);
	const [pending, setPending] = useState(false);
	const [error, setError] = useState(false);
	const cancelRef = useRef<HTMLButtonElement>(null);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const titleId = useId();

	useEffect(() => {
		if (confirming) cancelRef.current?.focus();
	}, [confirming]);

	async function signOut() {
		if (pending) return;
		setPending(true);
		setError(false);
		try {
			await onSignOut();
			onComplete();
		} catch {
			setError(true);
		} finally {
			setPending(false);
		}
	}

	return confirming ? (
		<div role="group" aria-labelledby={titleId} className="rounded-sm bg-surface p-3">
			<p id={titleId} className="text-xs font-medium text-text-bright">Sign out of OMA?</p>
			<p className="mt-1 text-[11px] leading-relaxed text-text-muted">Sign in again with your email or wallet to return.</p>
			{error && <p role="alert" className="mt-2 text-xs text-error">Could not sign out. Please try again.</p>}
			<div className="mt-3 grid grid-cols-2 gap-2">
				<button ref={cancelRef} type="button" disabled={pending} onClick={() => {
					setConfirming(false);
					requestAnimationFrame(() => triggerRef.current?.focus());
				}} className="min-h-11 rounded-sm border border-border px-3 text-xs text-text-secondary hover:bg-panel focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">Cancel</button>
				<button type="button" disabled={pending} onClick={signOut} className="min-h-11 rounded-sm border border-error/30 px-3 text-xs text-error hover:bg-error-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error disabled:opacity-50">{pending ? "Signing out…" : "Sign out"}</button>
			</div>
		</div>
	) : (
		<button ref={triggerRef} type="button" onClick={() => setConfirming(true)} className="flex min-h-11 w-full items-center gap-3 rounded-sm px-3 text-left text-xs text-text-secondary hover:bg-surface hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
			<LogOut className="h-4 w-4" aria-hidden="true" />Sign out
		</button>
	);
}
