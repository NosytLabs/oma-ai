import { chromium } from "../../node_modules/.pnpm/playwright@1.62.1/node_modules/playwright/index.mjs";
import { writeFileSync } from "fs";

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PAGES = [
  "/",
  "/models",
  "/pricing",
  "/docs",
  "/chat",
  "/chat?mode=create",
  "/compare",
  "/capabilities",
  "/faq",
  "/getting-started",
  "/glossary",
  "/about",
  "/contact",
  "/changelog",
  "/login",
  "/dashboard",
  "/deposit",
  "/settings",
  "/privacy",
  "/terms",
];

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

async function auditPage(page, path, vp) {
  const issues = [];
  const url = BASE + path;
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
    if (!res || res.status() >= 400) {
      issues.push({ type: "http", detail: `status ${res?.status()}` });
      return { issues, metrics: null };
    }
    await page.waitForTimeout(900);

    const metrics = await page.evaluate(() => {
      const doc = document.documentElement;
      const body = document.body;
      const scrollW = Math.max(doc.scrollWidth, body.scrollWidth);
      const clientW = doc.clientWidth;
      const hOverflow = scrollW - clientW;

      const header = document.querySelector("header");
      const main = document.querySelector("main");
      const footer = document.querySelector("footer");

      const hb = header?.getBoundingClientRect();
      const mb = main?.getBoundingClientRect();
      const fb = footer?.getBoundingClientRect();

      const fixed = [];
      for (const el of document.querySelectorAll("body *")) {
        const st = getComputedStyle(el);
        if (st.position === "fixed" || (st.position === "sticky" && el === header)) {
          const r = el.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          fixed.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 70),
            pos: st.position,
            top: Math.round(r.top),
            left: Math.round(r.left),
            w: Math.round(r.width),
            h: Math.round(r.height),
            z: st.zIndex,
          });
        }
      }

      const overflowing = [];
      const vw = window.innerWidth;
      for (const el of document.querySelectorAll("main *, footer *, header *")) {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (r.right > vw + 3 || r.left < -3) {
          if (r.bottom < -20 || r.top > window.innerHeight + 20) continue;
          overflowing.push({
            tag: el.tagName.toLowerCase(),
            cls: (el.className || "").toString().slice(0, 70),
            left: Math.round(r.left),
            right: Math.round(r.right),
            w: Math.round(r.width),
            text: (el.textContent || "").trim().slice(0, 40),
          });
          if (overflowing.length > 15) break;
        }
      }

      const navLinks = [...document.querySelectorAll("header a, header button")].map((el) => {
        const r = el.getBoundingClientRect();
        return {
          label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 40),
          left: r.left,
          right: r.right,
          top: r.top,
          bottom: r.bottom,
          w: r.width,
          h: r.height,
        };
      }).filter((r) => r.w > 0 && r.h > 0);

      const navOverlaps = [];
      for (let i = 0; i < navLinks.length; i++) {
        for (let j = i + 1; j < navLinks.length; j++) {
          const a = navLinks[i], b = navLinks[j];
          const overlap =
            !(a.right <= b.left + 1 || a.left >= b.right - 1 || a.bottom <= b.top + 1 || a.top >= b.bottom + 1);
          if (!overlap || a.w <= 8 || b.w <= 8) continue;
          const aInB = a.left >= b.left - 1 && a.right <= b.right + 1 && a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
          const bInA = b.left >= a.left - 1 && b.right <= a.right + 1 && b.top >= a.top - 1 && b.bottom <= a.bottom + 1;
          if (aInB || bInA) continue;
          // small intersection area ignore
          const ix = Math.min(a.right, b.right) - Math.max(a.left, b.left);
          const iy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (ix * iy < 20) continue;
          navOverlaps.push([a.label, b.label, Math.round(ix * iy)]);
        }
      }

      const h1 = document.querySelector("h1");
      const h1Style = h1 ? getComputedStyle(h1) : null;

      const tinyTargets = [];
      for (const el of document.querySelectorAll("header a, header button")) {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && r.height > 0 && (r.width < 32 || r.height < 32)) {
          tinyTargets.push({
            label: (el.getAttribute("aria-label") || el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 30),
            w: Math.round(r.width),
            h: Math.round(r.height),
          });
        }
      }

      // first content text node under header when scrolled to top
      let contentCoveredByHeader = false;
      if (hb) {
        const probeY = hb.bottom + 2;
        const el = document.elementFromPoint(Math.min(120, vw / 2), probeY);
        if (el && header && header.contains(el)) {
          // still in header - ok
        }
      }

      // page shell padding top inconsistency
      const shell = document.querySelector(".page-shell, .container-page");
      const shellStyle = shell ? getComputedStyle(shell) : null;

      // main first child top padding
      const mainFirst = main?.firstElementChild;
      const mf = mainFirst?.getBoundingClientRect();

      return {
        hOverflow,
        scrollW,
        clientW,
        headerH: hb ? Math.round(hb.height) : null,
        headerBottom: hb ? Math.round(hb.bottom) : null,
        mainTop: mb ? Math.round(mb.top) : null,
        headerGap: hb && mb ? Math.round(mb.top - hb.bottom) : null,
        footerGap: fb && mb ? Math.round(fb.top - mb.bottom) : null,
        overflowing: overflowing.slice(0, 10),
        navOverlaps: navOverlaps.slice(0, 10),
        h1Font: h1Style ? `${h1Style.fontSize}/${h1Style.lineHeight}` : null,
        h1Text: h1?.textContent?.trim().replace(/\s+/g, " ").slice(0, 60) || null,
        tinyTargets: tinyTargets.slice(0, 8),
        fixed: fixed.slice(0, 8),
        shellPad: shellStyle ? shellStyle.paddingTop : null,
        mainFirstTop: mf ? Math.round(mf.top) : null,
        mainFirstCls: mainFirst?.className?.toString?.().slice(0, 60) || null,
      };
    });

    if (metrics.hOverflow > 2) {
      issues.push({
        type: "horizontal-overflow",
        detail: `${metrics.hOverflow}px`,
        samples: metrics.overflowing,
      });
    }
    if (metrics.headerBottom != null && metrics.mainTop != null && metrics.mainTop < metrics.headerBottom - 2) {
      issues.push({
        type: "main-under-header",
        detail: `main.top=${metrics.mainTop} header.bottom=${metrics.headerBottom}`,
      });
    }
    if (metrics.navOverlaps.length) {
      issues.push({ type: "nav-overlap", detail: metrics.navOverlaps });
    }
    if (metrics.tinyTargets.length) {
      issues.push({ type: "tiny-tap-targets", detail: metrics.tinyTargets });
    }
    if (metrics.footerGap != null && metrics.footerGap < -4) {
      issues.push({ type: "footer-main-overlap", detail: `gap=${metrics.footerGap}` });
    }

    // mobile menu open check
    if (vp.name === "mobile") {
      const menuBtn = page.locator("header button").filter({ has: page.locator("svg.lucide-menu, svg") }).first();
      // better: button with Menu icon near end of header
      const hamburger = page.locator('header button[aria-expanded], header button[aria-controls], header button:has(svg.lucide-menu)').first();
      const count = await hamburger.count();
      if (count) {
        await hamburger.click({ timeout: 3000 }).catch(() => {});
        await page.waitForTimeout(350);
        const menu = await page.evaluate(() => {
          // look for mobile menu panel
          const candidates = [...document.querySelectorAll("body *")].filter((el) => {
            const st = getComputedStyle(el);
            if (st.position !== "fixed" && st.position !== "absolute") return false;
            const r = el.getBoundingClientRect();
            return r.height > 150 && r.width > 200 && r.top >= 40 && r.top < 120;
          });
          const best = candidates.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
          if (!best) return null;
          const r = best.getBoundingClientRect();
          // check links spacing
          const links = [...best.querySelectorAll("a")].map((a) => {
            const br = a.getBoundingClientRect();
            return { t: a.textContent.trim().slice(0, 30), h: Math.round(br.height), y: Math.round(br.top) };
          }).filter((x) => x.h > 0);
          return {
            top: Math.round(r.top),
            h: Math.round(r.height),
            w: Math.round(r.width),
            linkCount: links.length,
            minLinkH: links.length ? Math.min(...links.map((l) => l.h)) : null,
            overflowY: best.scrollHeight > best.clientHeight + 8,
          };
        });
        if (menu && menu.minLinkH != null && menu.minLinkH < 36) {
          issues.push({ type: "mobile-menu-tiny-links", detail: menu });
        }
      }
    }

    return { metrics, issues };
  } catch (e) {
    return { issues: [{ type: "error", detail: String(e.message || e) }], metrics: null };
  }
}

const browser = await chromium.launch({ headless: true });
const report = [];

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);

  for (const path of PAGES) {
    const result = await auditPage(page, path, vp);
    const bad = result.issues?.length || 0;
    report.push({
      vp: vp.name,
      path,
      issues: result.issues,
      hOverflow: result.metrics?.hOverflow,
      headerH: result.metrics?.headerH,
      headerGap: result.metrics?.headerGap,
      mainTop: result.metrics?.mainTop,
      headerBottom: result.metrics?.headerBottom,
      h1Font: result.metrics?.h1Font,
      h1Text: result.metrics?.h1Text,
      overflowing: result.metrics?.overflowing,
      navOverlaps: result.metrics?.navOverlaps,
      tinyTargets: result.metrics?.tinyTargets,
      shellPad: result.metrics?.shellPad,
      mainFirstTop: result.metrics?.mainFirstTop,
      mainFirstCls: result.metrics?.mainFirstCls,
    });
    const mark = bad ? "FAIL" : "ok  ";
    console.log(`${mark} [${vp.name}] ${path} overflow=${result.metrics?.hOverflow ?? "?"} issues=${bad}`);
    if (bad) {
      for (const i of result.issues) console.log("   ", i.type, JSON.stringify(i.detail ?? i.samples).slice(0, 220));
    }
  }
  await context.close();
}

await browser.close();

const fails = report.filter((r) => r.issues?.length);
console.log("\n=== SUMMARY ===");
console.log(`pages audited: ${report.length}, with issues: ${fails.length}`);
const byType = {};
for (const r of fails) {
  for (const i of r.issues) {
    byType[i.type] = (byType[i.type] || 0) + 1;
  }
}
console.log("by type:", byType);

// group unique issue patterns
const patterns = new Map();
for (const r of fails) {
  for (const i of r.issues) {
    const key = `${i.type}::${JSON.stringify(i.detail).slice(0, 100)}`;
    if (!patterns.has(key)) patterns.set(key, []);
    patterns.get(key).push(`${r.vp}${r.path}`);
  }
}
console.log("\n=== PATTERNS ===");
for (const [k, pages] of patterns) {
  console.log(k.slice(0, 120));
  console.log("  on:", pages.slice(0, 8).join(", "), pages.length > 8 ? `+${pages.length - 8}` : "");
}

writeFileSync("/tmp/oma-layout-report.json", JSON.stringify(report, null, 2));
console.log("\nwrote /tmp/oma-layout-report.json");
