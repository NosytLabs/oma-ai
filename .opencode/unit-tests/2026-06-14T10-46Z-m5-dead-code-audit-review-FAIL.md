# Unit Review: M5 "Dead code + orphan audit" — FAIL

**Date**: 2026-06-14T10:46Z
**Reviewer**: Reviewer
**Subject**: `ses_dead_code_audit_v2` (M5, todo.md M5/T5.1-T5.2)
**Expected deliverable**: `.opencode/unit-tests/2026-06-13T22-40Z-dead-code-audit.md`
**Verdict**: ❌ **FAIL — deliverable file is MISSING**

---

## 1. Failure summary

The M5 task "Dead code + orphan audit" in `.opencode/todo.md` (M5/T5.1-T5.2, 6 sub-tasks S5.1.1-S5.2.3) is **not complete**. The Worker `ses_dead_code_audit_v2` (per `.opencode/work-log.md:15`) is still listed `[ ]` (in progress) and the expected deliverable file does not exist on disk.

**Direct evidence** (re-run at 2026-06-14T10:46Z):

```bash
$ ls -la .opencode/unit-tests/2026-06-13T22-40Z-dead-code-audit.md
ls: .opencode/unit-tests/2026-06-13T22-40Z-dead-code-audit.md: No such file or directory

$ ls .opencode/unit-tests/ | grep "22-40" | head -10
(empty — no 22-40Z file exists in .opencode/unit-tests/)

$ grep -A 5 "M5: Dead code" .opencode/todo.md
## M5: Dead code + orphan audit | agent:Worker
### T5.1: Find unused exports/imports
- [ ] S5.1.1: Run `tsc --noUnusedLocals` on both server + app
- [ ] S5.1.2: Grep for `import` statements with no usage
- [ ] S5.1.3: List `export` from server/src/inference/ not imported anywhere
### T5.2: Find dead components/pages
- [ ] S5.2.1: Compare `app/src/app/` page list vs `sitemap.ts` entries
- [ ] S5.2.2: Find pages with no internal links
- [ ] S5.2.3: Find components in `_components/` never imported
(ALL 6 sub-tasks still `[ ]`)

$ grep -n "ses_dead_code_audit_v2" .opencode/work-log.md
15:- [ ] ses_dead_code_audit_v2 (Worker): Find ALL dead code (... [still in_progress])
```

The unit **fails all 3 acceptance criteria** for a completed unit:

| Acceptance criterion | Status | Evidence |
|---|:---:|---|
| Unit test code (deliverable) is written and exists on disk | ❌ FAIL | File `2026-06-13T22-40Z-dead-code-audit.md` does not exist (no 22-40Z file in `.opencode/unit-tests/`) |
| Code quality + modularity compliance (clean grep) | ❌ FAIL | No deliverable to review — N/A |
| 7 M3 gates run + recorded | ❌ FAIL | No gate output captured in any 22-40Z file |

---

## 2. History: why this matters (SYNC-49 was the precedent)

The M5 task has a **documented history of producing a false-claim audit** (SYNC-49):

1. **2026-06-13T22:00Z** — Original `ses_dead_code_audit_v1` produced `.opencode/unit-tests/2026-06-13T22-00Z-dead-code-audit.md` (17,795 B) claiming "18 dead components / 1,707 lines".
2. **2026-06-13T22:32Z** — Reviewer re-verification found the v1 audit's "dead components" were **all actively used** via `dynamic(() => import(...))` (a Next.js dynamic import pattern the audit's regex missed). Filed SYNC-49.
3. **2026-06-13T22:32Z** — `ses_cleanup_v1` (Worker) deleted the v1 audit per SYNC-49 (verified: file is gone, no 22-00Z-dead-code-audit.md on disk).
4. **2026-06-13T22:40Z (target)** — `ses_dead_code_audit_v2` was dispatched with the explicit directive: "FULL coverage including `dynamic(() => import(...))` patterns to avoid the SYNC-49 false-positive". **This deliverable was never produced.**

SYNC-49 is **NOT** in the current `.opencode/sync-issues.md` because the v1 false-claim file was physically deleted — but the v2 replacement (which would have been the legitimate, dynamic-imports-aware audit) was never written. The **entire M5 audit capability is currently absent from the project**.

---

## 3. What's NOT done (6 sub-tasks)

| # | Sub-task | Status | Evidence |
|:-:|---|:---:|---|
| S5.1.1 | `tsc --noUnusedLocals` on both server + app | ❌ | Not run; no output captured |
| S5.1.2 | Grep for `import` statements with no usage | ❌ | Not run; no output captured |
| S5.1.3 | List `export` from `server/src/inference/` not imported anywhere | ❌ | M7.5 deliverable found 1 (`markup.ts`) but M5's full inference/ scope not audited |
| S5.2.1 | Compare `app/src/app/` page list vs `sitemap.ts` entries | ❌ | Not done — `ses_dead_page_cleanup` v1/v2 covered 4+15 candidates but not as a M5 deliverable |
| S5.2.2 | Find pages with no internal links | ❌ | Not done |
| S5.2.3 | Find components in `_components/` never imported | ❌ | Not done — this is the **exact** failure mode that caused SYNC-49 (dynamic imports missed) |

---

## 4. Adjacent work that exists (but does NOT satisfy M5)

| File | What it covers | Why it's NOT M5 |
|------|----------------|-----------------|
| `.opencode/unit-tests/2026-06-14T05-00Z-cleanup.md` (242 lines, M7.5) | 0 TODO/FIXME, 0 console.log, 1 dead export (`markup.ts`) | Scoped to COMMENT cleanup + dead-export spot check; does NOT cover `_components/` dynamic-import pattern |
| `.opencode/unit-tests/2026-06-13T22-08Z-dead-page-cleanup.md` (193 lines) + `.opencode/unit-tests/2026-06-13T22-26Z-dead-page-cleanup.md` (352 lines) | 4 + 15 candidate pages audited, 0 deleted (KEEP verdict) | Scoped to page-level orphan detection via sitemap/UI refs; does NOT cover unused components, unused exports, or dynamic-import false-positives |
| SYNC-25 (M5 dead-code reference in sync-issues) | Notes `x402/receipt.ts` (45 LOC) and `x402/settlement-cache.ts` (135 LOC) are dead | These are x402-specific dead-code findings, NOT a full M5 audit; SYNC-25 itself is still pending (lines 294-378 of sync-issues.md) |

**M5 is its own deliverable** and is not covered by any of the above.

---

## 5. Root cause analysis

The `ses_dead_code_audit_v2` worker was dispatched but **never completed**. Most likely causes (per AGENTS.md M3-execution-discipline patterns):
- Worker emitted a polite acknowledgement and stopped without writing the file
- Worker hit context exhaustion before file write
- Worker was preempted by a higher-priority session

**Per AGENTS.md §"M3 optimization"**: "without explicit 'MUST execute' prompting it treats the task as a planning exercise". The dispatch prompt for `ses_dead_code_audit_v2` (per work-log) described the PLAN (7 steps) but did not have a hard "MUST WRITE FILE" gate.

---

## 6. Action required (defect remediation)

The M5 task must be **re-dispatched** with explicit completion gates. The Worker MUST:

1. **Run the 6 sub-tasks** (S5.1.1, S5.1.2, S5.1.3, S5.2.1, S5.2.2, S5.2.3) and capture raw output (commands + stdout) for each.
2. **CRITICAL — handle `dynamic(() => import(...))`** per SYNC-49 lesson:
   - Run: `grep -rEn "from ['\"]\\.\\.?/" app/src/` to find ALL relative imports (including dynamic ones)
   - Cross-check `app/src/app/_components/`, `app/src/components/`, and `app/src/app/**/_components/` for files that are imported via `next/dynamic` (these are LIVE, not dead)
   - Use `grep -rEn "import\\(.*from\\s+['\"][./]" app/src/` to find static imports
   - Use `grep -rEn "dynamic.*import\\(" app/src/` to find dynamic imports
   - **Only flag a file as dead if BOTH grep queries return zero results AND the file is not a barrel/index re-export**
3. **Write the deliverable** to `.opencode/unit-tests/2026-06-13T22-40Z-dead-code-audit.md` (or a new timestamp like `2026-06-14T10-50Z-m5-dead-code-audit.md`) — must be **≥ 200 lines** with sections per sub-task.
4. **Include 7 M3 gate evidence** at the end: server typecheck (0), server lint (0), server tests (current count), app typecheck (0), app lint (0), app tests (72/72), app build (PASS).
5. **Update `.opencode/work-log.md`** to mark the session `[x]` with the new timestamp + a 1-line summary.
6. **Update `.opencode/todo.md`** to flip all 6 M5 sub-tasks `[ ]` → `[x]` ONLY after this Reviewer marks the unit PASS.
7. **Run `lsp_diagnostics`** on any files changed — must be clean.
8. **If dead code is found and deleted**, gate must be re-run after the deletion to prove no behavior change.

---

## 7. Quality bar (what the deliverable must include)

The M5 deliverable, when produced, must contain:

1. **Section per sub-task** (S5.1.1, S5.1.2, S5.1.3, S5.2.1, S5.2.2, S5.2.3) with the command run + raw output.
2. **Per-file evidence table** for any dead code claimed: `path | import_count_static | import_count_dynamic | ref_count_in_sitemap | verdict (DEAD | LIVE | BARREL)`.
3. **Explicit non-findings** (categories scanned that returned 0 hits — proves coverage, not just selection bias). E.g. "0 dead `server/src/inference/*` exports" with the grep that proves it.
4. **Dynamic-imports-aware check** — explicit section on the SYNC-49 failure mode and how the new audit avoids it.
5. **Conservative deletion policy** — per the v1 plan, only delete files with "multiple-line evidence" (≥ 2 independent references proving the file is unused). If evidence is weaker than threshold, the file is KEEP-with-rationale.
6. **7 M3 gate evidence** at the bottom.
7. **Self-review**: Worker's own lsp_diagnostics + a sample grep re-verification of 2-3 of its own claims.

---

## 8. State to preserve

- `.opencode/work-log.md` — UPDATE: mark `ses_dead_code_audit_v2` as FAIL with this file as evidence
- `.opencode/todo.md` — DO NOT mark M5 sub-tasks `[x]` until this unit is re-verified PASS
- `.opencode/sync-issues.md` — DO NOT add a new SYNC-N entry (the M5 task is a TODO item, not a sync regression between completed files)

---

## 9. Final verdict

**FAIL** — M5 "Dead code + orphan audit" is not complete. The deliverable file `.opencode/unit-tests/2026-06-13T22-40Z-dead-code-audit.md` does not exist. All 6 sub-tasks in `.opencode/todo.md` M5 remain `[ ]`. The Worker `ses_dead_code_audit_v2` must be **re-dispatched** with explicit file-write gates per Section 6 above, then re-invoke this Reviewer for verification.

**DONE 2026-06-14T10:46Z** — Reviewer verdict: FAIL. Re-dispatch required.
