import { test, expect, type Page } from "@playwright/test";

const VIEWPORTS = [
  { name: "mobile", width: 390, height: 844 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "desktop", width: 1440, height: 900 },
] as const;

async function assertNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow, "page must not overflow horizontally").toBeLessThanOrEqual(0);
}

const PAGES = [
  "/",
  "/models",
  "/chat",
  "/pricing",
  "/docs",
  "/login",
  "/faq",
  "/glossary",
  "/getting-started",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
] as const;

// NOTE: test.use() MUST be scoped to a per-viewport describe block. Calling it
// directly inside the parent describe's loop merged all three viewports and
// the last call (desktop) won for EVERY test — mobile/tablet tests silently
// ran at 1440px and never validated the breakpoints below lg.
for (const vp of VIEWPORTS) {
  test.describe(`${vp.name}`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const path of PAGES) {
      test(`${vp.name} · ${path} has no horizontal overflow`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });
        await page.waitForTimeout(800);
        await assertNoHorizontalOverflow(page);
      });
    }

    test(`${vp.name} · navbar hamburger opens & closes mobile menu`, async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const toggle = page.locator('button[aria-controls="mobile-menu"]');
      if (!(await toggle.isVisible().catch(() => false))) return; // desktop: no hamburger
      await toggle.click();
      const menu = page.locator("#mobile-menu");
      await expect(menu).toBeVisible();
      await expect(menu.locator('a[href="/models"]')).toBeVisible();
      await expect(menu.locator('a[href="/pricing"]')).toBeVisible();
      // Close via Escape — the focus trap inside the drawer catches Escape
      // and invokes onClose, mirroring keyboard-only user behavior.
      await page.keyboard.press("Escape");
      await expect(menu).toBeHidden();
    });

    test(`${vp.name} · navbar links visible only at desktop sizes`, async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const desktopLink = page.locator("header ul li a[href='/models']").first();
      if (vp.width >= 1024) {
        await expect(page.locator("header a[href='/models']").first()).toBeVisible();
        await expect(page.locator("header a[href='/pricing']").first()).toBeVisible();
      } else {
        await expect(desktopLink).toBeHidden();
        await expect(page.locator('button[aria-controls="mobile-menu"]')).toBeVisible();
      }
    });

    test(`${vp.name} · theme toggle cycles through themes`, async ({ page }) => {
      await page.goto("/", { waitUntil: "networkidle" });
      const toggle = page.locator('button[data-theme-toggle]');
      await expect(toggle).toBeVisible();
      await toggle.click();
      const menu = page.locator("#theme-menu");
      await expect(menu).toBeVisible();
      await menu.locator('button[aria-label="Amber"]').click();
      await expect(page.locator('html')).toHaveAttribute("data-theme", "amber");
      await toggle.click();
      await menu.locator('button[aria-label="Emerald"]').click();
      const attr = await page.evaluate(() => document.documentElement.getAttribute("data-theme"));
      expect(attr).toBeNull();
    });
  });
}

test.describe("desktop-only navbar interactions", () => {
  test("tools dropdown opens with all tools", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    const toolsBtn = page.locator('button[aria-label="Tools menu"]');
    await expect(toolsBtn).toBeVisible();
    await toolsBtn.click();
    const menu = page.locator("#tools-menu");
    await expect(menu).toBeVisible();
    for (const href of ["/deposit", "/docs#endpoints", "/getting-started", "/faq"]) {
      await expect(menu.locator(`a[href="${href}"]`).first()).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("tools dropdown closes on outside click", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle" });
    await page.locator('button[aria-label="Tools menu"]').click();
    await expect(page.locator("#tools-menu")).toBeVisible();
    await page.mouse.click(10, 400);
    await expect(page.locator("#tools-menu")).toBeHidden();
  });

  test("models page renders brand logos for every card", async ({ page }) => {
    await page.goto("/models", { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    const broken = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("img.model-logo-svg")).filter(
        (img) => !(img as HTMLImageElement).complete || (img as HTMLImageElement).naturalWidth === 0,
      ).map((img) => (img as HTMLImageElement).src);
    });
    expect(broken).toEqual([]);
  });

  test("docs page renders code blocks without overflow", async ({ page }) => {
    await page.goto("/docs", { waitUntil: "networkidle" });
    const overflows = await page.evaluate(() => {
      return Array.from(document.querySelectorAll("pre")).filter((pre) => {
        const r = pre.getBoundingClientRect();
        return r.right > window.innerWidth + 2;
      }).length;
    });
    expect(overflows).toBe(0);
  });
});
