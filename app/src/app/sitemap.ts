import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
	const baseUrl = "https://oma-ai.com";
	const now = new Date();

	const entry = (
		path: string,
		priority: number,
		changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"],
	): MetadataRoute.Sitemap[number] => ({
		url: path === "/" ? baseUrl : `${baseUrl}${path}`,
		lastModified: now,
		changeFrequency,
		priority,
	});

	return [
		entry("/", 1, "weekly"),
		// Marketing / product
		entry("/models", 0.9, "daily"),
		entry("/pricing", 0.9, "weekly"),
		entry("/docs", 0.85, "weekly"),
		entry("/compare", 0.7, "weekly"),
		entry("/chat", 0.7, "weekly"),
		entry("/image-generation", 0.55, "weekly"),
		entry("/video-generation", 0.55, "weekly"),
		entry("/deposit", 0.7, "weekly"),
		entry("/swap", 0.55, "monthly"),
		entry("/network", 0.5, "monthly"),
		entry("/observability", 0.5, "monthly"),
		entry("/changelog", 0.45, "monthly"),
		// FAQ lives on pricing; about content is on homepage
		entry("/pricing#faq", 0.4, "monthly"),
		// Legal
		entry("/privacy", 0.25, "yearly"),
		entry("/terms", 0.25, "yearly"),
	].filter(
		// Deduplicate by URL (models listed twice above intentionally collapsed)
		(item, index, arr) => arr.findIndex((x) => x.url === item.url) === index,
	);
}
