# OMA-AI test-suite + repo-organization audit (2026-09-27, read-only)

## Test quality

### [T-1] server/src/routes/__tests__/deposit-index.test.ts — tests the MOCK, not the app (worst offender)
Lines 34-64 mock the ENTIRE deposit router with a hand-written ~25-line reimplementation of the endpoint; lines 76-149 issue HTTP requests against that FAKE. Every assertion validates the test's own inline handler, zero production code executes. Header comment says "One more attempt with a completely barebones app that bypasses EVERYTHING". Duplicates real coverage in deposit.test.ts:212+.
Severity: HIGH (false confidence, byte-cost)
Action: DELETE the file.
Status: OPEN

### [T-2] Two pure no-op tests
- server/src/routes/__tests__/models-modality.test.ts:73-81 — "expect(true).toBe(true)" twice. R7 removed image/video models; tests should have been deleted, not neutered.
- server/src/x402/__tests__/eip3009.test.ts:439-441 — same tautology.
Action: DELETE those three test bodies (or restore a real assertion).
Status: OPEN

### [T-3] Source-text-grep tests that break on any refactor
- app/src/lib/__tests__/deployment-docs.test.ts:88-131 — /Running|matches|/Root Directory is/?app/?/g punctuation-coupled Markdown prose checks.
- app/src/lib/__tests__/free-tier-copy.test.ts:29-38 — matches literal .tsx source strings including an exact SVG path.
- app/src/lib/site-redirects.test.ts:100-113,129 — asserts favicon SVG stroke-dasharray + geometry + globals.css 220-char-window regex.
- app/src/lib/__tests__/free-tier-copy.test.ts:17-23 — pins the ENTIRE free-model ID list as a sorted literal.
Action: trim the punctuation/geometry ones to semantic assertions; keep the guards that ARE lint-like (no-direct-ip-header-reads, usdc-constants-not-duplicated).
Status: OPEN (trim, don't delete wholesale)

### [T-4] Exact Tailwind class assertions
- app/src/app/login/__tests__/login-typography.test.tsx:49-50 (font-sans), :58 (H3 tag — fine).
- app/src/app/models/__tests__/ModelCard.availability.test.tsx:73 (text-text-muted regex).
- app/src/app/pricing/__tests__/pricing-table-availability.test.tsx:68 (same regex).
Action: swap to semantic/color checks.
Status: OPEN

### [T-5] .availability.* fragmentation: 9 files / 33 tests on one concern
model-availability.test.ts (2), model-availability-rule.test.ts (5), ModelCard.availability.test.tsx (5), pricing-table-availability.test.tsx (3), PricingTable.availability.test.tsx (3), useModelFilters.availability.test.tsx (4), catalog-availability.test.tsx (4), sitemap-availability.test.ts (5), chat-rate-limit-availability.test.ts (2).
Rule "omitted flag = available" asserted 3x independently in different files.
Dot-namespaced files (ChatErrorBanner.daily-limit.test.tsx, usePlaygroundState.available.test.ts) sit beside the source rather than in __tests__/.
Action: consolidate into ONE file per concern; move dot-named files into __tests__/.
Status: OPEN (moderate refactor)

### [T-6] Cross-file duplicate coverage (sitemap)
seo-infrastructure.test.ts:54-69 vs sitemap-availability.test.ts:59-65 — same URL set, 8 vs 6, 100% overlap modulo /about /contact.
seo-infrastructure.test.ts:89-103 vs site-redirects.test.ts:63-73 — same invariant; the latter is better (iterates exported constant).
seo-infrastructure.test.ts:25-30 vs sitemap-availability.test.ts:73-77 — same canonical host regex.
Action: keep sitemap-availability versions (they iterate constants) and trim the hard-coded duplicates from seo-infrastructure.test.ts.
Status: OPEN

### [T-7] Cross-file duplicate coverage (server routes)
GET /v1/site-settings describe block duplicated: deposit.test.ts:187-210 AND site-settings.test.ts:52+.
POST /v1/deposit/usdc describe block duplicated: deposit.test.ts:212+ AND deposit-index.test.ts:76+ (T-1 file).
Action: consolidate after deleting T-1.
Status: OPEN

### [T-8] cwd-dependent source-scan tests (green-tick hazard)
server/src/__tests__/no-direct-ip-header-reads.test.ts:21 — "join(process.cwd(), "src")" → silently empty src if run from repo root ⇒ single assertion passes vacuously. Same pattern in usdc-constants-not-duplicated.test.ts:18, app/src/lib/site-redirects.test.ts:11,127, free-tier-copy.test.ts:9.
Fix: use import.meta.dirname as deployment-docs.test.ts:23 correctly does.
Status: OPEN (P2 — silently-broken test class)

### [T-9] High mock density, low assertion count (mock the stub's own output)
- ChatToolbar.mobile.test.tsx (9 vi.fn/vi.mock vs 2 expects)
- SettingsPanel.saveError.test.tsx (10 vs 3)
- login-typography.test.tsx (8 vs 3)
Modest counts, mostly testing the stub's own output.
Action: trim; only keep mocks that actually gate a behavior.
Status: OPEN (low priority)

## Repo organization

### [T-10a] 13 Playwright e2e specs are dead weight
app/e2e/*.spec.ts (chat, dashboard, deposit, home, login, models, pricing, settings, responsive, chat-viewport, 3x a11y). @playwright/test@^1.63.0 is a devDependency and app/playwright.config.ts exists, BUT no e2e/test:e2e script in app/package.json, and no root `pnpm validate` / .github/workflows/ci.yml invokes Playwright.
Action: either wire pnpm --filter app exec playwright test into CI OR delete the folder + dep.
Status: OPEN (decision)

### [T-10b] Unused dep + orphaned config
- @vitest/coverage-v8@^4.1.11 in app devDeps is referenced nowhere. app/vitest.config.ts:26-31 configures a full v8 coverage block no script triggers. No test:coverage script.
- turbo absent from packageDevDeps and NO turbo.json, yet .turbo/cache/ exists at the root — orphaned from removed Turbo setup. Root package.json carries "workspaces":["app","server"] that duplicates pnpm-workspace.yaml (pnpm ignores the former).
Action: drop coverage-v8 + dead config block, delete .turbo/cache, drop root package.json "workspaces".
Status: OPEN

### [T-10c] No dead routes
All 20 top-level page routes have inbound references. Clean.
Status: NONE

## Clean
No duplicate tsconfig/eslint (one per package). .gitignore correctly excludes dist / .next / *.tsbuildinfo. Only .env.example files tracked. No committed build output. No secrets in tests.

## Priority
Delete T-1 and T-2 outright. T-8 is one-line fix per file (removes a silently-passing failure class). T-3/T-4 are judgment calls — trim punctuation regexes and SVG geometry but keep the load-bearing security guards. T-10a is a decision, not a bug: 13 unrun e2e specs are either a CI gap or dead files.
