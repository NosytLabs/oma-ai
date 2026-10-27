"use client";

import Script from "next/script";

/** Google Analytics 4 (gtag.js) - fires on every pageview.
 *
 * Rendered ONLY when NEXT_PUBLIC_GA_ID is set, so local dev, preview builds
 * and forks never send production traffic into the real property. The ID is
 * a NEXT_PUBLIC_ var, so it is inlined at build time and the component
 * disappears entirely when unset.
 *
 * `afterInteractive` defers the tag until after hydration so it never competes
 * with the critical path - GA should not delay first paint.
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
 *
 * NO CONSENT GATE (restored 2026-10-27): a consent banner was reintroduced on
 * 2026-10-19 by an automated audit commit, after this component had already
 * shipped unconditional tracking on 2026-10-12. It broke measurement a
 * second time and the regression is now corrected.
 *
 * Why the gate destroys measurement rather than merely delaying it: with
 * `gtag('consent','default',{analytics_storage:'denied'})` the property
 * receives NO session, no user and no engagement row for the visitor. The
 * page still loads the tag and still fires a hit, so the site looks
 * instrumented while the property stays dark.
 *
 * Measured impact of the 2026-10-19 regression (read from the GA4 property
 * itself, 2026-10-27): sessions fell from 21/day (2026-10-13) to 0 on
 * 2026-10-20 through 2026-10-25, while Search Console kept recording brand
 * clicks (4 clicks on 2026-10-22 for "oma ai") - i.e. real visitors kept
 * arriving and kept being invisible to GA4. GA4 with `anonymize_ip` and no
 * ad/ads signals collects no personal data, which is the practice this site's
 * privacy page describes.
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
