import { test, expect } from "./deposit-fixtures";

test("confirmed account deletion ends the session and returns home without a second sign-out mutation", async ({ page, context, baseURL, depositApi }) => {
	let deletions = 0;
	let signOuts = 0;
	await page.route("**/api/v1/keys", async route => {
		expect(route.request().method()).toBe("GET");
		await route.fulfill({ json: { keys: [] } });
	});
	await page.route("**/api/account", async route => {
		expect(route.request().method()).toBe("DELETE");
		expect((await route.request().allHeaders()).cookie ?? "").toContain("oma-demo-public=1");
		deletions++;
		// The real deletion response invalidates the server session and cookies.
		depositApi.userId = null;
		await route.fulfill({ json: { success: true } });
	});
	await page.route("**/api/auth/sign-out", async route => {
		signOuts++;
		await route.fulfill({ status: 503, json: { message: "A second mutation must not be necessary" } });
	});

	await page.goto("/dashboard?tab=settings&section=danger");
	await page.getByRole("button", { name: "Delete account", exact: true }).click();
	await page.getByRole("textbox", { name: "Confirm by typing DELETE" }).fill("DELETE");
	// A demo visited in another tab may leave this public flag behind.
	await context.addCookies([{ name: "oma-demo-public", value: "1", url: baseURL! }]);
	const homeRequest = page.waitForRequest(request => request.isNavigationRequest() && new URL(request.url()).pathname === "/");
	await page.getByRole("button", { name: "Delete my account", exact: true }).click();
	await expect(page).toHaveURL(`${baseURL}/`);
	expect((await (await homeRequest).allHeaders()).cookie ?? "").not.toContain("oma-demo-public=");
	await expect(page.getByRole("link", { name: "Sign in or create an account" })).toBeVisible();
	expect(deletions).toBe(1);
	expect(signOuts).toBe(0);
	expect(depositApi.userId).toBeNull();
	expect((await context.cookies()).find(cookie => cookie.name === "oma-demo-public")).toBeUndefined();
});
