import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	REMOVED_PUBLIC_PATHS,
	SITE_REDIRECTS,
} from "./site-redirects";
import sitemap from "@/app/sitemap";
import manifest from "@/app/manifest";

const publicDir = join(process.cwd(), "public");

describe("SITE_REDIRECTS (shipped next.config source)", () => {
	it("covers every removed public path with a permanent-style mapping", () => {
		const sources = SITE_REDIRECTS.map((r) => r.source);
		for (const path of REMOVED_PUBLIC_PATHS) {
			const covered =
				sources.includes(path) ||
				sources.some((s) => s === `${path}/:path*` || s.startsWith(`${path}/`));
			expect(covered, `missing redirect for ${path}`).toBe(true);
		}
	});

	it("never redirects a removed path onto another removed path", () => {
		const removed = new Set<string>(REMOVED_PUBLIC_PATHS);
		for (const r of SITE_REDIRECTS) {
			const destPath = r.destination.split("#")[0];
			if (destPath === "/") continue;
			expect(removed.has(destPath)).toBe(false);
		}
	});

	it("maps known consolidations to live product surfaces", () => {
		const bySource = Object.fromEntries(
			SITE_REDIRECTS.map((r) => [r.source, r.destination]),
		);
		// /changelog and /status are live pages (not redirected) — same as /about, /faq
		expect(bySource["/about"]).toBeUndefined();
		expect(bySource["/faq"]).toBeUndefined();
		expect(bySource["/changelog"]).toBeUndefined();
		expect(bySource["/status"]).toBeUndefined();
		expect(bySource["/blog"]).toBe("/docs");
		expect(bySource["/network"]).toBe("/docs#endpoints");
		expect(bySource["/support"]).toBe("/contact");
		expect(bySource["/signup"]).toBe("/login");
		expect(bySource["/sign-in"]).toBe("/login");
		expect(bySource["/sign-up"]).toBe("/login");
		expect(bySource["/register"]).toBe("/login");
		expect(bySource["/signin"]).toBe("/login");
		expect(bySource["/playground"]).toBe("/chat");
		expect(bySource["/image-generation"]).toBe("/chat");
		expect(bySource["/video-generation"]).toBe("/chat");
		expect(bySource["/create"]).toBe("/chat");
		expect(bySource["/studio"]).toBe("/chat");
		expect(bySource["/swap"]).toBe("/deposit");
		expect(bySource["/credits"]).toBe("/deposit");
		expect(bySource["/account"]).toBe("/settings");
		expect(bySource["/api-keys"]).toBe("/dashboard?tab=api-keys");
	});
});

describe("sitemap excludes removed marketing routes", () => {
	it("does not list any REMOVED_PUBLIC_PATHS URL", () => {
		const urls = sitemap().map((e) => e.url);
		for (const path of REMOVED_PUBLIC_PATHS) {
			const hit = urls.some(
				(u) =>
					u === `https://oma-ai.com${path}` ||
					u.startsWith(`https://oma-ai.com${path}/`),
			);
			expect(hit, `sitemap still lists ${path}`).toBe(false);
		}
	});
});

describe("brand assets on disk (public/)", () => {
	// The tab favicon + apple touch icon are served from static files in
	// `public/` (declared in `src/app/layout.tsx` metadata.icons). SVG + PNG
	// cover every modern browser; `app/favicon.ico` is the legacy /favicon.ico
	// fallback for older crawlers.
	const required = [
		"favicon.svg",
		"favicon-16x16.png",
		"favicon-32x32.png",
		"favicon.ico",
		"apple-touch-icon.png",
		"og-image.png",
		"logos/oma-logo.svg",
		"logos/oma-wordmark.svg",
		"logos/oma-brand-card.svg",
		"logos/oma-icon-192.png",
		"logos/oma-icon-512.png",
		"logos/oma-icon-1024.png",
	];

	it.each(required)("exists: %s", (rel) => {
		expect(existsSync(join(publicDir, rel))).toBe(true);
	});

	it("favicon.svg encodes void + accent and open-gateway mark geometry", () => {
		const svg = readFileSync(join(publicDir, "favicon.svg"), "utf8");
		expect(svg).toContain("#07090a");
		expect(svg).toContain("#46d39a");
		// Open ring (stroked circle with dash gap at 3 o'clock)
		expect(svg).toMatch(/stroke-dasharray/i);
		// Terminal chevron (path) pointing through the gap
		expect(svg).toMatch(/<path\b/i);
		// Signal / LED dots at the ring gap
		const accentFills = svg.match(/fill="#46d39a"/g) ?? [];
		expect(accentFills.length).toBeGreaterThanOrEqual(1);
		expect(svg).toMatch(/circle[^>]+fill="#46d39a"/);
		expect(svg).toContain("#6ee7b7");
	});

	it("lockup SVGs use the same brand hex tokens and canonical tagline", () => {
		for (const rel of ["logos/oma-logo.svg", "logos/oma-wordmark.svg", "logos/oma-brand-card.svg"]) {
			const svg = readFileSync(join(publicDir, rel), "utf8");
			expect(svg).toContain("#07090a");
			expect(svg).toContain("#46d39a");
			expect(svg).toMatch(/open model access/i);
		}
	});
});

describe("shared page-shell layout contract", () => {
	it("does not contain the retired desktop sidebar offset", () => {
		const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
		expect(css).toContain(".page-shell {");
		expect(css).not.toMatch(/\.page-shell[\s\S]{0,220}padding-left:\s*18rem/);
	});
});

describe("manifest brand wiring", () => {
	it("uses void background and references brand icons that exist on disk", () => {
		const m = manifest();
		expect(m.background_color).toBe("#07090a");
		expect(m.theme_color).toBe("#07090a");
		expect(m.icons?.length).toBeGreaterThan(0);
		for (const icon of m.icons ?? []) {
			const rel = icon.src.replace(/^\//, "");
			expect(existsSync(join(publicDir, rel)), `missing icon ${icon.src}`).toBe(
				true,
			);
		}
	});
});
