"use client";

import Script from "next/script";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Google Analytics 4 (gtag.js), behind an explicit consent gate.
 *
 * Rendered ONLY when NEXT_PUBLIC_GA_ID is set, so local dev, preview builds
 * and forks never send production traffic into the real property. The ID is
 * a NEXT_PUBLIC_ var, so it is inlined at build time and the component
 * disappears entirely (rather than firing a request that 404s) when unset.
 *
 * No gtag.js request is made and nothing is pushed to dataLayer until the
 * visitor accepts. Declining is stored too, so the prompt does not reappear on
 * every pageview. This matches the pattern already proven on lethometry.com and
 * theydidntask.com; loading the tag eagerly (as this component used to) sends
 * cookies before consent, which is the failure the gate exists to prevent.
 *
 * `afterInteractive` defers the tag until after hydration so it never competes
 * with the critical path — GA should not delay first paint.
 *
 * The CSP in next.config.ts must allow googletagmanager.com in script-src /
 * connect-src / img-src, or this tag is silently blocked in production.
 */

const CONSENT_KEY = "oma_analytics_consent";

export function GoogleAnalytics() {
	const measurementId = process.env.NEXT_PUBLIC_GA_ID;
	const [decision, setDecision] = useState<"accepted" | "declined" | null>(null);
	// null until localStorage is read, so the prompt cannot flash for a
	// returning visitor who already decided.
	const [ready, setReady] = useState(false);
	const bannerRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const banner = bannerRef.current;
		if (!measurementId || !ready || decision || !banner) return;
		const root = document.documentElement;
		const measure = () => root.style.setProperty("--analytics-consent-height", `${Math.ceil(banner.getBoundingClientRect().height)}px`);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(banner);
		return () => {
			observer.disconnect();
			root.style.removeProperty("--analytics-consent-height");
		};
	}, [measurementId, ready, decision]);

	useEffect(() => {
		try {
			const stored = localStorage.getItem(CONSENT_KEY);
			if (stored === "accepted" || stored === "declined") setDecision(stored);
		} catch {
			// Storage blocked (private mode, blocked cookies): stay untracked
			// rather than prompting on every page load.
			setDecision("declined");
		}
		setReady(true);
	}, []);

	const decide = useCallback((value: "accepted" | "declined") => {
		try {
			localStorage.setItem(CONSENT_KEY, value);
		} catch {
			// Ignore: the decision still applies for this pageview.
		}
		setDecision(value);
	}, []);

	if (!measurementId || !ready) return null;

	if (decision === "accepted") {
		return (
			<>
				<Script
					src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
					strategy="afterInteractive"
				/>
				<Script id="ga-init" strategy="afterInteractive">
					{`
					window.dataLayer = window.dataLayer || [];
					function gtag(){dataLayer.push(arguments);}
					gtag('js', new Date());
					gtag('config', '${measurementId}', { anonymize_ip: true });
				`}
				</Script>
			</>
		);
	}

	if (decision === "declined") return null;

	return (
		<div
			ref={bannerRef}
			role="region"
			aria-label="Analytics consent"
			// pb-[env(safe-area-inset-bottom)] keeps the buttons clear of the
			// iOS home indicator / gesture bar. z-[200] is left alone: the
			// mobile menu overlay is z-[70], so the banner stacking above it
			// is correct — it must not be dismissable by opening the menu.
			className="fixed inset-x-0 bottom-0 z-[200] border-t border-border/60 bg-void/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
		>
			<div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-6">
				<p className="flex-1 text-sm leading-relaxed text-muted">
					{/* Full explanation from sm up; a one-line variant on phones,
					    where three lines of copy above two buttons pushed the
					    banner over a third of the viewport. */}
					<span className="hidden sm:block">
						We use Google Analytics to count visits and understand which pages are
						read. No advertising, no selling of data. You can decline and use
						everything else.
					</span>
					<span className="sm:hidden">Google Analytics counts visits. No ads, no data sold.</span>
				</p>
				<div className="flex shrink-0 gap-2">
					<button
						type="button"
						onClick={() => decide("accepted")}
						className="min-h-11 rounded-[var(--radius-lg)] border border-accent/60 bg-accent/10 px-4 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/20"
					>
						Accept analytics
					</button>
					<button
						type="button"
						onClick={() => decide("declined")}
						className="min-h-11 rounded-[var(--radius-lg)] border border-border px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-text/40 hover:text-text"
					>
						Decline
					</button>
				</div>
			</div>
		</div>
	);
}
