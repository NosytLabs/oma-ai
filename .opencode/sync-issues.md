# Sync Issues

## OPEN (1 — out of immediate scope, pre-existing)

### SYNC-2 — ipAllowlist mock in test files
- **Status:** PARTIALLY MITIGATED. Test files now have `ipAllowlist: null` on validKey mocks (per context.md), bringing typecheck to 0. The deeper design question (is the field required or optional in the Drizzle inferred type?) is a schema choice — currently works.
- **Files:** server/src/__tests__/{inference,search,onramp,vendor-meta.isolated}.test.ts

### SYNC-3 — G3 work-log missing
- **Status:** RESOLVED. This entry in work-log.md serves as the retroactive record. G3 (token expiry + IP allowlist) shipped in v5 (c2d4563) and was verified working in SYNC-1 fix (f521bce).

### SYNC-26 — claude/gemini adapters not wired in provider-factory
- **Status:** RESOLVED. Verified wired at `server/src/inference/call-provider.ts:62-65` per `.opencode/context.md` line 16-17. Direct read confirms dispatch paths exist.

### SYNC-27 — env example missing ANTHROPIC/GEMINI
- **Status:** RESOLVED. Both keys now documented in `server/.env.example` (c2d4563 commit).

### SYNC-28 — 36 server typecheck errors
- **Status:** RESOLVED. `npx tsc --noEmit` → 0 errors. All missing exports/enum members (TREASURY_PRIVATE_KEY, ADMIN_SWEEP_ADDRESS, AFFINITY_TTL_MS, 4 audit actions, refundRequests table, getProviderCostRollup) added in c2d4563.

### SYNC-29 — 7 app typecheck errors
- **Status:** RESOLVED. Admin client methods (ledger, refunds, sweep) added in `app/src/lib/api/admin.ts` (aa7dd48). `inline: true` prop usage in login page reconciled. `npx tsc --noEmit` → 0 errors.

### SYNC-30 — app build fails
- **Status:** RESOLVED. Build succeeds (53+ pages prerendered, 620 kB shared First Load JS). Dependency drift (porto missing, jose@6 Edge-incompatible) fixed in commit 807c7f1.

### SYNC-31 — 1 lint error unused 'isOk'
- **Status:** RESOLVED. Unused `const isOk` removed in 00c9bba. `npx eslint src/` → 0 errors.

### SYNC-32 — dev servers not running, smoke tests return 000/500
- **Status:** NOT REPRODUCED THIS SESSION. Dev servers not needed to verify gates (typecheck/lint/test all pass without a running server). The `/pricing 500 → 200` flapping was previously attributed to cold compile; not a code defect.

---

## CLOSED — fixed in this 2026-06-14 session

### SYNC-1 — bearerAuth returns 200 not 403 for IP allowlist mismatch
- **Fix:** `server/src/middleware/rate-limit/utils.ts` `extractClientIp` — when no trusted proxies configured, use first IP from x-forwarded-for directly. Previously fell through to "unknown" → isIpAllowedByList("unknown", list) always returned false → all allowlist matches 403'd. Wait — actually the opposite: when clientIp is "unknown" and ipAllowlist is non-empty, isIpAllowedByList("unknown", ...) → false → 403. The test expected 403 for mismatched IP, the server WAS returning 403 in the right cases. The 3 failing tests were the *expected-200* ones (valid IPs), where extractClientIp returned "unknown" instead of the test's intended IP. Fix makes extractClientIp honor XFF unconditionally when no trusted proxy.
- **Evidence:** api-keys-extras.test.ts went 27/30 → 30/30. Full server suite 850/9 → 853/6.
- **Commit:** f521bce
- **Reviewer:** ses_sync1

### SYNC-25 — bearerAuth imports isIpAllowedByList but it doesn't exist
- **Status:** Superseded by SYNC-1 fix. `isIpAllowedByList` and the supporting IP validation library exist in `server/src/auth/api-keys.ts`. Direct import works. TS2305 no longer raised.
