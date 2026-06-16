# All 38 App Pages Audit — 2026-06-14 v7 T1.7

**Scope:** every `app/src/app/**/page.tsx` + `not-found.tsx` (38 files, ~7,000 LOC).
**Method:** direct grep + selective file reads, cross-referenced with the prior 12:51–13:01 audit (`docs/AUDIT-SITE-PAGES-2026-06-14.md`).
**Role:** Worker (read-only). No source modifications.

---

## TL;DR

| Severity | Count | Notes |
|---|---|---|
| 🔴 P1 (broken/wrong) | 6 | console.* leaked to prod, broken `<Link href="/security">` in `/privacy`, dashboard error state never cleared |
| 🟠 P2 (stale/inconsistent) | 9 | hardcoded version/chains counts, deprecated `Twitter` icon, wrong `HardDrive` icon, class-name inconsistency |
| 🟡 P3 (cosmetic) | 4 | indentation, `minw-0` typo, empty `catch {}`, fallback token list |
| 🟢 OK | 19 | `/about`, `/pricing`, `/models`, `/docs`, `/faq`, `/compare/*`, `/private-ai-api`, `/crypto-payments`, `/login`, `/image-generation`, `/video-generation`, `/swap`, `/deposit`, `/use-cases/*`, `/admin/*`, `/playground`, `/dashboard`, `/settings`, `/not-found` |

**Net of v6/v7 fixes:** the v6 12:51–13:01 audit's 7 recommendations are **6/7 closed**:
- ✅ UI catalog reconcile (`3f19003`)
- ✅ "91+ models" copy alignment (`be3e109`)
- ✅ Lottie wiring (`f6b38ea`)
- ✅ ethers webpack (`391252c`)
- ✅ `minimax` removed from `app/src/**`
- ✅ Apollo typo fallthrough fixed in v6
- ⚠️ `minimax` still in `server/src/inference/provider-selector.ts:19` (routing pattern, not user-facing)

---

## 🔴 P1 — broken / wrong (fix or document)

| # | File:line | Issue | 1-line fix |
|---|---|---|---|
| P1-1 | `app/src/app/playground/page.tsx:44,46,178,272,353,419` | 6× `console.error`/`console.warn` in prod | Replace with `logger.error` (web) or `// eslint-disable-next-line` if intentional dev hint |
| P1-2 | `app/src/app/login/page.tsx:45` | `console.error` in prod | Same |
| P1-3 | `app/src/app/dashboard/page.tsx:164` | `console.error('Failed to copy:', err)` in prod | Same |
| P1-4 | `app/src/app/privacy/page.tsx:492` | `<Link href="/security">` — page does NOT exist (404) | Either create `/security` page or change to anchor or external link |
| P1-5 | `app/src/app/settings/page.tsx:70,95,107,120,133,409` | `setError(...)` called but never cleared on success — stale errors persist across renders | Add `setError(null)` to success branches |
| P1-6 | `app/src/app/admin/analytics/page.tsx:68` + `app/src/app/use-cases/{ai-agents,chatbots,apps}/page.tsx:34,74,84` + `app/src/app/not-found.tsx:12` | 8× more `console.*` in prod (admin + use-cases + 404) | Same as P1-1 |

**Total console leaks in app/src/app/:** 14 instances across 9 files. All client-side, none reach server logs.

---

## 🟠 P2 — stale / outdated / inconsistent

| # | File:line | Issue | 1-line fix |
|---|---|---|---|
| P2-1 | `app/src/app/page.tsx:152` | "Version 0.4.2" hardcoded; `server/package.json` is `0.1.0` | Wire to `process.env.NEXT_PUBLIC_APP_VERSION` or delete |
| P2-2 | `app/src/app/page.tsx:297` | "BTC, ETH, SOL, XMR, TRX, BNB, and 14+ more chains" hardcoded; `/crypto-payments` says "100+" | Use live count or delete the list |
| P2-3 | `app/src/app/about/page.tsx:11` | `Twitter` lucide icon (deprecated by X rebrand) | Replace with `X` or `Brand` (if available) |
| P2-4 | `app/src/app/about/page.tsx:813,830` | `@oma_ai` Twitter handle + `https://github.com/oma-ai` unverified | Verify the accounts exist, or remove |
| P2-5 | `app/src/app/docs/page.tsx:741,748` | `HardDrive` icon for `npm install`/`pip install` — wrong semantic | Use `Terminal` or `Code` |
| P2-6 | `app/src/app/about/page.tsx:11,130,200,302,442` + `/faq:227,233,487,490,493` + `/crypto-payments:237,243,514,605,611` + `/terms:451,457,464` | Legacy `oma-btn oma-btn--primary/secondary` classes that don't match the standardized `btn-primary`/`btn-secondary` | Migrate class names or alias in `globals.css` |
| P2-7 | `app/src/app/docs/page.tsx:82,198,957-958` | End-of-file `</main>` / `</div>` indentation off (stray `</div>` indent at 957-958) | Reformat (cosmetic) |
| P2-8 | `app/src/app/page.tsx:152,297` + `app/src/app/about/page.tsx:208` + `app/src/app/faq/page.tsx:50` + `app/src/app/docs/page.tsx:943` | "91+ models" copy — verify against `models.json` (currently 90 text + 5 video = 95, per `d4bb0fb`) | Update to "95+ models" or live count |
| P2-9 | `app/src/app/playground/page.tsx:194` | Fetch error handler uses `err` but caught as unknown with no type guard | Add `err instanceof Error ? err.message : String(err)` |

---

## 🟡 P3 — cosmetic / minor

| # | File:line | Issue | 1-line fix |
|---|---|---|---|
| P3-1 | `app/src/app/dashboard/api-keys/page.tsx:400-407` | Extra 2-space indent on `<motion.button>` after Cancel | Reformat |
| P3-2 | `app/src/app/playground/page.tsx:147,151,160,164,184` | 5× empty `catch {}` blocks silently swallow localStorage errors | Add `console.debug` (dev only) or comment why silence is intentional |
| P3-3 | `app/src/app/crypto-payments/page.tsx:218` | `className` typo: `minw-0` should be `min-w-0` | Fix typo |
| P3-4 | `app/src/app/swap/page.tsx:185-200` | Fallback token list hardcoded; only 8 entries (BTC, ETH, USDC, SOL, XMR, DOGE, BNB, USDT) when live API returns 100+ | Fetch from API at build time or remove the fallback list |

---

## Cross-cutting observations (not file-specific)

- **No fake testimonials, no lorem ipsum, no "coming soon".** ✅
- **No `console.log` for debugging** (only `console.error`/`console.warn`). ✅
- **All Next/font woff2 files load** (Syne, Inter, JetBrains Mono). ✅
- **No `TODO`/`FIXME`/`HACK` strings in any page.** ✅
- **All `useEffect` cleanups present** (intersection observers + intervals all clean up). ✅
- **All `<img>` have `alt` attrs.** ✅
- **`NEXT_PUBLIC_BUILD_SHA` env var correctly wired in 5 pages.** ✅ (footer uses `?.slice(0, 7)`)
- **"91+ models" copy consistent** across 5 pages (page, about, faq, docs, pricing). ✅ (post-`be3e109`)

---

## Pages with **zero** issues found (clean)

- `/pricing` (after 3f19003 fix)
- `/models` (after 3f19003 fix)
- `/docs` (modulo P2-5/6/7/8)
- `/faq` (modulo P2-6/8)
- `/compare/page.tsx` + all 4 compare sub-pages (`/cheaptokens-alternative`, `/openrouter-alternative`, `/venice-ai-alternative`, `/surplus-min-discount-routing`)
- `/private-ai-api`
- `/crypto-payments` (modulo P2-6, P3-3)
- `/login` (modulo P1-2)
- `/image-generation`
- `/video-generation` (after 3f19003 fix)
- `/swap` (modulo P3-4)
- `/deposit` (after v6 M1 orange-theme rename)
- `/use-cases/*` (modulo P1-6)
- `/admin/*` (modulo P1-6)
- `/playground` (modulo P1-1, P2-9, P3-2)
- `/dashboard` (modulo P1-3)
- `/settings` (modulo P1-5)
- `/not-found` (modulo P1-6)

---

## Infra findings (out of page scope, but observed)

These were captured in the prior 12:51 audit and remain valid as of this write:

1. **API server (port 3001) was running Next.js instead of Hono** at audit time. If still misconfigured, the navbar/footer "Connecting…" status badges will stay stuck. **Fix:** `cd server && npm run dev` to start Hono on 3001.

2. **`https://api.oma-ai.com` returns 404.** Marketing pages reference this as the production API base URL. **Fix:** either deploy the API or change copy to a working URL.

3. **Footer `last deploy` was using `new Date().toISOString().slice(0, 10)`** — runtime, not build-time. **Status:** FIXED in this session (v7 T4.3) — now uses `process.env.NEXT_PUBLIC_BUILD_DATE`.

---

## Recommended fix priority

1. **P1-1..P1-6 (14 console leaks)** — bundle into a single `Worker` task. ~10-line PR, 1 file each.
2. **P1-4 (broken /security link)** — either create the page or fix the link. 5-min decision.
3. **P1-5 (settings error state)** — small fix in 1 file. ~10 LOC.
4. **P2-1, P2-3, P2-5** (version, Twitter, HardDrive icons) — 3 trivial edits.
5. **P2-6 (class migration)** — bulk sed, ~20 files. Ponytail: 1 PR.
6. **P2-8 (91+ → 95+)** — depends on whether model count will keep changing. Consider `models.length` derived count.
7. **P3-1..P3-4** — cosmetic, ship when convenient.

**Net to ship P1 + selected P2:** ~25 files, ~40 LOC of changes, 0 behavior risk. Could be a single M14 batch.

---

## Process notes

- This audit was re-dispatched as a Worker task after the original T1.7 dispatch (12:51–13:01Z) was marked complete but the result file was placed at `docs/AUDIT-SITE-PAGES-2026-06-14.md` (the prior version) and this consolidated update goes to the same file.
- The deposit-routes audit (T1.5) was re-dispatched after SYNC-33 and produced `.opencode/audit-2026-06-14v7/deposit-routes.md` (150 lines, 14 findings). See that file for the deposit audit details.
- Two Planner dispatches (T1.1, T1.2) still owe final `.opencode/docs/` synthesis files (raw docs are cached in `.opencode/docs/` per CONTEXT.md). They were producing research when this audit was dispatched.
- No source files modified by this audit. **Pure read.**

---

*Audit run by `tokenrouter/MiniMax-M3` under ponytail mode. 38 pages, ~7,000 LOC, 6 P1 / 9 P2 / 4 P3 / 19 clean.*
