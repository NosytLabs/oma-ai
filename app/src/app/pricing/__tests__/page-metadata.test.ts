import { describe, expect, it } from "vitest";
import { metadata } from "../page";

/**
 * The /models metadata was fixed to stop asserting "20 models" when only a
 * couple accept requests -- availability is a LIVE fact read from the API, and
 * a count baked into a build-time <head> silently rots the moment a provider
 * key is added, revoked or expires.
 *
 * /pricing shipped the same claim and was missed. Its body is honest (the
 * table marks every unavailable row and strikes the input price), so the only
 * lie is in the metadata -- which is exactly what search engines, link
 * previews and social cards read. Measured live: the title and description
 * both said "20 curated AI models" while 18 of 20 rows rendered UNAVAILABLE.
 *
 * So the description must describe the catalog without asserting a volatile
 * quantity. No "20", no "N curated".
 */
describe("/pricing metadata honesty", () => {
	it("does not assert a model count in the page title", () => {
		expect(metadata.title).not.toMatch(/\b\d+\s+(curated|models)/i);
		expect(String(metadata.title)).not.toMatch(/\b20\b/);
	});

	it("does not assert a model count in the meta description", () => {
		const d = String(metadata.description ?? "");
		expect(d).not.toMatch(/\b\d+\s+(curated|models)/i);
		expect(d).not.toMatch(/\b20\b/);
	});

	it("keeps the same honest wording on every social/OG variant", () => {
		const og = String(metadata.openGraph?.title ?? "");
		const tw = String(metadata.twitter?.title ?? "");
		for (const t of [og, tw]) {
			expect(t).not.toMatch(/\b\d+\s+(curated|models)/i);
			expect(t).not.toMatch(/\b20\b/);
		}
	});

	it("still describes what the page is (guard against deleting the copy)", () => {
		expect(String(metadata.title)).toMatch(/pricing/i);
		expect(String(metadata.title)).toMatch(/USDC/i);
		expect(String(metadata.description)).toMatch(/USDC on Base/i);
		expect(String(metadata.description)).toMatch(/OpenAI-compatible/i);
	});
});
