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
					"/dashboard",
					"/settings",
					"/login",
					"/api-keys",
					"/dashboard/api-keys",
					// Auth-gated product surfaces (session required)
					"/chat",
					"/deposit",
					"/image-generation",
					"/video-generation",
				],
			},
		],
		sitemap: "https://oma-ai.com/sitemap.xml",
		host: "https://oma-ai.com",
	};
}
