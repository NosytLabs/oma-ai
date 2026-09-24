import { describe, expect, it } from "vitest";
import { metadata } from "../layout";

/**
 * The /models page BODY was fixed to stop advertising 20 models when only a
 * couple accept requests: the hero fetches the live catalog and counts what is
 * actually accepting. The segment's <head> metadata was left on the static
 * MODEL_COUNT, so every search result still pitched a 20-model catalog while
 * the page itself said 2.
 *
 * A build-time number cannot be honest here. Availability changes whenever an
 * upstream key is added, revoked, or rate-limited, and metadata is not rebuilt
 * on that event -- so any hardcoded count is a claim that will silently rot.
 * The fix is to describe the catalog without asserting a volatile quantity.
 */
describe("/models metadata honesty", () => {
	const descriptions = [
		metadata.description ?? "",
		metadata.openGraph?.description ?? "",
	].join(" ");

	it("never asserts a model count in search-facing metadata", () => {
		// Any number-word pair like "20 models" / "20 AI models" is a claim
		// about live availability that metadata cannot keep true.
		expect(descriptions).not.toMatch(/\b\d+\s+(curated\s+)?(AI\s+)?models?\b/i);
	});

	it("still describes the catalog usefully", () => {
		expect(descriptions).toMatch(/pricing/i);
		expect(descriptions).toMatch(/openai-compatible|openai compatible/i);
	});

	it("keeps a canonical URL so the page is indexable", () => {
		expect(metadata.alternates?.canonical).toBe("/models");
	});
});
