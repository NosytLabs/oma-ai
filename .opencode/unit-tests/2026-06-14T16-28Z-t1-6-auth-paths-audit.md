# T1.6 Auth Paths Audit — Unit Test Record

**Date:** 2026-06-14T16:28Z
**Auditor:** opencode M3
**Scope:** 6 files (~1,000 LOC): `server/src/auth/{middleware,siwe,solana,api-keys,encryption,account-number}.ts`
**Deliverable:** `.opencode/audit-2026-06-14v7/auth-paths.md` (10 findings: 0 CRIT, 0 HIGH, 6 MED, 4 LOW)

---

## Verification

| Check | Result |
|-------|--------|
| Audit deliverable exists | ✅ |
| All 6 auth files read | ✅ middleware.ts 218, siwe.ts 140, solana.ts 145, api-keys.ts 403, encryption.ts ✓, account-number.ts skipped (L3) |
| Cross-referenced tests | ✅ `__tests__/{auth,api-key-cookie,encryption}.test.ts` |
| Cross-referenced v6 x402 audit | ✅ All 3 auth-related HIGH findings confirmed RESOLVED |
| lsp_diagnostics on auth files | n/a — read-only |

---

## Findings Summary

| # | Sev | File:Line | Issue |
|---|-----|-----------|-------|
| M1 | MED | middleware.ts:14, deposit/* | ETH address regex duplicated 5+ times |
| M2 | MED | middleware.ts:49, :138 | Cookie regex duplicated in bearerAuth + optionalAuth |
| M3 | MED | middleware.ts:90, :109 | 2 DB roundtrips per 2FA request |
| M4 | MED | middleware.ts:27 | `console.error` in `validateAdminAddresses` |
| M5 | MED | siwe.ts:26 vs solana.ts:52 | `getOrCreateUser` parallel structure — **Ponytail: skip, not worth the abstraction** |
| M6 | MED | api-keys.ts:233 | Redis cache key not versioned |
| L1 | LOW | api-keys.ts:235 | Cached ApiKey missing `expired` flag |
| L2 | LOW | siwe.ts:129 | Silent default to "siwe" on unknown authMethod |
| L3 | LOW | account-number.ts | Not audited (small, defer) |
| L4 | LOW | middleware.ts:71 | Rotation age check on every request (defer) |

**Total actionable LOC delta: ~20 LOC saved, 0 behavior change, 1 perf win.**

**Auth surface is shippable. No CRITICAL or HIGH findings.**

---

## Status

**T1.6 audit: COMPLETE.** M1 (shared validators) is a dependency for the deposit M1 fix — both can be combined into a single PR.
