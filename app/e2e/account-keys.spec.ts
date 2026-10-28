import { test, expect } from "./deposit-fixtures";

test("switching accounts removes the previous account's one-time API key secret", async ({ page, depositApi }) => {
	const secret = "oma_sk_synthetic_account_a_browser_only";
	const requests: Array<{ name: string }> = [];
	await page.route("**/api/v1/keys", async route => {
		if (route.request().method() === "GET") {
			await route.fulfill({ json: { keys: [] } }); return;
		}
		expect(route.request().method()).toBe("POST");
		requests.push(route.request().postDataJSON());
		await route.fulfill({ json: { id: "synthetic-account-a-key", name: "Synthetic workload A", prefix: "oma_sk_synthetic", key: secret, createdAt: "2026-01-01T00:00:00Z", lastUsedAt: null, expiresAt: "2099-01-01T00:00:00Z", allowedModels: null, ipAllowlist: null } });
	});
	await page.goto("/dashboard?tab=api-keys");
	await page.getByRole("button", { name: "Create your first key" }).click();
	await page.getByRole("textbox", { name: "API key name" }).fill("Synthetic workload A");
	await page.getByRole("button", { name: "Create key", exact: true }).click();
	const modal = page.getByRole("dialog", { name: "API key created" });
	await expect(modal).toBeVisible();
	await modal.getByRole("button", { name: "Reveal API key" }).click();
	await expect(modal.getByText(secret, { exact: true })).toBeVisible();
	await depositApi.switchAccount("synthetic-account-b");
	await expect(modal).toBeHidden();
	await expect(page.getByText(secret, { exact: true })).toHaveCount(0);
	await expect(page.getByRole("button", { name: "Create your first key" })).toBeEnabled();
	expect(requests).toEqual([expect.objectContaining({ name: "Synthetic workload A" })]);
});
