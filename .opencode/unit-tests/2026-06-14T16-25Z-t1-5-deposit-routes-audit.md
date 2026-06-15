# T1.5 Deposit Routes Audit — Unit Test Record

**Date:** 2026-06-14T16:25Z
**Reviewer:** opencode M3 (Reviewer → Worker fallback per SYNC-33 dispatch failure)
**Scope:** `server/src/routes/deposit/{usdc,cctp,lifi,houdini,balance,router,status,index}.ts` (8 files, 1,245 LOC) + `server/src/credits/deposit.ts` (272 LOC) + `server/src/credits/deposit-router.ts` (139 LOC)
**Deliverable:** `.opencode/audit-2026-06-14v7/deposit-routes.md` (1,083 words, 14 findings: 3 HIGH + 7 MED + 4 LOW)

---

## Verification

| Check | Result |
|-------|--------|
| Audit deliverable exists | ✅ `.opencode/audit-2026-06-14v7/deposit-routes.md` |
| All 7 deposit route files read | ✅ usdc.ts 205, cctp.ts 83, lifi.ts 109, houdini.ts 368, balance.ts 126, router.ts 27, status.ts 287, index.ts 19 |
| Cross-referenced `credits/deposit.ts` | ✅ 272 LOC processor functions |
| Cross-referenced `credits/deposit-router.ts` | ✅ 139 LOC route picker |
| Cross-referenced `__tests__/deposit.test.ts` | ✅ 5 mock patterns confirmed |
| Cross-referenced v6 AUDIT-PONYTAIL-CLEANUP | ✅ SEC-1/SEC-2 verified ALREADY DONE (verifyMessage called, not length check) |
| Cross-referenced v6 AUDIT-COMPREHENSIVE | ✅ V6 #10 PII finding validated as still open |
| lsp_diagnostics on touched files | n/a — read-only audit, no files modified |

---

## Findings Summary

| # | Sev | File:Line | Issue | Ponytail Verdict |
|---|-----|-----------|-------|------------------|
| H1 | HIGH | usdc.ts:52 | In-memory nonce map breaks serverless | 1 file fix, 20 LOC |
| H2 | HIGH | balance.ts:40 vs status.ts:61 | Two `/v1/deposit/status` routes with different shapes | 1 file delete, -80 LOC |
| H3 | HIGH | usdc.ts:202, houdini.ts:306, balance.ts:113 | PII in error logs (V6 #10 still open) | 1 file, 5 LOC redaction config |
| M1 | MED | usdc/cctp/lifi/status/deposit | EVM regex duplicated 5x | 1 new validator, 5 imports |
| M2 | MED | usdc.ts:26 vs :35 | Two identical zod schemas | 1 schema, delete duplicate |
| M3 | MED | usdc.ts:85-133 vs :135-205 | `/signature` and `/v1/deposit/usdc` 90% same | Delete one route, -50 LOC |
| M4 | MED | usdc/cctp/lifi/houdini | IP extraction boilerplate x4 | 1 helper, 4 imports |
| M5 | MED | houdini.ts:66,306 + balance.ts:113 | `console.error` mixed with logger | 3-line edits |
| M6 | MED | houdini.ts (6x) | `isConfigured()` boilerplate | Middleware, -30 LOC |
| M7 | MED | usdc.ts:194 | Wallet address in audit metadata unredacted | Hash, 5 LOC |
| M8 | MED | usdc vs cctp/lifi | Amount cap inconsistency (100k vs 1M) | Shared constant |
| M9 | MED | status.ts:226-237 | 404 logic checks deposits, not user | 3-line fix |
| L1-L4 | LOW | various | Non-deterministic quote, hardcoded 0, DLQ PII, TS casts | Document/ignore |

**Total actionable LOC delta: ~190 LOC removed, 0 behavior change (assuming frontend smoke tests pass), 3 real-money/routing bugs fixed.**

---

## Status

**T1.5 audit: COMPLETE.** Ready for M3 (HIGH fixes) to consume. The H1 (nonce → Redis) and H2 (delete balance.ts status route) are the two P1 fixes for the deposit surface.

**Tests:** No new tests added in this audit (audit-only). The existing `__tests__/deposit.test.ts` covers the happy paths of the 4 main processor functions.

**Next dispatch:** T3.1-T3.5 (Ponytail S1-S5 from the v6 cleanup audit, which already references H2 in spirit as the "parallel implementations" pattern).
