import type { MetadataRoute } from "next";

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
					"/dashboard",
					"/dashboard/",
					"/settings",
					"/settings/",
					"/login",
					"/api-keys",
					// Auth-gated product surfaces (session required)
					"/deposit",
					"/deposit/",
					// /chat is public free playground — indexable; image/video
					// legacy paths redirect into /chat?mode=
				],
			},
		],
		sitemap: "https://oma-ai.com/sitemap.xml",
	};
}
