"use client";

import { useEffect, useState } from "react";

/**
 * Skeleton shown while wagmi initializes its connectors.
 *
 * The wagmi provider returns `isReady=false` until `useEffect`s have
 * populated the stored-session check + the connector registry. Without a
 * skeleton the Connect Wallet button renders then re-renders with new
 * state — a visible flicker. We pulse a placeholder block of the same
 * size so the layout doesn't shift.
 */
export function AuthSkeleton({ lines = 3 }: { lines?: number }) {
	return (
		<div
			className="w-full max-w-md space-y-3"
			role="status"
			aria-label="Loading authentication"
			aria-busy="true"
		>
			<div className="h-10 w-full animate-pulse rounded-lg bg-surface" />
			{Array.from({ length: lines }).map((_, i) => (
				<div
					key={i}
					className="h-3 w-full animate-pulse rounded bg-surface/70"
					style={{ width: `${80 - i * 8}%` }}
				/>
			))}
			<span className="sr-only">Preparing wallet session…</span>
		</div>
	);
}

/**
 * Hook-friendly countdown for "retry in N seconds" UI. Returns the
 * remaining seconds; ticks down once per second until it hits 0, where
 * it stops (so the visual hint disappears as soon as the user can retry).
 */
export function useCountdown(startSec: number | undefined): number {
	const [secs, setSecs] = useState(startSec ?? 0);
	useEffect(() => {
		if (!startSec || startSec <= 0) {
			setSecs(0);
			return;
		}
		setSecs(startSec);
		const interval = setInterval(() => {
			setSecs((prev) => (prev <= 1 ? 0 : prev - 1));
		}, 1000);
		return () => clearInterval(interval);
	}, [startSec]);
	return secs;
}
