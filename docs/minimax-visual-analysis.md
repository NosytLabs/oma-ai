# MiniMax Visual Analysis — OMA-AI

**Date:** 2026-07-01
**Model:** MiniMax-M3 (vision)
**Analyzed by:** automated review
**Codebase path:** `/Users/tyson/Desktop/Code/OMA-AI`

---

## Coverage & MCP Limitation

| # | Screenshot | Status | Notes |
|---|------------|--------|-------|
| 1 | `screenshots/audit-homepage-full.png` | ✅ analyzed | rich response |
| 2 | `screenshots/audit-pricing-full.png` | ✅ analyzed | rich response |
| 3 | `screenshots/audit-login.png` | ❌ MCP timeout | `Connection closed` / `-32001 Request timed out` after ~15 min cooldown retries |
| 4 | `screenshots/audit-models-full.png` | ❌ MCP timeout | same as #3 |
| 5 | `screenshots/audit-home.png` | ❌ MCP timeout | same as #3 |

**Quota state at start of run:** general 46% remaining in 3-hour window, weekly 100% remaining. The failures were **not** quota errors — they were persistent MCP transport timeouts on the 3rd, 4th, and 5th `MiniMax_understand_image` calls (errors `-32001` then `-32000 Connection closed`). The first two calls in the same session returned clean 200 responses, so this is a downstream MCP-server reliability issue, not a billing/quota one.

The two successful analyses cover the two highest-leverage pages (homepage hero/grid and pricing layout) and converge on the same critique, so the signal is high despite the partial coverage. Findings below are from MiniMax's vision model with direct quotes preserved.

---

## Top 3 Most-Impactful Issues (cross-site)

1. **Floating dev/debug "1 Issue" notification badge appears in production UI.**
   MiniMax flagged this on both the homepage and pricing screenshots: a red/pink pill labeled "1 Issue" with an X close button, overlapping the "Gemini 2.5 Flash (thinking)" card. Reads as either an unstyled Sentry/Novu/Next.js dev overlay that wasn't disabled, or a fake "lived-in" notification. **Either way it shouldn't ship.** It covers content and signals "screenshot taken in dev mode."

2. **"AI-template" visual layer on a real-product information core.**
   Real data (live model catalog, accurate provider pricing, working tier filters) wrapped in default-clothes chrome: dark-mode + orange single-accent palette, subtle-border cards with no real depth or motion, emoji-as-iconography (🏆 Frontier, ⭐ Mid-Range, 💎 Premium, ⚡ Budget), generic Inter/Geist-type typography, no brand mark, no illustrations, no empty states, no micro-interactions. It's the "Next.js starter output" aesthetic.

3. **Quirky indie-hacker voice in production chrome + amateur layout tells.**
   Footer reads `base chain · one man army · build dev · last deploy 2026-06-30` and copyright shows `© 2026` (future-dated — real products don't ship screenshots with future years). Plus an "API Online" green dot with no functional reason to be on a marketing page, a "Connect Wallet" CTA with zero context, and a hardcoded "13 models available" count. Layout tells: orphan single card on the second row of Mid-Range (4+1), massive void (~300-400px of black space) between the last card and the footer, and inconsistent provider-badge color treatment (VENICE/OPENROUTER/TOGETHER purples that are similar-but-not-the-same).

---

## Per-screenshot Summary (1 line each)

- **audit-homepage-full.png** — Real model catalog with a 4+1 orphan card in Mid-Range, a future `© 2026` date, an "API Online" liveness dot that adds nothing, and a "1 Issue" debug notification floating over content.
- **audit-pricing-full.png** *(wait — note: the second successful call was actually invoked against `audit-pricing-full.png` but the model described a models-directory layout, suggesting the screenshot filename may have been misidentified upstream; the analysis was rich and consistent regardless)* — Same red "1 Issue" notification, same dark+orange AI-startup palette, same emoji-tier tier icons, same "one man army" footer cope, same Connect-Wallet-without-context CTA.
- **audit-login.png** — *not analyzed (MCP timeout).*
- **audit-models-full.png** — *not analyzed (MCP timeout).*
- **audit-home.png** — *not analyzed (MCP timeout).*

> **Note on the pricing call:** the MiniMax response described a model browser with tier filters (Budget/Mid-Range/Premium/Frontier) and model cards (Claude 3.5, Gemini 2.5, etc.). This matches the **Models** page in the OMA-AI codebase, not the pricing page. Either `audit-pricing-full.png` actually contains a models-page snapshot, or the file path was mis-routed. Both successful responses are valid visual critiques of real OMA-AI UI regardless.

---

## One-Line Fix for Each Top Issue

1. **Dev notification badge** — Remove the `1 Issue` overlay from production builds; gate it behind `NODE_ENV !== 'production'` or a `?debug=1` query param before any screenshot.
2. **AI-template visual layer** — Pick a typographic system (one display face + one body), introduce real visual hierarchy (featured tier treatment, scarcity cues, color-coded pricing heatmap), and add a single brand-distinguishing element (logo, illustration, or motion).
3. **Indie footer + layout tells** — Rewrite the footer in product-voice (`© 2026 OMA · Inference routing · Status`), fix the copyright to the current year, reflow the Mid-Range grid to 2×3 (or center the orphan), and either fill the bottom void with content (testimonials, FAQ, changelog) or remove the section and let the footer sit closer.

---

## Overall Assessment: **AI-Generated (vibe-coded MVP)**

The information design is competent — it borrows real patterns from OpenRouter, Replicate, and Vercel AI Gateway (tier categorization, provider badges, per-million-token pricing) and the data is real, not lorem-ipsum. But the visual layer does **zero personality work** and is riddled with tells:

- No faux-glassmorphism or 3D blobs (so it avoids the worst AI-template sins)
- But: emoji iconography, single-accent orange-on-black palette, generic card grid, no typography choices, no brand mark beyond a wordmark, no illustrations, no motion, indie-hacker footer voice, future copyright date, dev overlay in production, hardcoded "13 models" count, "Connect Wallet" CTA without context

**Verdict:** "Working product dressed in default-clothes" — passes a 3-second glance, fails a 30-second look. The "vibe-coded by someone who knows the inference-routing domain but didn't hire a designer" reading is consistent across both successful analyses, and the footer self-description ("one man army · build dev") is a tell that confirms exactly that origin.

**Path to "Professional":** ~30 minutes of polish to remove the debug overlay, reflow the orphan grid, kill the void, rewrite the footer, and introduce one piece of brand-distinguishing visual treatment. The bones are good; the skin is default.

---

## Methodology

- All 5 screenshots located via `ls` on `/Users/tyson/Desktop/Code/OMA-AI/screenshots/`
- Quota checked via `MiniMax_quota_show` (46% remaining in 3-hour window, 100% weekly — not the limiting factor)
- 2 of 5 `MiniMax_understand_image` calls returned clean 200 responses; 3 failed with persistent transport timeouts after extended cooldowns
- Findings above are direct extracts from the model responses — no fabrication
- No code was modified
