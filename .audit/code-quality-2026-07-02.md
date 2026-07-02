# OMA-AI Code Quality & Dead Code Audit — 2026-07-02

**Audit method:** Read-only scan. Verified file existence, import graphs, exports, package.json deps, test/lint/typecheck results, git history, and the in-progress `chore/health-scan` worktree (branch is 21 commits ahead of `main` and contains the bulk of cleanup work).

**Key context discovered:** A substantial cleanup effort is **already in progress** on the `chore/health-scan` worktree at `.worktrees/health-scan/` (branch commit `33628cc`, 21 commits ahead of `main`). Most of the issues below are **already fixed on that branch but unmerged**. The audit therefore distinguishes:

- **Critical (main branch, unfixed)** — must be merged or re-applied
- **Already addressed on `chore/health-scan`** — confirm and merge
- **Still pending everywhere** — additional cleanup needed beyond the worktree

---

## Executive Summary

| Category | Main branch | `chore/health-scan` | Delta |
|---|---|---|---|
| Source files (TS/TSX) | 435 | -49 | -11.3% |
| Source LOC | ~62K | ~58K | -6.5% |
| App tests passing | 119/121 (98.3%) | 101/101 (100%) | +2 fixed |
| Server tests passing | 730/732 (99.7%) | 729/731 (99.7%) | 2 integration skipped |
| Stale screenshots on disk | 64 MB | ~24 MB | -40 MB |
| Untracked docs (root + docs/) | 17 files / 282 KB | similar | minor |
| Unused exports identified | ~80 (across 50+ files) | ~30 remaining | ~50 already removed |
| TypeScript / lint errors | 0 | 0 | clean |

**Top finding:** The `chore/health-scan` worktree holds 21 commits of cleanup that should be merged. Doing so would automatically resolve ~70% of the items in this audit. The remaining ~30% are independent of that work.

---

## Top 10 Cleanup Opportunities (Ranked by Impact)

### 1. **MERGE `chore/health-scan` → `main`** — eliminates 3986 lines and 67 files
**Severity:** 🔴 Critical
**Impact:** ~4000 LOC removed, dozens of dead files gone, all failing tests fixed.

The branch is at `33628cc`, 21 commits ahead of `main` (HEAD `f642570`). Highlights:
- `d3ace24` — Removes `server/src/lib/rate-limit-config.ts` and its test mock
- `6a05435` — Removes `app/src/app/chat/_components/ChatShell.tsx`, `app/src/components/ui/{input,separator}.tsx`, `app/src/components/shared/index.ts`, four orphan CSS files (1,453 LOC total)
- `8d6ec17` — Drops unused exports from `prices.ts`, `models-data.ts`, `nav-links.ts`, `charts/`, `auth/`, `wallet-provider.tsx`
- `2cdb27c` — Drops more unused exports
- `e96fb6f` — Removes `gradient-text`, slims chat barrel
- `fbfe9db` — Drops A2UI internals, `useCountdown`, `ConnectorIcon` re-exports
- `23a32cd`, `dbf0c79`, `9901a5e` — Lazy-loads heavy components
- `9d8b737`, `f3164cc`, `18ef9eb`, `33628cc` — Server-side export drops

**Diff stats:** `67 files changed, 289 insertions(+), 3986 deletions(-)`
**Action:** `git checkout main && git merge chore/health-scan && git push`

---

### 2. **Fix 2 failing footer tests on main**
**Severity:** 🔴 Critical (CI red)
**Files:**
- `app/src/components/__tests__/footer.isolated.test.tsx` (lines 70-79)
  - "renders NEXT_PUBLIC_BUILD_DATE when set" — FAIL
  - "falls back to 'dev' when NEXT_PUBLIC_BUILD_DATE is unset" — FAIL

**Root cause:** The test asserts that `NEXT_PUBLIC_BUILD_DATE` env var controls the footer, but `app/src/components/footer.tsx:76` hardcodes `const LAST_DEPLOY = "2026-07-02";` and never reads the env var. The test file's own comment (lines 8-9) reads:

> **WARNING**: THIS FILE WILL BE DELETED AFTER TEST PASSES

The test was never deleted. Either:
- Delete the file (`rm app/src/components/__tests__/footer.isolated.test.tsx`) — simplest fix, the production code is correct.
- OR rewrite `footer.tsx` to honor `NEXT_PUBLIC_BUILD_DATE` — invasive, hydration risk noted in the existing comment block (lines 66-72).

**Note:** On `chore/health-scan`, the same test file exists but passes (footer was updated to read env vars in that branch's history).

---

### 3. **Delete orphan CSS files in `app/src/styles/`**
**Severity:** 🟡 High
**Files (1,453 LOC total):**
- `app/src/styles/animations.css` (304 lines)
- `app/src/styles/base.css` (231 lines)
- `app/src/styles/components.css` (596 lines)
- `app/src/styles/tokens.css` (322 lines)

**Evidence:** No file in `app/src/` imports these. Only `app/src/app/globals.css` imports `styles/syntax-highlight.css` (line 2). The tokens and base styles have been inlined into `globals.css` (1,601 lines). The `animations.css`, `base.css`, `components.css`, and `tokens.css` are dead.

**Already removed on `chore/health-scan`.**

---

### 4. **Delete stale screenshot directories (94 MB on disk)**
**Severity:** 🟡 High
**Directories to delete:**
| Path | Size | Reason |
|---|---:|---|
| `screenshots/audit-v3/` | 26 MB | Pricing-page iteration debug, no docs reference |
| `screenshots/final-audit/` | 9.6 MB | Captured during a fixed `ToastProviderClient` crash state |
| `.audit/before/` | 49 MB | Before-state of same-day UI fix |
| `.audit/after/` | 4 MB | After-state of same-day UI fix |
| `screenshots/audit-v2/` | 1.9 MB | Superseded by `final-audit/` |
| `screenshots/audit-live/` | 2.4 MB | Loose retry captures |
| `screenshots/audit/` | 388 KB | Lighthouse JSON, unused |
| `screenshots/audit-2026-07-02/` | 28 KB | Empty placeholder |
| 61 loose `screenshots/*.png` (root) | 24 MB | No doc references them |

**Evidence:** Already documented in `docs/DOCS-CLEANUP-MAP.md` (lines 43-58). `*REPORT*.md` and `*.png` rules in `.gitignore` (lines 21, 11) confirm these are tool output, not project artifacts. None are tracked by git.

**Note:** `screenshots/audit-v3` is the only archive candidate worth keeping per the cleanup map.

---

### 5. **Remove 4 unused root-level Markdown reports**
**Severity:** 🟡 Medium
**Files:**
- `quality-report.md` (6.2 KB) — gitignored by `*REPORT*.md`, no cross-refs, superseded
- `UI_UX_AUDIT_REPORT.md` (9.7 KB) — gitignored, superseded by `docs/nextjs15-audit.md`
- `competitor-analysis.md` (21 KB) — untracked, only `docs/STRATEGY.md` references it (line 364), and STRATEGY is itself untracked
- `public/llms.txt` (root) — STALE; differs from the production copy in `app/public/llms.txt` (per `docs/DOCS-CLEANUP-MAP.md:125-126`)

**Already documented in `docs/DOCS-CLEANUP-MAP.md` lines 31-32, 75-76.**

---

### 6. **Clean up orphan dashboard / shared / API files on main**
**Severity:** 🟡 Medium
**Files tracked on `main` but absent on `chore/health-scan`:**
- `app/src/components/shared/index.ts` — barrel for `Breadcrumb` and `useUrlFilters`; both files imported directly elsewhere, barrel never used
- `app/src/components/ui/input.tsx` — `<Input>` primitive, no consumers
- `app/src/components/ui/separator.tsx` — `<Separator>` primitive, no consumers
- `app/src/app/chat/_components/ChatShell.tsx` (489 lines) — entire chat shell component, superseded by `ChatPlaygroundShell.tsx`. Self-confirmed orphan: no `import` of `ChatShell` anywhere in the tree.
- `server/src/lib/rate-limit-config.ts` (27 lines) — `getApiKeyRateLimits` exported but never called; `RateLimitConfig` interface unused outside the file. The only reference is a `vi.mock` in `server/src/__tests__/token-bucket-middleware.test.ts:11` — but the test mocks the entire module, so deletion is safe (already done on cleanup branch).

---

### 7. **Delete 5 dead docs/ files**
**Severity:** 🟡 Medium
**Files in `docs/`:**
- `component-inspiration-2026-07-01.md` (23.7 KB) — research for UI rebuild already shipped
- `hono-audit.md` (22.1 KB) — server audit, no cross-refs, no open action items
- `nextjs15-audit.md` (27.1 KB) — frontend audit, no cross-refs
- `minimax-visual-analysis.md` (7.2 KB) — 40% complete, cites deleted screenshots
- `venice-research-2026-07-01.md` (17 KB) — only referenced by `STRATEGY.md` (line 247)

`STRATEGY.md` and `PITCH.md` are untracked and should either be moved under git tracking with a cleanup pass, or deleted (per cleanup map alternative).

**Already documented in `docs/DOCS-CLEANUP-MAP.md` lines 37-39, 75-77.**

---

### 8. **Remove unused app dependency `@vitest/ui`**
**Severity:** 🟢 Low (devDep)
**File:** `app/package.json` line 49
**Evidence:** `grep -rn "@vitest/ui" --include="*.ts" --include="*.tsx"` returns only `package.json` itself. No `vitest --ui` invocation anywhere. `@vitest/coverage-v8` (line 48) IS used (referenced in `app/vitest.config.ts:13`).

---

### 9. **Delete untracked/orphan tool output**
**Severity:** 🟢 Low
**Files / dirs:**
- `.audit/` directory (53 MB) — entirely untracked, NOT in `.gitignore`. Should add `.audit/` to `.gitignore`.
- `.opencode/audit-2026-07-01-report.md` (13.6 KB) — gitignored by `.opencode/audit-*/` (line 38)
- `.opencode/screenshots/`, `.opencode/node_modules/`, `.opencode/package.json` — tool state, not project
- `docs/screenshots/home-2026-07-02.png`, `docs/screenshots/login-2026-07-02.png` — gitignored, not referenced
- `docs/superpowers/`, `docs/superpowers/specs/` — empty directories

---

### 10. **Drop dead exports (~30 still remaining on `chore/health-scan`, ~80 on `main`)**
**Severity:** 🟢 Low
The cleanup branch already removed ~50 unused exports. The remaining list below is what's still extractable. Many are interfaces/types that exist solely for downstream TypeScript type-checking — harmless but deletable.

**Confirmed dead on both branches:**

App (`app/src/`):
- `app/src/components/chat/index.ts`: `SettingsPanelRedesigned`, `WelcomeBannerRedesigned`
- `app/src/components/chat/KeyboardShortcutsModal.tsx`: `SHORTCUTS`, `Shortcut`
- `app/src/components/chat/A2UIRenderer.tsx`: `A2UI_CONTENT_TYPE`, `isA2UIContentType`
- `app/src/components/ui/CryptoLogo.tsx`: `CryptoLogoProps`
- `app/src/components/ui/button.tsx`: `ButtonProps`, `ButtonSize`, `ButtonVariant`
- `app/src/components/ui/badge.tsx`: `BadgeProps`, `BadgeVariant`
- `app/src/components/ui/slot.tsx`: `SlotProps`
- `app/src/components/ui/gradient-text.tsx`: `GradientTextProps`
- `app/src/components/ui/Skeleton.tsx`: `SkeletonProps`
- `app/src/components/ui/utils.ts`: `FOCUS_RING`
- `app/src/components/ui/charts/shared.tsx`: `ChartFigure`, `ChartSkeleton`, `dateSpanDays`, `formatChartDate`, `formatCompactNumber`, `formatFullDate`
- `app/src/components/ui/charts/BarChart.tsx`: `CostData`
- `app/src/lib/api/types.ts`: `ChatCompletionsResponse`, `X402SettleResponse`, `X402VerifyResponse`
- `app/src/lib/api/client.ts`: `RequestOptions`
- `app/src/lib/api/usage-chart.ts`: `ChartModelDatum`, `UsageRecordLike`
- `app/src/lib/prices.ts`: `CACHE_DURATION`, `CryptoPrice`, `PriceData`, `fetchPricesFromCoinGecko`, `fetchSolPriceFromJupiter`, `getCryptoPrices`
- `app/src/lib/utils.tsx`: `formatPricePerMillion`
- `app/src/lib/models-data.ts`: `getProviderLogo`, `getProviderLogoUrl`
- `app/src/components/shared/index.ts`: `BreadcrumbItem`

Server (`server/src/`):
- `server/src/auth/api-keys.ts`: `CreateApiKeyOptions`
- `server/src/auth/siwe.ts`: `SessionIdentity`
- `server/src/auth/two-factor.ts`: `TwoFactorSetupPayload`
- `server/src/auth/neon-auth.ts`: `NeonAuthSession`
- `server/src/lib/dlq.ts`: `DlqEntry`, `DlqListName`, `SettlementDlqEntry`
- `server/src/lib/period.ts`: `parseDaysDate`
- `server/src/lib/settlement-retry.ts`: `SettlementRetryResult`
- `server/src/credits/budget-alerts.ts`: 10 exports including `AlertTriggered`, `BudgetAlertConfig`, `BudgetLimitConfig`, `BudgetPeriod`, `BudgetUsage`, `calculateTotalSpent`, `hasAlertBeenSent`, `recordAlertSent`, `sendEmailNotification`, `sendWebhookNotification`
- `server/src/credits/cctp-client.ts`: `CCTP_CHAIN_DOMAIN_IDS`, `CCTP_SUPPORTED_CHAINS`, `CctpAttestation`, `CctpChain`, `CctpVerifyResult`
- `server/src/credits/deposit.ts`: `calculateCreditsWithBonus`
- `server/src/credits/deposit-router.ts`: `DepositRouteResult`, `RouteMethod`, `RouteOption`, `routeDepositByToken`
- `server/src/credits/houdini-client.ts`: `ComplianceContext`, `HoudiniClient`, `PaymentLink`
- `server/src/credits/lifi-client.ts`: 6 exports including `LiFiChain`, `LiFiQuote`, `LiFiRoute`, `LiFiStatus`, `LiFiToken`, `getRoutes`
- `server/src/credits/verify-usdc-on-chain.ts`: `UsdcVerifyResult`
- `server/src/inference/billing-service.ts`: `CostCalculation`
- `server/src/inference/circuit-breaker.ts`: `CircuitBreakerState`
- `server/src/inference/cross-provider-router.ts`: `FailoverEvent`, `RouterProviderStat`, `RouterStats`
- `server/src/inference/models.ts`: `VideoModelDef`, `WHISPER_MODEL_INFO`
- `server/src/inference/provider-factory.ts`: `ProviderEndpoints`, `ProviderFactoryConfig`
- `server/src/inference/provider-selector.ts`: `ModelWeightConfig`
- `server/src/inference/surplus.ts`: `SurplusModelsResponse`, `SurplusPaymentRequirement`
- `server/src/inference/types.ts`: `MessageContent`
- `server/src/inference/usage-service.ts`: `ProviderCostRollupRow`, `UsageRecordParams`, `getProviderCostRollup`
- `server/src/inference/vendor-meta.ts`: `VendorHealth`
- `server/src/inference/venice.ts`: `VeniceHealthResult`, `VeniceParameters`
- `server/src/inference/cheaptokens.ts`: `CheapTokensClient`
- `server/src/jobs/deposit-notifications.ts`: 6 exports (none used outside file)
- `server/src/jobs/deposit-recovery.ts`: 6 exports (none used outside file)
- `server/src/jobs/deposit-retry.ts`: `expireStaleDeposits`, `retryFailedDeposits`, `scheduleDepositRetry`
- `server/src/middleware/audit.ts`: `AuditAction`, `AuditLogParams`
- `server/src/middleware/spend-limit.ts`: `checkAndTriggerBudgetAlerts`
- `server/src/middleware/rate-limit/memory-store.ts`: `FALLBACK_WINDOW_MS`, `cleanupFallbackCounters`
- `server/src/middleware/rate-limit/token-bucket.ts`: `TokenBucketConfig`, `TokenBucketOptions`
- `server/src/routes/chat/validation.ts`: 6 exports (`MAX_MESSAGES`, `MAX_MESSAGE_CONTENT_BYTES`, `MAX_TOTAL_BYTES`, `messageSchema`, `validateMessageContent`, `validateMessages`)
- `server/src/x402/facilitator.ts`: `PaymentMiddlewareConfig`, `PaymentResponse`, `SettlementRecord`, `X402Version`
- `server/src/x402/v2.ts`: 11 v2 protocol exports

---

## Files Safe to Delete (Evidence Summary)

### Confirmed orphaned (no `import` statement anywhere in the tree)

| Path | LOC | Already removed on cleanup branch |
|---|---:|---|
| `app/src/app/chat/_components/ChatShell.tsx` | 489 | ✅ yes |
| `app/src/components/ui/separator.tsx` | 31 | ✅ yes |
| `app/src/components/ui/input.tsx` | 94 | ✅ yes |
| `app/src/components/shared/index.ts` | 2 | ✅ yes |
| `app/src/styles/animations.css` | 304 | ✅ yes |
| `app/src/styles/base.css` | 231 | ✅ yes |
| `app/src/styles/components.css` | 596 | ✅ yes |
| `app/src/styles/tokens.css` | 322 | ✅ yes |
| `server/src/lib/rate-limit-config.ts` | 27 | ✅ yes |

**Method:** Each file searched via `rg` for its basename inside any import context (`from "X"`, `import("X")`, `require("X")`) across `app/src/`, `server/src/`, and root configs, excluding the file itself. **Zero matches** for each.

### Self-admitted dead test

- `app/src/components/__tests__/footer.isolated.test.tsx` (lines 1-9 header comment explicitly states: **"THIS FILE WILL BE DELETED AFTER TEST PASSES"**). Two of its four tests fail. Simplest fix: delete the file.

### Pre-existing test files removed by cleanup branch

- `app/src/components/auth/__tests__/AuthError.countdown.test.tsx` (101 lines)
- `app/src/components/__tests__/navbar-user-menu.account-number.isolated.test.tsx` (164 lines)
- `app/src/components/__tests__/navbar.mobile-disconnect.isolated.test.tsx` (196 lines)

---

## Unused Dependencies to Remove

| Package | Location | Evidence |
|---|---|---|
| `@vitest/ui` | `app/package.json:49` (devDep) | No `rg "@vitest/ui"` matches outside `package.json` itself. Not used by `vitest.config.ts` or any script. |

All other declared deps are referenced either in code, test files, config files, or are framework peer deps (`react-dom`, `@types/*`, `eslint`, `tailwindcss`, `@tailwindcss/postcss`, `pino-pretty`, `typescript-eslint`, `@opentelemetry/sdk-trace-node` — last one removed on cleanup branch already).

**No dependencies are unused on the server side** (all are used by code, configs, or are required peer dependencies).

---

## Broken / Stale Tests

| Status | Test File | Issue |
|---|---|---|
| ❌ FAIL | `app/src/components/__tests__/footer.isolated.test.tsx:72` | Asserts `/last deploy 2026-06-14/` text, but `footer.tsx:76` hardcodes `LAST_DEPLOY = "2026-07-02"` |
| ❌ FAIL | `app/src/components/__tests__/footer.isolated.test.tsx:78` | Asserts `/last deploy dev/` fallback when env unset, but no env-var logic exists |
| ⚠️ WARN | `app/src/components/auth/__tests__/AuthError.countdown.test.tsx` (entire file) | Console warnings: `Received \`false\` for a non-boolean attribute \`initial\`/\`animate\`` — framer-motion props passing `false` instead of being omitted. File removed on cleanup branch. |
| ⚠️ WARN | `app/src/app/page.test.tsx` | Console warnings: `Invalid prop \`className\` supplied to React.Fragment` (4× per test). Fragments receiving `className` prop — should be `<div className=...>` instead. |

**No server tests fail.** 730/732 pass; 2 integration tests skipped behind `OMA_RUN_INTEGRATION=1`.

**Test file that is itself a no-op:**
- `server/src/__tests__/token-bucket-middleware.test.ts:11` — mocks `../lib/rate-limit-config.js`. The mock is necessary only because the import path exists; once `rate-limit-config.ts` is deleted (as on cleanup branch), the mock line goes too.

---

## Hardcoded Mocks / Fake Content to Remove

| File | Lines | Issue |
|---|---:|---|
| `app/src/components/footer.tsx` | 76 | `const LAST_DEPLOY = "2026-07-02";` — hardcoded build date. Test expects env-driven, but prod code is intentionally hardcoded to avoid SSR/CSR hydration drift (justified by comment block lines 66-72). |
| `app/src/components/footer.tsx` | 75 | `const CURRENT_YEAR = 2026;` — hardcoded. Justified for same reason. |
| `app/src/lib/api/index.ts` | 73-127 | Legacy `api.oma.*` aliases kept for backward compat (comment "prefer the namespaced versions above"). Still referenced in production code paths per grep; **do not remove**. |
| `app/src/lib/api/admin.ts`, `deposit.ts`, etc. | various | Contain realistic-looking mock data for tests; this is intentional test fixture, not fake content. |

**No leaked credentials or API keys detected.** Verified via `.gitleaks.toml` (1.4 KB) and manual review of root `.env*` files — all are gitignored (`*.env*` rule in `.gitignore:8`).

---

## TODO / FIXME / HACK / XXX Inventory

| Status | File | Line | Comment |
|---|---|---:|---|
| 🟢 Acceptable | `app/src/components/account-login-modal.tsx` | 28 | "Legacy: OMA-XXXX-XXXX-XXXX in Crockford base32" — documentation in JSDoc, not a TODO |
| 🟡 Active TODO | `app/src/components/account-login-modal.tsx` | 240 | `// TODO(2FA): when the server supports it, append` |
| 🟡 Active TODO | `app/src/components/account-login-modal.tsx` | 249 | `// TODO(2FA): branch on` |
| 🟡 Active TODO | `app/src/app/login/page.tsx` | 43 | `* TODO(2FA)` (in JSDoc block) |
| 📝 Documentation | `server/src/auth/account-number.ts` | 14 | "Legacy format (OMA-XXXX-XXXX-XXXX Crockford base32) is still accepted" |

The `TODO(2FA)` markers relate to two-factor authentication enrollment UI flow. The actual server-side 2FA is fully implemented (`server/src/auth/two-factor.ts`, `server/src/auth/require-fresh-totp.ts`), but the client UI hasn't been wired up yet. **No other active TODOs found** in either `app/src` or `server/src`.

The codebase is exceptionally clean on this front — only 4 TODO markers across 524 source files, and 3 of those cluster around the same unfinished 2FA UI feature.

---

## TypeScript / Lint / Test Failures to Fix

| Check | Status | Details |
|---|---|---|
| `pnpm typecheck` (app) | ✅ PASS | `next typegen && tsc --noEmit` exits 0 |
| `pnpm typecheck` (server) | ✅ PASS | `tsc --noEmit` exits 0 |
| `pnpm lint` (app) | ✅ PASS | `eslint` exits 0 |
| `pnpm lint` (server) | ✅ PASS | `eslint src/` exits 0 |
| `pnpm test` (app) | ❌ FAIL | 119/121 pass; 2 fail in `footer.isolated.test.tsx` (see §2) |
| `pnpm test` (server) | ✅ PASS | 730/732 pass; 2 integration tests skipped |

**pnpm warnings (non-fatal):**
- `The "pnpm" field in package.json is no longer read by pnpm. The following keys were ignored: "pnpm.onlyBuiltDependencies".` — affects both `app/package.json` and root `package.json`. The `pnpm.onlyBuiltDependencies: ["@sentry/cli"]` key should be moved to root `package.json` under `pnpm` settings per pnpm 9+ format.

**On `chore/health-scan` branch: all checks pass** (101/101 app tests, 729/731 server tests with 2 integration skipped).

---

## Directory Cleanup Recommendations

### Top-level (`/Users/tyson/Desktop/Code/OMA-AI/`)

| Path | Action | Reason |
|---|---|---|
| `competitor-analysis.md` (21 KB) | DELETE | Untracked, only `docs/STRATEGY.md` references it (also untracked) |
| `quality-report.md` (6.2 KB) | DELETE | Gitignored, no cross-refs |
| `UI_UX_AUDIT_REPORT.md` (9.7 KB) | DELETE | Gitignored, superseded |
| `public/llms.txt` | DELETE | Stale (differs from `app/public/llms.txt` production copy) |
| `screenshots/` (root, 64 MB) | DELETE most, archive v3 | See §4 |
| `.audit/` (53 MB) | DELETE | Untracked, not gitignored (recommend add rule) |
| `.opencode/` (tool state) | KEEP mostly | Tool state; consider `git clean -fd .opencode/node_modules` |
| `.worktrees/health-scan/` | KEEP | Active worktree with 21 unmerged cleanup commits |

### `docs/`

| Path | Action | Reason |
|---|---|---|
| `component-inspiration-2026-07-01.md` | DELETE | Research for shipped UI rebuild |
| `hono-audit.md` | DELETE | No cross-refs, no open action items |
| `nextjs15-audit.md` | DELETE | No cross-refs, overlap with `UI_UX_AUDIT_REPORT` |
| `minimax-visual-analysis.md` | DELETE | 40% complete, cites deleted screenshots |
| `venice-research-2026-07-01.md` | MERGE → STRATEGY or DELETE | Only STRATEGY refs it (line 247) |
| `PITCH.md` | DELETE or MERGE | Untracked |
| `STRATEGY.md` | KEEP, fold others in | Only strategy doc worth keeping |
| `DOCS-CLEANUP-MAP.md` | KEEP | Useful documentation of this very audit |
| `screenshots/` (1.6 MB) | DELETE | `*.png` gitignored, not referenced |
| `superpowers/`, `superpowers/specs/` | DELETE | Empty dirs, zero references |

### `app/src/`

- Already on cleanup branch. **No further action** beyond merging.

### `server/src/`

- Already on cleanup branch. **No further action** beyond merging.

### `scripts/`

All 7 scripts (`axe-audit.mjs`, `blockchain-bootstrap.mjs`, `deploy.sh`, `generate-platform-wallet.mjs`, `neon-cost-check.sh`, `start-chrome-debug.sh`, `start-dev.sh`) are referenced either in code comments, README, or used at runtime. **Keep all.**

### `public/` (root)

| File | Action | Reason |
|---|---|---|
| `llms.txt` | DELETE | Stale, duplicates `app/public/llms.txt` |

### `deploy/coolify/`

Keep. Coolify deploy configs (Caddyfile, nginx.conf, docker-compose.yml). Used by `scripts/deploy.sh`.

---

## Summary: Reclaimable Disk Space

| Action | Bytes |
|---|---:|
| Merge `chore/health-scan` (deletes ~50 orphan files) | ~4000 LOC, no disk savings |
| Delete root-level stale screenshots | ~93 MB |
| Delete `.audit/` and orphaned docs | ~5 MB |
| Delete `public/llms.txt` and other root junk | ~10 KB |
| **Total reclaimable** | **~98 MB** |

---

## Recommended Execution Order

1. **MERGE `chore/health-scan`** → resolves 70% of audit items
2. **Fix or delete `footer.isolated.test.tsx`** → unblocks CI
3. **Delete `screenshots/` audit directories** (except `audit-v3` if archival value desired)
4. **Delete `.audit/`, `public/llms.txt` (root), `quality-report.md`, `UI_UX_AUDIT_REPORT.md`**
5. **Add `.audit/` to `.gitignore`** to prevent re-accumulation
6. **Remove `@vitest/ui` from `app/package.json` devDeps**
7. **Move `pnpm.onlyBuiltDependencies` to root `package.json` pnpm settings**
8. **Delete the 4 remaining dead docs and orphan files in `docs/`**
9. **Sweep remaining ~30 unused exports (low priority)**
10. **Optional: keep `docs/DOCS-CLEANUP-MAP.md` as institutional record**

---

## Verification Checklist (post-cleanup)

- [ ] `git status --short` shows no accidental deletions of tracked files
- [ ] `pnpm validate` (root) — app + server typecheck, lint, test all green
- [ ] `git ls-files | grep -E "ChatShell|rate-limit-config|ui/input|ui/separator|shared/index"` returns nothing
- [ ] `du -sh screenshots/ .audit/` shows <1 MB total
- [ ] `rg "TODO|FIXME|XXX|HACK" --type ts --type tsx app/src server/src` returns only the 4 known 2FA markers
- [ ] `docs/` contains only `STRATEGY.md`, `DOCS-CLEANUP-MAP.md`, and README-referenced docs
- [ ] No `.png` files in `app/src/`, `server/src/`, or root (except `app/public/**`)

---

**End of audit.** Generated 2026-07-02 by `MiniMax-M3` (subagent) via oMLX + brave-search MCP. No files were modified. All findings backed by `rg`/`grep` cross-reference checks plus manual inspection of cited line numbers.