/**
 * Deployment docs must agree on two facts that were previously stated three
 * different ways:
 *
 * 1. The canonical host is `https://www.oma-ai.com`. The apex
 *    `https://oma-ai.com` 308-redirects to it, and there is no
 *    `api.oma-ai.com` at all.
 * 2. `vercel deploy --prod --yes` runs from the REPOSITORY ROOT. The Vercel
 *    project's Root Directory is `app`, but that is a dashboard setting the
 *    build applies — the CLI link (`.vercel/`) lives at the root, so running
 *    from `app/` finds no link.
 *
 * These are prose facts in Markdown, which is exactly why they drifted: a
 * doc can be "correct" in isolation and wrong next to its neighbours. The
 * assertions below encode the agreed convention so a later edit that
 * reintroduces the old wording fails here instead of in a deploy.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = path.resolve(import.meta.dirname, "../../../..");

function read(relPath: string): string {
	return readFileSync(path.join(REPO_ROOT, relPath), "utf8");
}

/** Docs that state a deploy instruction or a public host. */
const DEPLOY_DOCS = [
	"README.md",
	"docs/DEPLOYMENT.md",
	"docs/PLATFORM.md",
	"docs/settlement-runbook.md",
	"docs/deployment-health.md",
	"deploy/coolify/README.md",
] as const;

/** Only these OMA hosts may appear in a `https://` URL in deploy docs. */
const ALLOWED_OMA_HOSTS = new Set([
	"www.oma-ai.com",
	"oma-ai.com",
	"api.oma-ai.com", // only ever named as non-existent
]);

function httpsUrls(doc: string): string[] {
	return [...doc.matchAll(/https:\/\/[^\s`)"'<>]+/g)].map((m) => m[0]);
}

/** Third-party links (badge CDN, coolify.io) are legitimate; only ours are policed. */
function isOmaHost(host: string): boolean {
	return host === "oma-ai.com" || host.endsWith(".oma-ai.com");
}

describe("deployment docs — canonical host", () => {
	it.each(DEPLOY_DOCS)("%s uses no unexpected OMA host", (doc) => {
		for (const url of httpsUrls(read(doc))) {
			const host = new URL(url).host;
			if (!isOmaHost(host)) continue;
			expect(
				ALLOWED_OMA_HOSTS.has(host),
				`${doc} references unexpected host: ${url}`,
			).toBe(true);
		}
	});

	it.each(DEPLOY_DOCS)("%s never points readers at api.oma-ai.com", (doc) => {
		// The host does not resolve. It may be named to say so, but must
		// never be the target of a link people are told to call.
		for (const url of httpsUrls(read(doc))) {
			if (!url.includes("api.oma-ai.com")) continue;
			const line = read(doc)
				.split("\n")
				.find((l) => l.includes(url)) as string;
			const saysItDoesNotExist =
				/no such record|does not exist|NXDOMAIN|not the public API host|Do not create/i.test(
					line,
				);
			expect(
				saysItDoesNotExist,
				`${doc} links to api.oma-ai.com without saying it does not exist: ${line.trim()}`,
			).toBe(true);
		}
	});

	it("DEPLOYMENT.md is the single source of truth and names the canonical host", () => {
		const doc = read("docs/DEPLOYMENT.md");
		expect(doc).toContain("https://www.oma-ai.com");
		expect(doc).toMatch(/\*\*Canonical\./);
		expect(doc).toMatch(/308-redirects/);
	});

	it("README no longer advertises the apex or a nonexistent OpenAPI host", () => {
		const readme = read("README.md");
		expect(readme).toContain("https://www.oma-ai.com/api/v1/openapi.json");
		expect(readme).not.toMatch(/\]\(https:\/\/oma-ai\.com\)/);
	});
});

describe("deployment docs — vercel deploy command", () => {
	it.each(DEPLOY_DOCS.filter((d) => d !== "docs/PLATFORM.md"))(
		"%s runs vercel deploy from the repository root, not app/",
		(doc) => {
			const text = read(doc);
			if (!text.includes("vercel deploy")) return;

			// The stale instruction paired the command with app/.
			expect(
				text,
				`${doc} still tells the reader to deploy from app/`,
			).not.toMatch(/vercel deploy[^\n]*from `?app\//);

			// Where the working directory is stated, it must be the root.
			const claims = [...text.matchAll(/vercel deploy[^\n]*/g)].map((m) => m[0]);
			for (const claim of claims) {
				if (!/from/i.test(claim)) continue;
				expect(
					claim,
					`${doc} names a non-root working directory: ${claim.trim()}`,
				).toMatch(/repo(?:sitory)? root/i);
			}
		},
	);

	it("DEPLOYMENT.md explains the root/app distinction explicitly", () => {
		const doc = read("docs/DEPLOYMENT.md");
		// Someone reading only the old line "from app/ (the project rootDir)"
		// must be able to tell why that was wrong.
		expect(doc).toMatch(/Root Directory is `?app`?/);
		expect(doc).toMatch(/CLI link/);
		expect(doc).toMatch(/repository root/i);
	});
});
