import type { MetadataRoute } from "next";
import SITE_URL from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				// Public /status remains crawlable so its noindex metadata can
				// be read. Private product paths stay excluded below.
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
		sitemap: `${SITE_URL}/sitemap.xml`,
	};
}
