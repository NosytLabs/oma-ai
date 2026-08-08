import { chromium } from "playwright";
import fs from "fs";

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to local UI...");
  const start = Date.now();
  await page.goto("http://localhost:3006/chat", { waitUntil: "networkidle" });
  console.log(`Loaded in ${Date.now() - start}ms`);

  const modelsBtn = page.locator("button", { hasText: /Select AI model/ }).first();
  if (await modelsBtn.isVisible()) {
      console.log("Model selector visible.");
  }

  // Type in the chat input
  const input = page.locator("textarea").first();
  await input.fill("Hello AI");
  const sendStart = Date.now();
  await page.keyboard.press("Enter");
  console.log(`Send event dispatched in ${Date.now() - sendStart}ms`);

  // Wait 2 seconds for a response to bubble (upstream will 401, but we can measure time to error)
  await page.waitForTimeout(2000);

  const html = await page.content();
  if (html.includes("error") || html.includes("Authentication failed")) {
      console.log("Auth error caught gracefully by UI.");
  }
  
  await browser.close();
}

main().catch(console.error);
