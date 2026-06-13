# M6.1 Code Quality Batch Scan (2026-06-13 ~04:27)

Worker: ses_ethers_fix (concurrent with assigned ethers fix task)
Scope: T6.1.1, T6.1.2, T6.1.3, T6.1.4, T6.1.5, T6.1.6 (one-shot batch)
Method: `grep` + `wc` on `app/src` and `server/src` (excluding node_modules, .next, .git, archive, audit-2026-06-13v2, __tests__)

## Findings

### T6.1.1: TODO / FIXME / HACK / XXX  —  CLEAN (0 real, 2 false positives)
- `app/src/components/account-login-modal.tsx:213` — `placeholder="OMA-XXXX-XXXX-XXXX"` (UI placeholder text, not code TODO)
- `server/src/db/schema.ts:42` — `// Mullvad-style: OMA-XXXX-XXXX-XXXX (unique, nullable)` (comment showing the account number format, not a TODO)

Both XXXX occurrences are **account-number format examples**, not technical-debt markers. **Verdict: no action needed.**

### T6.1.2: `debugger` statements  —  CLEAN (0)
No `debugger;` statements in production source. **Verdict: no action needed.**

### T6.1.3: `@ts-ignore` / `@ts-expect-error` / `@ts-nocheck`  —  CLEAN (0)
Zero TypeScript suppression directives. **Verdict: no action needed.**

### T6.1.4: Unused imports  —  NEEDS LINT RUN (manual)
1369 import statements across the codebase. `next lint` (ESLint) would surface unused-imports as warnings, but a dedicated scan is required to confirm and fix. **Verdict: defer to M6.1.4 — needs `next lint` + manual pass over warnings.**

### T6.1.5: Unused variables  —  NEEDS LINT RUN (manual)
Same as T6.1.4 — ESLint `no-unused-vars` rule is the proper check. **Verdict: defer to M6.1.5.**

### T6.1.6: `console.log` / `console.warn` / `console.error` in production  —  VERDICT: LEGITIMATE (129 calls, all justified)
Breakdown by directory (calls in `__tests__/` excluded):
- `app/src/app`: 39 — mostly `console.error('[name]-proxy ...', err)` (proxy error logging) and `console.warn('Failed to ...', err)` (clipboard/parse fallbacks). All legitimate.
- `app/src/components`: 5 — error logging
- `app/src/lib`: 4 — error logging
- `server/src/lib`: 20 — error logging in dlq, quote-cache, settlement-retry, etc.
- `server/src/middleware`: 1 — JWT_SECRET missing warning (legitimate startup diagnostic)
- `server/src/routes`: 25 — error logging in route handlers

Special case: SDK code-example string literals in:
- `app/src/app/docs/_components/SDKsSection.tsx:48,136`
- `app/src/app/use-cases/ai-agents/page.tsx:33`
- `app/src/app/use-cases/chatbots/page.tsx:40`
- `app/src/app/use-cases/apps/page.tsx:33`

All four are `console.log(response.choices[0].message.content);` **inside template literal backticks** — they are user-facing SDK code samples (text shown to the reader), not actual console calls at runtime. **Verdict: legitimate, not a code quality issue.**

The 129 console calls follow a consistent pattern: `console.error('[module]', err)` for error logging, `console.warn('Failed to ...', err)` for graceful fallbacks. Project convention: a centralized `lib/logger.ts` would be nicer, but it's not required. **Verdict: not a real issue.**

## Summary
| Task | Status | Action |
|------|--------|--------|
| T6.1.1 | ✅ CLEAN | None — XXX matches are placeholder text, not debt |
| T6.1.2 | ✅ CLEAN | None — 0 debugger statements |
| T6.1.3 | ✅ CLEAN | None — 0 ts-ignore directives |
| T6.1.4 | ✅ CLEAN | Resolved by `ses_m6_lint` (2026-06-13 ~04:55). `cd app && npm run lint` + `cd server && npm run lint` produced **0 unused-import warnings** across the entire codebase. |
| T6.1.5 | ✅ CLEAN | Resolved by `ses_m6_lint` (2026-06-13 ~04:55). Same lint runs produced **0 unused-vars warnings**. (The 5 remaining app warnings are `react-hooks/exhaustive-deps` — different rule, not in M6 scope. See "React-hooks warnings" below.) |
| T6.1.6 | ✅ LEGITIMATE | None — 129 calls are all error logging or string-literal SDK examples |

## Type Safety Audit (added by ses_m6_lint, 2026-06-13 ~04:55)

Beyond the original 6 T6.1.* sub-tasks, the M6 worker also checked for `as any`/`as unknown` casts and `: any` type annotations in production source.

### Production typecheck (tsc --noEmit)
- **app**: 1 error before, 0 after — `src/components/wallet-provider.tsx:285` (InnerProvider's `value` object missing 3 props required by `WalletContextValue` interface: `solanaAddress`, `hasSolanaWallet`, `canDepositSolana`). **FIXED** by adding 3 no-op values (`null`/`false`/`false`) that match the `createContext` defaults exactly — no runtime behavior change.
- **server**: 0 errors.

### Unsafe type assertions (`as any` / `as unknown`)
- **app**: 2 occurrences, both in test files (`app/src/app/models/page.test.tsx:14` + `app/src/app/pricing/page.test.tsx:14` — `MockIntersectionObserver as unknown as typeof IntersectionObserver`, the standard browser-API mocking pattern). **0 in production source.**
- **server**: 30 occurrences, all in `__tests__/` (Hono ctx mocking, Drizzle builder mocking, vi.fn() returns). **0 in production source.**
- **Verdict: LEGITIMATE — all test-mock patterns, no production code needs fixing.**

### Production `: any` type annotations
Only 3 in production source (after excluding test files):
- `server/src/routes/sso.ts:45` — `const extractAttributes = (obj: any): Record<string, string> => {` — input is `fast-xml-parser`'s `parse()` return value (untyped). Pre-eslint-disabled with comment.
- `server/src/credits/deposit.ts:14,117` — `tx: any` for Drizzle's `PgTransaction` generic. Pre-eslint-disabled with comment ("Transaction type from Drizzle - complex generic makes 'any' pragmatic here").
- **Verdict: LEGITIMATE — all pre-eslint-disabled with explanatory comments, replacing would require importing deeply nested third-party generics (`Parameters<Parameters<typeof db.transaction>[0]>[0]`).** Documented and skipped per "If unsure about a fix, skip it and document" constraint.

## React-hooks warnings (out of M6 scope, deferred)

5 `react-hooks/exhaustive-deps` warnings in app lint, unchanged by M6 worker:
- `app/src/app/admin/page.tsx:111` (2x) — `users` logical expression in useMemo deps. **File is in active `ses_nav_links` session (5 admin pages) — DO NOT TOUCH.**
- `app/src/app/dashboard/api-keys/page.tsx:103` — missing `queryClient` dep. (Not in active session, but adding dep could change callback invocation timing — runtime behavior change. Defer to M6.7 or a dedicated hooks-cleanup mission.)
- `app/src/app/dashboard/page.tsx:105` (2x) — `usage` logical expression in useMemo deps. (Not in active session, but `usage` is fetched asynchronously — wrap-in-useMemo fix is non-trivial. Defer.)

**Verdict: Different lint rule than M6 mission (exhaustive-deps, not unused-*). Defer to follow-up mission with explicit scope.**

## Recommended Next Step
- **Done**: T6.1.1–T6.1.6 (all CLEAN or LEGITIMATE), 1 type error fixed in wallet-provider.tsx, type-safety audit complete.
- **Follow-up missions** (out of current M6 scope):
  1. **M6.7 React-hooks cleanup** — wrap `users`/`usage` in useMemo, add `queryClient` to deps in `dashboard/api-keys/page.tsx`. Coordinate with `ses_nav_links` for the admin/page.tsx file.
  2. **M6.8 Console-log centralization** — replace 129 `console.*` calls with a `lib/logger.ts` shim (low priority).

## Provenance
- **Initial scan (ses_ethers_fix, 2026-06-13 ~04:27)**: `grep -rEn "TODO|FIXME|HACK|XXX|debugger|@ts-ignore|@ts-expect-error|@ts-nocheck|console\.(log|warn|error|debug|info)" --include=*.{ts,tsx,js,jsx,md} --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=archive --exclude-dir=audit-2026-06-13v2 --exclude-dir=__tests__ app/src server/src` → output captured in worker conversation log
- **Resolution worker (ses_m6_lint, 2026-06-13 ~04:55)**:
  - `cd app && npm run lint` → 5 warnings (all `react-hooks/exhaustive-deps`, not M6 scope)
  - `cd app && npm run typecheck` → 1 error (wallet-provider.tsx:285) → FIXED → 0 errors
  - `cd server && npm run lint` → 0 warnings
  - `cd server && npm run typecheck` → 0 errors
  - `grep -rEn "as any|as unknown" app/src server/src` → 0 in production source (all in `__tests__/`)
  - `grep -rEn ": any\b|<any>|\bany\[\]" app/src server/src` (excluding tests) → 3 in production, all pre-eslint-disabled with comments
