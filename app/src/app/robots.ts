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
					"/chat",
					"/chat/",
					"/deposit",
					"/deposit/",
					"/image-generation",
					"/video-generation",
				],
			},
		],
		sitemap: "https://oma-ai.com/sitemap.xml",
		host: "https://oma-ai.com",
	};
}
