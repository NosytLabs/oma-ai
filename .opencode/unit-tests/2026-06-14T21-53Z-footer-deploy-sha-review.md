# Unit Review: Footer last-deploy SHA wiring (v8 re-verify)

**Reviewer:** Reviewer agent (current session)
**Date:** 2026-06-14T21:53Z
**Source unit:** v7 T4.3 / `ses_footer_sha_verify` (16:47Z) — re-verified under v8 dispatch
**File under review:** `app/src/components/footer.tsx:139`

---

## 1. Acceptance Criteria

| Criterion | Required | Observed | Pass? |
|-----------|----------|----------|-------|
| `last deploy` is build-time, not runtime | yes | Uses `process.env.NEXT_PUBLIC_BUILD_DATE` (Next.js inlines at build) | ✓ |
| `build` shows GitHub short SHA (7 chars) | yes | `process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7)` | ✓ |
| Defensive fallback for missing env | yes | Both use `?? 'dev'` | ✓ |
| Pattern consistent with rest of app | yes | Matches `navbar.tsx:86` + 6 page files (`privacy`, `faq`, `terms`, `about`, `compare`, `crypto-payments`) | ✓ |
| lsp_diagnostics clean | yes | "All clean!" | ✓ |
| typecheck passes | yes | 0 errors (server + app) | ✓ |
| lint passes | yes | 0 errors (server + app) | ✓ |
| tests pass | yes | server 73/73 files 863/863, app 7/7 files 81/81 | ✓ |

---

## 2. Diff (from `git diff`)

```diff
diff --git a/app/src/components/footer.tsx b/app/src/components/footer.tsx
@@ -136,7 +136,7 @@ export function Footer() {
         <div className="mt-10 pt-5 border-t border-[var(--color-border)] text-[10px] text-[var(--color-text-muted)] leading-relaxed">
           <p>
-            © {year} OMA AI · base chain // one man army · build {process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev'} · last deploy {new Date().toISOString().slice(0, 10)}
+            © {year} OMA AI · base chain // one man army · build {process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'dev'} · last deploy {process.env.NEXT_PUBLIC_BUILD_DATE ?? 'dev'}
           </p>
```

**Two surgical changes on one line:**
1. `process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev'` → `process.env.NEXT_PUBLIC_BUILD_SHA?.slice(0, 7) ?? 'dev'` — slice to 7 chars (GitHub convention)
2. `new Date().toISOString().slice(0, 10)` → `process.env.NEXT_PUBLIC_BUILD_DATE ?? 'dev'` — runtime → build-time

---

## 3. Cross-codebase consistency check (grep)

```
app/src/components/footer.tsx:139      ← this fix
app/src/components/navbar.tsx:86        ← exact same SHA pattern
app/src/app/{privacy,faq,terms,about,compare,crypto-payments}/page.tsx (6 files)
  each line 26-39:  const BUILD = (process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev').slice(0, 7)
app/.env.local:4:   NEXT_PUBLIC_BUILD_SHA=dev   ← dev fallback configured
```

**Verdict:** The footer now matches the established codebase pattern. No drift.

---

## 4. Code Quality Assessment

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| Correctness | ✓ | Build-time env vars inlined at build, runtime `new Date()` eliminated |
| Modularity | ✓ | Single-line change, no new abstractions, no new files |
| Defensive | ✓ | Both env vars have `'dev'` fallback for local dev / unset CI |
| Idiomatic | ✓ | Optional chaining + nullish coalescing — matches `navbar.tsx:86` |
| Side effects | none | Pure JSX change |
| Security | ✓ | No new attack surface (env vars are public-by-design in Next.js) |
| Performance | ✓ | No new runtime cost; `new Date()` was per-render cost eliminated |
| A11y | unchanged | No aria/role changes |

**No defects found. No refactoring required.**

---

## 5. Deployment Concern (non-blocking, not a code defect)

For the change to actually show a real SHA/date, the deploy-time CI must set:
- `NEXT_PUBLIC_BUILD_SHA` (full SHA, footer slices to 7)
- `NEXT_PUBLIC_BUILD_DATE` (ISO date, e.g. `2026-06-14`)

If unset, both fall back to `'dev'`. This is a **CI/deploy concern**, not a code defect. The v7 reviewer flagged the same item. Out of scope for unit verification.

---

## 6. Sync Issue Status

| Issue | State |
|-------|-------|
| v6 MED-3 (Footer build-time wiring) | RESOLVED by this change |
| v7 `ses_footer_sha_verify` (16:47Z) | PASS, re-confirmed by this review |
| Current todo.md line 67 | `[x] status:deferred:v8` — formal v8 acceptance NOW warranted |

**No new sync issues filed.**

---

## 7. Final Verdict

**VERDICT: PASS** — All acceptance criteria met. No defects. No sync issues. The change is correct, follows existing patterns, and clears every gate (lsp/typecheck/lint/tests).

**Caveat (commander note, not blocking):** The change is currently **uncommitted** in the working tree (`M app/src/components/footer.tsx`). It will be lost unless committed. Recommend a single atomic commit bundling it with the other 5 uncommitted v8 app source changes (`admin/layout.tsx`, `dashboard/layout.tsx`, `app/layout.tsx`, `app/page.tsx`, `navbar.tsx`) to preserve audit trail.

**Test record:** This file (the v8 re-verification). The v7 record at the time of the work was the `ses_footer_sha_verify` work-log entry (16:47Z); no separate test record file was created because the change is a 1-line UI tweak with no logic to unit-test — typecheck/lint/lsp IS the verification surface.

---

## 8. Evidence Summary

```
lsp_diagnostics(app/src/components/footer.tsx) → "No diagnostics found. All clean!"
server npm run typecheck                       → exit 0, 0 errors
server npm run lint                            → exit 0, 0 errors
server npm test                                → 73 files, 863 tests, 10.56s, all pass
app    npm run typecheck                       → exit 0, 0 errors
app    npm run lint                            → exit 0, 0 errors
app    npm test                                → 7 files, 81 tests, 1.59s, all pass
grep "process.env.NEXT_PUBLIC_BUILD"           → footer + navbar + 6 pages (consistent)
```
