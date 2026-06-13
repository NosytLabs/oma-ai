# Repo Hygiene Audit Findings (2026-06-13)

**Auditor:** Worker (read-only audit, no fixes applied)
**Target:** `/Users/tyson/Desktop/Code/OMA-AI/`
**Scope:** Stray files, redundant docs, orphan assets, outdated config, git hygiene, archive audit

## Summary

| Category | Count | Severity |
|----------|-------|----------|
| Stray files (`.log`, `.bak`, `.tmp`, `.DS_Store`, `.swp`, `Thumbs.db`) | **0** | ✅ clean |
| Empty directories | **4** | low |
| Redundant docs (duplicates) | **1** real duplication + 5 archived | medium |
| Orphan assets | **0** in active tree; 1 broken-screenshot suspect in archive | low |
| Outdated config | **2** items | medium |
| Git hygiene issues | **1** uncommitted rename batch + ~50 untracked files | medium |
| Secrets in tracked files | **0** | ✅ clean |

Overall: repo is in **good shape**. The major cleanups have already been done in the previous mission. Remaining items are minor.

---

## Stray Files

Command results from `find` on the working tree (excluding `node_modules/`, `.next/`, `dist/`):

| Pattern | Count | Action | Notes |
|---------|-------|--------|-------|
| `*.log` | 0 | — | none found |
| `*.bak` / `*.orig` / `*.tmp` | 0 | — | none found |
| `.DS_Store` | 0 | — | none found |
| `*.swp` / `*~` (vim/emacs) | 0 | — | none found |
| `Thumbs.db` | 0 | — | none found |
| `*.pid` (process files) | 0 | — | none found |
| `*.tsbuildinfo` | 1 | KEEP | `app/tsconfig.tsbuildinfo` — already in `.gitignore` (line 60), not a stray |

**Verdict: clean.** No action required.

---

## Empty Directories (4)

| Path | Created | Notes | Action |
|------|---------|-------|--------|
| `.opencode/archive/` | 2026-06-13 01:40 | Reserved place for old session state, never populated | DELETE (or use as designed) |
| `.opencode/plugins/` | 2026-06-13 01:40 | Reserved for plugin state, never populated | DELETE (or use as designed) |
| `.opencode/audit-2026-06-13/` | 2026-06-13 01:40 | Empty (audit artifacts went to `docs/archive/audit-2026-06-13/` instead) | DELETE |
| `docs/archive/audit-2026-06-13/screenshots-v2/` | 2026-06-13 03:36 | Empty placeholder for "v2" screenshots, never populated | DELETE |

> **Excluded from findings:** `.opencode/audit-2026-06-13v2/` is the intentional target directory for this audit's output (currently empty before this report is written).

---

## Redundant Docs

### Already-archived legacy reports (good — left in `docs/archive/`)

| Path (in `docs/archive/`) | Size | Date | Notes |
|--------------------------|------|------|-------|
| `AUDIT-CORRECTIONS-2026-06-03.md` | 4.8 KB | 2026-06-12 | Old audit corrections log |
| `AUDIT-REPORT-2026-06-02.md` | 41 KB | 2026-06-12 | Old site audit |
| `MVP-DOCUMENTATION.md` | 13 KB | 2026-06-12 | Superseded by `docs/API-DOCUMENTATION.md` (v2.1.0) |
| `PRODUCTION-READINESS-REPORT.md` | 12 KB | 2026-06-12 | Old readiness report |
| `audit-port3000.jpeg` | 39 KB | 2026-06-12 | Old screenshot |

**Action: KEEP** — these were intentionally archived in the previous mission's commit `d5f7911` and the `R` renames in pending index. They serve as historical record.

### Already-archived audit artifacts (`docs/archive/audit-2026-06-13/`)

87 files, 12 MB total, organized as:

| Subdir | Files | Size | Notes |
|--------|-------|------|-------|
| `code-quality.md` + `filesystem-audit.md` | 2 | 25 KB | The actual audit reports |
| `final_runs/run_001/` | 21 | ~3 MB | Python script + 18 screenshots + 2 logs from the final visual sweep |
| `plan.md` | 1 | 1.4 KB | The audit plan |
| `screenshots-agent-browser/` | 34 PNGs | 2.8 MB | before/after pairs (`-FIXED.png` + original) for 17 pages |
| `screenshots-final/` | 19 PNGs | 5.3 MB | Final post-fix screenshots, one per page |
| `screenshots-v2/` | 0 | 0 | **EMPTY — see empty dirs above** |
| `verification/` | 9 PNGs | 520 KB | After-fix verification shots (named `NN-page-after.png`) |

**Action: KEEP** — these are the forensic record of the 2026-06-13 audit cycle.

### Real duplications (active code)

| Path A | Path B | Type | Issue | Action |
|--------|--------|------|-------|--------|
| `app/public/llms.txt` (69 lines) | `app/src/app/llms.txt/route.ts` (route with hardcoded `BODY = ...`) | Static file + Next.js API route | **Both serve identical content at `/llms.txt`.** Next.js public files take precedence over app-router routes, so the route is dead code. The static file is the canonical one. | DELETE `app/src/app/llms.txt/route.ts` (and its directory `app/src/app/llms.txt/`), keep `app/public/llms.txt`. |
| `app/public/llms.txt` (69 lines, short version) | `app/public/llms-full.txt` (1600 lines, full version) | Two static files | **NOT a duplicate** — short vs. long marketing copy. Both are referenced by `app/src/app/llms.txt/route.ts` and by the `<link rel="alternate">` in the landing page. | KEEP both |

### Active `docs/` files — review for staleness

| File | Last edit | Status | Notes |
|------|-----------|--------|-------|
| `docs/API-DOCUMENTATION.md` | 2026-06-12 | v2.1.0 | KEEP — current |
| `docs/BRAND-MESSAGING.md` | 2026-06-12 | v2.0.1 | KEEP — current |
| `docs/CRITICAL-1-DEPLOYMENT-RUNBOOK.md` | 2026-06-12 | **Has BROKEN link** | See below |
| `docs/DEVELOPER-GUIDE.md` | 2026-06-13 | Most recent edit | KEEP — current |
| `docs/INTERNAL-SOURCING.md` | 2026-06-12 | "live as of 2026-06-12 refactor" | KEEP, but flag for review if 2026-06-12 changes invalidate it |
| `docs/MOTION-DESIGN-REF.md` | 2026-06-12 | v1 | KEEP — current |
| `docs/OMA-X402-CROSSCHAIN-ARCHITECTURE.md` | 2026-06-12 | v1 | KEEP — current |

---

## Orphan Assets

### `app/public/` (all 11 files referenced — clean)

| File | Referenced by | Action |
|------|---------------|--------|
| `favicon.png` + `favicon.svg` | `app/src/app/layout.tsx` (icons.metadata) | KEEP |
| `oma-logo.svg` | `app/src/components/oma-logo.tsx` + navbar/footer | KEEP |
| `logos/logo.png` | model/page, about page | KEEP |
| `logos/oma-logo.svg` | footer/navbar fallback | KEEP |
| `logos/unknown.svg` | model fallback for unknown provider | KEEP |
| `llms.txt` (short) | route + landing page | KEEP — but see duplication note above |
| `llms-full.txt` (long) | route + landing page | KEEP |
| `screenshots/oma_live_mcps.jpg` | marketing surfaces | KEEP |
| `screenshots/oma_live_pricing.jpg` | marketing surfaces | KEEP |
| `screenshots/oma_screenshot_fullpage_postfix.png` | marketing surfaces | KEEP |

**Verdict: no orphan assets in active tree.**

### Suspect asset in archive

| File | Size | Issue | Action |
|------|------|-------|--------|
| `docs/archive/audit-2026-06-13/screenshots-final/17-image-gen.png` | **3,421 bytes** | All other screenshots in the same dir are 150KB-870KB. This one is 1-2 orders of magnitude smaller, strongly suggesting it's a broken render, error page, or empty placeholder. | Investigate. If broken render, DELETE. If intentional "page not capturable" placeholder, keep but add a README note. |

### PNGs outside `public/` and `node_modules/`

84 PNGs total. **All 84 are in `docs/archive/`** — properly archived, no orphans in the active tree.

### Build artifacts (on disk, properly gitignored)

| Path | Size | In `.gitignore`? | Action |
|------|------|-------------------|--------|
| `server/dist/` (compiled `.js` + `.d.ts`) | n/a | YES (line 11) | KEEP — local build output, correctly ignored |
| `app/.next/` (Next.js build) | n/a | YES (line 12) | KEEP — local build output, correctly ignored |
| `app/tsconfig.tsbuildinfo` | small | YES (line 60) | KEEP — gitignored correctly |

---

## Outdated Config

### 1. `docs/CRITICAL-1-DEPLOYMENT-RUNBOOK.md` — BROKEN link

Line 6 references:
```
See screenshot `docs/screenshots/audit-2026-06-02/00-production-url-mismatch.png`.
```

But this file was moved to `docs/archive/screenshots/audit-2026-06-02/00-production-url-mismatch.png` in the rename batch (still pending index).

**Action:** Update the runbook to point to the archived path, or add a redirect note. The runbook itself is also status-frozen at 2026-06-03 ("BLOCKER") and may need a re-verification section since the domain might be live now.

### 2. `server/scripts/vulnerability-report.json` — stale

`timestamp: "2026-05-26T15:10:53.215Z"` — 18 days old.

Not a code-level problem (it IS the output of `server/scripts/vuln-monitor.cjs` running `npm audit --json`), but the data is stale.

**Action:** Rerun `node server/scripts/vuln-monitor.cjs` to refresh. Optionally move the file to `server/reports/` or add to `.gitignore` (currently tracked, so it shows up in git diffs).

### `AGENTS.md` and `README.md`

Both are **current and accurate**:
- `AGENTS.md` (10,902 bytes) — last edited 2026-06-13 02:59, includes the dual `.vercel/project.json` note, vitest version drift, env example authoritative rule
- `README.md` (7,695 bytes) — last edited 2026-06-12, lists all features and quick start

**No action required** for either.

---

## Git Hygiene

### Working tree state

```
Your branch is ahead of 'origin/master' by 1 commit.   (commit d5f7911 not pushed)
```

**Pending renames** (7 files, already staged):
- `app/lighthouse.json` → deleted (good, was in `.gitignore` already)
- `docs/AUDIT-CORRECTIONS-2026-06-03.md` → `docs/archive/...`
- `docs/AUDIT-REPORT-2026-06-02.md` → `docs/archive/...`
- `docs/MVP-DOCUMENTATION.md` → `docs/archive/...`
- `audit-port3000.jpeg` → `docs/archive/...`
- `docs/screenshots/audit-2026-06-02/00-production-url-mismatch.png` → `docs/archive/...`
- `docs/screenshots/error-runs-2026-05-28` → `docs/archive/screenshots/error-runs-2026-05-28.png` (with extension fix)
- `docs/screenshots/test-runs-2026-05-22` → `docs/archive/screenshots/test-runs-2026-05-22.png` (with extension fix)

**Action: complete the commit** (these are in staged state but the working tree also has uncommitted modifications to many other files, so the commit may need staging in two parts).

### Uncommitted modified files (24)

Largest categories: `app/src/app/{page,admin,dashboard,image-generation,settings}/*` UI tweaks, `app/src/components/{ui/*,navbar,wallet-provider}*`, `server/src/{inference,lib,middleware,routes}/*` and several test files, plus `app/next.config.ts`, `app/globals.css`, `server/src/config.ts`, `server/src/auth/*`.

**Action: review and commit in logical chunks.** Not a hygiene violation per se, but represents significant uncommitted work.

### Untracked but likely-needed files (~50+)

Two clean categories:

**Legitimately new work** (represent new functionality that should be committed):
- `app/src/app/admin/{layout.tsx,users/page.tsx}` — new admin section
- `app/src/app/api/{admin/observability,v1/deposit,v1/privacy,v1/search,v1/surplus,v1/videos}/` — new API routes
- `app/src/app/compare/{loading.tsx,surplus-min-discount-routing/}` — new compare routes
- `app/src/app/dashboard/{api-keys,credits}/loading.tsx` — new loading states
- `app/src/app/docs/{_components,data.ts,docs-client.tsx,layout.tsx}` — new docs sub-app
- `app/src/app/faq/` — new FAQ section
- `app/src/app/{deposit,image-generation,privacy,settings,terms,video-generation}/loading.tsx` — new loading states
- `app/src/app/playground/_components/` — new playground components
- `app/src/components/AuthNotice.tsx` + `app/src/components/ui/charts/shared.tsx`
- `app/src/lib/{api/credits.ts,api/oma.ts,config.ts,logger.ts,webpack-stubs/}` — new lib modules
- `app/scripts/og-image-generate.mjs` — new helper
- `app/src/middleware.ts` (modified)
- `server/src/__tests__/{credits-modules,cron-jobs,dlq,middleware,settlement-retry,sliding-window,token-bucket-middleware,x402-facilitator}.test.ts` — new test files
- `server/src/db/{migrations/,seed.ts}` — new DB layer
- `server/src/inference/markup.ts` — new inference module
- `server/src/lib/{privacy.ts,url-safety.ts}` — new lib modules
- `server/src/middleware/metrics.ts` — new middleware
- `server/src/routes/{__tests__/,admin-observability,health,metrics,openapi,ping,usage}.ts` — new routes
- `server/src/x402/{receipt.ts,settlement-cache.ts}` — new x402 modules
- `scripts/blockchain-bootstrap.mjs` — new helper
- `docs/INTERNAL-SOURCING.md` — new doc
- `docs/archive/audit-2026-06-13/` — entire archived audit (intentional, see docs section)

**Action: stage + commit in functional groups.** This is significant uncommitted work (~50 files, ~3-5K LOC new code) that should not be left dangling.

### `.gitignore` review

Comprehensive. Covers:
- Build artifacts: `node_modules/`, `dist/`, `.next/`, `coverage/`, `.hallmark/`, `*.tsbuildinfo`
- Env: `.env`, `.env.local`, `.env.production`, `.env.development`, `*.env.local`
- OS noise: `.DS_Store`, `Thumbs.db`
- Wildcard: `*.log`
- Test artifacts: `e2e_screenshots/`, `test-screenshots/`, `e2e_test.py`, `test_*.py`, `screenshot_*.py`
- Project-specific: `audit_*/`, `audit_results_*/`, `*_audit*.md`, `*_AUDIT*.md`, `*REPORT*.md`, `*VALIDATION*.md`, `*.png`/`*.jpg` (with `!app/public/**` and `!public/**` exceptions)
- App builds: `app/lighthouse.json`, `app/.lighthouseci/`, `app/tsconfig.tsbuildinfo`
- Webwright: `webwright_audit/`
- Vercel: `.vercel`

**One minor concern:** `*.png` / `*.jpg` is broadly ignored, but `docs/archive/screenshots/*.png` and `docs/archive/audit-2026-06-13/screenshots-*/**/*.png` are properly tracked (presumably they were `git add -f`'d or the ignore only matches root). The fact that the archived PNGs ARE in git is correct — they're evidence, not noise.

**Action: none required for `.gitignore`.**

### Secrets scan

`grep -E "(sk-[a-zA-Z0-9]{20,}|private[_-]?key|password[_-]?[=:]|secret[_-]?[=:])"` on tracked files (excluding `.env.example*`, test fixtures): **no real secrets found.**

- Schema fields named `secret` (e.g., `db.schema.ts:secret: text("secret")`) — legitimate
- `password: z.string().min(1)` in auth route — Zod schema definition, not a value
- `SURPLUS_WALLET_PRIVATE_KEY: "test-private-key"` in `server/src/inference/__tests__/surplus.test.ts` — test fixture, not a real key
- `server/dist/*.d.ts` hits — local build output, gitignored

**Verdict: clean.** No real secrets in tracked files.

---

## Recommendations (Priority Order)

### High priority
1. **Fix the broken screenshot link** in `docs/CRITICAL-1-DEPLOYMENT-RUNBOOK.md` — update the path from `docs/screenshots/audit-2026-06-02/...` to `docs/archive/screenshots/audit-2026-06-02/...` (or add a redirect note).
2. **Delete the duplicate `/llms.txt` route** at `app/src/app/llms.txt/route.ts` (and its directory) — the static `app/public/llms.txt` takes precedence and is canonical.

### Medium priority
3. **Remove the 4 empty directories**:
   - `.opencode/archive/`
   - `.opencode/plugins/`
   - `.opencode/audit-2026-06-13/` (the v2 in `.opencode/audit-2026-06-13v2/` is this report's target)
   - `docs/archive/audit-2026-06-13/screenshots-v2/`
4. **Commit the pending renames** (currently in staged state with `R` in git index).
5. **Commit the ~50 untracked new files** in logical groups (admin pages, API routes, server tests, etc.).
6. **Re-run `node server/scripts/vulnerability-report.json`** to refresh 18-day-old data, or move it to `.gitignore` and only generate on demand.

### Low priority
7. **Investigate `17-image-gen.png`** (3,421 bytes — anomalously small vs. siblings of 150-870KB). Likely a broken render, but check before deleting.
8. **Update `docs/CRITICAL-1-DEPLOYMENT-RUNBOOK.md`** status section to re-verify the 2026-06-03 BLOCKER is still valid (or close it out if the domain is now live).
9. **Review `docs/INTERNAL-SOURCING.md`** for staleness given the 2026-06-12 refactor.

### No action
- `.gitignore` is comprehensive and correctly excludes build artifacts, env files, OS noise, and project-specific test/audit artifacts.
- No stray `.log`, `.bak`, `.tmp`, `.DS_Store`, `.swp`, or `Thumbs.db` files anywhere in the working tree.
- No real secrets in any tracked file.
- `app/public/` has 11 files, all referenced — no orphan assets.
- `AGENTS.md` (10,902 bytes) and `README.md` (7,695 bytes) are current and accurate.

---

## Audit Artifacts

- **Working tree size:** 22 dirs at root, 128 entries in root `ls -la`
- **Total files in `docs/archive/`:** 95 (13 MB on disk)
- **Total PNGs outside `public/`/`node_modules/`:** 84 (all in `docs/archive/`)
- **Tracked vs untracked in working tree:** ~24 modified, ~50 untracked, 7 staged-rename, 1 commit ahead
- **Empty directories found:** 4 (excluding the report target `.opencode/audit-2026-06-13v2/`)
- **Audit duration:** ~5 min, all read-only operations
