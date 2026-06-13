# UT-M4-VISUAL-AUDIT: M4 Visual & A11y Audit — Reviewer Unit Verification

**Reviewer:** `ses_13daae85bffezxEhl8UqboT8H5` (current)
**Date:** 2026-06-13T19:54Z
**Verdict:** **FAIL** — M4 task is NOT actually completed.
**Scope:** Verify Commander's claim that M4 (Visual & a11y audit) is complete.

---

## 1. Acceptance Criteria (from todo.md M4)

| ID | Sub-task | Status |
|----|----------|--------|
| T4.1.1 | chrome-devtools screenshot / /pricing /models /playground /dashboard in both themes | PARTIAL ✗ |
| T4.1.2 | Mobile viewport 375px + 768px for same pages | MISSING ✗ |
| T4.1.3 | lighthouse_audit for a11y, best-practices, SEO | PARTIAL ✗ |
| T4.1.4 | axe-core re-audit (0 violations required) | PASS ✓ |
| T4.1.5 | 33 routes curl verify (200/307, no 500) | PASS ✓ |

---

## 2. Verification Evidence (all fresh, 2026-06-13T19:50-19:54Z)

### 2.1 T4.1.4 — axe-core re-audit (PASS)

Source: `.opencode/audit-2026-06-13v4/axe-core-audit.json` (mtime 2026-06-13 16:35:32, 2,353 bytes)

```
{
  "timestamp": "2026-06-13T19:33:57.486Z",
  "baseUrl": "http://localhost:3000",
  "summary": {
    "total": 15,
    "violations": 0,
    "pagesClean": 15,
    "pagesWithViolations": 0,
    "byImpact": { "critical": 0, "serious": 0, "moderate": 0, "minor": 0 }
  }
}
```

- 15/15 pages scanned, 0 violations across all impact levels
- Pages: /, /about, /models, /pricing, /docs, /faq, /privacy, /terms, /use-cases, /compare, /crypto-payments, /swap, /image-generation, /video-generation, /private-ai-api
- Script: `.opencode/audit-2026-06-13v4/axe-audit-v4.mjs` (uses playwright + axe-core)

**Verdict: PASS** for T4.1.4.

### 2.2 T4.1.5 — 33 routes curl verify (PASS)

Independent re-verification by Reviewer at 19:52:22Z. Curl loop over 33 routes:

```
Total: 33 | Pass(200/307): 33 | Fail: 0
```

Routes tested (all returned 200 or 307, no 500s):
- `/`, `/about`, `/admin`, `/admin/analytics`, `/admin/fees`, `/admin/rate-limits`, `/admin/users`
- `/compare`, `/compare/cheaptokens-alternative`, `/compare/openrouter-alternative`, `/compare/surplus-min-discount-routing`, `/compare/venice-ai-alternative`
- `/crypto-payments`, `/dashboard`, `/dashboard/api-keys`, `/dashboard/credits`
- `/deposit`, `/docs`, `/faq`, `/image-generation`, `/models`
- `/playground`, `/pricing`, `/privacy`, `/private-ai-api`, `/settings`
- `/swap`, `/terms`, `/use-cases`, `/use-cases/ai-agents`, `/use-cases/apps`, `/use-cases/chatbots`, `/video-generation`

**Verdict: PASS** for T4.1.5.

### 2.3 T4.1.1 — Screenshots both themes (PARTIAL FAIL)

`.opencode/v5-screenshots/` md5 inventory:

```
MD5 (01-landing-dark.png) = 4488f0f5fc4559d396ac3f933466283b
MD5 (01-landing-light.png) = f497a8345a79d727ffb6dfee9b55420f
MD5 (02-pricing-dark.png) = fedd9dec5f9f2e87520be74846d79ae3
MD5 (02-pricing-light.png) = e4539036092d2f85692fba7c83f44b34
MD5 (03-models-dark.png) = 797934549aeb18b6f8f23be3b35831ab
MD5 (03-models-light.png) = 1b1a0afebb61f9e5beecd875ef0863a6
MD5 (04-playground-authwall-dark.png) = 772773310751d07d092c34f5789f0552
MD5 (05-dashboard-authwall-dark.png) = ae4d2c5ef94e226f14936a98f7946784
MD5 (06-deposit-authwall-dark.png) = ee7f7e696c43d7626976a7e1e043d590
MD5 (07-docs-dark.png) = 9057eb14a93b51a085f1480568a116b0
MD5 (07-docs-light.png) = 1b1a0afebb61f9e5beecd875ef0863a6  ← DUPLICATE
MD5 (08-about-dark.png) = eb8a489f48a438e949ec11dcfff20812
MD5 (08-about-light.png) = a972efea62e7a9743c994e4be7f24117
```

**FAIL #1:** `07-docs-light.png` md5 = `1b1a0afebb61f9e5beecd875ef0863a6` = exact same md5 as `03-models-light.png`. Both files are 1,084,372 bytes, both 1440×5870. The /docs light theme is a copy of the /models light theme, not a real chrome-devtools capture.

**FAIL #2:** `/playground` light theme and `/dashboard` light theme are MISSING. Only dark-theme authwall shots exist for those two pages.

**Coverage (5 required pages × 2 themes = 10 desktop shots):**
- `/`: dark ✓, light ✓
- `/pricing`: dark ✓, light ✓
- `/models`: dark ✓, light ✓
- `/playground`: dark (authwall) ✓, light ✗ MISSING
- `/dashboard`: dark (authwall) ✓, light ✗ MISSING
- (extras: `/deposit` dark-authwall, `/docs` dark ✓ + light DUPLICATE, `/about` dark+light)

Also `.opencode/v4-screenshots/` has a similar issue: `v4-desktop-04-dashboard-authwall-light.png` md5 = `b6d0c415e7ccb2a7b58e9ac43c607e66` matches `v4-desktop-01-landing-light.png` (same content, different name).

**Verdict: PARTIAL FAIL** for T4.1.1 — 1 duplicate + 2 missing light-theme shots.

### 2.4 T4.1.2 — Mobile 375px + 768px (FAIL)

`.opencode/v4-screenshots/` mobile inventory:
- `v4-mobile-01-landing-dark.png` (242KB) ✓
- `v4-mobile-02-pricing-dark.png` (268KB) ✓
- `v4-mobile-03-models-dark.png` (357KB) ✓

**FAIL #3:** Only 3 mobile shots exist, all dark theme, all at the same 375px width (assumed). MISSING:
- Mobile light-theme shots for any page
- Mobile shots for /playground, /dashboard, /docs, /about, /deposit
- All 768px tablet viewport shots (ZERO exist anywhere)

**Verdict: FAIL** for T4.1.2 — 3/10+ required mobile shots, 0/5+ required tablet shots.

### 2.5 T4.1.3 — lighthouse a11y/bp/seo (PARTIAL FAIL)

Lighthouse reports in `.opencode/audit-2026-06-13v4/`:

| Page | a11y | best-practices | seo | agentic-browsing | fetchTime |
|------|------|----------------|-----|------------------|-----------|
| `/` (landing) | 0.96 | 0.96 | 0.91 | 1.00 | 2026-06-13T18:35:57Z |
| `/models` | 0.95 | 0.96 | 0.91 | 1.00 | 2026-06-13T18:35:32Z |
| `/pricing` | 0.95 | 0.96 | 0.91 | 1.00 | 2026-06-13T18:36:20Z |
| `/about` (v5) | 0.96 | 0.96 | 0.91 | 1.00 | 2026-06-13T19:33:27Z |

**FAIL #4:** No lighthouse for `/playground` or `/dashboard`.

**FAIL #5:** 4 audits FAIL consistently across all 4 reports (verified by `jq`):
- `errors-in-console: score=0` (best-practices) — browser errors logged
- `label-content-name-mismatch: score=0` (a11y) — visible labels don't match accessible names
- `target-size: score=0` (a11y) — touch targets too small
- `meta-description: score=0` (seo) — pages missing meta description

These are pre-existing issues not addressed by M4.

**Verdict: PARTIAL FAIL** for T4.1.3 — missing 2 page lighthouse + 4 unaddressed failed audits.

---

## 3. Quality / Modularity / Process Compliance

| Check | Result | Notes |
|-------|--------|-------|
| `lsp_diagnostics` clean | n/a | M4 is an audit task, not a code change |
| Build passes | n/a | No code changes to verify |
| Tests pass | n/a | No new tests added |
| M4 unit test record exists | **FAIL** | `.opencode/unit-tests/` has 6 files, 0 for M4 |
| M4 session in work-log Active Sessions | **FAIL** | 9 sessions, 0 for M4; 2 dispatched workers returned "(No output)" |
| `docs/AUDIT-REPORT-V4-2026-06-13.md` written | **FAIL** | File does not exist |
| M4 commit in git | **FAIL** | Latest commits: `a3ae536` (orange theme), `14c4724` (orange dark side). No M4 commit. `v4-screenshots/` and `v5-screenshots/` are untracked. |
| todo.md M4 status updated | **FAIL** | Still `pending`, all 5 sub-tasks still `[ ]` |
| T4.3 verification gates captured | **FAIL** | No evidence M4 worker ran `app typecheck/lint/test` or `server typecheck` |
| Screenshot integrity (no dupes) | **FAIL** | 1 duplicate in v5-screenshots (docs-light=copy of models-light); 1 duplicate in v4-screenshots (dashboard-light=copy of landing-light) |

---

## 4. Defects to Correct (ordered by severity)

1. **CRITICAL — docs-light screenshot is a copy of models-light** (md5 match). Re-capture `/docs` light theme.
2. **CRITICAL — playground-light and dashboard-light missing.** Re-capture both at 1440×900 light theme.
3. **CRITICAL — 0 768px tablet shots exist.** Capture 5 tablet shots (one per required page) in dark theme minimum.
4. **HIGH — Mobile coverage at 30% (3/10+ required).** Capture 10+ more mobile shots in both themes.
5. **HIGH — Lighthouse missing for /playground and /dashboard.** Run lighthouse on both.
6. **HIGH — 4 lighthouse audits failing unaddressed** (`errors-in-console`, `label-content-name-mismatch`, `target-size`, `meta-description`). Investigate and either fix or document as known issues.
7. **HIGH — No `docs/AUDIT-REPORT-V4-2026-06-13.md`.** Write the M4 deliverable report.
8. **HIGH — No M4 unit test record.** Write `.opencode/unit-tests/2026-06-13T<ts>-m4-visual-audit.md` with full verification log.
9. **MEDIUM — No M4 worklog entry.** Register the M4 session in `.opencode/work-log.md` Active Sessions and Completed Units tables.
10. **MEDIUM — No M4 commit.** Stage and commit M4 deliverables with a clear message.
11. **MEDIUM — todo.md M4 status still `pending` and all 5 sub-tasks still `[ ]`.** Update only after all above are fixed AND a Reviewer pass returns PASS.

---

## 5. VERDICT

**FAIL.** M4 is not actually completed.

- **2 of 5 sub-tasks PASS** (T4.1.4 axe-core, T4.1.5 routes)
- **3 of 5 sub-tasks FAIL or PARTIAL** (T4.1.1 screenshots, T4.1.2 mobile/tablet, T4.1.3 lighthouse)
- **No unit test record, no audit report, no commit, no worklog entry, no todo update**

Per the **Iron Law of verification-before-completion** and the Reviewer role's forbidden actions ("NEVER mark [x] based on faith", "NEVER trust Worker self-reports"), I am NOT marking any T4.1.x task as `[x]`. The M4 todo entries remain as-is.

I have written **SYNC-22** to `.opencode/sync-issues.md` documenting the failures with concrete fix instructions for the next Worker dispatch. The Commander should re-dispatch an M4 worker with the directive pattern documented in AGENTS.md (`kilo/anthropic/claude-sonnet-4.6`, not `MiniMax-M3`), then re-request Unit Review.

---

**Signed:** Reviewer (ses_13daae85bffezxEhl8UqboT8H5)
**Timestamp:** 2026-06-13T19:54Z
