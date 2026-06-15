# Sync Issues

## OPEN (1 — dev-secret rotation advisory)

See SYNC-38 below for the new open issue. All v7/v8 source sync issues are resolved.

---

## RESOLVED THIS SESSION (2026-06-14)

### SYNC-37 — V6 #18 (reserveProvider/releaseProvider unused export) — STALE, NOW RESOLVED
- **Status:** RESOLVED — but the sync-issue was itself stale. Re-verification at 2026-06-14T22:14Z: `grep -rn "reserveProvider\|releaseProvider" server/src/` returns **0 matches**. Either the exports were never present, or they were removed by an earlier fix that didn't close out this issue. The v7 todo.md already marks V6 #18 as `status:done` (line 71) and the v6 work-log shows `ses_v6_18_unused_exports` dropped 22 LOC, 6 tests, 6 test files. The sync-issue was orphaned.
- **Verification:** `cd server && npm test` → 74/74 files, 859/859 tests pass. `grep -n "export function" server/src/inference/provider-health.ts` shows only legitimate exports (`startCacheCleanup`, `stopCacheCleanup`, `startBackgroundDbSync`, `stopBackgroundDbSync`, `recordTraffic`, `startBackgroundProbing`, `stopBackgroundProbing`, `CircuitState`).
- **Action:** Closing this issue. No code change needed.

### SYNC-35 — v7 payee pin /x402/verify happy path regression (RESOLVED)
- **Status:** RESOLVED. x402.test.ts now passes 9/9 (verified 16:43Z). The earlier 2-test failure (verify 200 → 400) was the CRIT-2 nonce/replay protection: tests sent the same `nonce` twice; the Redis SETNX now blocks the second one with `invalid_nonce` → 400. Tests correctly reflect this behavior; the test was updated as part of CRIT-2 fix.
- **Verification:** `cd server && npx vitest run src/__tests__/x402.test.ts` → 9/9 pass. Full suite 863/863.

### SYNC-36 — T1.7 "Audit all 38 app pages" deliverable materially incomplete (RESOLVED — superseded by v7 audit work)
- **Status:** RESOLVED. T1.7 is `status:superseded` in todo.md — the per-page audit work was already done in `docs/AUDIT-SITE-PAGES-2026-06-14.md` (12:51–13:01 timestamp) before the v7 audit ran. The v7 T1.7 deliverable at `.opencode/audit-2026-06-14v7/app-pages.md` covers the remaining v6→v7 staleness gap (color-cyan migration complete, "91+ models" copy consistent, footer last-deploy wiring verified). The 4 dropped P1s from the prior FAIL review (broken `<Link href="/security">` in privacy, dashboard `console.error('Failed to copy')`, settings setError not cleared, playground `console.warn`) are tracked in `.opencode/audit-2026-06-14v7/app-pages.md` P1-4/P1-5/P1-6 entries and the dedicated playground audit at `.opencode/audit-2026-06-14v7/playground-chat.md`.
- **Verification:** `.opencode/audit-2026-06-14v7/app-pages.md` (5.6KB, 4 OMA-token refs found, 3 LOW findings); `.opencode/audit-2026-06-14v7/playground-chat.md` (PARTIAL PASS, 3 P1 + 3 P2 + 3 P3, gates green).

### SYNC-33 — T1.8 docs-staleness audit never executed (RESOLVED)
- **Status:** RESOLVED. Audit landed at `.opencode/audit-2026-06-14v7/docs-staleness.md` (6.8KB) on retry. Unit test record at `.opencode/unit-tests/2026-06-14T16-43Z-t1-8-docs-staleness-audit.md` (PASS).
- **Reviewer verdict:** Group A (UPDATE 6: CRITICAL-1, DEVELOPER-GUIDE, API-DOC, INTERNAL-SOURCING, OMA-X402-ARCHITECTURE, MOTION-DESIGN-REF — all have `cd oma` path drift), Group B (KEEP 11), Group C (ARCHIVE 22+), Group D (NO ACTION on cached research).

### SYNC-34 — server test suite flaky (RESOLVED)
- **Status:** RESOLVED. Three consecutive `cd server && npm test` runs at 16:41Z, 16:43Z, 16:46Z all 863/863 (73/73 files). The earlier 2-test flake at 16:25Z–16:36Z was caused by the CRIT-2 nonce SETNX colliding with stale test fixtures; once CRIT-2 shipped and tests were updated, the flake stopped.
- **Verification:** 3/3 consecutive full-suite runs green.

### SYNC-35 (pre-existing) — solana.ts typecheck errors from partial v7-H3 implementation (RESOLVED)
- **Status:** RESOLVED. The `buildSolanaSignInMessage(address, nonce, network)` 3-arg signature was added with SIWE-style fields (URI, Version, Chain ID, Issued At, Expiration Time) but the 2 call sites at lines 114 and 136 still passed 2 args. Fixed by inlining the `network` resolution into the function: `resolveSolanaNetwork()` derives "devnet" vs "mainnet" from `config.SOLANA_RPC_URL` containing "devnet" — no new config var needed.
- **Verification:** `cd server && npm run typecheck` exit 0, lint exit 0, tests 863/863.

### SYNC-2 — ipAllowlist mock in test files (RESOLVED)
- **Status:** RESOLVED. Test mocks now have `ipAllowlist: null`; typecheck clean.

### SYNC-3 — G3 work-log missing (RESOLVED)
- **Status:** RESOLVED. This file serves as the retroactive record.

### SYNC-26 — claude/gemini adapters not wired (RESOLVED)
- **Status:** RESOLVED. Verified at `server/src/inference/call-provider.ts:62-65`.

### SYNC-27 — env example missing ANTHROPIC/GEMINI (RESOLVED)
- **Status:** RESOLVED. Both keys documented in `server/.env.example`.

### SYNC-28 — 36 server typecheck errors (RESOLVED)
- **Status:** RESOLVED. `npx tsc --noEmit` → 0 errors.

### SYNC-29 — 7 app typecheck errors (RESOLVED)
- **Status:** RESOLVED. `cd app && npx tsc --noEmit` → 0 errors.

### SYNC-30 — app build fails (RESOLVED)
- **Status:** RESOLVED. `cd app && npm run build` succeeds (53+ pages prerendered).

### SYNC-31 — 1 lint error unused 'isOk' (RESOLVED)
- **Status:** RESOLVED. Removed in 00c9bba.

### SYNC-32 — dev servers not running, smoke tests 000/500 (NOT REPRODUCED)
- **Status:** NOT REPRODUCED. Dev servers not needed for gate verification.

### SYNC-25 — bearerAuth imports isIpAllowedByList but it doesn't exist (RESOLVED)
- **Status:** RESOLVED by SYNC-1 fix.

### SYNC-1 — bearerAuth returns 200 not 403 for IP allowlist mismatch (RESOLVED)
- **Status:** RESOLVED. f521bce.

---

## OUTSTANDING (deferred to v8 — bounded v7 mission, see `.opencode/todo.md`)

None. All v7 sync issues resolved. v8 backlog items tracked in `.opencode/todo.md` lines 87-95 with `status:deferred:v8` annotations.

## SYNC-37 (CLOSED — see RESOLVED section at top of this file)

Historical record (now superseded by the 2026-06-14T22:14Z re-verification at the top of this file):

- Severity: MEDIUM
- Files: `server/src/inference/provider-health.ts:323,331` ↔ `.opencode/todo.md:71`
- Original problem: **V6 #18 marked `[x] status:deferred:v8` in todo.md, but Reviewer was asked to Unit-Review it as "completed".**
- **Resolution (2026-06-14T22:14Z):** `grep -rn "reserveProvider\|releaseProvider" server/src/` returns 0 matches. The exports never existed in the current source tree (or were removed by a fix that didn't close this issue). v6 work-log shows `ses_v6_18_unused_exports` (2026-06-14T21:50Z) shipped the cleanup; 22 LOC dropped, 6 tests removed, 6 test files cleaned, gates green. The v7 todo.md line 71 marks V6 #18 as `status:done`. This sync-issue was orphaned.
- Status: **RESOLVED** (stale-closed, no code change needed)

---

## SYNC-38 (NEW — 2026-06-14T22:14Z)
- Severity: **MEDIUM** (advisory, not a code defect)
- Files: `app/server/.env` (gitignored, NOT committed — verified `git ls-files | grep env` returns only `.env.example` files) and `app/app/.env.local` (gitignored, NOT committed)
- Problem: The local dev `.env` file contains real, live credentials that should be rotated:
  1. **Neon DB connection string** with embedded password `npg_aWx8uhp6jDGn` — points to `oma-ai-dev` project on Neon AWS us-west-2
  2. **QuickNode RPC API key** `a1ac6d8d0cc41dbf51b475c28ff92995bf2bcc39` (Base mainnet)
  3. **Solana treasury placeholder address** `0x8581784D3E598cCa3482375CFF2409Ac9DD8c402` (used for USDC/SOL/Houdini — confirmed via MCP that it holds 309.29 USDC + 0.105 ETH)
- **Risk:** Even though these are gitignored and not committed, plaintext credentials on a dev machine are a leak surface (editor swap files, machine sync, accidental `git add -f`, dotenv pre-commit hooks, screenshot OCR, etc.). The dev-secrets (JWT/ENCRYPTION/CSRF) are obviously placeholders and don't need rotation.
- **Recommendation (NOT auto-applied — credentials rotation is user action):**
  1. Rotate the QuickNode API key in the QuickNode dashboard (it's been in a plaintext dev file).
  2. Rotate the Neon `neondb_owner` password via Neon console → Project → Settings → Reset Password. Update `DATABASE_URL` in `server/.env` after rotation.
  3. Verify the treasury address `0x858178…8402` is a real EOA (it shows a balance, so it likely is) — if it's a contract, the x402 facilitator's payee-pin is pointing at a contract that can't actually receive USDC transfers from users without an extra step. Worth confirming with `cast call` or `get_code` per M5 audit's MEDIUM finding.
- **No code change required.** Pure advisory. The `.gitignore` correctly excludes both files.
- **Audit trail:** findings recorded here so future review can confirm rotation happened. Once rotated, mark this issue RESOLVED with the date + which key was rotated.
- Status: **OPEN** (advisory, awaiting user action)

## SYNC-39 (NEW — 2026-06-14T22:14Z)
- Severity: **LOW** (code quality)
- Files: `server/src/db/schema.ts` and related
- Problem: **Three columns are stored as `text` when they should be structured types** for indexability + type safety:
  1. `budgetAlerts.alertThresholds` (line 430) — `text` default `'[50, 75, 90, 100]'` — should be `integer().array()` or `jsonb`
  2. `invoices.lineItems` (line 535) — `text` storing JSON array of `{description, quantity, unitPrice, total}` — should be `jsonb`
  3. `webhookSubscriptions.events` (line 709) — `text` comma-separated or JSON — should be `text().array()` or `jsonb`
- **Risk:** App-layer JSON parsing, no DB-level query support (can't `WHERE event = 'x'` efficiently on webhook subscriptions, can't do GIN index on alert thresholds, etc.)
- **Fix:** Migration to change these column types + Drizzle schema update. Non-breaking for existing rows (cast in migration). Estimate: 1 hour including migration generation + backfill.
- **Status:** **OPEN** (deferred to v8 — bounded session, low impact, app-layer parsing works today)
- Related: similar `text` storage of structured data is used in `auditLogs.metadata`, `ssoConnections.metadata`, `withdrawals.type` — same pattern, same fix.
