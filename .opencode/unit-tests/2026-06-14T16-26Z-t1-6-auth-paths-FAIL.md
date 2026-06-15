# T1.6 Audit Auth Paths — Unit Review

**Date:** 2026-06-14T16:25Z
**Reviewer:** ses_t1_6_auth_review (Reviewer)
**Scope:** v7 todo.md T1.6 — "Worker — Audit all 4 auth paths (jwt, siwe, solana, api-keys)"

## VERDICT: FAIL

**Task never executed.** No audit deliverable, no work-log session, no unit test record. 9th occurrence of the orchestrator-side empty-output pattern (after M4/SYNC-15, M6/SYNC-23, M7/SYNC-21, M8/SYNC-22, Venice/SYNC-24, x402/SYNC-25, Config+env/SYNC-26, deposit-routes/SYNC-33, docs-staleness/SYNC-33).

## Evidence (fresh, 2026-06-14T16:23-16:26Z)

### 1. todo.md state
- T1.6 in `.opencode/todo.md:41` is still `[ ]` pending
- Whole M1 ("Parallel Research") has 0 of 8 tasks complete

### 2. No audit deliverable
- `.opencode/audit-2026-06-14v6/` exists but contains only `final-report.md` (v6 M14 report, NOT a v7 auth audit)
- `.opencode/audit-2026-06-14v7/` does not exist
- No file in `.opencode/`, `docs/`, or git history matches "auth-paths", "auth-audit", "auth-paths-audit"

### 3. No work-log session
- `.opencode/work-log.md` Active Sessions: 4 Planner + 3 Worker sessions dispatched at 2026-06-14T19:20-21Z, all still `[ ]` in_progress
- Zero sessions reference "auth paths" or any of the 4 auth surface names (jwt, siwe, solana, api-keys)
- grep `T1\.6` in work-log.md → 0 matches

### 4. No unit test record
- `.opencode/unit-tests/` directory is EMPTY (size 0; previously held 28 records, all marked `D` deleted in `git status`)
- T1.6 has no review record at the expected path `.opencode/unit-tests/[ts]-t1-6-auth-paths.md`

### 5. Auth code is intact, no audit-driven edits
- `server/src/auth/{account-number,api-keys,encryption,middleware,siwe,solana}.ts` all present, last modified 2026-06-12 to 2026-06-14 (prior work, not v7 audit)
- 1,425 LOC across 6 auth files (per `wc -l`)

## Code Quality / Modularity Spot-Check (bonus)

The auth surface is actually well-modularized. Lsp_diagnostics clean, typecheck 0, lint 0, all 19 auth.test.ts cases pass. Quick structural notes (no fixes applied, per the Reviewer's "NEVER implement fixes" rule):

### ✅ Strengths
- **Layer separation:** `account-number.ts` (low-level derivation) / `api-keys.ts` (validation + caching + IP allowlist) / `middleware.ts` (Hono context integration) / `siwe.ts` (JWT mint+verify) / `solana.ts` (Ed25519 verify) — clean responsibility split
- **Defensive defaults:** `algorithms: ["HS256"]` pinned in `verifySessionToken` (C10 comment), `clockTolerance: 5` set, `AUTH_METHODS` Set allowlist in siwe.ts:19
- **Timing-safe comparison:** `crypto.timingSafeEqual` in api-keys.ts:19 (correctly wraps in length-check first to avoid throwing)
- **Reuse over duplication:** `assertValidSolanaAddress` is the single entry point for Solana address validation (solana.ts:11)
- **Cookie regex safety:** `match = cookieHeader.match(/(?:^|;\s*)(?:__Host-)?oma_api_key=([^;]+)/)` (middleware.ts:49, 138) — bounded character class, no ReDoS surface
- **G3 IP allowlist (SYNC-1 fix):** `isIpAllowedByList` + `extractClientIp` working correctly per f521bce; tests pass

### ⚠️ Concerns (read-only — no fixes)
- **Session expiry of 24h (siwe.ts:108) is hard-coded** — not configurable via env. Acceptable for current dev scope but should be `config.SESSION_TTL` when teams/sso land.
- **Redis client optionality in siwe.ts:62, solana.ts uses no Redis** — Solana challenges write to DB only (no `nonce:{address}` cache, so every challenge is a DB read). Ponytail fix: add Redis nonce cache to match siwe.ts pattern. But this is speculative (Solana volume currently low).
- **2FA fail-key in middleware.ts:96 is per-user with no ip-binding** — a stolen session token + 2FA brute force from rotating IPs would not trip the 300s lockout as fast. Add `2fa_fail:{userId}:{ip}` if abuse observed.
- **admin wallet addresses validated at boot (middleware.ts:35-37) only in production** — silent acceptance of malformed `ADMIN_WALLET_ADDRESSES` in dev. The error message would still be loud (`process.exit(1)`), so this is acceptable.
- **`sessionAuth` 2FA check (middleware.ts:90-126) is 36 LOC of nested if/try** — strong candidate for extraction to `verify2faForUser(userId, code, redis)`. Ponytail fix: 1-line extract, no behavior change. Skip unless 2FA logic grows.
- **No auth.test.ts coverage for `optionalAuth` or `requireAdmin` paths** — only `bearerAuth` + `sessionAuth` indirectly via `/auth/nonce` + `/auth/verify` + `/auth/solana/*`. The 19 passing tests cover the routes, not the middleware directly.

### 🐛 Likely real issues a Worker would find (if dispatched)
- `verifySessionToken` catches all errors and returns `null` (siwe.ts:137) — masks token-tampering from logs. Should `logger.warn` on the catch.
- `bearerAuth` (middleware.ts:39-75) does NOT rate-limit failed API-key attempts — a credential-stuffing attacker can grind forever. Should add `429` after N consecutive 401s (Redis-backed counter, same pattern as 2FA fail-key).
- `optionalAuth` (middleware.ts:131-149) silently swallows `validateApiKey` failures — if Redis is down and the cache returns null, the user is treated as anonymous, not as having a broken session. Acceptable for "optional", but a `logger.debug` on the path would help debugging.
- IP-allowlist bypass possible when `c.req.header("X-Forwarded-For")` contains a comma-separated list and no trusted proxy is configured: `extractClientIp` returns first hop, which can be spoofed. The 401-vs-403 split is correct (allowlist = 403) but the source-of-truth is the request header. Out of scope (infra config), not a code defect.

## Required corrective action (per Commander → Worker)

1. Re-dispatch T1.6 with explicit deliverable contract:
   - Write `.opencode/audit-2026-06-14v7/auth-paths.md` (or similar) with per-file findings, severity, fix snippets for `auth/{account-number,api-keys,encryption,middleware,siwe,solana}.ts` + the 4 unit-test gaps + the 4 likely-real issues above
   - Write `.opencode/unit-tests/[ts]-t1-6-auth-paths.md` with verification gates
   - Update work-log.md with session entry marked `[x]`
2. Set `model: "opencode/big-pickle"` on the subagent session.prompt (per AGENTS.md "Subagent model fix 2026-06-14") — M3 produces empty output 9 out of 9 times in this pattern
3. Only then mark `T1.6 [x]` in todo.md after Reviewer re-verification

## Gates re-run this review (no code change, just to confirm baseline)

| Gate | Command | Result |
|------|---------|--------|
| lsp | `lsp_diagnostics server/src/auth/{middleware,api-keys,siwe,solana,encryption}.ts` | clean (5/5 files) |
| typecheck | `cd server && npm run typecheck` | exit 0, 0 errors |
| lint | `cd server && npm run lint` | exit 0, 0 errors |
| test | `cd server && npx vitest run src/__tests__/auth.test.ts` | **19/19 passed, 2.01s** |
| test (full) | `cd server && npm test` (re-confirmed from prior session) | 73 files / 863 tests pass |

No regressions detected. The auth code is shippable; the audit deliverable is what's missing.
