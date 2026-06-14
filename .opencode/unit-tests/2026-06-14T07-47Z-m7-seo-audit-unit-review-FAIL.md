# Unit Review — SEO + sitemap + schema audit (M7 v6 mission)

**Date**: 2026-06-14T07:47Z
**Author**: Reviewer (terminal node, ses_m7_seo_review)
**Scope**: Verify the "SEO + sitemap + schema audit" task (todo.md M7) and assess completeness of the unit before global integration.

---

## VERDICT: **FAIL** — Task is "audit-only"; 0 of 4 sub-tasks in M7 are properly completed. 0/5 audit recommendations applied. 0 unit tests for the SEO module.

The previous review (`.opencode/unit-tests/2026-06-14T05-30Z-seo-audit-unit-review.md`) returned PARTIAL PASS for the v5 mission's M8.4. This is a fresh re-verification for the v6 mission's M7 ("SEO + sitemap + schema audit"). All findings are independently re-checked against the live code at 2026-06-14T07:47Z.

---

## 1. M7 Sub-task Verification

| # | Sub-task | Status | Evidence |
|---|----------|--------|----------|
| S7.1.1 | Read `sitemap.ts` and `robots.ts` | ✅ DONE (audit + this re-verify) | `app/src/app/sitemap.ts` 28L, `app/src/app/robots.ts` 15L |
| S7.1.2 | Verify all 30+ pages are in sitemap | ⚠️ PARTIAL — verified the **gap**, but **fix not applied** | sitemap has 20 entries; **22 page.tsx files not in sitemap** |
| S7.1.3 | Check for canonical tags, JSON-LD schema markup | ❌ NOT DONE — audit did NOT check JSON-LD | grep for `application/ld+json` returns 0 hits across `app/src/app/` |
| S7.1.4 | Verify /llms.txt content freshness | ⚠️ PARTIAL — verified it loads, but **content is stale** (says "25% markup" — actual is 10%) | `app/src/app/llms.txt/route.ts:51,89` |

**No [x] mark applied to M7 in todo.md** — gate must be all 4 sub-tasks properly DONE with evidence.

---

## 2. Audit Accuracy — 7/7 claims independently re-verified

| Audit claim | Re-verified | Source |
|-------------|-------------|--------|
| Sitemap has 20 public marketing pages | ✅ | `find ... | wc -l` = 20 in `app/src/app/sitemap.ts:6-27` |
| 10/32 pages have `export const metadata` | ✅ | `find ... -exec grep -l "export const metadata"` = 10/32 |
| `/about` missing from sitemap | ✅ | `grep -n "/about" sitemap.ts` returns nothing |
| `/faq` missing from sitemap | ✅ | `grep -n "/faq" sitemap.ts` returns nothing |
| `/admin` NOT in robots disallow | ✅ | `robots.ts:9` = `disallow: ['/api/', '/settings', '/api-keys']` |
| llms.txt implemented as route, not static file | ✅ | `app/src/app/llms.txt/route.ts:109` returns `NextResponse` |
| Only root has `opengraph-image.tsx` | ✅ (from prior review) | `find app/src/app -name "opengraph-image.tsx"` returns 1 (root only) |

**Audit deliverable is accurate.** No factual errors found in the 82-line audit report.

---

## 3. Fix Status — 0/5 action items applied

| # | Severity | Action Item | Status | Evidence |
|---|----------|-------------|--------|----------|
| 1 | HIGH | Add metadata to ~15 marketing pages | ❌ NOT DONE | 22/32 pages still missing metadata (re-counted) |
| 2 | HIGH | Add `/about` and `/faq` to sitemap | ❌ NOT DONE | `grep -E "/about|/faq" sitemap.ts` returns 0 hits |
| 3 | MEDIUM | Per-page OG images for top 5 pages | ❌ NOT DONE | `find ... -name "opengraph-image.tsx"` still returns 1 (root only) |
| 4 | MEDIUM | Add canonical URLs | ❌ NOT DONE | `grep -r "alternates.*canonical" app/src/app/` returns 0 hits |
| 5 | LOW | Add `/admin` to robots disallow | ❌ NOT DONE | `robots.ts:9` unchanged |

**Zero fixes applied** since the prior review at 2026-06-14T05:30Z. Same SYNC-65 from the previous review still applies.

---

## 4. Unit Test Code for SEO Module — **0 TESTS EXIST**

This is the **core defect** for this Unit Review:

```
$ find app/src -name "*.test.*" -not -path "*/node_modules/*"
app/src/app/page.test.tsx
app/src/app/faq/__tests__/page.larp-isolated.test.ts
app/src/app/models/page.test.tsx
app/src/app/__tests__/page.larp-isolated.test.ts
app/src/app/api/admin/proxy-auth.test.ts
app/src/app/pricing/page.test.tsx

$ find . -name "sitemap*.test.*" -o -name "robots*.test.*" -o -name "*seo*.test.*"
(none — only node_modules/pino/test/metadata.test.js which is a library test)
```

**NO test exists for:**
- `app/src/app/sitemap.ts` (Next.js MetadataRoute.Sitemap validation)
- `app/src/app/robots.ts` (Next.js MetadataRoute.Robots validation)
- `app/src/app/llms.txt/route.ts` (custom route handler returning text/plain)

The only related test (`app/src/app/__tests__/page.larp-isolated.test.ts`) **incidentally** checks that `app/src/app/page.tsx` keeps its `export const metadata` line, but it does not validate the metadata content, length, or SEO fields (title, description, OG, Twitter, canonical).

**Impact**: A future change to any of the 3 SEO infrastructure files could break the sitemap, robots, or llms.txt with **zero test coverage to catch the regression**. The build would still succeed because these are Next.js route handlers validated by TypeScript only.

---

## 5. Build Gates — All PASS

| Gate | Result |
|------|--------|
| `app typecheck` | ✅ PASS (route types generated successfully, 0 errors) |
| `app lint` | ✅ PASS (0 errors) |
| `app tests` | ✅ 72/72 PASS (6 files, 1.58s) — but **0 SEO tests** |
| `lsp_diagnostics` on sitemap.ts, robots.ts, llms.txt/route.ts | ✅ CLEAN (all 3) |

The build is green, but the SEO infrastructure has no test coverage to back the green status.

---

## 6. Code Quality & Modularity — **PASS**

All 3 SEO infrastructure files are well-modularized, single-responsibility, and follow Next.js App Router conventions:

### `app/src/app/sitemap.ts` (28 lines)
- **Pattern**: `export default function sitemap()` returning `MetadataRoute.Sitemap` — Next.js convention ✅
- **Single responsibility**: only sitemap generation ✅
- **No side effects, no state, no I/O** — pure function of hardcoded URL list ✅
- **Modularity**: Could be split into per-section constant arrays, but at 28 lines it's appropriately concise ✅

### `app/src/app/robots.ts` (15 lines)
- **Pattern**: `export default function robots()` returning `MetadataRoute.Robots` — Next.js convention ✅
- **Single responsibility**: only robots.txt generation ✅
- **Modularity**: Concise; missing `/admin` is a **content** issue, not a code quality issue ✅

### `app/src/app/llms.txt/route.ts` (116 lines)
- **Pattern**: `export function GET()` returning `NextResponse` — Next.js route handler convention ✅
- **`export const dynamic = 'force-static'`** — correct static-route declaration ✅
- **`Cache-Control: public, max-age=3600, must-revalidate`** — 1-hour client cache, appropriate for content that doesn't change every second ✅
- **Single responsibility**: only llms.txt content ✅
- **⚠️ Stale data**: Line 51 and line 89 still claim "default 25% markup" — actual is 10% per Mission 1 correction (see `.opencode/unit-tests/2026-06-14T05-00Z-provider-architecture.md`). This is a content defect, not a code defect.

**Code quality: HIGH** — these 3 files are exemplary Next.js boilerplate.

---

## 7. Schema/JSON-LD Markup — **NOT IMPLEMENTED** (gap not in prior audit)

The v6 M7 sub-task S7.1.3 says: *"Check for canonical tags, JSON-LD schema markup"*.

```
$ grep -r "application/ld+json" app/src/app/
(none)
```

The prior audit missed this. JSON-LD schema markup (e.g., `Organization`, `WebSite`, `Product`, `FAQPage`, `BreadcrumbList`) is **standard SEO practice** for AI gateway sites and is entirely absent. This is a gap the v6 audit should have flagged.

---

## 8. Defects Summary

| ID | Severity | Description | Fix | Status |
|----|----------|-------------|-----|--------|
| **D1** | **CRITICAL** | Zero unit tests for SEO infrastructure (sitemap, robots, llms.txt) | Add `app/src/app/__tests__/sitemap.test.ts`, `robots.test.ts`, `llms-txt.test.ts` with minimum 8 assertions | pending |
| **D2** | **CRITICAL** | 0/5 audit action items applied — audit-only, no fixes | Apply the 2 HIGH items (sitemap + metadata), then 1 LOW item (robots `/admin`) | pending |
| **D3** | **HIGH** | JSON-LD schema markup absent (not checked by prior audit) | Add `application/ld+json` blocks for at minimum `Organization` + `WebSite` (root) and `FAQPage` (faq page) | pending |
| **D4** | **MEDIUM** | `robots.ts` does not disallow `/admin` | Add `/admin` to the disallow list (1 line edit) | pending |
| **D5** | **MEDIUM** | `sitemap.ts` missing `/about` and `/faq` | Add 2 entries to the sitemap array (2 line edit) | pending |
| **D6** | **LOW** | `llms.txt` content stale — claims "25% markup" but actual is 10% (Mission 1 correction) | Replace 2× "25% markup" with "10% markup" in `route.ts:51,89` | pending |

---

## 9. Required Corrections (priority order)

1. **D1 (CRITICAL) — Add unit tests for SEO module.** Minimum 8 assertions across 3 test files:
   - `sitemap.test.ts`: sitemap returns array, all entries have valid `url` (https://oma-ai.com/*), 20+ entries
   - `robots.test.ts`: returns valid `MetadataRoute.Robots`, disallow list includes `/api/`
   - `llms-txt.test.ts`: GET returns 200, content-type `text/plain`, body contains "OMA AI Gateway"

2. **D2 (CRITICAL) — Apply audit fixes.** Worker must:
   - Add 4 metadata exports to remaining HIGH-priority pages (e.g., `/playground`, `/image-generation`, `/video-generation`, `/swap`)
   - Add `/about` + `/faq` to sitemap
   - Add `/admin` to robots disallow
   - Run 7 M3 gates after each fix batch

3. **D3 (HIGH) — JSON-LD schema markup.** Add `Organization` + `WebSite` JSON-LD to root layout or page.tsx.

4. **D6 (LOW) — Fix stale 25% markup claim in llms.txt** (line 51, 89).

---

## 10. Final Status to Commander

**M7 SEO + sitemap + schema audit**: **FAIL** — task is audit-only, 0/4 sub-tasks properly completed, 0/5 audit action items applied, 0 unit tests for SEO infrastructure.

**Recommended next action**: Dispatch a Worker to (1) add SEO unit tests, (2) apply the 5 audit action items, (3) add JSON-LD schema markup, (4) fix the stale 25% claim in llms.txt. After Worker completes, re-run 7 M3 gates and re-invoke Reviewer.

**NOT marking M7 [x] in todo.md** per the Iron Law of verification-before-completion. Zero evidence of completion exists beyond the audit deliverable itself, which is a diagnostic, not a fix.

**SYNC-66** (new): SEO unit module lacks test coverage + 0/5 fixes applied. File at `.opencode/sync-issues.md` per Reviewer rules.

---

*DONE 2026-06-14T07:47Z. Reviewer terminal node, ses_m7_seo_review. No [x] marks applied.*
