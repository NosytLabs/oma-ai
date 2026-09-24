import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	// The fallback must match the canonical host used by sitemap.ts and every
	// page's alternates.canonical. The apex 308-redirects to www, so
	// advertising it here would point crawlers at a redirect instead of the
	// sitemap whenever NEXT_PUBLIC_APP_URL is unset.
	const baseUrl =
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
		"https://www.oma-ai.com";
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: [
					"/api/",
					"/admin",
					"/admin/",
					"/dashboard",
					"/dashboard/",
					"/settings",
					"/settings/",
					"/login",
					// Auth-gated product surfaces (session required)
					"/deposit",
					"/deposit/",
					// /chat is the public free playground — indexable. Legacy
					// `/image-generation`, `/video-generation`, `/create`,
					// `/studio` paths are caught by the permanent-redirect map
					// in `lib/site-redirects.ts` and route into /chat.
				],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
