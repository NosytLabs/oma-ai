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
  const x402 = page.getByRole("tab", { name: /x402/ });
  await usdc.focus();
  await usdc.press("ArrowRight");
  await expect(x402).toBeFocused();
  await expect(x402).toHaveAttribute("aria-selected", "true");
  await expect(usdc).toHaveAttribute("tabindex", "-1");
  await x402.press("End");
  await expect(x402).toBeFocused();
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", await x402.getAttribute("id") ?? "");
  await x402.press("ArrowRight");
  await expect(usdc).toBeFocused();
  await usdc.press("ArrowLeft");
  await expect(x402).toBeFocused();
  await x402.press("Home");
  await expect(usdc).toBeFocused();
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
