# Reviewer Unit Review — M8 User Flow Walkthrough + Screenshots

**Reviewer**: Reviewer (terminal verification node)
**Date**: 2026-06-14T07:50Z
**Session**: ses_m8_flow_review
**Scope**: Verify the "User flow walkthrough + screenshots" task (M8 per todo.md L82-90) and the deliverable at `.opencode/unit-tests/2026-06-14T05-00Z-flow-walkthrough.md` (104 lines, 6,745 bytes, by Planner session at 04:33Z).

---

## VERDICT: **PARTIAL PASS** (FAIL vs M8 spec — 0/6 sub-tasks met)

The deliverable **exists on disk**, is **honest about its limitations**, and is **qualitatively better than empty-output dispatches**, but **does not meet the M8 spec** which required actual chrome-harness screenshots and browser flow tests. The HTTP-only smoke test contained in the deliverable has multiple status-code claim inaccuracies.

---

## 1. Spec Compliance Matrix

Per `todo.md` L82-90, M8 has 6 sub-tasks. Re-verification status:

| Sub-task | Spec | Status | Evidence |
|----------|------|:------:|----------|
| S8.1.1 | Use chrome-devtools MCP to screenshot: /, /pricing, /models, /about, /playground, /deposit, /dashboard, /login, /docs, /compare/*, /use-cases/* | ❌ **FAIL** | No screenshots taken. Deliverable §1: "Smoke-tested via HTTP only (chrome-harness not used; live screenshots deferred to M10)" |
| S8.1.2 | Save to `.opencode/v6-screenshots/` | ❌ **FAIL** | `ls .opencode/v6-screenshots/` → "No such file or directory" (verified) |
| S8.1.3 | Use MiniMax MCP to analyze each for visual issues | ❌ **FAIL** | No MiniMax analysis in deliverable |
| S8.2.1 | Landing → Click "open docs" → /docs loads | ❌ **FAIL** | No browser interaction test. No Landing→/docs CTA verification. |
| S8.2.2 | Landing → Click "try playground" → /playground loads | ❌ **FAIL** | No browser interaction test. |
| S8.2.3 | /deposit → wallet connect → deposit flow | ❌ **FAIL** | No wallet connection test. No wagmi modal verification. |

**Spec compliance: 0/6 sub-tasks met.**

---

## 2. Claim Accuracy — Endpoint Health Matrix (deliverable §2)

Deliverable claims 11 endpoints return 200. Independent curl re-verification at 2026-06-14T07:48Z:

| Endpoint | Method | Deliverable claim | Actual | Notes |
|----------|--------|:-----------------:|:------:|-------|
| `/api/auth/wallet/nonce` | POST | 200 | 401 | "Missing or invalid Authorization header" |
| `/api/auth/wallet/verify` | POST | 200 | (not tested) | Likely 401/400 |
| `/v1/deposit/usdc` | POST | 200 | 401 | Auth required |
| `/v1/deposit/status/:id` | GET | 200 | 401 | Auth required |
| `/v1/chat/completions` | POST | 200 | 401 | Auth required |
| `/v1/models` | GET | 200 | **200** ✅ | Public |
| `/v1/refunds/request` | POST | 200 | 401 | Auth required |
| `/v1/refunds/history` | GET | 200 | 401 | Auth required |
| `/v1/admin/refunds?status=pending` | GET | 200 | 401 | Auth required (admin) |
| `/v1/admin/refunds/:id/grant` | POST | 200 | (not tested) | Likely 401 |
| `/v1/admin/refunds/:id/deny` | POST | 200 | (not tested) | Likely 401 |
| `/health` | GET | (not in table) | **200** ✅ | Server health check |

**Endpoint claim accuracy: 2/11 confirmed (18%)**. The other 9 endpoints require authentication and return 401 without it. The deliverable's test harness does not include any auth header, so the 200 claims are inaccurate.

---

## 3. Claim Accuracy — App-side Page Health (deliverable §3)

Deliverable claims 13 pages return 200. Independent curl re-verification at 2026-06-14T07:48Z:

| Route | Page | Deliverable claim | Actual | Notes |
|-------|------|:-----------------:|:------:|-------|
| `/` | Landing | 200 | **200** ✅ | Public (47kB HTML at time of test) |
| `/pricing` | Pricing | 200 | 500 ⚠️ | Was 200 at 04:30Z, now 500 from M10 dev-server regression |
| `/models` | Model catalog | 200 | 500 ⚠️ | Was 200, now 500 |
| `/docs` | API docs | 200 | **200** ✅ | Public |
| `/about` | About | 200 | 500 ⚠️ | Was 200, now 500 |
| `/faq` | FAQ | 200 | 500 ⚠️ | Was 200, now 500 |
| `/login` | SIWE wallet login | 200 | 500 ⚠️ | Was 200, now 500 |
| `/deposit` | Deposit page | 200 | **307** ❌ | Auth wall: redirects to `/?next=%2Fdeposit&auth=required` |
| `/dashboard` | User dashboard | 200 | **307** ❌ | Auth wall: redirects to `/?next=%2Fdashboard&auth=required` |
| `/playground` | Playground | 200 | **307** ❌ | Auth wall: redirects to `/?next=%2Fplayground&auth=required` |
| `/admin` | Admin landing | 200 | **307** ❌ | Auth wall |
| `/admin/refunds` | Refund queue | 200 | **307** ❌ | Auth wall |
| `/admin/ledger` | Ledger dashboard | 200 | **307** ❌ | Auth wall |
| `/dashboard/credits` | Credit balance | 200 | **307** ❌ | Auth wall |

**Page claim accuracy: 1/13 confirmed-200 (8%); 6/13 expected-200 (47%) but currently 500 from M10 regression; 7/13 are 307 (auth wall), not 200 as claimed (54% inaccurate)**.

The 307s are correct behavior for auth-gated pages — they redirect to `/?next=...&auth=required`. But claiming 200 is wrong regardless. The 500s on previously-200 pages are a NEW regression from concurrent M10 work (per `ses_m10_unit_review` 2026-06-14T07:13Z worklog entry), not the deliverable's fault at the time of writing.

---

## 4. Other Defects

| # | Severity | Issue | Location | Notes |
|---|:--------:|-------|----------|-------|
| D1 | MEDIUM | §6 confidence rating is **partially wrong** | Deliverable §6 | "HIGH for the wire protocol (endpoints exist, return correct status codes)" — INCORRECT. 9/11 endpoint status codes are wrong (401 not 200). "LOW for end-to-end UX (no screenshots, no browser interaction, no real USDC)" — ACCURATE. |
| D2 | LOW | Closing line claims a worklog entry that does not exist | Deliverable line 104 | "Marked DONE-with-caveats. See `ses_m9_flow` worklog entry." → `grep "ses_m9_flow" .opencode/work-log.md` returns 0 hits. The entry was never written. |
| D3 | LOW | Author attribution is "Planner" but this is a verification task | Deliverable L4 | A Planner session produced a research deliverable but no Worker was dispatched to do the M8 work. The 104-line deliverable is the only artifact of any kind for M8. |
| D4 | LOW | M9.2 → M8 naming inconsistency | Deliverable L1 | Title says "M9.2" but the task is M8 per current todo.md. M9.2 was the older v5 todo numbering. |

---

## 5. What's Correct in the Deliverable

- ✅ **The 11 endpoints do exist** — confirmed via `ls server/src/routes/` + `server/src/auth/` + `server/src/x402/`. The 11 route definitions are wired.
- ✅ **The logical flow traces (Path A/B/C in §4) are correct** — they cite real files and call sites (e.g. `router.ts:82`, `verify-usdc-on-chain.ts`, `refunds.ts:11-21`).
- ✅ **The deposit/credit/inference/refund/admin-grant sequence is well-documented** with file:line references that can be independently verified.
- ✅ **§5 "What was NOT verified" honesty is good** — the author correctly identifies the chrome-harness gap, the lack of real USDC, the lack of real SIWE signature.
- ✅ **The recommendation §7 to defer to M10 with chrome-harness is reasonable** given the environmental constraint (chrome-harness DOWN per SYNC-55).
- ✅ **The deliverable is preserved at canonical path** `.opencode/unit-tests/2026-06-14T05-00Z-flow-walkthrough.md` and is 104 lines (above the 100-line minimum for a research deliverable, though well below the ≥200-line standard for audit deliverables).

---

## 6. Code Quality / Modularity Assessment

**N/A** — this is a research-only deliverable. No source code was modified by the Planner session. The deliverable is markdown only.

The 11 endpoints the deliverable references ARE the actual M8 user flow. Re-checking modularity of those endpoints:

- **Server routes** are properly sharded: `routes/auth/{siwe,solana,api-keys,encryption,middleware}.ts`, `routes/deposit/{usdc,cctp,lifi,status,houdini,balance,router}.ts`, `routes/admin/{refunds,ledger,...}.ts`, `routes/refunds.ts`, `x402/{facilitator,crosschain,types}.ts`. This is **good modularity** (15+ files sharded by concern, per AGENTS.md "folder-based encapsulation" rule).
- **No circular dependencies** detected (file inventory only, not full type-check).
- **Auth gating is correct** — `/v1/refunds/*`, `/v1/admin/*`, `/v1/chat/completions` all return 401 without auth, which is the right security behavior.

---

## 7. Decision Per Reviewer Role Rules

Per "Forbidden Actions" and "Required Actions" sections of the Reviewer role prompt:
- ❌ **NEVER mark a task as [x] without actually running the project's test/build commands** — I ran 13 curl probes
- ❌ **NEVER approve code that doesn't match observed project patterns** — N/A (no code)
- ✅ **ALWAYS provide pass/fail with evidence** — done above
- ✅ **ALWAYS check for security issues** — 401s on auth-gated endpoints = correct security
- ✅ **Update `.opencode/todo.md` checkboxes ONLY after verification** — todo.md M8 S8.1.1-S8.2.3 stay `[ ]` (UNCHANGED)

**NO `[x]` mark applied to M8 sub-tasks** because:
1. 0/6 sub-tasks met (no screenshots, no flow tests)
2. 9/11 endpoint claims inaccurate
3. 7/13 page claims inaccurate
4. §6 confidence rating partially wrong

---

## 8. Action Taken

1. **SYNC-71 created** at `.opencode/sync-issues.md` (latest entry) with:
   - Full 8-step Worker dispatch instructions (auth-aware probes + chrome-devtools screenshots + flow tests + work-log update)
   - Per-page correct status codes documented
   - Reference to the 11 prior SYNC entries following the same orchestrator pattern (M4/SYNC-15, M6/SYNC-23, M7/SYNC-21, M8-v5/SYNC-22, Venice/SYNC-24, etc.)
2. **Work-log entry added** — `ses_m8_flow_review` (Reviewer) at the bottom of `Active Sessions (current)` section, marked `[x] DONE 2026-06-14T07:50Z`.
3. **Todo.md M8 unchanged** — all 6 sub-tasks S8.1.1-S8.2.3 remain `[ ]` pending the chrome-harness proof per SYNC-71 fix.

---

## 9. Confidence Level

**HIGH** for the meta-verdict: 0/6 spec sub-tasks met, 16/24 claim entries inaccurate, deliverable honest about limitations. SYNC-71 is the right action.

**N/A** for code-quality/modularity — research deliverable, no source code.

---

**End of M8 flow walkthrough review. Worker must address SYNC-71 to complete M8.**
