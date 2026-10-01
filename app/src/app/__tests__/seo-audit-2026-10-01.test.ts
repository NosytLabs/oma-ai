import { describe, expect, it } from "vitest";
import { metadata as statusMetadata } from "../status/page";
import { generateMetadata as glossaryMetadata, truncateDescription } from "../glossary/[slug]/page";
import robots from "../robots";
import sitemap from "../sitemap";
import { GLOSSARY_SLUGS, GLOSSARY_TERMS_BY_SLUG } from "@/components/glossary-data";

/**
 * AUDIT 2026-10-01 — regressions found by a live crawl of www.oma-ai.com.
 *
 * 1. /status served `<meta name="robots" content="index, follow">` and a self
 *    canonical while robots.ts disallows /status, and the route is absent from
 *    the sitemap. That is a self-contradicting crawl graph, not a preference:
 *    the disallow line and the missing sitemap entry both say "keep it out of
 *    the index", while the meta said "index it". The fix is in the metadata —
 *    the disallow is load-bearing because the page is a force-dynamic probe
 *    with no indexable content.
 * 2. Glossary meta descriptions used the full glossary definition prose
 *    verbatim; 23 of 32 ran 161-268 chars and got truncated mid-sentence.
 */

const ORIGIN = "https://www.oma-ai.com";

describe("/status crawl directives are self-consistent", () => {
	it("is noindex,follow — the page is a per-request liveness probe with no indexable content", () => {
		// The intent is already documented in robots.ts ("no indexable content
		// — keep it out of the crawl graph") and next.config.ts keeps /status out
		// of the CDN-cacheable list for the same reason. The meta robots tag is
		// the one directive that disagreed, so it is the one that changes.
		expect(statusMetadata.robots).toMatchObject({ index: false, follow: true });
	});

	it("does not advertise a canonical for a noindex URL", () => {
		// A self-referencing canonical on a noindexed page sends a mixed signal
		// and is pure noise in the rendered HTML. Drop it rather than pointing
		// it at "/" — a canonical implies the content lives at that URL.
		expect(statusMetadata.alternates?.canonical).toBeUndefined();
	});

	it("still disallows /status in robots.txt", () => {
		// robots.ts default-exports the *function*, not the result — call it.
		const result = robots() as { rules: { disallow?: string[] }[] };
		const disallowed = result.rules.flatMap((r) => r.disallow ?? []);
		expect(disallowed).toContain("/status");
	});

	it("keeps /status absent from the sitemap (a noindex URL must not be advertised)", async () => {
		const result = await sitemap();
		const urls = result.map((e) => e.url);
		expect(urls.some((u) => u.replace(`${ORIGIN}`, "") === "/status")).toBe(false);
	});

	it("remains force-dynamic so it is never served a frozen build snapshot", async () => {
		const mod = await import("../status/page");
		expect((mod as { dynamic?: string }).dynamic).toBe("force-dynamic");
	});
});

describe("glossary meta descriptions fit a SERP snippet", () => {
	const MAX = 160;

	it("every glossary page has a description of at most 160 characters", async () => {
		const over: string[] = [];
		for (const slug of GLOSSARY_SLUGS) {
			const meta = await glossaryMetadata({ params: Promise.resolve({ slug }) });
			const desc = typeof meta.description === "string" ? meta.description : "";
			if (desc.length > MAX) over.push(`${slug} (${desc.length})`);
		}
		expect(over).toEqual([]);
	});

	it("descriptions are non-empty and end as prose, not mid-word truncation", async () => {
		for (const slug of GLOSSARY_SLUGS) {
			const meta = await glossaryMetadata({ params: Promise.resolve({ slug }) });
			const desc = typeof meta.description === "string" ? meta.description : "";
			expect(desc.length).toBeGreaterThan(40);
			// A truncation helper can leave a dangling "…" or a half word; assert
			// the visible tail is real prose so a future edit cannot reintroduce it.
			expect(desc).not.toMatch(/\s…$/);
			expect(desc.trim()).toBe(desc);
		}
	});

	it("truncates on a word boundary, never mid-token", () => {
		// Exercise the real helper, not a local re-implementation: a synthetic
		// definition that is one enormous token after "zero " would be cut
		// mid-word by a naive slice().
		const def = "zero " + "x".repeat(400);
		const short = truncateDescription(def);
		expect(short.length).toBeLessThanOrEqual(MAX);
		expect(short.endsWith("x")).toBe(false);
		expect(short).toBe("zero");
	});

	it("leaves descriptions already within budget untouched", () => {
		const short = "A vector of numbers that captures meaning.";
		expect(truncateDescription(short)).toBe(short);
	});

	it("strips trailing punctuation left by the cut", () => {
		// Must actually exceed the budget, otherwise the helper correctly
		// returns early and nothing is trimmed.
		const long = "alpha beta, gamma delta. epsilon " + "zeta eta theta. ".repeat(20);
		const short = truncateDescription(long);
		expect(short.length).toBeLessThanOrEqual(MAX);
		expect(short).not.toMatch(/[\s,;:.!?-]$/);
	});

	it("openGraph description matches the truncated meta description", async () => {
		for (const slug of GLOSSARY_SLUGS) {
			const meta = await glossaryMetadata({ params: Promise.resolve({ slug }) });
			const desc = typeof meta.description === "string" ? meta.description : "";
			const og = meta.openGraph as { description?: string } | undefined;
			expect(og?.description).toBe(desc);
		}
	});

	it("still describes the same term as the glossary definition", async () => {
		// Guards against a helper that truncates to something unrelated (e.g. the
		// first N chars of a JSON blob): the head must still be the definition.
		for (const slug of GLOSSARY_SLUGS) {
			const meta = await glossaryMetadata({ params: Promise.resolve({ slug }) });
			const desc = typeof meta.description === "string" ? meta.description : "";
			const def = GLOSSARY_TERMS_BY_SLUG[slug as (typeof GLOSSARY_SLUGS)[number]].def;
			expect(def.startsWith(desc.slice(0, 30))).toBe(true);
		}
	});
});