import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
	const baseUrl =
		process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, "") ||
		"https://oma-ai.com";
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
