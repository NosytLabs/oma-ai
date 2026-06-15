# T1.8 — Docs Staleness Audit (Unit Verification)

**Task:** v7 todo.md T1.8 — "Worker — Audit all .opencode/docs/ + 30+ files in docs/ for staleness"
**Reviewer:** Reviewer (direct verification, no subagent dispatch)
**Verified at:** 2026-06-14T16:30Z
**Verdict:** **FAIL** — Worker produced no deliverable

---

## Acceptance Criteria (per established v7 audit pattern, mirror of T1.5/T1.6)

| # | Deliverable | Required Path | Present? |
|---|-------------|---------------|----------|
| 1 | Audit report | `.opencode/audit-2026-06-14v7/docs-staleness.md` (or analogous) | ❌ NOT PRESENT |
| 2 | Unit test record | `.opencode/unit-tests/[timestamp]-t1-8-docs-staleness.md` | ❌ NOT PRESENT (this file IS that record, but for the FAIL verdict) |
| 3 | Work-log session | `.opencode/work-log.md` Active Sessions marked `[x]` for T1.8 | ❌ NOT PRESENT |
| 4 | T1.8 todo status | `.opencode/todo.md:44` marked `[x]` | ❌ Still `[ ]` (correctly) |

---

## Evidence (all fresh, 2026-06-14T16:30Z)

1. **todo.md:44** — T1.8 listed as `[ ]` pending.
2. **No deliverable file** — `ls .opencode/audit-2026-06-14v7/` returns only:
   - `deposit-routes.md` (T1.5 deliverable, 12,802 bytes)
   - `FINAL-REPORT.md` (Commander-authored v7 summary, 11,464 bytes)
   - No `docs-staleness.md` of any size, no `.md` with "stale" or "staleness" in name.
3. **No unit test record** — `ls .opencode/unit-tests/` returns 2 files (T1.5 and T1.6 FAIL only):
   - `2026-06-14T16-25Z-t1-5-deposit-routes-audit.md` (3,394 bytes)
   - `2026-06-14T16-26Z-t1-6-auth-paths-FAIL.md` (7,019 bytes)
   - 0 records for T1.8 docs-staleness.
4. **No work-log session** — `grep -E "t1-8|t1.8|docs-staleness|docs audit" .opencode/work-log.md` returns 0 matches in Active Sessions (only matches are in CLOSED-section references to SYNC-33 itself).
5. **No v7 git commits** — `git log --oneline -20 | grep -iE "doc|staleness"` returns 0 matches for T1.8. The only doc-related commit in last 20 is `1d5f84f docs: OWNER-ONBOARDING + generate-platform-wallet.mjs` (v6 era, not v7 T1.8).
6. **FINAL-REPORT.md:79** explicitly confirms: `| Docs staleness | (Worker dispatch failed) | 17 top-level docs in docs/. 8 are current audits (V6 + earlier). 9 are stable reference docs (API-DOC, BRAND-MESSAGING, etc.). |` — the parenthetical "Worker dispatch failed" is a self-admission by Commander that the task was never executed.
7. **Pre-existing SYNC-33** for T1.8 is in `.opencode/sync-issues.md:87-93` and states: "Reviewer dispatched to verify 'completed' audit. No evidence the task was ever executed." This is the 8th occurrence of the orchestrator-side empty-output pattern. (Note: SYNC-33 also covers T1.5 deposit-routes — separate failure, same root cause.)

---

## Actual Scope (for re-dispatch sizing)

| Surface | Count | Source |
|---------|-------|--------|
| `docs/*.md` (top-level reference docs) | 17 | `ls /Users/tyson/Desktop/Code/OMA-AI/docs/*.md` |
| `.opencode/docs/*.md` (research cache, gitignored) | 156 | `ls /Users/tyson/Desktop/Code/OMA-AI/.opencode/docs/*.md` |
| **Total in scope** | **173** | todo.md's "30+" claim is undercount |
| Excluded | archive/, audit-2026-06-13/ (intentionally historical) | per established scope convention |

The 17 top-level `docs/*.md` are the audit-worthy surface (the 156 .opencode/docs/ are research cache with timestamps in their names — should be inventoried but not deeply audited).

---

## Verification Methodology (this review)

Reviewer is a terminal node per role rules — I do NOT delegate this verification. I did:

1. **Read `.opencode/todo.md`** for T1.8 status.
2. **Read `.opencode/work-log.md`** in full to inventory Active Sessions and look for T1.8 entries.
3. **Read `.opencode/sync-issues.md`** in full to check for prior SYNC issues.
4. **Listed `.opencode/audit-2026-06-14v7/`** and `.opencode/audit-2026-06-14v6/` to confirm no docs-staleness deliverable.
5. **Listed `.opencode/unit-tests/`** to confirm 0 T1.8 records.
6. **Searched for "docs-staleness" / "t1-8" / "t1.8" / "docs audit"** across `.opencode/` + `docs/` recursively.
7. **Ran `git log --oneline -20 | grep -iE "doc|staleness"`** to confirm no v7 commits.
8. **Read `FINAL-REPORT.md`** to check if Commander's own summary covers T1.8 (it does only as a one-line "dispatch failed" admission — not a deliverable).
9. **Ran baseline gates** (server typecheck/lint, app typecheck) to confirm no regression from this review (this review made no source changes).

---

## Baseline Gates (no regression)

| Gate | Result | Notes |
|------|--------|-------|
| `cd server && npx tsc --noEmit` | 2 errors (pre-existing, out of T1.8 scope) | `src/x402/facilitator.ts:242:50` and `:400:29` — `Property 'nonce' does not exist on type 'PaymentPayload'`. x402 v2 spec drift (V6 #1 follow-up). NOT introduced by this review. |
| `cd server && npx eslint src/` | 0 errors | clean |
| `cd app && npx tsc --noEmit` | 0 errors | clean |
| `lsp_diagnostics` on docs deliverable | n/a | deliverable does not exist; no file to lint |
| `git status --short` | Modified: context.md, _metadata.json, sync-issues.md, todo.md, todo.version.json (all .opencode/ mission state) + 16 deleted unit-test records (T1.5/T1.6 review cycle) | no v7 audit deliverables in working tree |

---

## Root Cause (matches established pattern)

This is the **10th occurrence** of the orchestrator-side empty-output pattern in this v7 session:
1. M4/SYNC-15
2. M6/SYNC-23
3. M7/SYNC-21
4. M8/SYNC-22
5. Venice/SYNC-24
6. x402/SYNC-25
7. Config+env+secrets/SYNC-26
8. deposit-routes/SYNC-33 (T1.5)
9. docs-staleness/SYNC-33 (T1.8, this task)
10. auth-paths/SYNC-34 (T1.6)

The dispatched Worker (via `delegate_task` / `task` tool) produced no tool calls and no file writes. Per AGENTS.md "Subagent model fix 2026-06-14", the fix is to set `model: "opencode/big-pickle"` on the subagent session.prompt so Worker doesn't inherit the free M3 (MiniMax-M3) model that has produced empty output 10 times in this pattern.

---

## Action Required (back to Commander)

Per role rules: Reviewer does NOT implement fixes. Reviewer does NOT re-dispatch. Reviewer reports FAIL.

**Commander must:**
1. Re-dispatch T1.8 with explicit deliverable contract:
   - Write `.opencode/audit-2026-06-14v7/docs-staleness.md` with per-file freshness score (e.g., "modified <7d" / "7-30d" / ">30d" / "stale") + per-file staleness findings + recommended actions (archive, update, consolidate)
   - Write `.opencode/unit-tests/[ts]-t1-8-docs-staleness.md` with verification gates (typecheck, lint, any test impact)
   - Update `.opencode/work-log.md` Active Sessions with the T1.8 session ID marked `[x]` done
   - Only THEN mark T1.8 `[x]` in `.opencode/todo.md:44`
2. **CRITICAL: set `model: "opencode/big-pickle"`** on the subagent session.prompt body (per AGENTS.md patch) to avoid the 11th empty-output occurrence. The orchestrator's `createConfigHandler` / `task-launcher.ts` should be patched if not already.
3. Acknowledge the **pre-existing x402 facilitator type errors** (lines 242, 400) — these are V6 #1 follow-up work, NOT a T1.8 failure, but should be tracked separately so they don't get lost in the backlog.

---

## Related Sync Issues

- **SYNC-33 (existing, OPEN)** — T1.8 docs-staleness dispatch failure (same root cause, same fix)
- **SYNC-33 (existing, OPEN, duplicate file:line)** — T1.5 deposit-routes dispatch failure
- **SYNC-34 (existing, OPEN)** — T1.6 auth-paths dispatch failure + server test flakiness (2 separate issues, same sync number)
- **SYNC-35 (NEW, OPEN, this review)** — T1.8 docs-staleness verification re-confirms dispatch failure (this verification round)

**Reviewer recommendation:** consolidate SYNC-33 (which is currently used for both T1.5 and T1.8 — confusing) into separate SYNC-33 (T1.5) + SYNC-35 (T1.8) in a future housekeeping pass. Out of scope for this review.
