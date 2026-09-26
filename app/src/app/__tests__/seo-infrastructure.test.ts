import { describe, expect, it } from "vitest";
import manifest from "../manifest";
import robots from "../robots";
import sitemap from "../sitemap";

describe("manifest.ts - Next.js MetadataRoute.Manifest", () => {
	it("defines an installable OMA manifest without duplicate route sources", () => {
		const result = manifest();
		expect(result.name).toContain("OMA AI");
		expect(result.start_url).toBe("/");
		expect(result.display).toBe("standalone");
		expect(result.icons?.some((icon) => icon.sizes === "192x192")).toBe(true);
		expect(result.icons?.some((icon) => icon.sizes === "512x512")).toBe(true);
	});
});

describe("sitemap.ts - Next.js MetadataRoute.Sitemap", () => {
	it("returns a non-empty array", async () => {
		const result = await sitemap();
		expect(Array.isArray(result)).toBe(true);
		// Public product surface — auth-gated routes intentionally excluded
		expect(result.length).toBeGreaterThanOrEqual(10);
	});

	it("every entry has a valid https url under oma-ai.com", async () => {
		const result = await sitemap();
		for (const entry of result) {
			expect(entry.url).toMatch(/^https:\/\/(www\.)?oma-ai\.com(\/.*)?$/);
		}
	});

	it("every entry has changeFrequency and priority; lastModified intentionally omitted", async () => {
		const result = await sitemap();
		for (const entry of result) {
			// lastModified is deliberately omitted (see the sitemap.ts comment:
			// deploy-date freshness would mark unchanged pages as freshly edited
			// on every release, and we only publish source-owned semantic dates).
			expect(entry.lastModified).toBeUndefined();
			expect([
				"always",
				"hourly",
				"daily",
				"weekly",
				"monthly",
				"yearly",
				"never",
			]).toContain(entry.changeFrequency);
			expect(typeof entry.priority).toBe("number");
			expect(entry.priority).toBeGreaterThanOrEqual(0);
			expect(entry.priority).toBeLessThanOrEqual(1);
		}
	});

	it("includes critical public marketing pages", async () => {
		const result = await sitemap();
		const urls = result.map((e) => e.url.replace(/^https:\/\/(www\.)?oma-ai\.com/, "") || "/");
		for (const required of [
			"/",
			"/pricing",
			"/docs",
			"/models",
			"/chat",
			"/about",
			"/contact",
			"/getting-started",
		]) {
			expect(urls).toContain(required);
		}
	});

	it("excludes auth-gated product surfaces", async () => {
		const result = await sitemap();
		const urls = result.map((e) => e.url.replace(/^https:\/\/(www\.)?oma-ai\.com/, "") || "/");
		// /chat is public free playground and is listed.
		// image/video legacy paths redirect and must not be listed.
		for (const gated of [
			"/deposit",
			"/dashboard",
			"/settings",
			"/admin",
			"/image-generation",
			"/video-generation",
			"/login",
		]) {
			expect(urls).not.toContain(gated);
		}
	});

	it("excludes removed marketing routes", async () => {
		const result = await sitemap();
		const paths = result.map((e) => e.url.replace(/^https:\/\/(www\.)?oma-ai\.com/, "") || "/");
		for (const dead of [
			"/blog",
			"/capabilities",
			"/compare",
			"/support",
			"/signup",
			"/disclosures",
			"/provenance",
		]) {
			expect(paths).not.toContain(dead);
		}
	});

	it("root entry (/) has priority 1", async () => {
		const result = await sitemap();
		const root = result.find((e) => /^https:\/\/(www\.)?oma-ai\.com\/?$/.test(e.url));
		expect(root).toBeDefined();
		expect(root?.priority).toBe(1);
	});
});

const rulesArray = (r: ReturnType<typeof robots>) => {
	const rules = r.rules;
	return Array.isArray(rules) ? rules : rules ? [rules] : [];
};

describe("robots.ts - Next.js MetadataRoute.Robots", () => {
	it("has rules defined", () => {
		const result = robots();
		expect(result).toBeDefined();
		expect(result.rules).toBeDefined();
	});

	it("allows / and disallows private paths for *", () => {
		const result = robots();
		for (const rule of rulesArray(result)) {
			if (rule.userAgent === "*") {
				expect(rule.allow).toBe("/");
				expect(Array.isArray(rule.disallow)).toBe(true);
			}
		}
	});

	it("disallows /api/, /admin, /dashboard, /settings, /login and deposit", () => {
		const result = robots();
		for (const rule of rulesArray(result)) {
			if (rule.userAgent === "*") {
				const disallow = Array.isArray(rule.disallow)
					? rule.disallow
					: rule.disallow
						? [rule.disallow]
						: [];
				for (const path of [
					"/api/",
					"/admin",
					"/dashboard",
					"/settings",
					"/login",
					"/deposit",
				]) {
					expect(disallow).toContain(path);
				}
				// Free public playground must remain crawlable
				expect(disallow).not.toContain("/chat");
			}
		}
	});

	it("declares sitemap and omits deprecated host field", () => {
		const result = robots();
		// Must match sitemap.ts and every page's alternates.canonical. The
		// apex 308-redirects to www, so pointing crawlers at it here would
		// advertise a redirect instead of the sitemap. Was the bare apex.
		expect(result.sitemap).toBe("https://www.oma-ai.com/sitemap.xml");
		// `host` is deprecated by Google and produces an invalid robots.txt —
		// intentionally omitted since the 2026-07-31 audit.
		expect(result.host).toBeUndefined();
	});
});
