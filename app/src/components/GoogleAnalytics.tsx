"use client";

import Script from "next/script";

/**
 * Google Analytics 4 (gtag.js) — fires on every pageview.
 *
 * Rendered ONLY when NEXT_PUBLIC_GA_ID is set, so local dev, preview builds
 * and forks never send production traffic into the real property. The ID is
 * a NEXT_PUBLIC_ var, so it is inlined at build time and the component
 * disappears entirely when unset.
 *
 * `afterInteractive` defers the tag until after hydration so it never competes
 * with the critical path — GA should not delay first paint.
 *
 * The CSP in next.config.ts must allow googletagmanager.com in script-src /
 * connect-src / img-src, or this tag is silently blocked in production.
 */

export function GoogleAnalytics() {
	const measurementId = process.env.NEXT_PUBLIC_GA_ID;

	if (!measurementId) return null;

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