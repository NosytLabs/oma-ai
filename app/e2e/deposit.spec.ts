import { test, expect, installDepositWallet } from "./deposit-fixtures";

/**
 * Deposit page userflow.
 *
 * Uses isolated signed-in fixtures and a synthetic wallet. All APIs are
 * intercepted, external traffic is blocked, and no transfer can broadcast.
 */
test.describe("Deposit Page Userflow", () => {
  test("loads deposit page without server error", async ({ page }) => {
    const response = await page.goto("/deposit");
    if (response) {
      expect(response.status()).toBeLessThan(500);
    }
  });

  test("deposit page has no horizontal overflow", async ({ page }) => {
    await page.goto("/deposit");
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("shows the deposit page heading", async ({ page }) => {
    await page.goto("/deposit");
    // Scope to page content; the mobile-only navbar sign-in label is hidden
    // on desktop and is not evidence that the deposit page rendered.
    await expect(page.getByRole("heading", { name: "Add credits", level: 1 })).toBeVisible();
  });
});

test("payment methods support arrow, Home and End keyboard navigation", async ({ page }) => {
  await page.goto("/deposit");
  const usdc = page.getByRole("tab", { name: /USDC/ });
  const card = page.getByRole("tab", { name: /Card/ });
  const x402 = page.getByRole("tab", { name: /x402/ });
  await usdc.focus();
  await usdc.press("ArrowRight");
  await expect(card).toBeFocused();
  await expect(card).toHaveAttribute("aria-selected", "true");
  await expect(usdc).toHaveAttribute("tabindex", "-1");
  await card.press("End");
  await expect(x402).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", await x402.getAttribute("id") ?? "");
  await x402.press("ArrowRight");
  await expect(usdc).toBeFocused();
  await usdc.press("ArrowLeft");
  await expect(x402).toBeFocused();
  await x402.press("Home");
  await expect(usdc).toBeFocused();
});

test("changing accounts cancels a stale card checkout redirect", async ({ page, depositApi, baseURL }) => {
  const checkout = depositApi.holdCheckout();
  await page.goto("/deposit?method=card");
  // Credit-pack radios render for guests too. Wait for the synthetic session
  // before selecting a pack; account resolution intentionally resets its form.
  await expect(page.getByRole("button", { name: /Pay \$50 with card/ })).toBeEnabled();
  await page.getByRole("group", { name: "Choose a credit pack" }).getByText("Hobby", { exact: true }).click();
  await expect(page.getByRole("radio", { name: /Hobby/ })).toBeChecked();
  await page.getByRole("button", { name: /Pay \$10 with card/ }).click();
  await test.step("checkout request reaches the local hold", async () => { await checkout.started; });
  await test.step("refresh the session as account B", async () => { await depositApi.switchAccount("deposit-account-b"); });
  await test.step("account B has a fresh checkout form", async () => { await expect(page.getByRole("button", { name: /Pay \$50 with card/ })).toBeEnabled(); });
  await test.step("release account A's checkout response", async () => { await checkout.release(); });
  await expect(page).toHaveURL(`${baseURL}/deposit?method=card`);
  expect(depositApi.externalNavigations).toEqual([]);
});

test("changing payment methods cancels a stale card checkout redirect", async ({ page, depositApi, baseURL }) => {
  const checkout = depositApi.holdCheckout();
  await page.goto("/deposit?method=card");
  await page.getByRole("button", { name: /Pay .* with card/ }).click();
  await checkout.started;
  await page.getByRole("tab", { name: /x402/ }).click();
  await expect(page.getByRole("heading", { name: "x402 — agent USDC settlement" })).toBeVisible();
  await checkout.release();
  await expect(page).toHaveURL(`${baseURL}/deposit?method=card`);
  expect(depositApi.externalNavigations).toEqual([]);
});

test("changing accounts during a USDC challenge does not open a transfer prompt", async ({ page, depositApi }) => {
  await installDepositWallet(page);
  const challenge = depositApi.holdChallenge();
  await page.goto("/deposit?method=usdc");
  await page.getByLabel("Amount (USD)").fill("10");
  await page.getByRole("button", { name: "Send 10 USDC" }).click();
  await challenge.started;
  await depositApi.switchAccount("deposit-account-b");
  await expect(page.getByLabel("Amount (USD)")).toHaveValue("");
  await challenge.release();
  const calls = await page.evaluate(() => (window as unknown as { depositWalletCalls: string[] }).depositWalletCalls);
  expect(calls).not.toContain("eth_sendTransaction");
  expect(calls).not.toContain("personal_sign");
  await expect(page.getByRole("button", { name: "Send 0 USDC" })).toBeDisabled();
});
