# OMA-AI Code Quality & Redundancy Audit
**Date:** 2026-07-18  
**Scope:** `app/src/` (~322 files) + `server/src/` (~205 files) = ~527 TypeScript source files  
**Total LOC:** ~45,000+ lines

---

## Executive Summary
The codebase is well-structured with good architectural boundaries (Next.js App Router + Hono server). Centralized utilities (`lib/utils.tsx`, `lib/validation.ts`) are used consistently. No critical dead code found. Primary issues are **duplicate validation patterns**, **inconsistent error formatting**, **scattered magic numbers**, and **boilerplate repetition** in route handlers.

---

## 1. Code Quality Issues (Conventions, Naming, Structure)

| # | File | Lines | Issue | Evidence | Recommended Fix |
|---|------|-------|-------|----------|-----------------|
| 1 | `server/src/db/schema.ts` | 54, 70, 83, 91, 101, 116, 124, 134, 149, 154, 160, 175, 193, 199, 202, 203, 220, 233, 238, 239, 240, 249, 298, 310, 325, 332, 337 | **DB columns use `snake_case`, TS uses `camelCase`** | `neonAuthUserId` (TS) ↔ `neon_auth_user_id` (DB), `userId` ↔ `user_id` | This is standard Drizzle practice. Document convention in `AGENTS.md`. No code change needed. |
| 2 | `app/src/components/auth/WalletStatus.tsx` | 12-15 | **Boolean prefix inconsistency** | `truncateAddress` (verb) vs `formatAddress` (noun) in `lib/utils.tsx` | Rename to `formatAddress` to match centralized utility; delete local copy. |
| 3 | `server/src/middleware/rate-limit/utils.ts` | 21, 31, 74, 78, 88 | **Mixed exported constants & functions** | `MODEL_LIMITS`, `extractClientIp`, `getModelLimits`, `getRateLimitKey` all exported from one file | Split into `model-limits.ts` (constants) and `rate-limit-utils.ts` (functions). |
| 4 | `app/src/lib/utils.tsx` | — | **Missing `cn` utility export** | `cn` is in `components/ui/utils.ts` but not in `@/lib/utils` | Re-export `cn` from `lib/utils.tsx` for consistent import path (`@/lib/utils`). |
| 5 | `app/src/lib/text.ts` | 1-3 | **Single-function file** | Only exports `estimateTokens` (3 lines) | Move to `lib/utils.tsx` or `lib/token-utils.ts`; delete `text.ts`. |
| 6 | `app/src/app/image-generation/page.tsx` | 1-6 | **Thin wrapper page** | Only imports and renders `ImageGenerationPanel` | Normal for App Router. No action needed. |
| 7 | `server/src/routes/auth.ts` | 718 | **Route file too large** | 718 lines, handles SIWE, 2FA, API keys, account numbers | Split into `auth-siwe.ts`, `auth-2fa.ts`, `auth-keys.ts`, `auth-account.ts`. |

---

## 2. Duplicate Code (Exact + Near)

| # | Pattern | Locations | Evidence | Recommended Fix |
|---|---------|-----------|----------|-----------------|
| 1 | **Address truncation** | `app/src/components/auth/WalletStatus.tsx:12-15` (local `truncateAddress`) vs `app/src/lib/utils.tsx:63-67` (`formatAddress`) | Both do `addr.slice(0,6)…addr.slice(-4)`; threshold differs (10 vs 14) | Delete `truncateAddress` in `WalletStatus.tsx`; import `formatAddress` from `@/lib/utils`. |
| 2 | **Copy-to-clipboard timeout** | 7+ files: `settings/page.tsx:241`, `ChatPlaygroundShell.tsx:292/296/314/318/337/341`, `ChatErrorBanner.tsx:240`, `models/page.tsx:162`, `docs/shared.tsx:395`, `dashboard/api-keys/page.tsx:73`, `dashboard/page.tsx:136`, `home/code-example.tsx:76`, `ChatMessageRedesign.tsx:111/444`, `WalletStatus.tsx:35`, `SiwePreview.tsx:33` | All use `setTimeout(() => setCopied(false), 1500-2000)` | Create `hooks/useCopyToClipboard.ts` returning `{ copy, copied }` with configurable timeout. |
| 3 | **Focus input timeout** | `ChatPlaygroundShell.tsx:250`, `useStreamingChat.ts:558`, `DocsSearch.tsx:120/160` | `setTimeout(() => inputRef.current?.focus(), 50-100)` | Create `hooks/useFocusOnMount.ts` or utility `focusAfterRender(ref, delay?)`. |
| 4 | **Duplicate transaction check** | `server/src/routes/deposit/usdc.ts:200`, `cctp.ts:30`, `lifi.ts:38` | Identical: `const existing = await db.select({ id: deposits.id }).from(deposits).where(eq(deposits.txHash, txHash)).limit(1)` | Extract to `credits/deposit-utils.ts` → `async function checkDuplicateDeposit(txHash)`. |
| 5 | **Zod validation + error response** | ~40 route handlers (see `grep "if (!parsed.success)"`) | 3 patterns: `validationError(parsed.error)`, inline `{error:{message:"Invalid request",details:...}}`, `c.json(validationError(...), 400)` | Standardize on `validationError` helper; add middleware `validateBody(schema)` wrapper. |
| 6 | **`c.get("userId")` repetition** | 50+ occurrences across routes | Every handler starts with `const userId = c.get("userId")` | Create `getUserId(c)` helper or middleware that attaches typed `userId`. |
| 7 | **Amount-to-cents conversion** | `app/src/lib/utils.tsx:11-16` (`toDollars`) + `formatCents` used in 20+ components | Good centralization, but `toDollars` and `formatCents` overlap | Deprecate `formatCents`; use `formatUsd(toDollars(cents))`. |
| 8 | **Format tokens** | `app/src/app/dashboard/_components/QuickStatsCard.tsx:27` (local `formatTokens`) | Only used once; not in `lib/utils` | Move to `lib/utils.tsx` as `formatTokens(n: number): string`. |

---

## 3. Dead Code / Unused Exports

| # | File | Issue | Evidence | Recommended Fix |
|---|------|-------|----------|-----------------|
| 1 | `app/src/components/ui/charts/shared.tsx:90` | **Stale comment** | `// \`formatAddress\` is consolidated in \`src/lib/utils.tsx\`.` but `formatAddress` is not imported/used in this file | Remove comment. |
| 2 | `server/src/lib/logger.ts` | **Potentially unused** | Exports `logger` but many routes import from `../lib/logger.js` | Verify all imports; if unused, remove. |
| 3 | `server/src/routes/missing-routes.ts` | **Placeholder route file** | Only 27 lines, likely for 404 handling | Confirm purpose; if unused, delete. |
| 4 | `app/src/app/api/v1/deposit/usdc/_proxy.ts` | **Proxy route** | May be legacy from audit (2026-07-15) | Verify if still called by frontend; if not, delete. |
| 5 | `server/src/auth/account-number.ts` | **Legacy format support** | Comments reference "legacy OMA-XXXX format" (lines 14, 37) | If no old accounts exist, remove legacy parsing. |
| 6 | `app/src/app/docs/sections/sdks.tsx:42/210/386` | **Console.log in docs** | Code examples contain `console.log(...)` | Expected in documentation examples. No action. |
| 7 | `server/src/config.ts:269-417` | **Config validation logs** | Many `console.error("[FATAL]...")` for startup validation | Appropriate for boot-time config checks. No action. |

---

## 4. Unused / Stale Imports (Barrel Files)

| # | Barrel File | Stale Exports | Action |
|---|-------------|---------------|--------|
| 1 | `app/src/components/ui/charts/index.ts` | Exports `AreaChartComponent`, `BarChartComponent`, `DonutChart`, `CHART_PALETTE` — verify all used | Run `madge --circular --extensions ts,tsx app/src/components/ui/charts` to detect unused. |
| 2 | `app/src/components/chat/index.ts` | Exports `ExampleConversation`, `Message`, `SearchResult`, `FALLBACK_MODELS`, `useLiveModels` | Check each import site; remove unused. |
| 3 | `app/src/components/auth/index.ts` | Exports `AuthError`, `shapeAuthError`, `AuthSkeleton`, `SiwePreview`, `WalletPicker`, `WalletStatus` | Verify `AuthSkeleton` and `shapeAuthError` are used. |
| 4 | `server/src/middleware/rate-limit.ts` | Re-exports all sub-modules (`lua-scripts`, `memory-store`, `sliding-window`, `token-bucket`, `utils`) | Good pattern; no action unless specific sub-exports unused. |

---

## 5. Superseded Implementations

| # | Area | Evidence | Recommended Fix |
|---|------|----------|-----------------|
| 1 | **Deposit routes** | `usdc.ts`, `cctp.ts`, `lifi.ts`, `router.ts`, `status.ts`, `balance.ts` all co-exist | Audit 2026-07-15 fixed `/api/keys`, `/v1/keys`, `/v1/usage/export`. Verify no dead `/v1/deposit/*` paths remain. |
| 2 | **Legacy account number** | `server/src/auth/account-number.ts` handles "OMA-XXXX" format | If migration complete, delete legacy parsing. |
| 3 | **App swap folder** | Not found in `app/src/app/` — confirmed removed per 2026-07-15 audit | Verified clean. |
| 4 | **Auth routes** | `auth.ts` (718 lines) likely supersedes older split files | Already consolidated. No action. |

---

## 6. Misplaced Code

| # | File | Issue | Evidence | Recommended Fix |
|---|------|-------|----------|-----------------|
| 1 | `server/src/routes/credits.ts` | **Business logic in routes** | Direct `db.insert(deposits)`, `db.select().from(usageRecords)`, auto-reload config logic (lines 57-95, 141-185, 228-267) | Move to `credits/service.ts` or `credits/purchase-service.ts`. |
| 2 | `server/src/routes/deposit/*.ts` | **DB queries in routes** | Duplicate `db.select().from(deposits).where(eq(deposits.txHash...))` in usdc/cctp/lifi | Extract to `credits/deposit-repository.ts`. |
| 3 | `server/src/routes/analytics.ts` | **Raw SQL & aggregations in routes** | Complex `db.select` with `sql` template strings (lines 29-125) | Move to `analytics/service.ts`. |
| 4 | `server/src/routes/config.ts` | **Config parsing in routes** | `zod` parsing of stored JSON configs (lines 61-133) | Move to `config/service.ts`. |
| 5 | `app/src/components/dashboard/ProviderHealthCard.tsx` | **Component calls API hook** | Uses `useHealthQuery()` which fetches `/api/health` | Acceptable (React Query pattern). No action. |
| 6 | `app/src/lib/api/*.ts` | **API client in lib/** | `lib/api/admin.ts`, `lib/api/credits.ts`, `lib/api/usage-chart.ts` | Move to `lib/api/` (already there). Good. |
| 7 | `server/src/lib/validation.ts` | **Tiny helper** | Only 5 lines: `validationError(err: ZodError)` | Keep; used in 20+ routes. Good centralization. |

---

## 7. Magic Numbers / Non-Centralized Constants

| # | File | Lines | Constant | Recommended Fix |
|---|------|-------|----------|-----------------|
| 1 | `app/src/app/chat/_hooks/useStreamingChat.ts` | 14, 293, 302, 313, 339 | `MAX_MESSAGE_LENGTH = 100*1024`, `SSE_BUFFER_MAX_BYTES = 1024*1024` | Move to `lib/constants.ts` or `chat/constants.ts`. |
| 2 | `app/src/app/api/v1/images/generations/route.ts` | 12, 38, 67, 98 | `MAX_BODY_BYTES = 1*1024*1024`, `AbortSignal.timeout(60_000)` | Centralize in `lib/http-constants.ts`. |
| 3 | `app/src/app/api/v1/videos/generations/route.ts` | 12, 38, 68, 99 | Same as images | Deduplicate with shared constant. |
| 4 | `app/src/app/api/v1/videos/retrieve/route.ts` | 69 | `AbortSignal.timeout(60_000)` | Shared timeout constant. |
| 5 | `app/src/app/api/auth/logout/route.ts` | 26 | `AbortSignal.timeout(2_000)` | Shared constant. |
| 6 | `app/src/app/api/auth/csrf-token/route.ts` | 24 | `AbortSignal.timeout(60_000)` | Shared constant. |
| 7 | `app/src/app/api/auth/account/create/route.ts` | 31 | `AbortSignal.timeout(60_000)` | Shared constant. |
| 8 | `app/src/app/api/auth/account/login/route.ts` | 29 | `AbortSignal.timeout(60_000)` | Shared constant. |
| 9 | `app/src/app/api/user/route.ts` | 26 | `timeoutMs: 5_000` | Shared constant. |
| 10 | `app/src/app/api/keys/route.ts` | 30 | `timeoutMs: 10_000` | Shared constant. |
| 11 | `app/src/app/api/keys/[id]/route.ts` | 37 | `timeoutMs: 10_000` | Shared constant. |
| 12 | `app/src/app/api/rpc/[chain]/route.ts` | 112 | `AbortSignal.timeout(15_000)` | Shared constant. |
| 13 | `app/src/app/api/pricing/crypto/route.ts` | 39 | `revalidate: 30`, `timeout: 60_000` | Shared constant. |
| 14 | `app/src/components/chat/VideoGenerationPanel.tsx` | 114, 118 | `maxAttempts = 40` | Move to `chat/constants.ts`. |
| 15 | `app/src/lib/wagmi.ts` | 78-84 | `retryCount: 3`, `retryDelay: 200` | Move to `lib/wagmi-config.ts`. |
| 16 | `server/src/middleware/timeout.ts` | 13 | `setTimeout` with implicit timeout | Uses default; document. |
| 17 | `server/src/middleware/idempotency.ts` | 46 | `setTimeout(r, 200)` | Move to constant. |
| 18 | `server/src/inference/base.ts` | 343 | Retry delay calculations | Already parameterized via `exponentialDelay + jitter`. Good. |
| 19 | `server/src/jobs/deposit-notifications.ts` | 58, 66 | `WEBHOOK_RETRY_DELAY_MS * (retries + 1)` | Constant defined at top. Good. |

---

## 8. Test Hygiene

| # | File | Issue | Evidence | Recommended Fix |
|---|------|-------|----------|-----------------|
| 1 | `app/src/test/setup.ts` | **Only setup file** | No actual test files in `app/src/test/` | Move component tests to `__tests__/` co-located (already done for most). |
| 2 | `app/src/app/page.test.tsx` | **Good coverage** | 13 tests with real assertions | Keep. |
| 3 | `app/src/app/models/page.test.tsx` | **Good coverage** | 11 tests with assertions | Keep. |
| 4 | `server/src/__tests__/config.test.ts` | **Good** | 15 tests with `expect` assertions | Keep. |
| 5 | `server/src/__tests__/vendor-meta.isolated.test.ts` | **Excellent** | 18 tests covering shape, secrets, immutability | Model for other tests. |
| 6 | **Missing tests** | No tests for `lib/utils.tsx`, `lib/validation.ts`, `components/auth/WalletStatus.tsx` | Critical utilities untested | Add unit tests for `formatAddress`, `toDollars`, `formatUsd`, `validationError`. |
| 7 | **Snapshot tests** | None found (no `.snap` files) | Good — no stale snapshots | N/A. |

---

## 9. Configuration Bloat

| File | Issue | Details |
|------|-------|---------|
| `app/tsconfig.json` | **Clean** | Standard Next.js config; no unused options. |
| `server/tsconfig.json` | **Clean** | Standard Node/ESM config. |
| `app/eslint.config.mjs` | **Clean** | Extends `next/core-web-vitals` + `next/typescript`; sensible rules. |
| `server/eslint.config.js` | **Missing** | Uses flat config at root? Not found in server/ | Add server-specific eslint config or confirm root config covers it. |
| `app/package.json` | **Dependencies** | 17 runtime deps — all appear used (viem, wagmi, siwe, recharts, framer-motion, etc.) | Run `depcheck` to verify. |
| `server/package.json` | **Dependencies** | 20 runtime deps — all appear used (hono, drizzle-orm, pino, redis, etc.) | Run `depcheck` to verify. |

---

## 10. Strengths

| Area | Evidence |
|------|----------|
| **Centralized utilities** | `lib/utils.tsx` consolidates `formatAddress`, `formatUsd`, `toDollars`, `formatTime`, `formatDateTime`, `formatDateShort`, `maskKey`, `formatCents` — used across 40+ components. |
| **Validation helper** | `lib/validation.ts` provides consistent `validationError` used in 20+ routes. |
| **Type safety** | Strict TypeScript, Zod schemas for all route inputs, Drizzle for DB. |
| **Test quality** | Server tests use isolated mocks, secret-leak guards, shape contracts. |
| **Error handling** | `errorResponse` wrapper in `lib/api-errors.ts`; structured error codes. |
| **Audit logging** | Centralized `auditLog` middleware with consistent metadata. |
| **Rate limiting** | Sophisticated token-bucket + sliding window with Redis + Lua scripts. |
| **Config validation** | Startup-time `console.error("[FATAL]...")` catches misconfig before traffic. |
| **Documentation** | Docs sections (`shared.tsx`) export typed constants for endpoints, errors, pricing. |

---

## Summary of Top 10 Action Items

| Priority | Action | Est. Effort |
|----------|--------|-------------|
| 1 | Extract `useCopyToClipboard` hook (7+ duplicate `setTimeout` patterns) | 2h |
| 2 | Create `validateBody(schema)` middleware to unify 3 validation patterns | 3h |
| 3 | Move business logic from `credits.ts`/`deposit/*.ts`/`analytics.ts` to service layer | 8h |
| 4 | Centralize HTTP timeouts & body limits in `lib/http-constants.ts` | 1h |
| 5 | Delete `truncateAddress` in `WalletStatus.tsx`; use `formatAddress` from `lib/utils` | 0.5h |
| 6 | Add unit tests for `lib/utils.tsx` functions | 2h |
| 7 | Split `auth.ts` (718 lines) into 4 route files | 4h |
| 8 | Remove stale comment in `charts/shared.tsx:90` | 0.1h |
| 9 | Move `estimateTokens` from `lib/text.ts` to `lib/utils.tsx`; delete `text.ts` | 0.5h |
| 10 | Run `depcheck` on both `app/` and `server/` to confirm no unused deps | 0.5h |

---

**Total estimated cleanup effort:** ~22 hours

*Generated by automated audit — verify findings before acting.*