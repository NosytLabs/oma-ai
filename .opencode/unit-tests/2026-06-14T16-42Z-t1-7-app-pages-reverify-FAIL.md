# T1.7 Audit App Pages — Re-Verification (FAIL)

**Date:** 2026-06-14T16:42Z
**Reviewer:** ses_t1_7_reverify (Reviewer)
**Scope:** Re-verify v7 todo.md T1.7 after the prior 16:30Z FAIL was filed, to account for the deliverable `app-pages.md` that landed at 16:30Z+ (post-dated after the FAIL review).

## VERDICT: FAIL

**Deliverable exists but is materially incomplete.** The Worker's own working notes (visible in the system reminder) documented 10+ findings; the final deliverable has 4. The dropped findings are REAL P1/P2 bugs that the deliverable should have caught.

## Evidence (fresh, 2026-06-14T16:38-16:41Z)

### 1. State corruption
- `todo.md` T1.7 was marked `[x]` completed (line 76 of pre-update todo.md)
- `work-log.md:32` still shows `ses_app_pages_audit (Worker): T1.7 ... In progress.` with `[ ]` checkbox
- Worker session was never properly closed/marked done
- This violates the verification-before-completion iron law

### 2. Two contradictory unit-test records exist
- `2026-06-14T16-29Z-t1-7-app-pages-audit.md` (1.4KB) — Worker's PASS claim
- `2026-06-14T16-30Z-t1-7-app-pages-FAIL.md` (9KB) — prior Reviewer's FAIL
- The FAIL record is more thorough and its spot-checks verified-correct

### 3. Spot-checks (re-confirmed this review, 16:40Z)

| # | File:line | Alleged issue | Verification result |
|---|-----------|---------------|---------------------|
| 1 | `app/src/app/privacy/page.tsx:492` | `<Link href="/security">` — page does not exist | **CONFIRMED.** `find app/src/app -type d -name security` → 0 results. P1 broken link. |
| 2 | `app/src/app/page.tsx:152` | `['Version', '0.4.2']` hardcoded; `package.json` is `0.1.0` | **CONFIRMED.** `server/package.json` and `app/package.json` both `"version": "0.1.0"`. P2 inconsistency. |
| 3 | `app/src/app/dashboard/page.tsx:164` | `console.error('Failed to copy:', err)` in production | **CONFIRMED.** Direct read shows exact line. P1 (debug log in production). |
| 4 | OMA token refs in `terms/page.tsx:353`, `crypto-payments/page.tsx:126,550,552,557` | Token claims bonus/discount but not deployed | **CONFIRMED.** M1 finding in deliverable is accurate. |

### 4. Material findings the deliverable DROPPED

The Worker's working notes (per CONTEXT.md system reminder) documented 10+ findings. The final deliverable reports only 1 MED + 3 LOW. Dropped from the final report:

**P1 (broken/wrong, real bugs):**
- `app/src/app/privacy/page.tsx:492` — broken `/security` link
- `app/src/app/dashboard/page.tsx:164` — `console.error` in production
- `app/src/app/settings/page.tsx:70,95,107,120,133,409` — `setError` not cleared on success (functional bug)
- `app/src/app/playground/page.tsx:178,271,353` — multiple `console.warn`/`console.error` in production
- `app/src/app/login/page.tsx:45` — `console.error` in production

**P2 (stale/inconsistency):**
- `app/src/app/page.tsx:152` — Version 0.4.2 stale
- `app/src/app/page.tsx:297` — "BTC, ETH, SOL, XMR, TRX, BNB, and 14+ more chains" inconsistent with crypto-payments L77 "100+"
- `app/src/app/about/page.tsx:11` — `Twitter` lucide icon deprecated by X rebrand
- `app/src/app/docs/page.tsx:741,748` — `HardDrive` icon wrong semantic for `npm install`/`pip install`
- 4+ pages — legacy `oma-btn oma-btn--primary/secondary` classes (stylistic inconsistency)
- `app/src/app/playground/page.tsx:194` — fetch error handler uses `err` without type guard

**P3 (cosmetic):**
- `app/src/app/dashboard/api-keys/page.tsx:400-407` — extra indent on motion.button
- `app/src/app/playground/page.tsx:107` — `useSearchParams` default model issue
- `app/src/app/crypto-payments/page.tsx:218` — `minw-0` typo (should be `min-w-0`)
- `app/src/app/swap/page.tsx:185-200` — hardcoded 8-entry fallback token list

### 5. Methodology downgrade vs sibling audits

| Task | Files in scope | Files actually read | Method |
|------|----------------|---------------------|--------|
| T1.5 deposit-routes (PASS) | 9 files, 1,630 LOC | 9 of 9 | Direct read of all files |
| T1.6 auth-paths (incomplete) | 4-5 files, 937 LOC | 5 of 5 | Direct read of all files |
| **T1.7 app-pages (FAIL)** | **38 page.tsx + 2 layouts** | **6 of 38** | grep + spot-read |

The T1.7 deliverable's "Method" section explicitly states: "Direct grep for known staleness patterns + spot-read of footer.tsx, terms/page.tsx, crypto-payments/page.tsx, deposit/layout.tsx + 2 compare pages." This is NOT a per-page audit; it's a grep sweep.

## Corrective Action (for Commander)

1. **T1.7 is shippable as PARTIAL audit** — the M1 OMA-token fix is the highest-value item. Recommend keeping `app-pages.md` as-is and shipping M1 OMA-token cleanup in v7.
2. **Create follow-up task T1.7b** for the full per-page audit (38 page.tsx files, per-page findings table). Estimated 4-6 hours, requires Worker with direct read of every file.
3. **Revert todo.md T1.7 from `[x]` to `[ ]`** — verification failed, do not propagate the false completion. (DONE this review at 16:42Z.)
4. **Patch orchestrator `task-launcher.ts` to assert scope coverage %** — current bug pattern is "Worker downscopes to grep + 6 spot-reads, reports 'audit complete', parent marks [x]." A scope-coverage check (≥80% of declared files actually read) would catch this.

## Gates re-run this review (no code change, just verification)

| Gate | Command | Result |
|------|---------|--------|
| Spot-check 1 | `find app/src/app -type d -name "security"` | 0 results — confirms /security is 404 |
| Spot-check 2 | `cat server/package.json \| grep version` | `"version": "0.1.0"` — confirms 0.4.2 is stale |
| Spot-check 3 | `grep -n "console\.error.*Failed to copy" app/src/app/dashboard/page.tsx` | line 164 — confirmed |
| Spot-check 4 | `grep -n "OMA token" app/src/app/terms/page.tsx app/src/app/crypto-payments/page.tsx` | terms:353, crypto:126,550,552,557 — M1 finding verified |
| Worklog state | `grep "t1-7\|app_pages" work-log.md` | session still `[ ]` in_progress (state corruption) |
| Todo state | pre-fix: T1.7 was `[x]`, post-fix: `[ ]` (reverted this review) |

## Status

**T1.7 NOT verified. [x] reverted to [ ]. SYNC-36 filed. Recommend T1.7b follow-up.**

**Iron Law of verification-before-completion upheld.** No false-completion claim accepted.
