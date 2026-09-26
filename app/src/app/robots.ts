import type { MetadataRoute } from "next";
import SITE_URL from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: "/",
				disallow: [
					"/api/",
					"/admin",
					"/admin/",
					"/admin/:path*",
					"/dashboard",
					"/dashboard/",
					"/dashboard/:path*",
					"/settings",
					"/settings/",
					"/settings/:path*",
					"/login",
					// Auth-gated product surfaces (session required)
					"/deposit",
					"/deposit/",
					"/deposit/:path*",
					// /status is a per-request force-dynamic liveness probe with
					// no indexable content — keep it out of the crawl graph.
					"/status",
					"/status/:path*",
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
