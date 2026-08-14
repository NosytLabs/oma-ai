import { describe, expect, it } from "vitest";
import { isCurrentPath, sectionLabelFor } from "./nav-links";

describe("navigation path matching", () => {
	it("matches an exact route", () => {
		expect(isCurrentPath("/docs", "/docs")).toBe(true);
	});

	it("matches a nested route without matching a similarly prefixed route", () => {
		expect(isCurrentPath("/docs/api", "/docs")).toBe(true);
		expect(isCurrentPath("/documentation", "/docs")).toBe(false);
	});

	it("does not treat the root link as active on every route", () => {
		expect(isCurrentPath("/", "/")).toBe(true);
		expect(isCurrentPath("/docs", "/")).toBe(false);
	});

	it("matches hash and query links by their path", () => {
		expect(isCurrentPath("/docs", "/docs#endpoints")).toBe(true);
		expect(isCurrentPath("/docs?tab=api", "/docs")).toBe(true);
		expect(isCurrentPath("/docs?tab=api", "/docs#endpoints")).toBe(true);
	});
});

describe("sectionLabelFor", () => {
	it("returns the primary link label for a nested route", () => {
		expect(sectionLabelFor("/docs/api")).toBe("Docs");
	});

	it("falls back to the first path segment for an unlisted route", () => {
		expect(sectionLabelFor("/faq")).toBe("FAQ");
	});
});
