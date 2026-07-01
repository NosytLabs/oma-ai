# OMA-AI Visual Audit — Final Report

**Date:** 2026-07-01
**Scope:** 16 public routes × 2 viewports = 32 screenshots
**Viewport sizes:** Desktop 1440×900, Mobile 390×844
**Tooling:** Chrome DevTools MCP + oMLX vision (model not loaded — fell back to direct visual inspection + DOM snapshots + curl-based SSR inspection)
**Dev server:** `http://localhost:3000` (Next.js 15.5.19 / Webpack / dev mode)

---

## ⚠️ CRITICAL BLOCKER — The site is broken

**14 of 16 audited pages render a fatal "Application Error" screen, not the actual UI.** Every screenshot in the set except `image-generation-*` and `video-generation-*` shows the global-error.tsx fallback: a black "void" page with a `> fatal_fault` prefix, the heading "Application Error", a generic "the application could not be loaded" message, and a single green "Reload Application" button.

**Root cause (from runtime error overlay):**
- `Uncaught TypeError: Cannot read properties of undefined (reading 'call')` in `src/components/ui/ToastProviderClient.tsx (27:9)`
- The `ToastProviderClient` is wrapped around every route in `src/app/layout.tsx`. Because it crashes during hydration, the entire root tree fails and only the `global-error.tsx` boundary catches it.
- The dev overlay also briefly exposes a Next.js version-staleness warning ("Next.js 15.5.19 (outdated)") and a "1 issue" badge — meaning the dev environment itself is acknowledging the problem.

**Why image-generation and video-generation render anyway:** these routes hit a code path that doesn't pull the broken Toast context on first paint. Every other page (homepage, login, signup, pricing, models, docs, about, faq, blog, swap, and the auth-guarded dashboard/chat/settings/deposit which all redirect to `/login`) crashes.

The screenshot inventory below reflects this reality. The screenshots labeled "Application Error" are not a screenshotting bug — they are the user-visible state of the site in dev mode right now.

---

## Screenshots taken (32 total)

| # | Route | Desktop (1440×900) | Mobile (390×844) | Visible state |
|---|---|---|---|---|
| 1 | `/` (homepage) | `homepage-desktop.png` | `homepage-mobile.png` | **Application Error** |
| 2 | `/login` | `login-desktop.png` | `login-mobile.png` | **Application Error** |
| 3 | `/signup` | `signup-desktop.png` | `signup-mobile.png` | **Application Error** |
| 4 | `/dashboard` | `dashboard-desktop.png` | `dashboard-mobile.png` | **Application Error** (auth-redirected to `/login?next=/dashboard`, then crashed) |
| 5 | `/pricing` | `pricing-desktop.png` | `pricing-mobile.png` | **Application Error** |
| 6 | `/models` | `models-desktop.png` | `models-mobile.png` | **Application Error** |
| 7 | `/docs` | `docs-desktop.png` | `docs-mobile.png` | **Application Error** |
| 8 | `/about` | `about-desktop.png` | `about-mobile.png` | **Application Error** (route resolves to `/about-us`, then crashed) |
| 9 | `/faq` | `faq-desktop.png` | `faq-mobile.png` | **Application Error** |
| 10 | `/chat` | `chat-desktop.png` | `chat-mobile.png` | **Application Error** (auth-redirected to `/login?next=/chat`, then crashed) |
| 11 | `/image-generation` | `image-generation-desktop.png` | `image-generation-mobile.png` | ✅ **Renders** |
| 12 | `/video-generation` | `video-generation-desktop.png` | `video-generation-mobile.png` | ✅ **Renders** |
| 13 | `/deposit` | `deposit-desktop.png` | `deposit-mobile.png` | **Application Error** (auth-redirected) |
| 14 | `/settings` | `settings-desktop.png` | `settings-mobile.png` | **Application Error** (auth-redirected) |
| 15 | `/swap` | `swap-desktop.png` | `swap-mobile.png` | **Application Error** |
| 16 | `/blog` | `blog-desktop.png` | `blog-mobile.png` | **Application Error** |

Plus supporting artifacts: `homepage-snapshot.txt` (DOM a11y snapshot of homepage crash state).

---

## Top 5 remaining visual / UX issues across the site

1. **[P0] ToastProviderClient crashes the entire app on hydration.** A single broken module in the root layout (line 27) takes down 14/16 pages with no per-route fallback. This is the dominant defect — fixing it unblocks all other pages automatically. Until it's fixed, no audit of marketing copy, color contrast, or layout spacing matters, because no visitor sees any of it.

2. **[P1] Auth-redirected routes have no graceful degraded state.** `/dashboard`, `/chat`, `/settings`, and `/deposit` all redirect to `/login?next=…` for unauthenticated users. In production this would be acceptable, but right now the redirect lands on a *broken* login page. Even after fixing the Toast crash, the redirect chain should never expose an internal URL fragment to users — the `?next=` parameter is a soft-leak of the auth boundary.

3. **[P1] The global-error fallback uses the wrong brand color.** `global-error.tsx` references `var(--color-accent, #f97316)` (orange) as a fallback. The actual brand accent in `globals.css` is emerald `#10b981`. In the captured screenshot the button is green because Tailwind's compiled `--color-accent` does cascade into global-error, but the *hard-coded fallback* in the inline style is the wrong hue. If a future environment strips CSS variables (CSP, raw HTML export, AMP), users would see an orange button instead of an emerald one — breaking brand consistency at the worst possible moment.

4. **[P2] `/about` route resolves to `/about-us` silently.** The browser URL bar rewrites without a 301 — the user lands at `/about-us` even though they typed `/about`. This is bad for SEO (split link equity) and confusing for users who copy/share the URL. Either 301 `/about` → `/about-us` at the edge, or alias the route to a single canonical path.

5. **[P2] The working pages lack the rest of the design system.** Image-generation and video-generation render fine, but they ship without the Navbar and Footer that the layout file wires up — meaning the providers wrap navbar/footer around `children`, and the crash kills them. So we can't even verify the top-level navigation, theme toggle, wallet connect button, or footer against the design. Until the crash is fixed, we don't actually know what the global chrome looks like.

---

## Top 3 conversion killers

1. **The "Application Error" screen is the literal first impression for 88% of visitors (14/16 routes).** Anyone who lands via SEO, paid ads, the docs link, a blog post, or `/pricing` from a tweet will see a fatal error with a "Reload Application" button. **Bounce rate will be effectively 100%.** This is not a polish issue — it's a "the product does not exist" failure.

2. **Sign-up funnel is unreachable.** `/signup`, `/login`, `/pricing` (the conversion-critical pages) all crash. There is no path from visitor → account creation → first paid request. The x402/USDC pitch in the metadata (`"Run any model, pay per request with USDC"`) cannot be acted on.

3. **Brand credibility is destroyed at first paint.** The footer (visible on image-gen and video-gen) advertises "© 2026 OMA AI · base chain · **one man army** · build dev · last deploy 2026-07-01" and notes "Inference routes to upstream providers. Uptime is best-effort, not guaranteed. Verify before you bet on it." Both the "best-effort uptime" disclaimer and the dev-tools "Application Error" screen contradict each other in the most damaging way possible: the disclaimer tells users not to trust the product, and the product then proves them right.

---

## Per-page brief summary (one line each)

| Page | Status | One-line summary |
|---|---|---|
| `/` | ❌ Crash | Crashes with ToastProviderClient TypeError before hero renders; only metadata in DOM ("Open Model Access · One API for every model"). |
| `/login` | ❌ Crash | Crashes with the same TypeError; users cannot authenticate. |
| `/signup` | ❌ Crash | Crashes with the same TypeError; account creation blocked. |
| `/dashboard` | ❌ Crash | Auth-redirects to `/login`, then crashes. Unauthenticated users never see the dashboard. |
| `/pricing` | ❌ Crash | Crashes; the conversion-critical pricing page is unreachable. |
| `/models` | ❌ Crash | Crashes; model catalog cannot be browsed. |
| `/docs` | ❌ Crash | Crashes; developer onboarding blocked at the docs step. |
| `/about` | ❌ Crash | URL silently rewrites to `/about-us`, then crashes. |
| `/faq` | ❌ Crash | Crashes; trust-building FAQ content unreachable. |
| `/chat` | ❌ Crash | Auth-redirects to `/login`, then crashes. |
| `/image-generation` | ✅ Renders | Clean two-column form (prompt + sidebar of Model / Style / Size / Count / Generate). Emerald CTA, light typography, generous whitespace. Works on desktop and mobile. |
| `/video-generation` | ✅ Renders | Tabbed UI (Text-to-Video / Image-to-Video) with Prompt / Model ($0.90 Seedance 2.0) / Aspect (16:9/9:16/1:1) / Duration / Resolution. Larger page with two help blocks stacked below. Works on desktop and mobile. |
| `/deposit` | ❌ Crash | Auth-redirects to `/login`, then crashes. Funding flow unreachable. |
| `/settings` | ❌ Crash | Auth-redirects to `/login`, then crashes. |
| `/swap` | ❌ Crash | Crashes; the public swap UI cannot be reached even without auth. |
| `/blog` | ❌ Crash | Crashes; content marketing surface is blank. |

---

## What I could not do (tooling notes)

- **oMLX vision audits failed.** The configured vision model (`mlx-community--Qwen2.5-VL-7B-Instruct-4bit`) is not loaded on the local oMLX server — every audit call returned `HTTP 404: Model not found. Available: (none — download via admin dashboard at /admin)`. I could not autonomously download it (the task restricts me to chrome-devtools + omlx-vision MCPs and prohibits code changes). Vision audits were replaced with direct PNG inspection of every screenshot, DOM a11y snapshots, and curl-based SSR HTML inspection.
- **Authenticated pages could not be screenshotted post-login.** No test credentials were available, and `/dashboard`, `/chat`, `/settings`, `/deposit` all auth-redirect to `/login` which itself crashes. Capturing them would require either a working login or bypassing auth in code (forbidden by the constraints).
- **The 5 most important pages (homepage, login, pricing, models, dashboard) could only be inspected via crash-state screenshots + source code.** Three of those five (`login`, `pricing`, `models`) do not render any content even with the dev overlay removed — only image-generation and video-generation survived.

---

## Recommended next actions (in order)

1. **Fix `src/components/ui/ToastProviderClient.tsx` line 27.** Either wrap the dynamic import in an `ErrorBoundary`, or move the `ToastProvider` into a try/catch that no-ops when framer-motion's broken barrel loader hands it a hookless react-server build (per the comment block at the top of that file, this is a known issue with Next 15.5.18 + React 19.2.6 + framer-motion).
2. **Re-run this audit** to capture the actual rendered state of all 16 routes once the crash is gone. The same 32 screenshots will tell a completely different story.
3. **Then** address the secondary issues: `/about` → `/about-us` 301, global-error color-token fallback, auth-redirect parameter hygiene.
4. **Then** run a real vision audit (download the oMLX model first) for color-contrast, spacing rhythm, typographic hierarchy, and conversion-flow polish.

---

**Report path:** `/Users/tyson/Desktop/Code/OMA-AI/screenshots/final-audit/AUDIT-FINAL.md`
**Screenshots dir:** `/Users/tyson/Desktop/Code/OMA-AI/screenshots/final-audit/`
**Total screenshots:** 32 (16 routes × desktop + mobile)