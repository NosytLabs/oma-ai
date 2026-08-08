import { chromium } from "playwright";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("Navigating to local chat UI (Free Tier)...");
  const start = Date.now();
  await page.goto("http://localhost:3006/chat", { waitUntil: "networkidle" });
  console.log(`Loaded in ${Date.now() - start}ms`);

  // Assert default model is Gemini 3 Flash Preview
  const modelToggle = page.locator("button", { hasText: /Gemini 3 Flash/i }).first();
  if (await modelToggle.isVisible()) {
    console.log("Verified free default model is Gemini 3 Flash.");
  }
  
  // Click the model selector dropdown
  console.log("Opening model selector...");
  await modelToggle.click();
  
  // Wait for the dropdown and click Kimi K3
  await page.waitForSelector("div[role='menu']", { timeout: 5000 });
  const kimiOption = page.locator("div[role='menuitem']", { hasText: /Kimi K3/i }).first();
  await kimiOption.click();
  
  console.log("Switched to Kimi K3.");

  // Type in the chat input
  const input = page.locator("textarea").first();
  await input.fill("Respond with the exact word 'PONG'. Nothing else.");
  
  const sendStart = Date.now();
  await page.keyboard.press("Enter");
  console.log(`Message sent at +${Date.now() - sendStart}ms`);

  // Wait for the stream to start responding and finish.
  // Wait up to 10s for an assistant bubble containing PONG.
  try {
      await page.waitForSelector("div:has-text('PONG')", { timeout: 10000 });
      console.log(`[SUCCESS] AI replied with PONG! Latency: ${Date.now() - sendStart}ms`);
  } catch (err) {
      console.log("[ERROR] Timeout waiting for PONG. Stream failed or hit Upstream 401.");
  }
  
  await browser.close();
}

main().catch(console.error);
