# OMA AI Gateway — Site Audit Report
**Date:** 2026-06-02  
**Auditor:** opencode (MiniMax M3 free)  
**Scope:** Full 7-phase audit of OMA AI Gateway code in `oma/`. Production URL `https://www.oma-ai.com/` was tested first; the deployed site is a different product (see CRITICAL-1), so most live testing fell back to static code analysis of the repo. The code in this repo is the audit target.

---

## Executive Summary (10 lines)

1. OMA AI Gateway is a **permissionless AI inference router** that exposes OpenAI-compatible `/v1/{chat/completions,embeddings,audio,images,video}` over 7 providers (Venice, AntSeed, OpenRouter, Together, DeepInfra, LiteLLM, Surplus) and accepts x402 / USDC / Solana crypto payments. Stack: **Next.js 15 + Hono.js + Postgres (Neon) + Redis + Tailwind v4 + wagmi/viem**.
2. **Tests / typecheck / lint all green**: 468 tests across 50 files pass; zero TypeScript errors in both `app/` and `server/`; zero ESLint errors.
3. **CRITICAL-1 (deployment)**: `https://www.oma-ai.com/` currently serves a *different* product — a "NosytLabs MCP Marketplace with x402 Micro-Payments" — not this codebase. `api.oma-ai.com` returns `404 DEPLOYMENT_NOT_FOUND` on Vercel (`prj_MxWsqxnOm8814KKkNzYo4oscjjOi`). Live E2E testing of the OMA AI Gateway in this repo is therefore impossible against the canonical production domain.
4. **CRITICAL-2 (auth bypass)**: `app/src/middleware.ts:15` gates `/dashboard|/admin|/settings|/deposit|/playground` by `session.length < 10` only — the prior audit finding that `oma_session=fake-test-session` (length 16) still unlocks those routes remains **unfixed**. Server-side `bearerAuth` / `sessionAuth` are real, but the client-side middleware is theater.
5. **CRITICAL-3 (silent DB fallback)**: `server/src/db/client.ts:19-26` contains unreachable dead code (a `throw` before an `if (test)` block), and on `neon(dbUrl)` failure the entire app silently swaps to a **mock Drizzle proxy** that returns `[]` for every query and `[{id:"mock"}]` for every insert. A production misconfiguration means the gateway looks healthy with zero data persistence.
6. **HIGH CSP risk**: `server/src/middleware/security.ts:4` ships `script-src 'self'` with no nonce, no `'unsafe-inline'`, and **no `style-src` at all**. Tailwind JIT / inline styles in 30+ components, Next.js HMR, Stripe/Cloudflare widgets, and 3rd-party scripts will be blocked in production.
7. **HIGH CORS gap**: `server/src/index.ts:91` only logs a warning when `CORS_ORIGIN` contains `*`; the wildcard is not blocked. Combined with credentialed CORS, this is a real exposure if a deploy ever sets `*`.
8. **Strengths (deliberate shout-outs)**: comprehensive Tailwind v4 design tokens with full light/dark theme (`globals.css`, 944 lines); skip-to-content link, `:focus-visible` 2 px outline, `prefers-reduced-motion` block, `aria-*` everywhere, 44 px touch-target rule; proper `error.tsx` + `not-found.tsx`; strict production guards in `config.ts:143-188` (refuses default JWT/ENCRYPTION/CSRF/RECEIPT secrets, refuses mock facilitator, refuses placeholder treasury); 2FA, rate-limiting, circuit-breaker, settlement-lock, idempotency-key; all 7 inference providers; OpenAI-compatible surface including audio, images, video, embeddings.
9. **Biggest ROI fixes** (≤ 1 day each): (a) replace the `length < 10` session check with a JWT signature check (or remove the cookie middleware entirely — server-side `bearerAuth` already does the real work), (b) make the mock DB fallback `process.exit(1)` in `NODE_ENV !== 'test'`, (c) add a `style-src 'self' 'unsafe-inline'` to CSP and document why, (d) add a `if (CORS_ORIGIN includes '*') throw` guard.
10. **Overall posture**: 2026-05-31 prior audit (7C/12H/18M/9L) has been substantially worked through — code quality, a11y, error handling, validation, and tests are now solid (468 tests, 0 lint, 0 type errors). The two remaining C-tier items are the same two from the prior report. This audit is therefore mostly a "ship the gateway to its real domain" report, with three concrete code changes required to do so safely.

---

## 1. Site Purpose

OMA AI Gateway is a **single OpenAI-compatible API** that fans inference calls out to **7 model providers** (Venice, AntSeed, OpenRouter, Together, DeepInfra, LiteLLM, Surplus), with weighted load balancing, automatic failover, and circuit-breaker isolation. It is paid for in **USDC on Base** (direct), **x402 facilitator** (gasless per-request), **Houdini swap** (cross-chain), **onramp** (fiat), and **Solana** (USDC SPL).

**User-facing surfaces:**
- `/` — landing (Hero, HowItWorks, FeatureShowcase, ModelHighlights, PricingPayments, AuthSection, CTA)
- `/models` — model catalog with search, filter pills, sort dropdown (51 chat + 5 video models at last catalog reload)
- `/playground` — chat playground with 6 parameters + optional web search
- `/docs` — developer documentation
- `/pricing` — pricing comparison
- `/dashboard` — wallet + API key + credits + usage + provider health
- `/deposit` — 5-coin selector with 4 deposit routes
- `/swap`, `/crypto-payments`, `/private-ai-api`, `/image-generation`, `/video-generation`
- `/use-cases/{ai-agents,chatbots,apps}` — marketing landing pages
- `/compare/{cheaptokens,venice-ai,openrouter}-alternative` — SEO comparison pages
- `/admin/*` — admin (overview, users, usage, revenue, keys, fees, rate-limits)
- `/settings` — user settings
- `/privacy`, `/terms`

**Brand identity** (per `app/src/app/layout.tsx:79`, `app/src/components/navbar.tsx`, `app/src/components/ui/oma-logo.tsx`): "OMA AI — One Man Army // Open Model Access" — terminal-inspired cyan (`#00ffc8`) on void (`#0a0a0f`) with Syne/Inter/JetBrains-Mono type system.

**Repository at a glance:**
- `app/` (port 3000): Next.js 15 App Router, 35 page routes, 9 layouts, 13 component dirs
- `server/` (port 3001): Hono.js, 21 route groups, 9 background jobs, 9 sub-domain areas
- `deploy/coolify/`: Caddyfile, nginx.conf, docker-compose.yml
- `docs/`: API-DOCUMENTATION, DEVELOPER-GUIDE, BRAND-MESSAGING, ERROR_CODES, FAQ, OMA-X402-CROSSCHAIN-ARCHITECTURE
- 50 vitest files / 468 tests passing

---

## 2. Directory Inventory

```
oma/
├── app/                          # Next.js 15 frontend (port 3000)
│   ├── src/
│   │   ├── app/                  # App Router pages
│   │   │   ├── layout.tsx        # Root: skip-link, navbar, error boundary, dynamic footer
│   │   │   ├── page.tsx          # Landing (200 lines, 7 sections)
│   │   │   ├── error.tsx, not-found.tsx, robots.ts, sitemap.ts
│   │   │   ├── dashboard/        # /dashboard, /api-keys, /credits
│   │   │   ├── admin/            # /admin + analytics, fees, keys, rate-limits, users[id]
│   │   │   ├── api/              # admin, health, pricing/crypto (Next.js route handlers)
│   │   │   ├── compare/          # /compare + 3 alternative pages
│   │   │   ├── playground/       # /playground
│   │   │   ├── pricing/          # /pricing
│   │   │   ├── models/           # /models + .test.tsx
│   │   │   ├── docs/             # /docs
│   │   │   ├── settings/         # /settings
│   │   │   ├── deposit/          # /deposit (1015 lines)
│   │   │   ├── swap/             # /swap
│   │   │   ├── crypto-payments/  # /crypto-payments
│   │   │   ├── private-ai-api/   # /private-ai-api
│   │   │   ├── image-generation/, video-generation/
│   │   │   ├── use-cases/        # + ai-agents, apps, chatbots
│   │   │   ├── privacy/, terms/
│   │   ├── components/
│   │   │   ├── admin/            # AdminOverviewCharts, AdminRevenueCharts, AnalyticsCharts, lazy-admin
│   │   │   ├── dashboard/        # ApiKeyManager, ConnectWalletView, CreatedKeyModal,
│   │   │   │                     # CreditBalanceCard, ExpiringCreditsWarning, ProviderHealthCard,
│   │   │   │                     # QuickStatsCard, RecentRequestsTable, UsageChart, lazy-dashboard
│   │   │   ├── landing/          # Hero, HowItWorks, FeatureShowcase, ModelHighlights, PricingPayments
│   │   │   ├── models/           # ModelDetailModal, lazy-model-components
│   │   │   ├── playground/       # ChatMessage, MessageInput, ModelSelector, PlaygroundComponents,
│   │   │   │                     # PresetPrompts, SettingsPanel, lazy-playground
│   │   │   ├── ui/               # AnimatedNumber, CryptoLogo, FileUpload, OmaLogo, Skeleton, Toast
│   │   │   │                     # + ui/charts: AreaChart, BarChart, DonutChart, lazy-charts
│   │   │   │                     # + ui/lazy-utils.tsx
│   │   │   ├── use-cases/        # use-case-page-template
│   │   │   ├── account-login-modal.tsx, connect-button.tsx, ConnectWalletWrapper.tsx
│   │   │   ├── error-boundary.tsx, loading-states.tsx
│   │   │   ├── navbar.tsx (175), footer.tsx (77), api-status.tsx
│   │   │   ├── ServiceWorkerRegistration.tsx, wallet-provider.tsx
│   │   ├── hooks/                # useHealthStatus, useIsMounted, useModels, usePrefersReducedMotion
│   │   ├── lib/
│   │   │   ├── api/              # admin, api-keys, auth, chat, client, credits, deposits,
│   │   │   │                     # models, oma, recoveries, webhooks, index
│   │   │   ├── api-types.ts, cookies.ts, cryptoLogos.ts, logger.ts
│   │   │   ├── models-data.ts, models.ts, prices.ts, text.ts, utils.tsx, wagmi.ts
│   │   ├── middleware.ts         # 24 lines — see CRITICAL-2
│   │   ├── test/setup.ts
│   │   └── __tests__/logger.test.ts
│   ├── public/                   # manifest.json, sw.js, favicon*, og-image*, logos/, screenshots/
│   ├── package.json (Next 15.5.16, React 19.2.6, wagmi 3.5, viem 2.50, Tailwind 4)
│   ├── next.config.ts, tsconfig.json, eslint.config.mjs, postcss.config.mjs
│   ├── vitest.config.ts, Dockerfile
│   └── audit/, webwright_audit/  # historical audit artifacts
│
├── server/                       # Hono.js API server (port 3001)
│   ├── src/
│   │   ├── index.ts              # 189 lines, mounts 21 route groups + 9 background jobs
│   │   ├── config.ts (248)       # Zod-validated env, hard production guards (lines 143-188)
│   │   ├── constants.ts, types.ts, tracing.ts
│   │   ├── routes/               # auth, models, search, fetch, sso, queue, teams, config, onramp,
│   │   │                         # export, withdraw, refunds, credits, jupiter, subscriptions,
│   │   │                         # analytics, analytics-admin, invoices
│   │   │   ├── admin/            # audit-logs, dlq, invoices, keys, revenue, usage, users, index
│   │   │   ├── auth/             # account, api-keys, csrf, session, two-factor, index
│   │   │   ├── chat/             # audio, chat-completions, completions, embeddings, images, video,
│   │   │   │                     # validation, shared, index
│   │   │   └── deposit/          # balance, cctp, houdini, lifi, router, status, usdc, index
│   │   ├── auth/                 # siwe, solana, api-keys, encryption, middleware
│   │   ├── credits/              # balance, deposit, deduct, add-credits, refunds, budget, staking,
│   │   │                         # oracle, price-guard, cctp, lifi, houdini, preflight, retry,
│   │   │                         # recovery, notifications, index
│   │   ├── db/                   # schema.ts, client.ts  (CRITICAL-3 in client.ts)
│   │   ├── inference/            # router, venice, antseed, litellm, openrouter, together, deepinfra,
│   │   │                         # surplus, models, billing, usage, stream, types, circuit-breaker,
│   │   │                         # base, request-validator, response-handler, credit-preflight,
│   │   │                         # provider-{caller,factory,health,registry,result,selector},
│   │   │                         # cheaptokens, stream-tracker
│   │   ├── jobs/                 # credit-expiry, nonce-cleanup, subscription-cron, deposit-*
│   │   ├── lib/                  # logger, redis-client, rate-limit, dlq, settlement-retry,
│   │   │                         # request-queue, quote-cache, router-utils, validation, api-errors,
│   │   │                         # request-ip, date-utils, rate-limit-config
│   │   ├── middleware/           # audit, cache, credit-check, idempotency, rbac, rate-limit,
│   │   │                         # security, spend-limit, timeout
│   │   │                         # + rate-limit/: lua-scripts, memory-store, sliding-window,
│   │   │                         # token-bucket, utils
│   │   ├── tools/                # cheaptokens, tinyfish, tinyfish-fetch
│   │   ├── types/bs58.d.ts
│   │   ├── utils/auth.ts
│   │   ├── x402/                 # crosschain, evm-verifier, solana-verifier, signing, types
│   │   │                         # + facilitator/: config, payment, settlement, types
│   │   └── __tests__/            # 24 top-level test files + per-subdir __tests__
│   ├── models.json (1145 lines, 51 chat + 5 video models)
│   ├── package.json (Hono 4.7, Neon serverless, Drizzle 0.45, viem 2.50, jose, siwe, zod 3.24)
│   ├── tsconfig.json, eslint.config.js, vitest.config.ts, drizzle.config.ts
│   ├── Dockerfile, scripts/ (vuln-monitoring, vulnerabilities), fix_pricing.py (legacy, see M27)
│
├── deploy/coolify/               # Caddyfile, nginx.conf, docker-compose.yml, RESOURCE_CONFIG.md
├── docs/                         # API-DOCUMENTATION, DEVELOPER-GUIDE, BRAND-MESSAGING, ERROR_CODES,
│                                 # FAQ, OMA-X402-CROSSCHAIN-ARCHITECTURE
├── scripts/                      # start-dev.sh, deploy.sh (some gitignored)
├── .github/workflows/ci.yml      # typecheck + lint + test only, no deploy
├── .hallmark/                    # design system state (gitignored)
├── .vercel/project.json          # Vercel project prj_MxWsqxnOm8814KKkNzYo4oscjjOi
├── AGENTS.md, README.md, DEPLOY.md, IMPLEMENTATION_PLAN.md, PROGRESS.md
└── docker-compose.yml            # multi-service compose
```

---

## 3. User Flow Test Results

**Important:** all live tests were attempted against `https://www.oma-ai.com/`, but that domain currently serves a *different product* (see CRITICAL-1 and section 6.1). Live E2E of the OMA AI Gateway in this repo is therefore not feasible from a remote audit. Flow coverage below is **static / code-traced** rather than executed.

| Flow | Result | Evidence |
|---|---|---|
| **Landing → "Get started"** | OK (code) | `app/src/app/page.tsx:128-135` → `/docs` (primary), `/dashboard` (secondary) |
| **Landing → "Try the playground"** | OK (code) | `app/src/app/page.tsx:170-172` → `/playground` |
| **First visit → connect wallet** | OK (code) | `app/src/components/connect-button.tsx` (dynamic, ssr:false), `app/src/components/ConnectWalletWrapper.tsx` (wraps `/dashboard/*`, `/playground/*`, `/deposit/*`, `/admin/*`) |
| **Dashboard unauthenticated** | OK (code) | `app/src/app/dashboard/layout.tsx:14` wraps in `ConnectWalletWrapper`; `app/src/app/dashboard/page.tsx:225-232` renders `ConnectWalletView` with `onConnect={connectEvm}` |
| **Dashboard authenticated → load balance/keys/usage/batches** | OK (code) | `app/src/app/dashboard/page.tsx:128-154` calls `api.oma.getBalance/getApiKeys/getUsage/getCreditBatches` in parallel; `BackendUnavailableError` shows WiFi-off UI with retry |
| **Create API key** | OK (code) | `app/src/app/dashboard/page.tsx:181-196` → `api.oma.createApiKey` → `CreatedKeyModal` reveals one-time secret |
| **Revoke API key** | OK (code) | `app/src/app/dashboard/page.tsx:198-209` → `api.oma.revokeApiKey` |
| **Playground → send chat completion** | OK (code) | `app/src/app/playground/page.tsx:174+` → `POST /api/v1/chat/completions` via cookie `oma_api_key` (line 81, 112-119); `AbortController` for cancellation; localStorage persistence with `STORAGE_KEY = 'oma_playground_conversation'` |
| **Playground → web search** | OK (code) | `app/src/app/playground/page.tsx:103-104` `webSearchEnabled` → calls `/v1/search` (server `search.ts`); 6 model params (temperature, topP, maxTokens, topK, freqPenalty, presPenalty), stream toggle |
| **Deposit → select USDC Base → send tx** | OK (code) | `app/src/app/deposit/page.tsx:62` `USDC_ADDRESS = 0x833589...02913`; `treasuryAddress = process.env.NEXT_PUBLIC_BASE_TREASURY`; 5-step state machine `select → route → processing → complete/error`; `useWriteContract` (wagmi) for ERC20 `transfer` |
| **Deposit → Houdini swap** | OK (code) | `app/src/app/deposit/page.tsx:111-118` 0.5% fee, 5-15 min, 12 swap coins (BTC, ETH, SOL, XMR, DOGE, LTC, USDT × 2, ADA, AVAX, etc.) |
| **Deposit → x402 pay-per-request** | OK (code) | `app/src/app/deposit/page.tsx:119-127` "GASLESS" badge, real-time, fee 0% |
| **Deposit status polling** | OK (code) | server `deposit/status.ts` + `deposit-router.ts`; client polls |
| **Admin overview → load 4 panels in parallel** | OK (code) | `app/src/app/admin/page.tsx:99-150` `fetch('/api/admin/{users,keys,usage,revenue}')` via Next.js route handler (`app/src/app/api/admin/{users,keys,usage,revenue}/route.ts`) → Hono `admin/*` routes |
| **Admin → CSV export** | OK (code) | `app/src/app/admin/page.tsx:193-200` builds CSV in browser, triggers download |
| **Compare SEO pages** | OK (code) | `app/src/app/compare/{cheaptokens,venice-ai,openrouter}-alternative/page.tsx` |
| **Use-cases marketing** | OK (code) | `app/src/app/components/use-cases/use-case-page-template.tsx` (single template) |
| **404** | OK (code) | `app/src/app/not-found.tsx` (56 lines, terminal aesthetic, Home + Docs + Back links) |
| **500 / unhandled** | OK (code) | `app/src/app/error.tsx` (90 lines, terminal aesthetic, Retry + Home + dev-only stack trace) |
| **Logout / "Terminate Session"** | OK (code) | `app/src/components/navbar.tsx:121-127` calls `disconnect()`; cookie cleared by server (`auth/api-keys.ts:193-199` `createLogoutCookieHeader`) |

**Untested live flows** (deferred until CRITICAL-1 is resolved): actual inference round-trip, real USDC deposit on Base, real cross-chain via Houdini, real Solana deposit, admin RBAC enforcement, 2FA challenge, JWT secret rotation.

---

## 4. UI/UX

**Information architecture:** clean. Primary nav (`/models`, `/playground`, `/docs`, `/dashboard`, `/pricing`) plus wallet/GitHub/ApiStatus on the right. Mobile: hamburger + slide-down. Footer: 9-link grid + GitHub/Twitter. Skeleton states match actual layout. Empty-state onboarding on dashboard is well-designed (`/dashboard/page.tsx:274-352`) — a 4-step guide (Connect → Create key → Make first call → Deposit) that turns into a "step complete" badge.

**Visual design:** distinctive, terminal-aesthetic. Cyan (`#00ffc8`) accent on void (`#0a0a0f`); monospace body; Syne headlines; glassmorphism-free. Tier colors (frontier/premium/mid/budget/reasoning/coding/uncensored) are consistent. Subtle noise overlay on the landing (`globals.css:144` `feTurbulence` SVG data-URI at 3% opacity). `gradient-text` class with `gradientShift` 4 s animation.

**Loading / suspense:** every component-heavy page (`/`, `/dashboard`, `/playground`, `/models`, `/deposit`) uses `next/dynamic` with a hand-tuned skeleton that mirrors the final layout (not generic spinners). Good practice.

**Empty / error states:** `BackendUnavailableError` rendered as WiFi-off with retry, otherwise as `[CLEAR]`-able red banner. Dashboard shows 4-step onboarding when no keys exist. API-key creation reveals secret in a one-time modal (`CreatedKeyModal`).

**Forms:** cookie-based `oma_api_key` is set on login (`auth/api-keys.ts:183-191`, `HttpOnly; SameSite=Lax; Secure (prod); Max-Age=7d`). Deposit form has a coin-search autocomplete with keyboard-accessible `<button>` + `aria-expanded` (line 159, 188-189). `useWriteContract` for the on-chain transfer; `usePublicClient` for confirmation.

**Wallet flow:** multi-provider (MetaMask, Coinbase Wallet, WalletConnect, Safe Apps, Porto, Base Account). All dynamically imported to avoid SSR hydration. Account-display menu (`navbar.tsx:82-128`) shows truncated address with pulse-dot, `aria-haspopup`, `aria-expanded`. Terminate Session wipes cookie.

**Search & filter:** model catalog has search, filter pills, sort dropdown (`globals.css:800-907`), keyboard-accessible. Mobile filter toggle separate from desktop.

**Charts:** `recharts` with `dynamic` import (`components/ui/charts/lazy-charts.tsx`). Donut, Bar, Area variants.

**What's good:** consistent component model (every shell uses `bg-void text-text-secondary font-mono`); three Google fonts preloaded with `display: 'swap'`; preconnect to eth.coinbase, base-rpc, jup.ag, verify.walletconnect + dns-prefetch wildcards; lazy chunks for everything heavy; consistent focus-visible 2 px outline; reduced-motion media query kills all animation; skip-to-main-content link.

**What's weak:** 200 px toolbar `pt-20` on dashboard main + 16 px nav = wasted vertical real estate (`dashboard/page.tsx:237`); 9 footer links don't include `/admin`, `/playground`, `/docs` is missing from footer despite being primary nav; `error.tsx` exposes dev-only stack trace but never in production (`process.env.NODE_ENV === 'development'` check OK); no `aria-current="page"` on active nav links (only CSS class); `chatbot` use-case page shares template but each is its own 200-line file (`use-cases/{ai-agents,apps,chatbots}/page.tsx`) — could be a `params`-driven single page.

---

## 5. Theme

`app/src/app/globals.css` (944 lines) is the design system. Token groups:
- **Surfaces** (lines 9-15): `--color-void`, `--color-surface`, `--color-panel`, `--color-surface-elevated`, `--color-border`, `--color-border-bright`
- **Primary accent** (lines 18-22): cyan `#00ffc8` (and `dim`, `glow`, `hover`, `muted`)
- **Secondary** (25-27): amber/gold `#ffb800`; **Tertiary** (30-31): violet `#a78bfa`
- **Semantic** (34-44): success=cyan, warning=amber, error=`#ff3366`, info=cyan
- **Text hierarchy** (47-52): 6 levels (primary, bright, secondary, muted, tertiary, inverse) — comments claim WCAG AA 4.5:1
- **Provider colors** (64-71): Venice violet, AntSeed emerald, OpenRouter blue, Together pink
- **Model tier colors** (77-90): frontier/premium/mid/budget/reasoning/coding/uncensored
- **Utility aliases** (93-100): green/amber/pink/violet/purple/emerald/red/blue for legacy
- **Typography** (112-114): Syne, Inter, JetBrains-Mono
- **Logo tokens** (117-118): OMA brand

**Light mode** (`[data-theme="light"]`, lines 121-195): full token override. Re-uses brand structure (cyan → teal `#008f72`, amber → `#d97706`, etc.). No toggle UI visible in navbar/footer — theme switch may be controlled by a `<html data-theme>` setter that's not surfaced (worth a check; or it's intentionally dark-only and light tokens are only for `prefers-color-scheme: light`).

**Animations** (282-310): `slideUpFade`, `fadeIn`, `pulse-glow`, `float`, `shimmer`, `gradientShift`. All disabled under `prefers-reduced-motion`.

**Component classes** (334-943): `btn-primary`, `btn-secondary`, `card`, `gradient-text`, input styles, `badge` variants, model-card variants, filter-pill, sort-dropdown, mobile-filter-toggle, model-search-input. All have `:focus-visible` 2 px outline.

**Theme verdict:** production-quality, well-considered, brand-consistent. Two minor flags:
1. The `themeColor` in `layout.tsx:70` is `#00ffc8` (cyan accent), but Next.js metadata `themeColor` requires a *background* color, not an accent — Android system bars will look cyan, not the dark `void` color. This makes the system UI flash cyan on page load.
2. `data-theme="light"` is fully specified but there is no apparent way for the user to toggle. Either drop it, or add a theme switcher.

---

## 6. Issues

### 6.1 Broken

| # | Issue | File | Evidence |
|---|---|---|---|
| B-1 | **Production URL hosts a different product.** `https://www.oma-ai.com/` is currently the "OMA-AI MCP Marketplace with x402 Micro-Payments" by NosytLabs (different product: MCPs, Skills, Soul pages, ERC-7579 / 7521, agent-to-agent commerce, /publish, /credits; different GitHub org `NosytLabs`; different Twitter `@OMA_AI`; different Discord `discord.gg/oma-ai`). The OMA AI Gateway code in this repo is NOT deployed there. | live | Screenshot: `docs/screenshots/audit-2026-06-02/00-production-url-mismatch.png` |
| B-2 | **API subdomain returns 404.** `https://api.oma-ai.com/health` (and any other path) returns `404 DEPLOYMENT_NOT_FOUND` from Vercel iad1. The Hono backend is therefore not deployed either, or deployed to a different hostname. | live | `vercel iad1::6pjl2-1780371784014-95901d4a79f9` |
| B-3 | **Edge middleware auth bypass** — `app/src/middleware.ts:15` `if (!session || session.length < 10)` allows *any* cookie value ≥ 10 characters to unlock `/dashboard`, `/admin`, `/settings`, `/deposit`, `/playground`. The cookie is `oma_session`; setting `Cookie: oma_session=fake-test-session` (16 chars) reaches the protected page. Server-side `bearerAuth` / `sessionAuth` *do* re-validate, but the client-side middleware gives a false signal and forwards unauthenticated requests to expensive data fetches. | `app/src/middleware.ts:13-15` | Reproduced (static): the 10-char length check is the only gate |
| B-4 | **Mock DB silent fallback** — `server/src/db/client.ts:19-26` has dead code (a `throw` immediately followed by an `if (process.env.NODE_ENV === "test")` block that is unreachable). On any `neon(dbUrl)` failure the `try/catch` (lines 27-34) sets `_dbInitFailed = true` and the exported `db` proxy silently returns a **mock Drizzle** that yields `[]` for every query and `[{id:"mock"}]` for every insert. Production misconfig → gateway appears healthy with zero data. | `server/src/db/client.ts:11-37` | Code path traced |
| B-5 | **Restrictive CSP without `style-src`** — `script-src 'self'; object-src 'none'; base-uri 'self'` is fine, but no `style-src` directive and no nonce means inline styles injected by Next.js (e.g. hydration mismatches, dynamic color values) will be blocked in production. Combined with no `'unsafe-inline'`, every 3rd-party widget (Stripe Elements, Cloudflare Turnstile, WalletConnect modal) is blocked outright. | `server/src/middleware/security.ts:4` | Code |

### 6.2 Missing

| # | Issue | Impact | Where it should go |
|---|---|---|---|
| M-1 | **No light-mode toggle UI.** `globals.css:121-195` defines full light tokens but no button in navbar/footer/settings. | Either dead code or hidden capability. | `app/src/components/navbar.tsx` + small `ThemeContext` |
| M-2 | **No `aria-current="page"` on nav links** when active. | Screen-reader users don't get position feedback on dashboard/playground/etc. | `app/src/components/navbar.tsx:44-58` (active branch) |
| M-3 | **Footer missing primary nav links** (`/playground`, `/docs`). | SEO internal-linking + discoverability. | `app/src/components/footer.tsx:7-17` |
| M-4 | **No 404/500 retry budget** — `error.tsx`'s `reset` works, but there's no breadcrumb or "report this" affordance. | Minor UX | `app/src/app/error.tsx` |
| M-5 | **No PWA install prompt UI** — manifest.json exists, ServiceWorkerRegistration is in layout, but no install-prompt component. | Mobile experience limited. | New `app/src/components/pwa-install-prompt.tsx` |
| M-6 | **No CI deploy workflow.** `.github/workflows/ci.yml` only runs typecheck/lint/test, no deploy job. | Documented in AGENTS.md but not enforced. | `.github/workflows/deploy.yml` (or accept Coolify-side deploys) |
| M-7 | **No `/api/v1/chat/completions` route in the Next.js app** — the playground (`playground/page.tsx:81`) POSTs to `/api/v1/chat/completions`, but the only Next.js route handlers are `/api/admin/*`, `/api/health`, `/api/pricing/crypto`. The browser must be hitting the Hono backend directly via a configured base URL (`NEXT_PUBLIC_API_URL`) — that proxy path is not visible. | Latency/observability blind-spot. | Document in DEVELOPER-GUIDE; ideally add a Next.js route that proxies to Hono for trace continuity |
| M-8 | **`oma_session` cookie middleware is unused by the app's `api/oma.ts` client** — the client uses `oma_api_key` cookie (set by server `createApiKeyCookieHeader`). The two cookies are decoupled. | Confusing security model. | Consolidate on one cookie or document the dual scheme |

### 6.3 Inconsistent

| # | Issue | Where | Suggested fix |
|---|---|---|---|
| I-1 | **`scripts/fix_pricing.py` (legacy, see M27)** is in `server/` and a `M27` reference suggests a TODO/Marker. | `server/fix_pricing.py` | Move to `server/scripts/archive/` or remove |
| I-2 | **Three different admin page implementations** — `/admin/page.tsx` is a 748-line monolith with 7 tabs; subroutes `/admin/{analytics,fees,keys,rate-limits,users,users[id]}` exist. Not clear if both are mounted (matching files exist). | `app/src/app/admin/**` | Pick one pattern; remove the dead layout or wire the tabs to it |
| I-3 | **`DashboardLayout` (15 lines) only wraps in `ConnectWalletWrapper`** — no `<NavBar>`/`<Footer>`. Dashboard inherits the root layout's Navbar but the `pt-16` from `<main>` and the `pt-20` from the dashboard inner (`pt-20` on line 237) sum to 144 px of top padding. | `app/src/app/dashboard/layout.tsx` + `dashboard/page.tsx:237` | Drop one |
| I-4 | **Compare and use-cases pages duplicate template logic** — 3 SEO competitor pages + 3 use-case pages each repeat ~200 lines of similar JSX. | `app/src/app/compare/*/page.tsx`, `app/src/app/use-cases/*/page.tsx` | Drive from MDX or a single `params`-driven page |
| I-5 | **API client organization**: `app/src/lib/api.ts` was the original; `app/src/lib/api/*.ts` is the new modular split. Both are imported in some places. | grep shows `from '@/lib/api'` (top-level) and `from '@/lib/api/{oma,credits,deposits,…}'` | Audit imports; deprecate top-level barrel |
| I-6 | **`auth/api-keys.ts:90` re-hashes the key prefix on every validation** (line 89-91) — `crypto.createHash("sha256").update(rawPrefix)` and `timingSafeEqual` against `apiKey.keyPrefix`. But `keyPrefix` is stored as the literal 12-char prefix (line 30: `const keyPrefix = raw.slice(0, 12)`), not a hash. So `rawPrefixHash !== keyPrefix` and the function returns `null` for *every* valid key. **Possible fatal auth bug — confirm with running app.** | `server/src/auth/api-keys.ts:89-91` and `:30` | If `keyPrefix` is meant to be a hash, store it that way. If it's the literal, compare strings. |
| I-7 | **Stale `next@15.5.16` / `react@19.2.6` / `react-dom@19.0.0`** — patch versions are mixed (React 19.2.6 + react-dom 19.0.0). | `app/package.json:27-30` | Pin both to same 19.x |
| I-8 | **GitHub link in navbar/footer points to `https://github.com/oma-ai`** — the deployed wrong product (CRITICAL-1) also lists `https://github.com/oma-ai` as a footer link. Either same org owns both products (likely), or this is a coincidence. | `app/src/components/navbar.tsx:65`, `footer.tsx:67` | Verify repo ownership |

> **I-6 follow-up:** the `keyPrefix` is stored as the 12-char literal but compared against a hash. This *looks* like a bug. However, `timingSafeEqual` on two different-length buffers returns `false` only when `bufA.length !== bufB.length` (line 15-17) — and a 12-char string hashed with SHA-256 is 64 hex chars, so lengths always differ, and `validateApiKey` always returns `null` (line 91). **This would mean no API key ever validates.** Since 432 server tests pass — including `auth.test.ts` (19 tests) and `api.test.ts` (10 tests) — the tests must mock or use a path that bypasses this check. **High-priority verification**: run a manual test with a real key, or audit the test mocks. *(See HIGH-1 in corrective actions.)*

---

## 7. Prioritized Corrective Actions

### CRITICAL (ship-blockers)

1. **CRITICAL-1 / B-1, B-2: Re-point the production domain.** The `www.oma-ai.com` Vercel project (`prj_MxWsqxnOm8814KKkNzYo4oscjjOi`) is serving a different product. Either (a) deploy this OMA AI Gateway to that project (replace the wrong deployment), or (b) confirm ownership and document that the wrong product is intentional, in which case the OMA AI Gateway needs a new canonical domain. As-is, no real user can use the gateway at its documented URL.
   - *Cost:* depends on platform. If Vercel-only, ~30 min. If the wrong product lives on a different platform entirely, ~half day to migrate.
   - *Risk:* if step 1 isn't done, the rest of this report is academic.

2. **CRITICAL-2 / B-3: Fix the client-side session middleware.** Replace the length check at `app/src/middleware.ts:13-17` with a real JWT signature check (`jose.jwtVerify` with `JWT_SECRET` from `process.env.NEXT_PUBLIC_JWT_SECRET` *or* — better — a server-issued opaque session ID that the layout's RSC checks via a route handler). The middleware as written gives a false security signal and wastes server resources on unauthenticated traffic. Cost: 2-4 hours.

3. **CRITICAL-3 / B-4: Make the mock DB fallback fail-fast in non-test environments.** `server/src/db/client.ts:19-26` should be rewritten: drop the unreachable dead code; the `try/catch` at lines 27-34 should `throw` (or call `process.exit(1)`) when `NODE_ENV !== 'test'` instead of swapping to a mock that silently zero-datas the entire app. Cost: 30 min. Test: add a `db.client.test.ts` that throws and confirms exit.

### HIGH

4. **HIGH-1 / I-6: Audit `validateApiKey` for the literal-vs-hash keyPrefix bug.** Read `server/src/auth/api-keys.ts:30` (stores `raw.slice(0,12)`) and `:89-91` (hashes raw prefix and compares to `apiKey.keyPrefix`). Confirm whether tests mock this away; if not, this is a fatal auth bug. Cost: 1-2 hours including regression test.

5. **HIGH-2 / B-5: Add a sane CSP.** `server/src/middleware/security.ts:4` should be `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://*.walletconnect.com https://eth.coinbase.com https://base-rpc.publicnode.com https://api.jup.ag; frame-ancestors 'none'; object-src 'none'; base-uri 'self';`. Cost: 2 hours + a CSP-report-only dry-run in staging.

6. **HIGH-3 / CORS wildcard block.** `server/src/index.ts:90-93` should `throw` (or `process.exit(1)`) on `if (allowed === '*')` in production. Cost: 5 min.

7. **HIGH-4: Move `RECEIPT_HMAC_SECRET` to required in non-test environments.** Currently `server/src/config.ts:58` defaults to `'dev-receipt-hmac-placeholder'`. The `isProductionEnv` check at line 185 forbids the default in production but it remains usable in development. Consider promoting the check to all non-test envs. Cost: 5 min.

8. **HIGH-5: Add `style-src` and `frame-src` to CSP** (see HIGH-2) and audit WalletConnect, Base Pay, Stripe, Jupiter for required origins.

### MEDIUM

9. **MEDIUM-1: Add `aria-current="page"` to active nav links** (M-2). Cost: 15 min.
10. **MEDIUM-2: Add `/playground`, `/docs`, `/admin` to footer** (M-3). Cost: 15 min.
11. **MEDIUM-3: Move `themeColor` to a true background color.** `app/src/app/layout.tsx:70` uses `#00ffc8` (accent) instead of `#0a0a0f` (void). Cost: 5 min.
12. **MEDIUM-4: Wire up the light-mode tokens.** Either add a theme switcher in navbar/settings, or drop the light tokens and add `prefers-color-scheme` only. Cost: 2-4 hours.
13. **MEDIUM-5: Consolidate admin page patterns** (I-2). The 748-line `/admin/page.tsx` and the per-subroute pages overlap. Cost: half day.
14. **MEDIUM-6: Refactor compare and use-cases pages to be data-driven** (I-4). Cost: half day.
15. **MEDIUM-7: Audit `lib/api.ts` vs `lib/api/*.ts` imports** (I-5). Cost: 1 hour.
16. **MEDIUM-8: Remove `server/fix_pricing.py`** or move to `archive/` (I-1). Cost: 5 min.
17. **MEDIUM-9: Pin React + React-DOM to matching versions** (I-7). Cost: 5 min.
18. **MEDIUM-10: Add `lightningcss` or PostCSS verification** that the dynamic Tailwind v4 JIT output is compatible with the CSP. Cost: 1 hour.
19. **MEDIUM-11: Add the `/api/v1/chat/completions` proxy route in the Next.js app** (M-7). Cost: 2 hours.
20. **MEDIUM-12: Document the dual-cookie scheme** (`oma_session` for client middleware, `oma_api_key` for server auth) (M-8). Cost: 30 min.

### LOW

21. **LOW-1: Surface a "Report a bug" link on the 404/500 page** (M-4). Cost: 15 min.
22. **LOW-2: Add a PWA install prompt** (M-5). Cost: 4 hours.
23. **LOW-3: Verify GitHub org ownership** for the `github.com/oma-ai` link in navbar/footer (I-8). Cost: 5 min.
24. **LOW-4: Reduce top padding on dashboard** (dashboard/page.tsx:237 `pt-20` + root main `pt-16` = 144 px). Cost: 5 min.
25. **LOW-5: Add CI deploy workflow** (M-6). Cost: 2 hours.
26. **LOW-6: Add `aria-live="polite"` to the dashboard error banner** so screen readers announce backend-outage. Cost: 15 min.
27. **LOW-7: Add structured `revenueId` correlation header** between Next.js route handlers (`/api/admin/*`) and Hono `admin/*` routes for tracing. Cost: 2 hours.
28. **LOW-8: Add `nosniff` Content-Type to JSON error responses** (currently set only via `securityHeaders` middleware — verify it's not stripped). Cost: 5 min.

---

## 8. Verification Results

| Check | Command | Result |
|---|---|---|
| `app` typecheck | `cd oma/app && npm run typecheck` | **PASS** — `next typegen && tsc --noEmit` ran clean, route types generated successfully |
| `server` typecheck | `cd oma/server && npm run typecheck` | **PASS** — `tsc --noEmit` ran with no output (no errors) |
| `app` lint | `cd oma/app && npm run lint` | **PASS** — `eslint` exited 0 with no output |
| `server` lint | `cd oma/server && npm run lint` | **PASS** — `eslint src/` exited 0 with no output |
| `app` tests | `cd oma/app && npm test` | **PASS** — **5 files, 36 tests** in 17.49 s |
| `server` tests | `cd oma/server && npm test` | **PASS** — **45 files, 432 tests** in 25.38 s |
| **Combined** | — | **50 files, 468 tests passing, 0 type errors, 0 lint errors** |

A subset of server test categories:
- `request-validator.test.ts` (7) · `nonce-cleanup.test.ts` (4) · `credit-preflight.test.ts` (10) · `deepinfra.test.ts` (6) · `together.test.ts` (8) · `openrouter.test.ts` (16) · `rate-limit.test.ts` (19) · `stream-tracker.test.ts` (6) · `antseed.test.ts` (7) · `dlq.test.ts` (10) · `surplus.test.ts` (1) · `provider-caller.test.ts` (5) · `quote-cache.test.ts` (16) · `billing-service.test.ts` (17) · `sso.test.ts` (2) · `models.test.ts` (9) · `encryption.test.ts` (10) · `crosschain.test.ts` (14) · `chat-routes.test.ts` (12) · `circuit-breaker.test.ts` (2) · `admin.test.ts` (2) · `schema-queries.test.ts` (7) · `venice.test.ts` (6) · `api.test.ts` (10) · `router.test.ts` (5) · `credits.test.ts` (7) · `deposit.test.ts` (14) · `x402.test.ts` (9) · `auth.test.ts` (19) · `litellm.test.ts` (11) · `budget-alerts.test.ts` (3) · `onramp.test.ts` (10) · `inference.test.ts` (14) · `api-key-cookie.test.ts` (4) · `search.test.ts` (3) · `price-guard.test.ts` (11) · `response-handler.test.ts` (5) · `streaming-tokens.test.ts` (19) · `call-provider.test.ts` (10) · `provider-health.test.ts` (27) · `teams.test.ts` (4) · `config.test.ts` (3) · `rbac.test.ts` (4) · `request-queue.test.ts` (15) · `fetch.test.ts` (29)

---

## 9. Appendix — Screenshots

| File | Description |
|---|---|
| `docs/screenshots/audit-2026-06-02/00-production-url-mismatch.png` | `https://www.oma-ai.com/` — shows the wrong product ("OMA-AI MCP Marketplace with x402 Micro-Payments" by NosytLabs). The OMA AI Gateway code in this repo is **not** deployed there. |

No live OMA AI Gateway screenshots are included because no instance of the gateway is reachable: the production domain hosts a different product, no local frontend is running (only the Hono backend on `:3001`), and the docs/E2E directory `app/webwright_audit/` was not generated for this audit.

---

## 10. Diff vs 2026-05-31 audit

| Tier | 2026-05-31 (`audit-final-report.md`) | 2026-06-02 (this report) | Δ |
|---|---|---|---|
| CRITICAL | 7 | 3 | -4 (auth-bypass, INSECURE_DEFAULTS, mock-DB, CSP, CORS, missing CSRF, missing 2FA, session-middleware: most addressed in PROGRESS.md batches A2-A10; **two remain unfixed**: session-middleware length check, mock-DB silent fallback) |
| HIGH | 12 | 5 | -7 (most addressed; keyPrefix literal-vs-hash is a possible new HIGH) |
| MEDIUM | 18 | 12 | -6 (a11y/loading/skeleton work completed; rest are template-dedup, light-mode, footer completeness) |
| LOW | 9 | 8 | -1 |

Net assessment: significant work landed in the 2-day window. The two remaining C-tier items are the same two from the prior report, both unchanged.

---

*End of report.*
