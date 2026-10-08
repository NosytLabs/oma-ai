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

async function expectAboveConsent(page: Page, control: Locator, label: string) {
	const consent = page.getByRole("region", { name: "Analytics consent", exact: true });
	await expect(control, `${label} must be visible`).toBeVisible();
	await expect.poll(async () => {
		const [controlBox, consentBox] = await Promise.all([control.boundingBox(), consent.boundingBox()]);
		if (!controlBox || !consentBox) return false;
		return controlBox.y >= 0 && controlBox.y + controlBox.height <= consentBox.y + 1;
	}, { message: `${label} must remain fully above the consent banner` }).toBe(true);
}

for (const viewport of VIEWPORTS) {
	test.describe(`chat viewport: ${viewport.name} ${viewport.width}×${viewport.height}`, () => {
		test.use({ viewport: { width: viewport.width, height: viewport.height }, analyticsConsent: "prompt" });

		test("keeps the composer above consent before and after a real send", async ({ page, chatApi }, testInfo) => {
			await openChat(page);
			const consent = page.getByRole("region", { name: "Analytics consent", exact: true });
			await expect(consent).toBeVisible();
			const input = page.getByRole("textbox", { name: "Enter your message", exact: true });
			const send = page.getByRole("button", { name: "Send message", exact: true });
			const price = page.getByText("Free chat", { exact: true });
			await expectAboveConsent(page, input, "message input");
			await expectAboveConsent(page, send, "send button");
			await expectAboveConsent(page, price, "cost footer");
			await expectAboveConsent(page, page.getByText("20 free left", { exact: true }), "quota footer");
			await expectNoDocumentOverflow(page);

			chatApi.replyNext("The composer stays usable with consent still open.\n\n```text\n" + "a-long-value-".repeat(40) + "\n```");
			await input.fill("Check the layout while the consent banner is open.");
			await expectAboveConsent(page, send, "enabled send button");
			await send.click();
			await expect(page.getByText("The composer stays usable with consent still open.", { exact: true })).toBeVisible();
			await expect(consent).toBeVisible();
			await expectAboveConsent(page, input, "message input after send");
			await expectAboveConsent(page, send, "send button after send");
			await expectAboveConsent(page, price, "cost footer after send");
			await expectAboveConsent(page, page.getByText("19 free left", { exact: true }), "quota footer after send");
			await expectNoDocumentOverflow(page);
			if (viewport.name === "phone" || viewport.name === "desktop") {
				const screenshot = testInfo.outputPath(`chat-${viewport.name}-consent.png`);
				await page.screenshot({ path: screenshot, animations: "disabled" });
				await testInfo.attach("Chat with consent visible", { path: screenshot, contentType: "image/png" });
			}

			// Dismissing consent should return the reserved space to the chat.
			await consent.getByRole("button", { name: "Decline", exact: true }).click();
			await expect(consent).toBeHidden();
			await expect(input).toBeInViewport();
			await expect(send).toBeInViewport();
			await expect(price).toBeInViewport();
			await expectNoDocumentOverflow(page);
			if (viewport.name === "phone" || viewport.name === "desktop") {
				const screenshot = testInfo.outputPath(`chat-${viewport.name}.png`);
				await page.screenshot({ path: screenshot, animations: "disabled" });
				await testInfo.attach("Chat after declining analytics", { path: screenshot, contentType: "image/png" });
			}
		});
	});
}
