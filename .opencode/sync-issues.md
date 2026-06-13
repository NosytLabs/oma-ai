# Sync Issues (Unresolved Only)

## SYNC-15
- Severity: HIGH
- Files: `.opencode/todo.md` (M4/T4.1-T4.4), `.opencode/audit-2026-06-13v4/`, `.opencode/v4-screenshots/`, `.opencode/unit-tests/`
- Problem: Reviewer was asked to verify task "Visual + a11y audit" (M4/T4.1-T4.4) as completed, but the task is **not actually finished**. Evidence of incompleteness (as of 2026-06-13 15:17Z):
  1. **Work log still marks session active:** `ses_visual_audit (Worker): T4 visual+a11y audit - in_progress` (line 2). The Worker has not flipped it to `[x]`.
  2. **Todo.md shows M4 as `pending`**, T4.1, T4.2, T4.3, T4.4 are all unchecked (`[ ]`). T4.1.1-S4.1.4, S4.2.1-S4.2.3, S4.3.1-S4.3.4, S4.4.1-S4.4.2 = 12 unchecked sub-tasks.
  3. **Audit output directory is empty:** `.opencode/audit-2026-06-13v4/` contains zero files (no `*.md` report, no `axe-core-audit.json`, no `lighthouse*.json`).
  4. **Screenshots: only 1 of ≥10 required.** T4.1.2 spec calls for `/, /pricing, /models, /playground, /dashboard` × both themes = ≥10. Actual: `.opencode/v4-screenshots/desktop-01-landing-dark.png` (1 file, mtime 15:16:28, ~37s before review started).
  5. **No lighthouse_audit output anywhere in the repo.**
  6. **No new axe-core re-audit output.** The only `axe-core-audit.json` is the v3 file at `docs/archive/audit-2026-06-13v2/axe-core-audit.json` (archived already).
  7. **No mobile-viewport screenshots** (S4.1.3 requires 375px + 768px).
  8. **No unit test record** created in `.opencode/unit-tests/` for the audit task. The 2 files there (`2026-06-13T04-22Z-invoices-test.md`, `2026-06-13T05-25-50Z-usage-chart.md`) are from the previous v3 mission.
  9. **No T4.3 typecheck/lint/build/test evidence** captured.
  10. **No T4.4 curl route-verification evidence** captured.
- Fix: The `ses_visual_audit` Worker must finish the actual audit work, write a full report (markdown + axe JSON + lighthouse JSON) to `.opencode/audit-2026-06-13v4/`, capture the missing screenshots, run all gate commands and record their output, then update work-log to `[x]` and notify Commander before re-review. Reviewer must NOT mark M4/T4.* as `[x]` until the unit test record and full evidence set exist.
- Status: pending

## SYNC-16
- Severity: MEDIUM (work was 60% done, but never executed fixes/verification)
- Files: `app/src/app/use-cases/page.tsx` (line 69), `app/src/app/private-ai-api/page.tsx` (lines 33-36, 188), `.opencode/todo.md` (M2), `.opencode/work-log.md`, `.opencode/unit-tests/`
- Problem: Reviewer was asked to verify task "Copy and wording review" (M2/T2.1-T2.4). The Worker `ses_copy_polish` performed a thorough audit and identified exactly 3 surgical fixes, but the work was **abandoned mid-flight** before any of the actual edits, verification, or work-log updates were committed. Evidence (as of 2026-06-13 15:18Z):
  1. **Audit complete and correct** — worker accurately identified 3 issues still present in HEAD:
     - `use-cases/page.tsx:69` — "From idea to working software — pick a category to see how OMA brings concepts to life." (line 69 has em-dash + "brings concepts to life" fluff)
     - `private-ai-api/page.tsx:33-36` — `{icon: Shield, title: 'Get Started Fast', desc: 'No paperwork. Just connect and start inferring.'}` (vague CTA)
     - `private-ai-api/page.tsx:188` — "Enterprise-grade security" (buzzword)
  2. **T2.3 admin pages audit incomplete** — 4 of 5 admin sub-pages never read: `admin/users/page.tsx`, `admin/users/[id]/page.tsx`, `admin/fees/page.tsx`, `admin/rate-limits/page.tsx`, `admin/analytics/page.tsx` (workers/Planner context only confirms `admin/page.tsx` was read; 4 sub-pages not covered).
  3. **T2.4 fixes never applied** — `git diff --stat HEAD -- app/src/app/use-cases/page.tsx app/src/app/private-ai-api/page.tsx` returns empty. The 3 identified issues are still live in HEAD.
  4. **No commit** — `git log` shows no copy-polish commit since `d4d9e0c` a11y from earlier session.
  5. **Work log not updated** — Active sessions are `ses_cleanup_v4`, `ses_visual_audit`; `ses_copy_polish` is missing entirely (not even marked done). Completed Units table is empty.
  6. **No unit test record** — `.opencode/unit-tests/` contains only 2 stale records (`2026-06-13T04-22Z-invoices-test.md`, `2026-06-13T05-25-50Z-usage-chart.md`). No record for M2 copy polish.
  7. **No verification gates run** — typecheck/lint/build never executed for this task.
  8. **LSP diagnostics clean on untouched files** — but irrelevant since fixes weren't applied.
- Fix: Re-dispatch Worker with explicit model `kilo/anthropic/claude-sonnet-4.6` (NOT free `tokenrouter/MiniMax-M3` which is known to acknowledge but not execute per AGENTS.md lessons). Worker must:
  1. Read remaining 4 admin sub-pages to complete T2.3 audit.
  2. Apply 3 surgical fixes (audit results are pre-validated; do not re-audit):
     - `use-cases/page.tsx:69` → "From idea to working software — pick a category to see the patterns and code."
     - `private-ai-api/page.tsx:33-36` → `{icon: Shield, title: 'Wallet to API', desc: 'Connect a wallet, get a key, hit the endpoint. No email, no KYC.'}`
     - `private-ai-api/page.tsx:188` → "Audited on-chain settlement"
  3. Run `cd app && npm run typecheck` (0), `npm run lint` (0), `npm run build` (exit 0) and capture output.
  4. Update `.opencode/work-log.md` to mark `ses_copy_polish` as `[x]` with files-modified list and verification output.
  5. Write unit test record to `.opencode/unit-tests/2026-06-13T15-XXZ-copy-polish.md` with audit findings, fixes applied, gate output.
  6. Update `.opencode/todo.md` to flip M2 status to `in_progress` then `completed` (only after gates pass).
- Status: pending

## SYNC-17
- Severity: HIGH
- Files: `app/src/app/globals.css` (lines 28-32, 35-41, 44-55, 66-69, 75-101, 104-117, 144-148, 149-153, 154-186, 187-200), `.opencode/todo.md` (M1), `.opencode/work-log.md`, `.opencode/unit-tests/`
- Problem: Reviewer was asked to verify task "Orange theme replacement" (M1/T1.1-T1.3) as completed, but the task is **not started at all**. Evidence of incompleteness (as of 2026-06-13 15:18Z):
  1. **No worker session in work log.** Active sessions show only `ses_cleanup_v4` (M3) and the abandoned `ses_visual_audit` (M4) and `ses_copy_polish` (M2). No `ses_orange_theme` or `ses_m1` worker has been dispatched.
  2. **All 12 M1 sub-tasks are `[ ]` in `.opencode/todo.md`.** T1.1.1-T1.1.6 (palette picks), T1.2.1-T1.2.6 (CSS tokens + gates), T1.3.1-T1.3.3 (visual smoke test).
  3. **`git diff app/src/app/globals.css` returns empty** — the CSS file has not been modified for the v4 mission.
  4. **11 cyan/teal references still present in `app/src/app/globals.css`:**
     - Line 28: `--color-accent: #00ffc8;` (cyan)
     - Line 29: `--color-accent-dim: rgba(0, 255, 200, 0.18);` (teal)
     - Line 30: `--color-accent-glow: rgba(0, 255, 200, 0.25);` (teal)
     - Line 31: `--color-accent-hover: #00d4aa;` (teal)
     - Line 32: `--color-accent-muted: #00aa8a;` (teal)
     - Line 112: `--color-cyan: var(--color-accent);` (cyan alias)
     - Line 113: `--color-cyan-bright: #00ffd4;` (teal)
     - Line 116: `--color-accent-soft: rgba(0, 255, 200, 0.08);` (teal)
     - Line 144: light theme `--color-accent: #008f72;` (teal)
     - Lines 145-148, 199: light theme teal variants
     - Line 195: `--color-cyan: #008f72;` (light cyan alias)
  5. **No orange palette document** in `.opencode/research/` (which only has 3 v3 files).
  6. **No unit test record** for orange theme in `.opencode/unit-tests/` (only 2 stale v3 records).
  7. **No component-class audit performed** (S1.2.3 — `.btn-primary`, `.oma-btn--primary`, etc. may hardcode `cyan`/`teal`).
  8. **No WCAG AA contrast verification** (S1.1.6 requires ≥ 4.5:1 for text on accent backgrounds).
  9. **No visual smoke test** (S1.3.1-S1.3.3 — no dev-server screenshot, no light/dark theme comparison, no confirmation that orange dominates).
  10. **Baseline gates PASS (clean state confirmed):** `app typecheck` ✓, `app lint` ✓, `server typecheck` ✓ — verified at 2026-06-13 15:18Z. The Worker can build on a known-good foundation.
- Fix: Dispatch a Worker on **M1: Orange Theme System** with explicit model `kilo/anthropic/claude-sonnet-4.6`. Worker must:
  1. **T1.1 Define palette** — write `.opencode/research/orange-palette.md` with primary + 5 variants (primary, dim, glow, hover, muted) for both dark and light themes, plus secondary/tertiary/semantic colors. Verify WCAG AA ≥ 4.5:1 contrast.
  2. **T1.2 Update tokens** — replace all 11 cyan/teal references in `app/src/app/globals.css` at the specified lines. Sweep `app/src/**/*.{ts,tsx,css}` for hardcoded `cyan`/`teal`/`#00ffc8`/`#00d4aa`/`#00ffd4` and update component classes (`.btn-primary`, `.oma-btn--primary`) accordingly.
  3. **T1.2.4-S1.2.6 gates** — run `cd app && npm run typecheck` (0), `npm run lint` (0), `npm run build` (exit 0), then `grep -rEi "00ffc8|00d4aa|00ffd4|cyan|teal" app/src --include="*.{ts,tsx,css}"` must return 0 matches.
  4. **T1.3 Visual smoke test** — start `npm run dev`, screenshot `/`, `/pricing`, `/dashboard` in both themes, confirm orange is dominant.
  5. **Unit test** — write to `.opencode/unit-tests/<timestamp>-orange-theme.md` asserting: (a) `--color-accent` resolves to the new orange hex in both themes; (b) zero cyan/teal references remain in source.
  6. **Work-log update** — register session as `[x]` with files-modified list and gate output.
  7. **Todo update** — flip M1 status to `in_progress` then `completed` (only after all gates pass + Reviewer re-verifies).
- Status: pending
