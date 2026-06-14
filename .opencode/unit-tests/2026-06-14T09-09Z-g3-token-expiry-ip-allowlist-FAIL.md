# G3 — Token expiry + IP allowlist (Unit Review)

**Verdict: FAIL — cannot mark G3 complete. Implementation is present but broken.**

Date: 2026-06-14 ~09:09Z
Reviewer: Reviewer (subagent verification)

---

## What was reviewed

G3 from `.opencode/todo.md`:

> ## G3: Token expiry + IP allowlist | agent:Worker
> - [ ] Schema migration: add `expires_at`, `ip_allowlist` to `apiKeys` table
> - [ ] Update `server/src/auth/api-keys.ts` to validate these
> - [ ] Update `server/src/middleware/rbac.ts` to enforce
> - [ ] Tests in `server/src/__tests__/api-keys-extras.test.ts`
> - [ ] Verify: `cd server && npm run typecheck && npm test`

## Evidence collected

### What exists (positive)

- ✅ `server/src/db/schema.ts:67` — `ipAllowlist: text("ip_allowlist").array()` column added
- ✅ `server/src/db/migrations/0026_api_keys_ip_allowlist.sql` — 13-line migration, uses `ADD COLUMN IF NOT EXISTS` for zero-downtime, well-commented header
- ✅ `server/src/auth/api-keys.ts:34-121` — full validation library:
  - `normalizeIpOrCidr()` — trims, strips IPv6 zone-id, validates bare/CIDR
  - `isValidIpOrCidr()`
  - `validateIpAllowlist()` — validates array, throws on garbage
  - `ipToBigInt()` — IPv4/IPv6 → bigint for CIDR comparison
  - `ipMatchesCidr()` — strict family check (v4 vs v6)
  - `isIpAllowedByList()` — empty list = no restriction (no breaking change)
- ✅ `server/src/auth/api-keys.ts:128-160` — `createApiKey()` accepts `CreateApiKeyOptions { expiresAt, ipAllowlist }` and persists
- ✅ `server/src/auth/middleware.ts:12, 62-64` — `bearerAuth` imports `extractClientIp` and `isIpAllowedByList`, enforces with `403 ip_not_allowed`
- ✅ `server/src/__tests__/api-keys-extras.test.ts` — 30 tests, dedicated file
- ✅ `lsp_diagnostics` clean for `auth/api-keys.ts` and `db/schema.ts`

### What's broken (negative)

#### 1. The G3 test file itself fails (19/30 fail in isolation)

```
$ npx vitest run src/__tests__/api-keys-extras.test.ts
 Test Files  1 failed (1)
      Tests  19 failed | 11 passed (30)
```

Failure pattern:
- `rejects requests from IPs not in the allowlist (403 ip_not_allowed)` — got 200, expected 403
- `body.error?.code` — expected `"ip_not_allowed"`, got something else
- `rejects an IPv6 request that doesn't match an IPv4-only allowlist` — got 200, expected 403

The pure-helper unit tests (`isValidIpOrCidr`, `ipMatchesCidr`, `isIpAllowedByList`, `validateIpAllowlist`) appear to pass; the failures concentrate in the `bearerAuth` middleware integration tests.

#### 2. The G3 schema change broke 22+ other tests across 4+ files

Full server test suite:
```
 Test Files  4 failed | 65 passed (69)   ← 1st run
 Test Files  7 failed | 63 passed (70)   ← 2nd run
      Tests  43 failed | 751 passed (794)
```

Visible failing files (sample across runs):
- `src/__tests__/inference.test.ts` — 13 tests failing (HTTP 500 instead of 200/503/402)
- `src/__tests__/onramp.test.ts` — 4 tests failing
- `src/__tests__/search.test.ts` — 2 tests failing
- `src/__tests__/vendor-meta.isolated.test.ts` — 3 tests failing
- `src/inference/__tests__/claude.test.ts` — 21 tests failing (separate G1 task, also unimplemented)

#### 3. Typecheck fails in 2 test files

```
$ npx tsc --noEmit
src/__tests__/inference.test.ts(453,55): error TS2345
  Property 'ipAllowlist' is missing in type '{...}' but required in type '{...ipAllowlist: string[] | null; ...}'
src/__tests__/inference.test.ts(467,55): error TS2345
src/__tests__/inference.test.ts(480,55): error TS2345
src/__tests__/search.test.ts(104,53): error TS2345
src/__tests__/search.test.ts(124,53): error TS2345
```

Drizzle infers the new `ipAllowlist` field as **required** in `ApiKey` even though the column is nullable. The test mocks build `ApiKey` objects without the field.

#### 4. Process gaps

- ❌ **No work-log session** for G3 in `.opencode/work-log.md`. The most recent sessions are unrelated: `ses_docs_alignment_fix` (in progress), `ses_console_audit_reverify` (PASS).
- ❌ **todo.md G3 still shows all checkboxes as `[ ]`** (unchecked). The task is not marked done anywhere.
- ❌ **No unit test record** in `.opencode/unit-tests/` for G3.
- ❌ work-log claim of "Server tests: 771/771" is now **false** — actual is 751/794 with 43 failures.

## Verdict

**FAIL** — G3 cannot be marked complete. The implementation is real and the design is correct, but:

1. The G3 test file's own middleware-integration tests fail (19/30).
2. The schema change introduced a typecheck break + 22+ runtime regressions in 4 unrelated test files.
3. No work-log or todo evidence of who did this work.

## Action items for Worker

1. **Fix the middleware integration bug first**: investigate why `bearerAuth` returns 200 (not 403) when `x-forwarded-for` is outside `ipAllowlist`. Check the actual `extractClientIp(c)` return value under the test's Hono request, and confirm the mocked DB row's `ipAllowlist` is reaching `bearerAuth` intact.
2. **Fix the regression in other test files**: add `ipAllowlist: null` to every ApiKey mock object in:
   - `server/src/__tests__/inference.test.ts` (3+ places)
   - `server/src/__tests__/search.test.ts` (2+ places)
   - `server/src/__tests__/onramp.test.ts` (likely similar)
   - `server/src/__tests__/vendor-meta.isolated.test.ts`
3. **Re-run** `npx tsc --noEmit` (must be 0 errors) and `npx vitest run` (must be 0 failures).
4. **Add a work-log session** for G3 in `.opencode/work-log.md`.
5. **Mark todo.md G3** checkboxes only AFTER both checks pass.
6. **Write a unit test record** at `.opencode/unit-tests/2026-06-14T<HH-MM>Z-g3-*.md`.

## Sync issues filed

See `.opencode/sync-issues.md`:
- SYNC-1 — G3 test failures (19/30)
- SYNC-2 — G3 schema-change regression in other test files (22+ failures, 5 typecheck errors)
- SYNC-3 — Process gaps (no work-log session, todo.md not updated)
