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
					// /chat is public free playground — indexable; image/video
					// legacy paths redirect into /chat?mode=
				],
			},
		],
		sitemap: `${baseUrl}/sitemap.xml`,
	};
}
