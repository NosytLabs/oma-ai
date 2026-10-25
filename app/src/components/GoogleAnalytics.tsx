"use client";

import Script from "next/script";

/** Load the configured tag after hydration. Initialize measurement only on
 * the production hosts; CookieConsent controls analytics storage separately.
 * The tag can load while storage consent is denied. */
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
				// Storage starts denied; CookieConsent can grant analytics storage.
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