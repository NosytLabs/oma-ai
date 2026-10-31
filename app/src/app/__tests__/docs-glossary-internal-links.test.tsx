import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DocsContent } from "../docs/DocsContent";

/**
 * AUDIT 2026-10-31 — internal links from /docs prose to the glossary pages
 * that already rank for their own terms.
 *
 * Search Console (90d, sc-domain:oma-ai.com) showed these glossary pages
 * earning impressions but ZERO clicks, sitting deep in the results:
 *
 *   "api key"         -> /glossary/api-key         20 impr, pos 70.5
 *   "http 402"        -> /glossary/http-status-402   4 impr, pos 57.5
 *   "402 status code" -> /glossary/http-status-402   4 impr, pos 69.0
 *   "magiclink"       -> /glossary/magic-link        3 impr, pos 55.3
 *
 * The cause is that /docs — the only page where these terms appear in
 * long-form prose — never linked to the definition. /docs is the high-authority
 * page (it ranks and is crawled); the glossary entries are the thin pages
 * ranking on their own terms. One contextual link per section transfers that
 * authority and is the cheapest available fix.
 *
 * This asserts the links EXIST, so a later edit that drops one is caught
 * rather than silently losing the ranking path again.
 */

describe("/docs links to the glossary pages that rank for their own terms", () => {
	afterEach(() => {
		cleanup();
	});

	function renderDocs() {
		render(<DocsContent />);
	}

	it("links the API key mention in Quick start to the api-key glossary entry", () => {
		renderDocs();
		const link = screen.getByRole("link", { name: "API key" });
		expect(link).toHaveAttribute("href", "/glossary/api-key");
	});

	it("links the magic link mention in Authentication to the magic-link entry", () => {
		renderDocs();
		const link = screen.getByRole("link", { name: "magic link" });
		expect(link).toHaveAttribute("href", "/glossary/magic-link");
	});

	it("links the 402 status code in Errors to the http-status-402 entry", () => {
		renderDocs();
		const link = screen.getByRole("link", { name: "402" });
		expect(link).toHaveAttribute("href", "/glossary/http-status-402");
	});

	it("keeps the surrounding prose intact when linking the 402 status code", () => {
		// Linking the status code must not delete its explanation.
		renderDocs();
		expect(screen.getByText("Insufficient spendable credits.")).toBeTruthy();
	});
});
