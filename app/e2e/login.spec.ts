import { test, expect, installWallet, address, nonce, signature } from "./auth-fixtures";

const safeNext = "/about?from=wallet#credits";
const errorCallback = (origin: string, next: string) => `${origin}/login?${new URLSearchParams({ method: "magic", next })}`;
const loginUrl = (next: string) => `/login?${new URLSearchParams({ next }).toString()}`;

test("invalid email is rejected without a delivery request", async ({ page, authApi }) => {
	await page.goto("/login");
	await page.getByLabel("Email address").fill("invalid-email");
	await page.getByRole("button", { name: "Send magic link" }).click();
	await expect(page.locator("#email-error")).toHaveText(/valid email/i);
	expect(authApi.magicRequests).toHaveLength(0);
});

test("magic link delivery can be retried and preserves a safe callback", async ({ page, authApi, baseURL }) => {
	authApi.magicStatus = 503;
	await page.goto(loginUrl(safeNext));
	await page.getByLabel("Email address").fill("person@example.test");
	await page.getByRole("button", { name: "Send magic link" }).click();
	await expect(page.locator("#email-error")).toContainText("Email temporarily unavailable");
	expect(authApi.magicRequests).toHaveLength(1);
	authApi.magicStatus = 200;
	await page.getByRole("button", { name: "Send magic link" }).click();
	await expect(page.locator("form [role=status]")).toContainText(/check your inbox/i);
	expect(authApi.magicRequests).toHaveLength(2);
	expect(authApi.magicRequests[1]).toMatchObject({ email: "person@example.test", callbackURL: `${baseURL}${safeNext}`, errorCallbackURL: errorCallback(baseURL!, safeNext) });
});

test("external next URLs are not accepted for magic-link callbacks", async ({ page, authApi, baseURL }) => {
	await page.goto(loginUrl("//evil.example/phishing"));
	await page.getByLabel("Email address").fill("person@example.test");
	await page.getByRole("button", { name: "Send magic link" }).click();
	await expect(page.locator("form [role=status]")).toContainText(/check your inbox/i);
	expect(authApi.magicRequests[0].callbackURL).toBe(`${baseURL}/dashboard`);
	expect(authApi.magicRequests[0].errorCallbackURL).toBe(errorCallback(baseURL!, "/dashboard"));
});

test("an invalid verification return stays on sign-in and supports a fresh link and resend", async ({ page, authApi, baseURL }) => {
	await page.goto(loginUrl(safeNext));
	await page.getByLabel("Email address").fill("person@example.test");
	await page.getByRole("button", { name: "Send magic link" }).click();
	await expect(page.locator("form [role=status]")).toContainText(/check your inbox/i);
	const sent = authApi.magicRequests[0];
	expect(sent.errorCallbackURL).toBe(errorCallback(baseURL!, safeNext));

	// Model Better Auth's redirect for invalid, expired or consumed tokens.
	// This fixture never follows a real email link or contacts a mail provider.
	await page.route("**/api/auth/magic-link/verify?**", async route => {
		const verify = new URL(route.request().url());
		const target = new URL(verify.searchParams.get("errorCallbackURL")!);
		target.searchParams.set("error", "INVALID_TOKEN");
		target.searchParams.set("error_description", "untrusted-error-description");
		await route.fulfill({ status: 302, headers: { location: target.toString() }, body: "" });
	});
	// A failed account change must not fall through to a previous session.
	await page.route("**/api/auth/get-session*", route => route.fulfill({ json: {
		user: { id: "previous-account", email: "previous@example.test", name: "Previous account", emailVerified: true },
		session: { id: "previous-session", userId: "previous-account", expiresAt: "2099-01-01T00:00:00.000Z", token: "fixture-only" },
	} }));
	const verify = new URL("/api/auth/magic-link/verify", baseURL);
	verify.searchParams.set("token", "invalid-fixture-token");
	verify.searchParams.set("callbackURL", sent.callbackURL);
	verify.searchParams.set("errorCallbackURL", sent.errorCallbackURL);
	await page.goto(verify.toString());
	await expect(page.locator("#email-error")).toContainText(/no longer valid/i);
	await expect(page.locator("#email-error")).toContainText(/expired.*already been used/i);
	await expect(page.getByText("untrusted-error-description", { exact: true })).toHaveCount(0);
	await expect(page).toHaveURL(/\/login\?.*error=INVALID_TOKEN/);
	await expect(page.getByRole("tab", { name: "Magic link" })).toHaveAttribute("aria-selected", "true");

	await page.getByLabel("Email address").fill("person@example.test");
	await page.getByRole("button", { name: "Send magic link" }).click();
	await expect(page.locator("form [role=status]")).toContainText(/check your inbox/i);
	await expect(page.locator("#email-error")).toHaveCount(0);
	await page.getByRole("button", { name: "Resend", exact: true }).click();
	await expect.poll(() => authApi.magicRequests.length).toBe(3);
	for (const request of authApi.magicRequests) expect(request).toMatchObject({ callbackURL: `${baseURL}${safeNext}`, errorCallbackURL: errorCallback(baseURL!, safeNext) });
	await expect(page).toHaveURL(/\/login\?/);
});

test("tabs support keyboard navigation and no-wallet fallback", async ({ page }) => {
	await page.goto("/login");
	const magic = page.getByRole("tab", { name: "Magic link" });
	const wallet = page.getByRole("tab", { name: "Wallet" });
	await magic.focus();
	await magic.press("ArrowRight");
	await expect(wallet).toBeFocused();
	await expect(wallet).toHaveAttribute("aria-selected", "true");
	await expect(magic).toHaveAttribute("tabindex", "-1");
	await wallet.press("Home");
	await expect(magic).toBeFocused();
	await magic.press("End");
	await expect(wallet).toBeFocused();
	await expect(page.getByText("No wallet extension detected")).toBeVisible();
	await page.getByRole("button", { name: "Use magic link instead" }).click();
	await expect(magic).toBeFocused();
	await expect(magic).toHaveAttribute("aria-selected", "true");
	await expect(page.getByLabel("Email address")).toBeVisible();
});

test("wallet rejection is retryable and successful SIWE signs the local origin", async ({ page, authApi, baseURL }) => {
	await installWallet(page, true);
	await page.goto(loginUrl(safeNext));
	await page.getByRole("tab", { name: "Wallet" }).click();
	const connect = page.getByRole("button", { name: "Connect MetaMask" });
	await connect.click();
	await expect(page.locator("#email-error")).toContainText(/canceled/i);
	await expect(connect).toBeEnabled();
	await connect.click();
	await expect(page).toHaveURL(`${baseURL}${safeNext}`, { timeout: 10000 });
	expect(authApi.verifyRequests).toHaveLength(1);
	const { message, signature: signed } = authApi.verifyRequests[0];
	const url = new URL(baseURL!);
	expect(message.split("\n")[0]).toBe(`${url.origin} wants you to sign in with your Ethereum account:`);
	expect(message).toContain(address);
	expect(message).toContain(`URI: ${url.origin}`);
	expect(message).toContain("Chain ID: 8453");
	expect(message).toContain(`Nonce: ${nonce}`);
	expect(signed).toBe(signature);
});

for (const failure of ["nonce", "verify"] as const) {
	test(`wallet ${failure} failure leaves the form retryable`, async ({ page, authApi }) => {
		await installWallet(page);
		if (failure === "nonce") authApi.nonceStatus = 503;
		else authApi.verifyStatus = 401;
		await page.goto("/login");
		await page.getByRole("tab", { name: "Wallet" }).click();
		const connect = page.getByRole("button", { name: "Connect MetaMask" });
		await connect.click();
		await expect(page.locator("#email-error")).toContainText(failure === "nonce" ? "Nonce unavailable" : "Signature rejected");
		await expect(connect).toBeEnabled();
		await expect(page).toHaveURL(/\/login/);
		if (failure === "nonce") expect(authApi.verifyRequests).toHaveLength(0);
		else expect(authApi.verifyRequests).toHaveLength(1);
	});
}

for (const sessionMode of ["hold", "wrong"] as const) {
	test(`wallet sign-in does not redirect when session is ${sessionMode}`, async ({ page, authApi }) => {
		await installWallet(page);
		authApi.sessionMode = sessionMode;
		await page.goto(loginUrl(safeNext));
		await page.getByRole("tab", { name: "Wallet" }).click();
		const connect = page.getByRole("button", { name: "Connect MetaMask" });
		await connect.click();
		if (sessionMode === "wrong") {
			await expect.poll(() => authApi.verifyRequests.length).toBe(1);
			await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
			await expect.poll(() => authApi.sessionRefreshCount).toBeGreaterThan(0);
		}
		await expect(page.locator("#email-error")).toContainText(/session did not persist/i, { timeout: 8000 });
		await expect(connect).toBeEnabled();
		await expect(page).toHaveURL(/\/login/);
		expect(authApi.verifyRequests).toHaveLength(1);
	});
}

for (const width of [320, 390]) {
	test(`sign-in methods do not overflow at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 800 });
		await page.goto("/login");
		await expect(page.getByLabel("Email address")).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
		await page.getByRole("tab", { name: "Wallet" }).click();
		await expect(page.getByText("No wallet extension detected")).toBeVisible();
		expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
	});
}
