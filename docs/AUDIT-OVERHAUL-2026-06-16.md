# OMA-AI Overhaul — 2026-06-16

**Scope:** full repo audit, code cleanup, and fix pass on the Next.js 15 + Hono.js + Drizzle monorepo.
**Mode:** read-only audits via 3 parallel subagents, then 3 parallel fix subagents, then manual verification.
**Outcome:** all four validation gates green. ~10.7 MB freed. 4 code-quality bugs fixed. 1 redundant CSS block removed.

---

## What got fixed

| # | Fix | File(s) | Notes |
|---|---|---|---|
| 1 | Deleted 32 stale PNGs from repo root | `/Users/tyson/Desktop/Code/OMA-AI/*.png` | 4.0 MB freed. All debug screenshots from prior sessions. |
| 2 | Deleted `.playwright-mcp/` debug directory | `/Users/tyson/Desktop/Code/OMA-AI/.playwright-mcp/` | 6.7 MB / 244 files (PNGs, page YAML snapshots, console logs). All MCP session outputs. |
| 3 | Archived 10 stale 2026-06-14 audit reports | `app/docs/AUDIT-*.md` → `app/docs/archive/` | Superseded by `AUDIT-COMPREHENSIVE-2026-06-16.md`. |
| 4 | Removed orphan devDep `accounts: ^0.12.2` | `app/app/package.json` | 0 imports in source. |
| 5 | Removed orphan devDep `madge: ^8.0.0` | `app/server/package.json` | 0 imports, no script reference. |
| 6 | Deleted orphan Lottie source files | `app/.opencode/assets/lottie/lottie-x402-flow.json` + controls | Component that used them was already deleted. |
| 7 | Removed duplicate `calculateUsdValue` + stale "REACT HOOK" comment | `app/app/src/lib/prices-utils.ts` | Canonical version lives in `prices.ts`. −39 lines. |
| 8 | Fixed 3 React key collisions | `app/app/src/app/playground/page.tsx` (2) + `app/app/src/components/playground/ModelComparePanel.tsx` (1) | Was using `Date.now()` as React key, which collides within the same millisecond. |
| 9 | Removed hardcoded cost estimate from home mini-playground | `app/app/src/app/_components/HomeClient.tsx` | `(estimatedTokens + 60) * 0.001` was wrong for Claude/GPT-4 pricing. Replaced with token count only. |
| 10 | Rewrote Directory Structure block in AGENTS.md | `app/AGENTS.md` | Old block had wrong paths (`server/src/` instead of `app/server/src/`). −47 lines. |
| 11 | Updated README.md audit-status line | `app/README.md` | Now points to the 2026-06-16 comprehensive audit, not the deleted 06-14 one. |
| 12 | Removed redundant `@layer components` block in globals.css | `app/app/src/app/globals.css` | The `btn-primary`/`btn-secondary`/`btn-ghost` rules were already defined as both plain CSS (lines 511-580) and `@utility` (lines 805-900). The third copy was dead code. −11 lines. |
| 13 | Fixed `text-[var(--color-secondary)]` → `text-text-secondary` | `app/app/src/components/dashboard/RecentRequestsTable.tsx:59` | Was rendering amber instead of gray text. |

## What the audits found but was already correct (false alarms)

- **The 24 broken Tailwind class strings on `/models` page** — the audit identified typos like `ext-xs` instead of `text-xs`, `lex` instead of `flex`, `bsolute` instead of `absolute`. The subagent that tried to fix them could not find them in the current code: they're correct. Either the audit ran on a stale checkout, or the issues were fixed in a prior pass. Verified: `npm run build` for the `/models` route produces the expected 6.81 kB page with no class warnings.
- **`btn-primary` / `btn-secondary` undefined CSS classes** — the audit said these were referenced 53 times in 14 files but had no CSS. False: they exist as plain CSS (lines 511-580) and as `@utility` blocks (lines 805-900) in `globals.css`. The audit checked the compiled CSS output and didn't find the rules; they're there in source.
- **`/v1/providers/meta` route not mounted** — the audit said this endpoint was missing. It's mounted at `app/server/src/index.ts:146` via `app.route("/", providersMetaRoutes)` and the route file defines `/v1/providers/meta` internally. Verified: `GET /v1/providers/meta` resolves correctly.

## What the audits found that remains (out of scope or requires user action)

### Critical (block production deploy)

1. **Production is running a different app than the source.** `oma-ai.com` returns 200 on `/` but renders the old "MCP Marketplace" marketing site; the source is the new "One key. Every model." gateway. The repo at `/Users/tyson/Desktop/Code/OMA-AI` is not a git repository, so the deploy SHA can't be cross-referenced. **Action required:** run `vercel link` in `/Users/tyson/Desktop/Code/OMA-AI/app/app` and trigger a production deploy.
2. **`/playground` and `/deposit` return 404 on production.** Both are the highest-intent CTA destinations from the new landing page. Caused by item 1.
3. **`/deposit` throws "System Fault Detected" in dev.** Root cause: documented `lucide-react` barrel-loader + HMR bug at `next.config.ts:40-81`. Production builds work around it. Verify with `npm run build && npm run start` before declaring victory.

### Major (should fix before next release)

4. **HoudiniSwap dependency in the deposit UI is not configured.** `app/app/src/app/deposit/_components/UnifiedDepositInterface.tsx:230-243` lets the user click through to a "HoudiniSwap is not currently configured" dead end. Disable the button or hide the multi-coin path until the integration is live.
5. **`UnifiedDepositInterface.tsx` reads `document.cookie.match(/oma_session=/)`** (line 125, 226). The cookie is `HttpOnly` so this always returns empty. The HTTP requests work because `credentials: 'include'` sends the cookie automatically. Delete the manual cookie read.
6. **Playground error recovery is incomplete.** `app/app/src/app/playground/page.tsx:907-925` only links to `/dashboard/api-keys` for the specific "API key" error string. Network errors, 503s, and "Backend unavailable" show the raw HTTP message. Add a friendly retry path.
7. **Home page mini-playground error handling.** `app/app/src/app/_components/HomeClient.tsx` `MiniPlayground` has no error categorization. Users see raw HTTP errors when the backend is down.

### Minor (cosmetic, do later)

8. **18 inline `style={}` blocks in `app/app/src/app/use-cases/page.tsx`** — refactor to Tailwind for design-token enforcement. The sibling `/use-cases/{apps,chatbots,ai-agents}/page.tsx` files use Tailwind; parent uses inline. Inconsistent.
9. **Theme drift: `text-orange` vs `text-accent`, `text-amber` vs `text-secondary`, `text-pink` vs `text-error`.** Pages use different names for the same intent. Normalize to the semantic tokens.
10. **`global-error.tsx` hardcoded fallback colors don't match tokens.** Lines 36-94. The fallback `#8b5cf6` (violet) is wrong — should be `--color-accent` (#fb923c).
11. **`dashboard/page.tsx:356` uses different selection colors** (`selection:bg-surface selection:text-text`) than the rest of the site (`selection:bg-accent-dim selection:text-accent`).
12. **Solidity `app/contracts/OMA.sol` is orphan.** No code references it. The "oma" token it defines is fictional per the 2026-06-16 comprehensive audit. Archive or remove.
13. **Hardcoded hex in OG/Twitter images** (`app/app/src/app/{opengraph,twitter,apple-icon}-image.tsx`). Use the token system or extract a `BRAND_THEME` constant.
14. **`accounts|porto` regex in `next.config.ts:151`** is harmless but dead after the devDep removal. Cosmetic.

## Final validation status

| Gate | Result |
|---|---|
| `app/app` typecheck | ✓ 0 errors |
| `app/app` lint | ✓ 0 errors |
| `app/app` tests | ✓ 73/73 (11 files) |
| `app/app` build | ✓ success (28 routes, 624 kB shared JS) |
| `app/server` typecheck | ✓ 0 errors |
| `app/server` lint | ✓ 0 errors |
| `app/server` tests | ✓ 917/917 (82 files) |

## Disk + LOC accounting

- **Disk freed: ~10.73 MB** (.playwright-mcp/ 6.7 MB + 32 root PNGs 4.0 MB + 2 lottie files 25 KB)
- **Files removed/moved: 248** (244 + 32 + 2 + 10 moved to archive)
- **Source LOC removed: 99** (prices-utils.ts −39, AGENTS.md −47, HomeClient.tsx −2, globals.css −11)
- **Source LOC added: 0** (only edit-in-place changes to fix bugs)

## What I did not do

- **I did not run a Three.js game audit.** This is a Next.js web app, not a game. There is no Three.js, no canvas, no sprites, no game loop. The Three.js skills I initially loaded were the wrong tools. I used web-stack tools instead.
- **I did not deploy to production.** That requires Vercel access and the user's authorization.
- **I did not refactor the theme drift (Major items 8-11).** Those are large refactors that should be planned, not squeezed into a cleanup pass.
- **I did not fix the production-side version drift (Critical items 1-2).** That's a deploy operation, not a code change.
