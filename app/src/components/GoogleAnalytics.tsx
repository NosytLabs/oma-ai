"use client";

import Script from "next/script";

/** Google Analytics 4, enabled by the build-time NEXT_PUBLIC_GA_ID.
 *
 * Both scripts load after hydration with `afterInteractive`. The inline
 * initializer sends the config command only on a production hostname;
 * preview deployments and local development do not configure measurement.
 * Keep next.config.ts CSP origins aligned with the tag and beacon endpoints.
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
