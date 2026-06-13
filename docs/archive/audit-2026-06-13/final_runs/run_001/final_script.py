#!/usr/bin/env python3
"""Webwright: Take fresh screenshots of OMA-AI site via Firefox/Playwright.

Workspace contract:
- WORKSPACE_DIR: .opencode/audit-2026-06-13/
- final_runs/run_001/
  - final_script.py (this file)
  - final_script_log.txt
  - screenshots/0N-name.png

Captures viewport screenshots (no full_page) for all 18 pages.
"""
import asyncio
import sys
from pathlib import Path
from playwright.async_api import async_playwright

WORKSPACE = Path("/Users/tyson/Desktop/Code/OMA-AI/.opencode/audit-2026-06-13")
RUN = WORKSPACE / "final_runs" / "run_001"
SCREENSHOTS = RUN / "screenshots"
LOG = RUN / "final_script_log.txt"
USER_VISIBLE = Path("/tmp/oma-screenshots")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)
USER_VISIBLE.mkdir(parents=True, exist_ok=True)

PAGES = [
    ("01-landing", "/"),
    ("02-models", "/models"),
    ("03-pricing", "/pricing"),
    ("04-playground", "/playground"),
    ("05-dashboard", "/dashboard"),
    ("06-dashboard-keys", "/dashboard/api-keys"),
    ("07-dashboard-credits", "/dashboard/credits"),
    ("08-deposit", "/deposit"),
    ("09-docs", "/docs"),
    ("10-settings", "/settings"),
    ("11-admin", "/admin"),
    ("12-compare", "/compare/surplus-min-discount-routing"),
    ("13-about", "/about"),
    ("14-faq", "/faq"),
    ("15-privacy", "/privacy"),
    ("16-terms", "/terms"),
    ("17-image-gen", "/image-generation"),
    ("18-video-gen", "/video-generation"),
]

BASE = "http://localhost:3000"


def log(line: str):
    print(line, flush=True)
    with LOG.open("a") as f:
        f.write(line + "\n")


async def main():
    # Reset log
    LOG.write_text("")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await context.new_page()

        # Track all console messages and errors globally
        all_console: dict[str, list] = {}
        all_errors: dict[str, list] = {}

        for name, path in PAGES:
            url = BASE + path
            log(f"\n[STEP] Navigating to {name}: {url}")

            console_msgs: list = []
            page_errors: list = []
            failed_requests: list = []

            def on_console(msg, _n=name):
                if msg.type in ("error", "warning", "warn"):
                    console_msgs.append((msg.type, msg.text[:500]))

            def on_pageerror(err, _n=name):
                page_errors.append(str(err)[:500])

            def on_requestfailed(req, _n=name):
                failed_requests.append(f"{req.method} {req.url} -- {req.failure}")

            page.on("console", on_console)
            page.on("pageerror", on_pageerror)
            page.on("requestfailed", on_requestfailed)

            try:
                response = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                status = response.status if response else "no-response"
                log(f"  status: {status}")
            except Exception as e:
                log(f"  nav error: {str(e)[:200]}")

            # Wait briefly for JS to render
            await page.wait_for_timeout(2000)

            # Take viewport screenshot (no full_page per Webwright contract)
            shot = SCREENSHOTS / f"{name}.png"
            try:
                await page.screenshot(path=str(shot), full_page=False)
                size_kb = shot.stat().st_size // 1024
                log(f"  saved {shot.name} ({size_kb}KB)")
            except Exception as e:
                log(f"  screenshot error: {e}")

            # Also save to user-visible location
            user_shot = USER_VISIBLE / f"{name}.png"
            try:
                await page.screenshot(path=str(user_shot), full_page=False)
            except Exception:
                pass

            # Cleanup event listeners
            page.remove_listener("console", on_console)
            page.remove_listener("pageerror", on_pageerror)
            page.remove_listener("requestfailed", on_requestfailed)

            all_console[name] = console_msgs
            all_errors[name] = page_errors

        # Write console summary
        with (RUN / "console_summary.txt").open("w") as f:
            f.write("# Console + Error Summary per Page\n\n")
            for name, _ in PAGES:
                f.write(f"\n## {name}\n")
                errs = all_errors.get(name, [])
                msgs = all_console.get(name, [])
                if not errs and not msgs:
                    f.write("  (clean)\n")
                if errs:
                    f.write(f"  errors: {errs}\n")
                for t, txt in msgs:
                    f.write(f"  [{t}] {txt}\n")
        log(f"\n[SUMMARY] console -> {RUN}/console_summary.txt")

        await browser.close()
    log("\n[DONE] All screenshots captured")


if __name__ == "__main__":
    asyncio.run(main())
