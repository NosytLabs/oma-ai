"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Cookie-consent banner. Renders only when GA is configured AND the user
 * has not yet made a decision. Decisions are stored in localStorage under
 * the same key the GA loader reads on mount, so a reload after acceptance
 * is non-blocking.
 *
 * Pattern: default-deny. The GoogleAnalytics component initializes GA with
 * `analytics_storage: 'denied'`; on accept we call gtag('consent', 'update',
 * { analytics_storage: 'granted' }) so existing and future hits start
 * tracking. Reject is a no-op (consent stays denied).
 */
const STORAGE_KEY = "oma-cookie-consent";

type ConsentState = "granted" | "denied" | "pending";

function readStored(): Exclude<ConsentState, "pending"> | null {
	if (typeof window === "undefined") return null;
	try {
		const v = window.localStorage.getItem(STORAGE_KEY);
		return v === "granted" || v === "denied" ? v : null;
	} catch {
		return null;
	}
}

declare global {
	interface Window {
		dataLayer: unknown[];
		gtag?: (...args: unknown[]) => void;
	}
}

export function CookieConsent() {
	const measurementId = process.env.NEXT_PUBLIC_GA_ID;
	const [state, setState] = useState<ConsentState>("pending");

	useEffect(() => {
		if (!measurementId) return;
		const stored = readStored();
		if (stored === "granted") {
			window.gtag?.("consent", "update", { analytics_storage: "granted" });
			setState("granted");
		} else if (stored === "denied") {
			setState("denied");
		} else {
			setState("pending");
		}
	}, [measurementId]);

	const decide = useCallback((value: "granted" | "denied") => {
		try {
			window.localStorage.setItem(STORAGE_KEY, value);
		} catch {
			// localStorage may be disabled (private mode, quota); the banner
			// will reappear next visit but gtag call still works in-memory.
		}
		if (value === "granted") {
			window.gtag?.("consent", "update", { analytics_storage: "granted" });
		}
		setState(value);
	}, []);

	if (!measurementId) return null;
	if (state !== "pending") return null;

	return (
		<div
			role="dialog"
			aria-live="polite"
			aria-label="Cookie consent"
			className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-surface/95 backdrop-blur-md px-4 py-3 sm:px-6"
			style={{ ["--consent-banner-height" as string]: "64px" }}
		>
			<div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
				<p className="text-[12px] leading-relaxed text-text-secondary">
					We use Google Analytics to understand how the site is used. No
					personal data is sold. Read the{" "}
					<a
						href="/privacy"
						className="underline-offset-2 hover:text-accent hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						privacy policy
					</a>
					.
				</p>
				<div className="flex shrink-0 gap-2">
					<button
						type="button"
						onClick={() => decide("denied")}
						className="min-h-8 rounded-sm border border-border bg-surface px-3 text-[11px] font-mono uppercase tracking-wider text-text-secondary transition-colors hover:border-text-muted hover:text-text-bright focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						Decline
					</button>
					<button
						type="button"
						onClick={() => decide("granted")}
						className="min-h-8 rounded-sm border border-accent bg-accent px-3 text-[11px] font-mono uppercase tracking-wider text-void transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					>
						Accept
					</button>
				</div>
			</div>
		</div>
	);
}
