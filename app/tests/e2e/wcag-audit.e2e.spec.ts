import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";
import type { Result as AxeResult, NodeResult } from "axe-core";

/**
 * OMA AI — WCAG 2.1 AA accessibility audit
 *
 * Runs axe-core against the rendered DOM of each public page in both
 * light and dark themes. Fails the test if any rule violates AA.
 *
 * Run:  npx playwright test tests/e2e/wcag-audit.e2e.spec.ts
 * Skip:  OMA_SKIP_WCAG=1
 */

const SKIP = !!process.env.OMA_SKIP_WCAG;
const SEVERITY_THRESHOLD = (process.env.WCAG_SEVERITY ?? "minor") as
	| "critical"
	| "serious"
	| "moderate"
	| "minor";

const SEVERITY_RANK: Record<string, number> = {
	critical: 4,
	serious: 3,
	moderate: 2,
	minor: 1,
};
const THRESHOLD_RANK = SEVERITY_RANK[SEVERITY_THRESHOLD] ?? 1;

const PUBLIC_PAGES = [
	{ name: "home", path: "/" },
	{ name: "pricing", path: "/pricing" },
	{ name: "models", path: "/models" },
	{ name: "docs", path: "/docs" },
	{ name: "chat", path: "/chat" },
	{ name: "login", path: "/login" },
	{ name: "network", path: "/network" },
	{ name: "changelog", path: "/changelog" },
];

	test.describe("WCAG 2.1 AA audit (axe-core)", () => {
		test.skip(SKIP, "Set OMA_SKIP_WCAG=0 to enable");

		for (const { name, path } of PUBLIC_PAGES) {
			test(`dark theme: ${name} (${path})`, async ({ page }) => {
				await page.goto(path, { waitUntil: "load" });
				// Allow client-side hydration (framer-motion entrance, wagmi, etc.)
				// without depending on a specific element being "visible".
				await page.waitForTimeout(2500);
				await runAxe(page, `dark:${name}`);
			});

			test(`light theme: ${name} (${path})`, async ({ page }) => {
				await page.goto(path, { waitUntil: "load" });
				await page.evaluate(() => {
					document.documentElement.setAttribute("data-theme", "light");
					localStorage.setItem("oma-theme", "light");
				});
				await page.reload({ waitUntil: "load" });
				await page.waitForTimeout(2500);
				await runAxe(page, `light:${name}`);
			});
		}
	});

async function runAxe(page: Page, label: string) {
	const results = await new AxeBuilder({ page })
		.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
		.analyze();

	const violations = (results.violations as AxeResult[]).filter((v) => {
		const rank = SEVERITY_RANK[v.impact ?? "minor"] ?? 1;
		return rank >= THRESHOLD_RANK;
	});

	if (violations.length > 0) {
		const summary = violations
			.map(
				(v) =>
					`  - [${v.impact}] ${v.id} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})\n` +
					`      ${v.help}\n` +
					`      ${v.helpUrl}\n` +
					v.nodes
						.slice(0, 2)
						.map((n: NodeResult) => `      > ${n.target.join(" ")}`)
						.join("\n"),
			)
			.join("\n\n");
		throw new Error(
			`[${label}] ${violations.length} WCAG violation(s) at ${SEVERITY_THRESHOLD}+ severity:\n\n${summary}`,
		);
	}

	expect(violations).toHaveLength(0);
}
