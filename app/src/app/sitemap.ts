import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://oma-ai.com";

	return [
		{
			url: baseUrl,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 1,
		},
		{
			url: `${baseUrl}/about`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/compare`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/compare/cheaptokens-alternative`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/compare/openrouter-alternative`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/compare/venice-ai-alternative`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/compare/surplus-min-discount-routing`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/deposit`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/deposit`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/docs`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/faq`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/image-generation`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/models`,
			lastModified: new Date(),
			changeFrequency: "daily",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/pricing`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.7,
		},
		{
			url: `${baseUrl}/privacy`,
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.3,
		},
		{
			url: `${baseUrl}/private-ai-api`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/swap`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/terms`,
			lastModified: new Date(),
			changeFrequency: "yearly",
			priority: 0.3,
		},
		{
			url: `${baseUrl}/use-cases`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.6,
		},
		{
			url: `${baseUrl}/use-cases/ai-agents`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/use-cases/apps`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/use-cases/chatbots`,
			lastModified: new Date(),
			changeFrequency: "monthly",
			priority: 0.5,
		},
		{
			url: `${baseUrl}/video-generation`,
			lastModified: new Date(),
			changeFrequency: "weekly",
			priority: 0.5,
		},
	];
}
