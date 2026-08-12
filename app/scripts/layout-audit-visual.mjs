import { chromium } from "../../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";
import { writeFileSync, mkdirSync } from "fs";

const BASE = "http://localhost:3000";
const OUT = "/tmp/oma-layout-shots";
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true });

async function probe(vp, path, name, actions) {
  const context = await browser.newContext({
    viewport: vp,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(BASE + path, { waitUntil: "networkidle", timeout: 30000 }).catch(() =>
    page.goto(BASE + path, { waitUntil: "domcontentloaded" })
  );
  await page.waitForTimeout(800);
  if (actions) await actions(page);
  const shot = `${OUT}/${name}.png`;
  await page.screenshot({ path: shot, fullPage: false });

  const data = await page.evaluate(() => {
    const issues = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Find elements that extend past viewport (even if ancestor clips)
    const clipped = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) continue;
      if (r.top > vh || r.bottom < 0) continue;
      if (r.right > vw + 1 || r.left < -1) {
        const st = getComputedStyle(el);
        clipped.push({
          tag: el.tagName.toLowerCase(),
          cls: (el.className || "").toString().slice(0, 80),
          left: Math.round(r.left),
          right: Math.round(r.right),
          top: Math.round(r.top),
          w: Math.round(r.width),
          overflow: st.overflow + "/" + st.overflowX,
          text: (el.textContent || "").trim().replace(/\s+/g," ").slice(0, 50),
        });
        if (clipped.length > 20) break;
      }
    }

    // Overlapping interactive elements (non-nested)
    const interactives = [...document.querySelectorAll("a, button, input, textarea, [role=button]")]
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { el, r, label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g," ").slice(0, 40) };
      })
      .filter((x) => x.r.width > 8 && x.r.height > 8 && x.r.bottom > 0 && x.r.top < vh);

    const overlaps = [];
    for (let i = 0; i < interactives.length; i++) {
      for (let j = i + 1; j < interactives.length; j++) {
        const a = interactives[i], b = interactives[j];
        if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
        const ar = a.r, br = b.r;
        const ix = Math.min(ar.right, br.right) - Math.max(ar.left, br.left);
        const iy = Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top);
        if (ix > 4 && iy > 4) {
          // same row nav items can be adjacent - only care about substantial overlap
          if (ix * iy > 40) overlaps.push([a.label, b.label, Math.round(ix*iy)]);
        }
      }
    }

    // Spacing consistency: measure left padding of main containers
    const containers = [...document.querySelectorAll(".container-page, main > div, main > section")]
      .slice(0, 8)
      .map((el) => {
        const r = el.getBoundingClientRect();
        const st = getComputedStyle(el);
        return {
          cls: (el.className || "").toString().slice(0, 60),
          left: Math.round(r.left),
          padL: st.paddingLeft,
          padT: st.paddingTop,
          maxW: st.maxWidth,
          w: Math.round(r.width),
        };
      });

    // Header measurements
    const header = document.querySelector("header");
    const hb = header?.getBoundingClientRect();
    const headerItems = [...(header?.querySelectorAll("a, button") || [])].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g," ").slice(0, 28),
        x: Math.round(r.left),
        w: Math.round(r.width),
        h: Math.round(r.height),
      };
    }).filter((x) => x.w > 0);

    // Text that overflows its box
    const textClip = [];
    for (const el of document.querySelectorAll("h1, h2, p, a, button, span, td, th")) {
      if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 20) {
        const st = getComputedStyle(el);
        if (st.overflow === "hidden" || st.textOverflow === "ellipsis" || st.whiteSpace === "nowrap") {
          textClip.push({
            tag: el.tagName,
            text: (el.textContent || "").trim().slice(0, 40),
            sw: el.scrollWidth,
            cw: el.clientWidth,
          });
        }
        if (textClip.length > 10) break;
      }
    }

    // footers
    const footers = [...document.querySelectorAll("footer")].map((f) => {
      const r = f.getBoundingClientRect();
      return { top: Math.round(r.top), h: Math.round(r.height), cls: (f.className||"").toString().slice(0,50) };
    });

    // body font
    const body = getComputedStyle(document.body);

    return {
      clipped: clipped.slice(0, 12),
      overlaps: overlaps.slice(0, 12),
      containers,
      headerH: hb ? Math.round(hb.height) : null,
      headerItems,
      textClip,
      footers,
      bodyFont: `${body.fontSize}/${body.lineHeight} ${body.fontFamily.split(",")[0]}`,
      scrollW: document.documentElement.scrollWidth,
      clientW: document.documentElement.clientWidth,
    };
  });

  console.log(`\n=== ${name} ${vp.width}x${vp.height} ${path} ===`);
  console.log("bodyFont:", data.bodyFont, "headerH:", data.headerH, "overflow:", data.scrollW - data.clientW);
  console.log("footers:", JSON.stringify(data.footers));
  if (data.clipped.length) console.log("clipped:", JSON.stringify(data.clipped.slice(0,5), null, 0));
  if (data.overlaps.length) console.log("overlaps:", JSON.stringify(data.overlaps.slice(0,8)));
  if (data.textClip.length) console.log("textClip:", JSON.stringify(data.textClip.slice(0,5)));
  console.log("containers:", JSON.stringify(data.containers.slice(0,4)));
  console.log("headerItems:", JSON.stringify(data.headerItems));
  console.log("shot:", shot);

  await context.close();
  return data;
}

// desktop key pages
await probe({ width: 1440, height: 900 }, "/", "d-home");
await probe({ width: 1440, height: 900 }, "/models", "d-models");
await probe({ width: 1440, height: 900 }, "/pricing", "d-pricing");
await probe({ width: 1440, height: 900 }, "/docs", "d-docs");
await probe({ width: 1440, height: 900 }, "/chat", "d-chat");
await probe({ width: 1440, height: 900 }, "/chat?mode=create", "d-create");
await probe({ width: 1440, height: 900 }, "/compare", "d-compare");
await probe({ width: 1440, height: 900 }, "/dashboard", "d-dashboard");
await probe({ width: 1440, height: 900 }, "/login", "d-login");
await probe({ width: 1440, height: 900 }, "/faq", "d-faq");

// tablet
await probe({ width: 768, height: 1024 }, "/", "t-home");
await probe({ width: 768, height: 1024 }, "/chat", "t-chat");
await probe({ width: 768, height: 1024 }, "/models", "t-models");
await probe({ width: 768, height: 1024 }, "/compare", "t-compare");

// mobile
await probe({ width: 390, height: 844 }, "/", "m-home");
await probe({ width: 390, height: 844 }, "/chat", "m-chat");
await probe({ width: 390, height: 844 }, "/chat?mode=create", "m-create");
await probe({ width: 390, height: 844 }, "/models", "m-models");
await probe({ width: 390, height: 844 }, "/pricing", "m-pricing");
await probe({ width: 390, height: 844 }, "/docs", "m-docs");
await probe({ width: 390, height: 844 }, "/compare", "m-compare");
await probe({ width: 390, height: 844 }, "/dashboard", "m-dashboard");
await probe({ width: 390, height: 844 }, "/login", "m-login");

// mobile menu open
await probe({ width: 390, height: 844 }, "/", "m-menu", async (page) => {
  await page.locator('header button[aria-controls="mobile-menu"]').click();
  await page.waitForTimeout(400);
});

// tools dropdown desktop
await probe({ width: 1440, height: 900 }, "/", "d-tools", async (page) => {
  const tools = page.getByRole("button", { name: /tools/i });
  if (await tools.count()) {
    await tools.click();
    await page.waitForTimeout(300);
  }
});

await browser.close();
console.log("\nDone. Shots in", OUT);
