import type { Locator, Page } from "@playwright/test";
import { test, expect, openChat } from "./chat-fixtures";

const VIEWPORTS = [
	{ name: "phone", width: 390, height: 844 },
	{ name: "tablet", width: 768, height: 1024 },
	{ name: "laptop", width: 1280, height: 720 },
	{ name: "desktop", width: 1440, height: 900 },
	{ name: "wide", width: 1920, height: 1080 },
];

async function expectNoDocumentOverflow(page: Page) {
	await expect.poll(() => page.evaluate(() => Math.max(
		Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - window.innerWidth,
		Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) - window.innerHeight,
		window.scrollY,
	)), { message: "The chat must fit the document; only the message list should scroll" }).toBeLessThanOrEqual(1);
}

/**
 * The composer must sit fully inside the viewport.
 *
 * REWRITE (2026-10-27): this spec previously asserted the composer stayed
 * ABOVE a consent banner, using `role="region"` / "Analytics consent". That
 * banner was removed on 2026-10-12 (unconditional GA4 measurement) and
 * briefly re-introduced on 2026-10-19 with different semantics
 * (`role="dialog"` / "Cookie consent") - so the assertion had been matching
 * nothing for a week and the spec could not have been green as written.
 *
 * The layout invariant that actually matters is unchanged and is what this
 * now asserts: the composer controls are fully visible and inside the
 * viewport, the document never overflows, and no consent banner is mounted
 * (the GA4 tag must not reintroduce a bottom overlay).
 */
async function expectInsideViewport(page: Page, control: Locator, label: string) {
	await expect(control, `${label} must be visible`).toBeVisible();
	await expect(control, `${label} must be inside the viewport`).toBeInViewport();
}

for (const viewport of VIEWPORTS) {
	test.describe(`chat viewport: ${viewport.name} ${viewport.width}×${viewport.height}`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height } });

		test("keeps the composer reachable and free of a consent overlay", async ({ page, chatApi }, testInfo) => {
			await openChat(page);
			const input = page.getByRole("textbox", { name: "Enter your message", exact: true });
			const send = page.getByRole("button", { name: "Send message", exact: true });
			const price = page.getByText("Free chat", { exact: true });
			await expectInsideViewport(page, input, "message input");
			await expectInsideViewport(page, send, "send button");
			await expectInsideViewport(page, price, "cost footer");
			await expectInsideViewport(page, page.getByText("20 free left", { exact: true }), "quota footer");
			await expectNoDocumentOverflow(page);
			// No consent banner may be mounted: it would overlay the composer.
			await expect(page.getByRole("region", { name: "Analytics consent" })).toHaveCount(0);
			await expect(page.getByRole("dialog", { name: "Cookie consent" })).toHaveCount(0);

			chatApi.replyNext("The composer stays usable.\n\n```text\n" + "a-long-value-".repeat(40) + "\n```");
			await input.fill("Check the layout.");
			await expectInsideViewport(page, send, "enabled send button");
			await send.click();
			await expect(page.getByText("The composer stays usable.", { exact: true })).toBeVisible();
			await expectInsideViewport(page, input, "message input after send");
			await expectInsideViewport(page, send, "send button after send");
			await expectInsideViewport(page, price, "cost footer after send");
			await expectInsideViewport(page, page.getByText("19 free left", { exact: true }), "quota footer after send");
			await expectNoDocumentOverflow(page);
			if (viewport.name === "phone" || viewport.name === "desktop") {
				const screenshot = testInfo.outputPath(`chat-${viewport.name}.png`);
				await page.screenshot({ path: screenshot, animations: "disabled" });
				await testInfo.attach("Chat layout", { path: screenshot, contentType: "image/png" });
			}
		});
	});
}
