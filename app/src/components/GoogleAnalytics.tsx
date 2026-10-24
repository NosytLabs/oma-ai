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
 *
 * HOSTNAME GUARD (added 2026-10-24): the Vercel project sets
 * NEXT_PUBLIC_GA_ID for the **Preview** environment as well as Production, so
 * every preview deployment was reporting its own traffic into the production
 * property. Measured over 28 days: 4 sessions / 4 views came from
 * `*.vercel.app` preview hosts - developer traffic counted as visitors.
 *
 * The guard lives INSIDE the inline init script rather than in the component
 * body, so the <Script> tags still render (keeping the component prerender-
 * safe and its existing tests meaningful) while the gtag 'config' command -
 * the command that actually starts a measurement - is only issued on a
 * production hostname. A preview deployment therefore loads the tag but
 * never opens a measurement.
 */
const PROD_HOSTS = ["www.oma-ai.com", "oma-ai.com"];

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
				// Default-deny. The CookieConsent component upgrades to 'granted'
				// once the user accepts; until then, GA sets a no-cookie header and
				// does not persist any client identifiers. The CSP allows
				// googletagmanager.com so the script still loads and the consent
				// state can be flipped client-side without a reload.
				gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' });
				// Only open a measurement on a production hostname. Preview
				// deployments (*.vercel.app) and local dev must not report into
				// the production property.
				var host = (window.location.hostname || '').toLowerCase();
				if (${JSON.stringify(PROD_HOSTS)}.indexOf(host) !== -1) {
					gtag('config', '${measurementId}', { anonymize_ip: true, send_page_view: true });
				}
			`}
			</Script>
		</>
	);
}