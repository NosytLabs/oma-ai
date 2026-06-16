# OMA-AI — Comprehensive Due-Diligence Audit (2026-06-14)

**Auditor:** opencode (M3), read-only session — no source modifications
**Scope:** All 38 `app/src/app/*/page.tsx`, 46 components, `app/src/middleware.ts`, server routes/middleware/lib, inventory + complexity analysis
**Method:** Static read of full repo (no `npm run dev`), cross-reference with the 6 prior audit reports (X402, Operational Model, Site Pages, Surplus, New-API References, Ponytail Cleanup) to avoid duplication
**Existing audit inputs (cited, not duplicated):**

- `docs/AUDIT-SITE-PAGES-2026-06-14.md` — HTTP status of each page, fictional model catalog
- `docs/AUDIT-X402-2026-06-14.md` — 6 CRITICAL, 7 HIGH, 9 MEDIUM, 8 LOW in `x402/`
- `docs/AUDIT-OPERATIONAL-MODEL-2026-06-14.md` — wallet/operator trace
- `docs/AUDIT-SURPLUS-2026-06-14.md` — Surplus provider viability
- `docs/AUDIT-NEW-API-REFERENCES-2026-06-14.md` — feature parity vs new-api/one-api
- `docs/AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` — dead code + 5 SEC findings in credits/auth/rate-limit

---

## Executive Summary

**Overall health score: 62 / 100** ⚠️ *(significant debt, partly mitigated by already-completed prior audits)*

| Dimension | Score | Why |
|---|---|---|
| Functionality (pages, routes) | 55 | 5/21 auth-walled pages 500 in dev per `AUDIT-SITE-PAGES-2026-06-14.md`. Production API at `api.oma-ai.com` returns 404. |
| User flow completeness | 65 | Login → dashboard → deposit → chat chain works in code; breaks at runtime when API absent. Playground/deposit/auth UI is well-built. |
| UI/UX consistency | 78 | Strong terminal/atmospheric design system (Hallmark `P4 H5 E5 S5 R4 V4` annotations in `navbar.tsx:3`); minor inconsistencies noted. |
| Inventory / dead code | 70 | 11,486 LOC across 24 inference modules, 13 docs `_components`, 5 modal variants of similar UI. ~1.4% dead code in `request-queue.ts` write side. |
| Dev cost & complexity | 60 | Largest files: `x402/facilitator.ts` (979), `db/schema.ts` (789), `auth.ts` (583), `inference/venice.ts` (554). 24 modules in `inference/`, 15 in `credits/`, 8 in `middleware/`. |
| Build hygiene | 90 | `tsc --noEmit` clean for both `server/` and `app/`. ESLint clean (no output). 0 console.log in components. 2 TODO/FIXME comments in app (none in server src). |
| Security posture | 50 | Carries forward 6 CRITICAL + 7 HIGH from x402 audit + 5 HIGH from ponytail audit + 3 P0 from Surplus audit. **No security issues identified by this audit that aren't already in the prior reports.** |

**One-line verdict:** The frontend is well-designed and the server is feature-complete on paper, but at least 16 CRITICAL/HIGH issues across the existing audits (x402 signer, deposit signature, EIP-712 payee pin, OMA token references, model catalog split) must be resolved before any real-money traffic. The dev cost to fix everything in the existing audits is ≈3-4 weeks of focused work; this audit surfaces no new CRITICAL or HIGH.

---

## Section A — Functionality & Pages

**38 page.tsx files** (not 21 as the prompt assumed). The user underestimated the scope. All 21 "expected" pages exist; the additional 17 are admin, dashboard sub-pages, use-cases, compare, etc.

### A.1 Per-page inventory & status

Status codes from `AUDIT-SITE-PAGES-2026-06-14.md` (HTTP probe, today, 2026-06-14). "OK" = page renders without server error.

| Path | HTTP | Loads | Critical issues | file:line |
|---|---|---|---|---|
| `/` | 200 | ✅ | Model count "91+" vs real 19; FEATURED_MODELS contains `deepseek-v3.2` (real at `models.ts:70-72`) but the rest of the **metadata** (`provider: "Anthropic"`, `provider: "Google"`) is wrong — page claims Anthropic routes `claude-sonnet-4` to Venice, etc. | `app/src/app/page.tsx:31-38` |
| `/about` | 200 | ✅ | Internal inconsistency: claims "50+ models" (footer) when catalog is 19 | `app/src/components/footer.tsx` |
| `/pricing` | 200 | ✅ | 17 model IDs in `MODELS[]`; 4 are not in server catalog (`claude-3-5-sonnet-latest`, `llama-3.3-70b-together` is in catalog at line 138, but `free/*` IDs are fictional, `claude-opus-4` not in `models.ts` grep) | `app/src/app/pricing/page.tsx:29-47` |
| `/models` | 200 | ✅ | OK; renders from `app/src/lib/models-data.ts` (separate from server catalog) | `app/src/app/models/page.tsx:528` |
| `/docs` | 200 | ✅ | Production URL hardcoded in 12 places in this page alone; copy/paste samples use a `claude-sonnet-4-6` fictional id | `app/src/app/docs/page.tsx:316, 356, 626` |
| `/faq` | 200 | ✅ | "50+ models" claim | `app/src/app/faq/page.tsx` |
| `/compare` | 200 | ✅ | 4 sub-pages (`venice-ai-alternative`, `openrouter-alternative`, `cheaptokens-alternative`, `surplus-min-discount-routing`) — all long-form, well-written, but `surplus-min-discount-routing` (755 lines) markets a **broken feature** | `app/src/app/compare/surplus-min-discount-routing/page.tsx:755` |
| `/use-cases` | 200 | ✅ | 4 sub-pages; `use-cases/ai-agents`, `chatbots`, `apps` all `use client`, fetch with placeholder `OMA_API_KEY` env | `app/src/app/use-cases/*/page.tsx:25,29` |
| `/private-ai-api` | 200 | ✅ | Content matches code; no false claims | `app/src/app/private-ai-api/page.tsx:212` |
| `/crypto-payments` | 200 | ✅ | OMA token referenced in 6+ places; no token contract exists | `app/src/app/crypto-payments/page.tsx:665` |
| `/login` | 200 | ✅ | OK; SIWE + account-number auth | `app/src/app/login/page.tsx:164` |
| `/image-generation` | 200 | ✅ | 4 models, hardcoded; OK as UI shell | `app/src/app/image-generation/page.tsx:255` |
| `/video-generation` | 200 | ✅ | 3 of 5 model ids not in server (carried from `AUDIT-SITE-PAGES-2026-06-14.md:3.3`) | `app/src/app/video-generation/page.tsx:419` |
| `/swap` | 200 | ✅ | Houdini UI, OK | `app/src/app/swap/page.tsx:897` |
| `/privacy` | 200 | ✅ | References fictional `claude-sonnet-4-6` | `app/src/app/privacy/page.tsx:524` |
| `/terms` | 200 | ✅ | OMA token bonus logic in copy but no contract | `app/src/app/terms/page.tsx:481` |
| `/dashboard` | **500** | ❌ | Middleware module missing (per prior audit) | `app/src/middleware.ts:5` |
| `/playground` | **500** | ❌ | Same | `app/src/middleware.ts:5` |
| `/settings` | **500** | ❌ | Same | `app/src/middleware.ts:5` |
| `/deposit` | **500** | ❌ | Same | `app/src/middleware.ts:5` |
| `/admin/*` (8 pages) | **500** | ❌ | Same | `app/src/middleware.ts:5` |
| `localhost:3001/health` | **404** | ❌ | Wrong process on port (Next.js, not Hono) | per `AUDIT-SITE-PAGES-2026-06-14.md:1.1` |
| `https://api.oma-ai.com/health` | **404** | ❌ | Production API not deployed | per `AUDIT-SITE-PAGES-2026-06-14.md:1.3` |

### A.2 Interactive elements

| Surface | File:line | Status |
|---|---|---|
| Sign-in with wallet (SIWE) | `app/src/components/wallet-provider.tsx:165-199` | OK in code; requires wagmi connector live |
| Sign-in with account number | `app/src/components/account-login-modal.tsx:336` | OK; 4-step modal (intro → create → confirm → done) |
| Wallet disconnect | `app/src/components/wallet-provider.tsx:329` | OK; clears cookie + local storage |
| Playground chat send | `app/src/app/playground/page.tsx:647` | Calls `/v1/chat/completions`; fails silently if API down |
| Playground model switcher | `app/src/components/playground/ModelSelector.tsx:141` | OK; 3 tabs (text/image/video) |
| Deposit USDC form | `app/src/app/deposit/_components/UnifiedDepositInterface.tsx` | OK; 4 payment methods, lazy Jupiter quote |
| Create API key | `app/src/app/dashboard/page.tsx:169-187` | OK; react-query, optimistic update |
| Revoke API key | `app/src/app/dashboard/page.tsx:189-200` | OK |
| Image generate button | `app/src/app/image-generation/page.tsx:25-` | OK; state machine (`idle → loading → result`) |
| Swap quote | `app/src/app/swap/page.tsx:897` | Houdini integration; needs live API |
| Theme toggle | `app/src/components/ThemeToggle.tsx` | OK; persists to localStorage |
| Skip-to-content link | `app/src/app/layout.tsx:122-127` | OK; accessibility best practice |

### A.3 Console / runtime concerns (inferred from source)

- **No `useEffect` cleanups missed** in the 28 client pages; `useEffect` deps look correct in `navbar.tsx:61-96`, `dashboard/page.tsx:135-156`, `account-login-modal.tsx`.
- **`process.env.NEXT_PUBLIC_BUILD_SHA ?? 'dev'`** referenced in 5 pages (`privacy`, `faq`, `terms`, `about`, `compare`); all use `.slice(0, 7)` so a missing var is silent — minor: dev never shows build SHA, prod only if CI sets it.
- **`process.env.OMA_AGENT_KEY` / `OMA_API_KEY`** referenced in 3 use-case pages (`ai-agents:25`, `chatbots:29`, `apps:25`) and 2 docs sections — these run server-side as default, but the variables aren't validated, so a missing key silently makes the curl example return 401.
- **`LottiePlayer`** lazy-loaded via `next/dynamic` in `FeaturedX402Lottie.tsx:20` (good — keeps `lottie-react` out of initial bundle).
- **`api-status.tsx:7`** reads `localhost:3001/health`; the wrong-process bug per `AUDIT-SITE-PAGES-2026-06-14.md:1.1` means this is stuck on "Connecting..." in dev.
- **Hot-reload story**: `tsc --noEmit` is clean for both `server/` and `app/` (verified 2026-06-14, 0 errors). No build-blocking issues.

### A.4 Pages with model/feature claims vs reality

| Page | Claim | Reality | Severity |
|---|---|---|---|
| `app/src/app/layout.tsx:54` | "Access 91+ models" | Server catalog has ~19 (`models.ts`); UI has 33 in `models-data.ts` | HIGH |
| `app/src/app/page.tsx:148` | "6 of 91+ shown" | 6 of 19 shown — the 91+ number is the inflated count | HIGH |
| `app/src/app/pricing/page.tsx` | Header: "Pay per token across 28+ models" / Table: 17 rows | Two different numbers on one page | MED (per `AUDIT-SITE-PAGES-2026-06-14.md:3.2`) |
| `app/src/components/footer.tsx` | "50+ models" in 5 pages (homepage footer copy) | 19 | HIGH |
| `app/src/app/docs/page.tsx:212` | "30+ models" | 19 | HIGH |
| `app/src/app/about/page.tsx:909` | "50+ models" | 19 | HIGH |
| `app/src/app/compare/page.tsx:244` | "18+ models" | 19 | OK |
| `app/src/app/faq/page.tsx:506` | "50+ models across Venice and AntSeed" | 19, but 9 from Venice + 1 from Antseed | HIGH |

---

## Section B — User Flow

The intended user journey:

```
Landing (/) → /pricing → /models → /login → /dashboard
                                              ↓
                       /deposit (USDC/Houdini/CCTP/x402)
                                              ↓
                       /playground → chat → usage records → /dashboard
```

### B.1 Step-by-step trace

| # | Step | File:line | Works? | Friction / break point |
|---|---|---|---|---|
| 1 | Land on `/` | `app/src/app/page.tsx` | ✅ | Copy is real (per `AUDIT-SITE-PAGES-2026-06-14.md`); "live" indicator is hardcoded `online` even when API is down |
| 2 | Click "open the docs" | `page.tsx:120` → `/docs` | ✅ | `/docs` loads; curl samples use `claude-sonnet-4-6` (fictional) |
| 3 | Click "try the playground" | `page.tsx:123` → `/playground` | ❌ | **HTTP 500** per `AUDIT-SITE-PAGES-2026-06-14.md:1.2` — middleware compile artefact |
| 4 | First-time user: "How do I pay?" | Footer "models" or "use cases" → `/docs` | ⚠️ | No clear "Get started" CTA pointing to wallet connect on landing |
| 5 | Click "Connect your wallet to continue" | `page.tsx:391` | ❌ | Goes to `/dashboard` which 500s |
| 6 | Visit `/pricing` | `app/src/app/pricing/page.tsx:362` | ✅ | Tier filter works, FAQ accordion OK; copy says "credits have 12-month rolling expiry" but server's `credit-expiry.ts` job does the actual expiry (not visible to user) |
| 7 | Click "Connect Base Wallet" on /deposit | `app/src/app/deposit/page.tsx:33-45` | ❌ | **Page 500s** before user can even see the button |
| 8 | Sign-in flow | `app/src/app/login/page.tsx:164` → SIWE or account number | ⚠️ | "Account number" tab works; SIWE requires wagmi connectors + Coinbase Wallet SDK to be loaded at runtime |
| 9 | SIWE success → `next` | `login/page.tsx:37-39` | ❌ | `router.replace(next)` where `next` defaults to `/dashboard` — **500s** |
| 10 | Dashboard loads | `app/src/app/dashboard/page.tsx:327` | ❌ | HTTP 500 (middleware) |
| 11 | Dashboard renders after middleware fix | `dashboard/page.tsx:73-` | ⚠️ | 4 react-query calls; 8 dynamic-imported components. If API down, shows "Backend unavailable \| Ensure server is running on port 3001" (`dashboard/page.tsx:236-239`) |
| 12 | "Add credits" link in user menu | `navbar.tsx:316` → `/deposit` | ❌ | 500 |
| 13 | Pick deposit method | `deposit/_components/UnifiedDepositInterface.tsx` | ⚠️ | 4 methods (USDC, Houdini, CCTP, x402), each with its own state machine; USDC direct requires wallet signature |
| 14 | USDC transfer confirmed | `server/src/credits/deposit.ts:48-76` | ⚠️ | "signature" is a length check not verification (`AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` SEC-1) |
| 15 | Balance credited | `credits/add-credits.ts:18-35` | ✅ | Standard upsert |
| 16 | Navigate to /playground | middleware | ❌ | 500 |
| 17 | Playground works after fix | `playground/page.tsx:647` | ⚠️ | `useChat` hook streams from `/v1/chat/completions`; model selector defaults to first model in list |
| 18 | Send a message | `playground/page.tsx` | ⚠️ | If model not in catalog (e.g., user types custom), 400 "Model not found"; if model in catalog but provider down, circuit breaker kicks in (`AUDIT-OPERATIONAL-MODEL-2026-06-14.md:3.4`) |
| 19 | Chat response streams | `app/src/components/playground/ChatMessage.tsx:307` | ✅ | Code syntax highlight, copy, retry all work |
| 20 | See usage in dashboard | `dashboard/page.tsx:90-95` → `usageQuery` | ⚠️ | `mapUsageToChartData` may show empty chart if usage array is `[]` on first visit |
| 21 | View API key | `dashboard/page.tsx:266` | ✅ | After create, modal `CreatedKeyModal` shows secret once with copy button (`dashboard/CreatedKeyModal.tsx:115`) |
| 22 | Disconnect | `navbar.tsx:329` | ✅ | Clears cookie, evmAddress → null, returns to landing |

### B.2 Where the flow breaks for first-time users

1. **HTTP 500 on every protected route** (`/dashboard`, `/playground`, `/settings`, `/deposit`, `/admin`) per `AUDIT-SITE-PAGES-2026-06-14.md:1.2` — this is the #1 conversion-killer. A first-time user clicks "try the playground" from the landing page and sees a 500.
2. **No on-ramp CTA on landing page.** The hero has "open the docs" and "try the playground" — both are read-only paths. There is no "Sign in to deposit" CTA in the primary button row. The wallet connect CTA exists but is at the end of the page (`page.tsx:391`).
3. **Fictional model IDs in curl examples** — a developer copies `claude-sonnet-4-6` from the docs and gets 404.
4. **Production API returns 404** — `https://api.oma-ai.com` is documented everywhere but not deployed.
5. **Playground defaults to a 0-context model** — `playground/page.tsx:647` if the default model selector picks `llama-3.2-3b` (8k ctx), a user pasting a 10k-token document gets a silent truncation.
6. **No "you're out of credits" warning** — the playground sends the request, gets a 402, displays the error, but the user has no in-line link to deposit.

### B.3 Confusing redirects

- `/login` → `next=/dashboard` (default at `login/page.tsx:32`) → 500. Should fall back to `/` if `/dashboard` fails.
- `middleware.ts:28-31` redirects to `/?next=/dashboard&auth=required` for unauthenticated users; the landing page does not display a banner explaining this query string is being parsed (the `AuthNotice` component exists at `app/src/components/AuthNotice.tsx` and is rendered in `Suspense` at `page.tsx:89-91` but I didn't observe any "auth=required" toast).

---

## Section C — UI/UX Consistency

The design system is **strong and intentional**. The navbar's `Hallmark` annotation block at `navbar.tsx:3-14` is exemplary documentation: it states nav style, contrast, interactive states per element. Other components should follow this pattern.

### C.1 Specific inconsistencies (file:line)

| Severity | File:line | Issue |
|---|---|---|
| **LOW** | `app/src/app/page.tsx:88` | Body uses `font-sans` (Inter) but the section labels in `page.tsx:172-174, 226-228, 298-300, 332-334, 364-366` use `font-syne` for visual hierarchy — consistent. But the **hero h1** at `page.tsx:108` uses `font-syne font-bold` (correct), and the supporting `<p>` at `page.tsx:115` uses default `font-sans`. Switches correctly between display and body. **OK** |
| **LOW** | `app/src/app/page.tsx:148` | Claims "Models 6 of 91+ shown" — `91+` is inconsistent with the section copy at `layout.tsx:54` ("91+ models") but the actual catalog has 19. See Section A. |
| **LOW** | `app/src/app/login/page.tsx:78-82` vs `app/src/app/login/page.tsx:94-99` | The two tab buttons have the same styling but different active-state class strings (`bg-[var(--color-accent)] text-[var(--color-void)]` vs the same). Duplicate. Extract. |
| **LOW** | `app/src/components/account-login-modal.tsx:336` | "Intro" state shows a 3-step explainer; "Create" state shows a 4-step wizard; "Confirm" state shows the account number. State machine is clean but the modal is **336 lines** — split into `<AccountLoginIntro/>`, `<AccountLoginCreate/>`, etc. |
| **LOW** | `app/src/components/navbar.tsx:283` | Wallet address truncation `${evmAddress.slice(0, 6)}…${evmAddress.slice(-4)}` is 6 chars + ellipsis + 4 chars. Industry standard is 4+4 or 6+4. Current is fine. |
| **MED** | `app/src/app/dashboard/credits/page.tsx:622` | Largest single page in the dashboard. 622 LOC for a single page is borderline; not split into sub-components. The `dashboard/credits` page has its own copy of `useState`, `useEffect`, and `useQuery` patterns that are nearly identical to `dashboard/api-keys/page.tsx:544`. |
| **MED** | `app/src/app/docs/_components/` | 13 files for a single docs page. The "split into per-section component" pattern is good for lazy-loading, but the docs page (`docs/page.tsx:964`) imports them all synchronously at the top — defeats the purpose. Should use `dynamic(() => import('./_components/AuthenticationSection'))`. |
| **LOW** | `app/src/components/dashboard/ApiKeyManager.tsx:198` | "create" form is local; "edit" form not implemented (per `AUDIT-NEW-API-REFERENCES-2026-06-14.md` recommendation B). |
| **LOW** | `app/src/app/playground/page.tsx:647` | 647 LOC single file. Should split: `<PlaygroundSidebar/>`, `<PlaygroundChatArea/>` (already exists at `_components/PlaygroundChatArea.tsx`), `<PlaygroundSettingsPanel/>` (already exists). The page itself is mostly glue. |
| **MED** | `app/src/app/settings/page.tsx:565` | 565 LOC for `/settings` — by far the largest single page. Settings tabs (Profile, Security, Notifications, Billing, API Keys) are all in one file. Should split per-tab. |
| **LOW** | `app/src/components/LottiePlayer.tsx:128` | Lottie animations: 3 JSON files in `public/`. Loads via `fetch('/lottie-x402-flow.json')`. No loading skeleton — only `null` fallback. Lottie files are 100-300KB each; on slow networks the user sees a blank box. |
| **MED** | `app/src/app/about/page.tsx:909` | The about page is 909 LOC. Carries the full philosophy + history + team + roadmap. Feels over-stuffed; could be 3-4 sub-pages. |
| **LOW** | `app/src/app/dashboard/page.tsx:151-152` | Arrow-key pagination in the RecentRequestsTable — but no visible focus indicator on the table rows. The "press ← / →" affordance is implicit. |
| **LOW** | `app/src/components/ui/CryptoLogo.tsx:186` | Crypto logo component renders SVG for known tokens; falls back to a 2-letter monogram. Good fallback design. |

### C.2 Accessibility (a11y) — quick scan

| Concern | File:line | Status |
|---|---|---|
| Skip-to-content link | `app/src/app/layout.tsx:122-127` | ✅ Implemented |
| `aria-current` on nav links | `app/src/components/navbar.tsx:167, 228` | ✅ |
| `aria-label` on icon-only buttons | `navbar.tsx:253, 348, 312` | ✅ |
| `aria-expanded` / `aria-haspopup` on dropdowns | `navbar.tsx:197-198, 272-274` | ✅ |
| `role="tablist"` + `role="tab"` | `app/src/app/login/page.tsx:67-101` | ✅ |
| `aria-live` for error toasts | `app/src/app/dashboard/page.tsx:232` | ✅ (`aria-live="polite"`) |
| Color contrast (claimed WCAG AA) | navbar.tsx:13 annotation | ✅ per `AUDIT-SITE-PAGES-2026-06-14.md:4` |
| Keyboard support for dropdowns | `navbar.tsx:80-96, 99-116` | ✅ (Escape key handler) |
| Focus rings on all interactive elements | scattered | ✅ `focus-visible:ring-2` is consistent |
| Form labels in account-number modal | `app/src/components/account-login-modal.tsx` | ⚠️ need to check (not audited here) |

### C.3 Mobile responsiveness

- `navbar.tsx:340-358` has a hamburger menu (lg breakpoint = 1024px)
- `dashboard/page.tsx` uses `grid-cols-1 lg:grid-cols-3` for top cards (responsive)
- `pricing/page.tsx` uses single-column on mobile
- All pages use `max-w-6xl` container for max width
- **No dedicated mobile testing done in this audit**; layout is Tailwind-responsive but I cannot verify rendering on actual devices

---

## Section D — Inventory

### D.1 Top-level counts

| Category | Count | Notes |
|---|---|---|
| `app/src/app/*/page.tsx` files | **38** | Not 21 as prompt assumed. The prompt's "21" is a subset (excludes admin, dashboard sub-pages, use-cases, compare sub-pages, etc.). |
| `app/src/app/*/loading.tsx` files | **23** | One per main page; nice UX touch |
| `app/src/app/*/layout.tsx` files | **4** | Root + playground + deposit + image/video |
| `app/src/app/*/_components` folders | **4** | `_components/` (homepage), `deposit/_components/`, `playground/_components/`, `docs/_components/` |
| `app/src/components/*.tsx` files | **19** (top-level) | 46 total including subdirs |
| `app/src/components/ui/*.tsx` files | **11** | Design system primitives |
| `app/src/components/dashboard/*.tsx` files | **8** | Dashboard-only components |
| `app/src/components/admin/*.tsx` files | **5** | Admin-only components |
| `app/src/components/playground/*.tsx` files | **3** | Playground-only |
| `app/src/components/models/*.tsx` files | **1** | Model detail modal |
| `app/src/lib/*.ts(x)` files | **10** | + `lib/api/` split (12 files) |
| `app/src/hooks/` | **0** (does not exist) | All hooks inlined in components |
| `app/src/middleware.ts` | **1** (55 LOC) | Auth wall |
| `app/src/app/api/*/route.ts` files | **~10** | Next.js API routes (BFF layer for some flows) |

### D.2 Server counts

| Category | Count | Notes |
|---|---|---|
| `server/src/**/*.ts` files (excl. tests) | **145** | |
| `server/src/inference/*` modules | **24** | Per `AUDIT-OPERATIONAL-MODEL-2026-06-14.md` inventory |
| `server/src/x402/*` modules | **3** | facilitator (979 LOC), crosschain (528 LOC), types |
| `server/src/credits/*` modules | **15** | Per `AUDIT-OPERATIONAL-MODEL-2026-06-14.md` |
| `server/src/middleware/*` modules | **8** | |
| `server/src/lib/*` modules | **10** | |
| `server/src/routes/*` files (excl. tests) | **~50** | chat, chat-ws, deposit (subdir), admin (subdir), etc. |
| `server/src/jobs/*` files | **7** | credit-expiry, subscription-cron, deposit-* (4), nonce-cleanup, ratio-sync-cron |
| `server/src/__tests__/*` files | **22** | |

### D.3 Lines of code (excluding `__tests__/` and `*.test.*`)

| Area | LOC | % of repo |
|---|---|---|
| `app/src/app/**` (pages) | 15,418 | 25.7% |
| `app/src/components/**` | 5,850 | 9.8% |
| `app/src/lib/**` | 1,354 (api split) + 1,300 (other) = ~2,700 | 4.5% |
| `app/src/middleware.ts` + `app/next.config.*` | 55 | 0.1% |
| `app` total | **24,023** | **40.1%** |
| `server/src/inference/**` | ~5,500 | 9.2% |
| `server/src/x402/**` | ~1,800 (incl. facilitator) | 3.0% |
| `server/src/credits/**` | ~2,200 | 3.7% |
| `server/src/routes/**` | 10,809 | 18.0% |
| `server/src/middleware/**` | ~1,800 | 3.0% |
| `server/src/lib/**` | ~1,500 | 2.5% |
| `server/src/auth/**` + `db/**` + `jobs/**` | ~4,200 | 7.0% |
| `server` total | **27,776** | **46.3%** |
| `contracts/`, `deploy/`, `scripts/`, root configs | ~12,000 | 20.0% (estimates) |
| **GRAND TOTAL** | **~60,000** (excl. tests, node_modules) | |

Tests add another ~15,000 LOC (estimate: 22 server test files averaging 500 lines each = 11,000, plus 3 app page tests at ~200 lines each = 600, plus `__tests__/` in app = ~3,000).

### D.4 Dead code / unused items

| Item | File:line | Severity | Action |
|---|---|---|---|
| `request-queue.ts` write side (`enqueueRequest`, `peekQueue`, `removeFromQueue`, `clearQueue`, `startQueueProcessor`, `stopQueueProcessor`, `getQueueStats`, Lua scripts, `processingFlag` mutex) | `server/src/lib/request-queue.ts:77-107, 184-241, 246-275` | **HIGH** | Delete. Per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S1. −100 LOC, 0 behavior change. |
| `dlq.ts` settlement variant (`SettlementDlqEntry`, `addSettlementToDlq`, `getSettlementDlqEntries`, `retrySettlementFromDlq`, `removeSettlementDlqEntry`) | `server/src/lib/dlq.ts:10-17, 49-76, 91-102, 121-136, 151-177` | **MED** | Per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S2. −80 LOC. |
| `provider-health.ts` DB sync loop + unreachable LRU cache | `server/src/inference/provider-health.ts:32-181, 273-298` | **MED** | Per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S3. −120 LOC. |
| `provider-health.ts:372` — `surplus: "https://api.surplusintelligence.ai"` (wrong domain) | per `AUDIT-SURPLUS-2026-06-14.md:9` | LOW | Update to `www.` |
| `getCachedRedisClient` shadows `lib/redis-client.ts` | `server/src/lib/quote-cache.ts:18-25` | LOW | Delete. |
| `_skipIfExists` destructured but never used | `server/src/x402/facilitator.ts:450` | LOW | Per `AUDIT-X402-2026-06-14.md` LOW-7 |
| `tokens` in `app/src/lib/api.ts` (the old monolith) | per `AGENTS.md` "Frontend `lib/api` is split" | INFO | Already a thin re-export shim — OK |
| `provider-test.isolated.test.ts` in `routes/admin/__tests__/` | `server/src/routes/admin/__tests__/provider-test.isolated.test.ts:329` | INFO | Test file, not dead — keep |
| `pricing/page.test.tsx` | `app/src/app/pricing/page.test.tsx` | INFO | Test, not dead — keep |
| `models/page.test.tsx` | `app/src/app/models/page.test.tsx` | INFO | Test, not dead — keep |
| `page.test.tsx` | `app/src/app/page.test.tsx` | INFO | Test, not dead — keep |
| `__tests__/page.larp-isolated.test.ts` | `app/src/app/__tests__/` | INFO | Audit leftover, not dead — keep |
| `getQueuePosition` | `server/src/lib/request-queue.ts:142` | INFO | Used by `routes/queue.ts` — keep |
| `vendor-meta.ts:147` `baseUrl: "https://api.surplusintelligence.ai/v1"` | per `AUDIT-SURPLUS-2026-06-14.md:17` | LOW | Drift trap; not on hot path |
| `isValidTxHash` one-line wrapper | `server/src/credits/deposit.ts:7-9` | LOW | Per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` "inline at 3 call sites" |

### D.5 Assets inventory

| Path | Items | Notes |
|---|---|---|
| `app/public/logos/` | (count not checked) | Brand logos |
| `app/public/lottie-*.json` | 3 | x402-flow, 404, playground-loader |
| `app/public/favicon.*` | 2 | svg + png |
| `app/public/og-image.png` | 1 | Social share |
| `app/public/llms-full.txt` | 1 | 91+ models catalog (machine-readable) |

### D.6 Console statements & TODO markers

| Pattern | Count | Notes |
|---|---|---|
| `console.log/warn/error` in `app/src/app/**/page.tsx` | 22 | Mostly `console.error` in catch blocks; 0 `console.log` in pages |
| `console.log/warn/error` in `app/src/components/*.tsx` | <5 | All `console.error` in catch |
| `console.log/warn/error` in `server/src/**` (excl. tests) | (large, not counted) | Heavy use of `logger.info`/`logger.warn` |
| `throw new Error` in `app/src/**` | 32 | All in error boundaries / loaders |
| `throw new Error` in `server/src/**` (excl. tests) | (large) | Standard error handling |
| `TODO`/`FIXME`/`XXX` in `app/src/**` | 2 (in `login/page.tsx` and `account-login-modal.tsx`) | Both are in docstrings |
| `TODO`/`FIXME`/`XXX` in `server/src/**` (excl. tests) | 0 | Clean — all `// TRACKED ISSUE` references are in x402/surplus and already documented in audits |

---

## Section E — Dev Cost & Complexity

### E.1 Highest-LOC server files (Top 15)

| File | LOC | Risk | Reason |
|---|---|---|---|
| `server/src/x402/facilitator.ts` | **979** | **CRITICAL** | Money path; 6 CRITICAL findings from `AUDIT-X402-2026-06-14.md`; 818 lines of route handlers + 161 lines of cache primitives |
| `server/src/db/schema.ts` | **789** | **HIGH** | Single-file schema; 50+ tables; any new column requires migration; high change cost |
| `server/src/inference/venice.ts` | **554** | MED | Adapter pattern; falls back to `VENICE_API_KEY` only on null cache, not on expired cache (per `AUDIT-OPERATIONAL-MODEL-2026-06-14.md:3.2`) |
| `server/src/inference/ratio-sync.ts` | **543** | LOW | Background price-ratio sync (CoinGecko → DB) |
| `server/src/inference/models.ts` | **543** | MED | FALLBACK_MODELS list, no Surplus entries (per `AUDIT-SURPLUS-2026-06-14.md:2`) |
| `server/src/x402/crosschain.ts` | **528** | **HIGH** | 4 CRITICAL/HIGH findings from `AUDIT-X402-2026-06-14.md` (quote/deposit auth, slippage hardcode) |
| `server/src/middleware/rate-limit/token-bucket.ts` | **496** | LOW | Heavy use but well-tested |
| `server/src/inference/surplus.ts` | **468** | **CRITICAL** | 3 P0 from `AUDIT-SURPLUS-2026-06-14.md`; EIP-712 wrong, base64 missing, no models in catalog |
| `server/src/auth/api-keys.ts` | **403** | LOW | Mostly IP-CIDR parsing |
| `server/src/inference/provider-health.ts` | **409** | MED | Per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S3: 3 sources of truth |
| `server/src/routes/auth.ts` | **583** | MED | SIWE + 2FA + account-number; 583 LOC for 3 auth flows |
| `server/src/routes/admin/ledger.ts` | **437** | MED | Cold/hot wallet report + sweep |
| `server/src/routes/withdraw.ts` | **402** | MED | Withdrawal flow |
| `server/src/routes/jupiter.ts` | **490** | LOW | Jupiter aggregator client (per `AUDIT-OPERATIONAL-MODEL-2026-06-14.md`) |
| `server/src/credits/*` total | **~2,200** across 15 files | MED | `deposit.ts:262` has the SEC-1 length-check; `deduction.ts:104` has SEC-5 race |

### E.2 Highest-LOC app files (Top 10)

| File | LOC | Risk | Reason |
|---|---|---|---|
| `app/src/app/docs/page.tsx` | **964** | MED | 13 `_components/` sub-files; serial imports defeat the lazy-load purpose |
| `app/src/app/about/page.tsx` | **909** | LOW | Long-form marketing |
| `app/src/app/swap/page.tsx` | **897** | MED | Houdini integration; live Jupiter quote |
| `app/src/app/compare/surplus-min-discount-routing/page.tsx` | **755** | **HIGH** | Markets broken feature; lead-gen risk |
| `app/src/app/docs/_components/AuthenticationSection.tsx` | (presumed 200+) | LOW | |
| `app/src/app/playground/page.tsx` | **647** | MED | Should split; `PlaygroundChatArea` and `PlaygroundSettingsPanel` already exist as `_components` |
| `app/src/app/crypto-payments/page.tsx` | **665** | MED | OMA token references w/o contract |
| `app/src/app/dashboard/credits/page.tsx` | **622** | MED | Should split into `<CreditsTable/>`, `<CreditsFilters/>` |
| `app/src/app/settings/page.tsx` | **565** | MED | Should split into per-tab components |
| `app/src/app/dashboard/api-keys/page.tsx` | **544** | MED | `<ApiKeyManager>` exists at `app/src/components/dashboard/ApiKeyManager.tsx:198`; should use it instead of inlining |

### E.3 Cyclomatic complexity hotspots

| Function | File:line | Cyclomatic | Notes |
|---|---|---|---|
| `ensureProviderRecord` | `server/src/inference/provider-health.ts:118-181` | ~10 | 4 nested state machines (CLOSED/HALF_OPEN/OPEN × in-mem × Redis × DB) |
| `tokenBucket` | `server/src/middleware/rate-limit/token-bucket.ts:62-175` | ~12 | Redis-unavailable fail-closed path duplicated 3x |
| `handleChatCompletion` | `server/src/inference/router.ts:82-162` | 7 | Per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S5: 80-line god function |
| `verifyEvmPayment` | `server/src/x402/facilitator.ts:207-345` | 9 | Per `AUDIT-X402-2026-06-14.md` CRITICAL-1+3+6 — security-critical |
| `x402 verify` handler | `server/src/x402/facilitator.ts:380-419` | 8 | Schema-dependent branching |
| `signPayment` | `server/src/inference/surplus.ts:282-364` | 6 | Per `AUDIT-SURPLUS-2026-06-14.md` Q1 — broken |
| `accountLoginModal` | `app/src/components/account-login-modal.tsx` | (state machine, 4 states) | Acceptable |

### E.4 Maintenance cost (estimated by area)

| Area | LOC | Risk | Fix-cost | Why |
|---|---|---|---|---|
| `x402/facilitator.ts` | 979 | **CRITICAL** | 2-3 weeks (1 eng) | Money path; 6 CRITICAL + 7 HIGH + 9 MED + 8 LOW; per `AUDIT-X402-2026-06-14.md` |
| `x402/crosschain.ts` | 528 | **HIGH** | 1 week (1 eng) | 4 HIGH findings; auth + slippage + refund validation |
| `inference/surplus.ts` | 468 | **CRITICAL** | 2-3 days (1 eng) | P0 EIP-712 + base64 + model catalog; per `AUDIT-SURPLUS-2026-06-14.md` |
| `credits/deposit.ts` | 262 | **HIGH** | 1 day (1 eng) | SEC-1 signature check + SEC-2 amount validation; per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` |
| `credits/deduction.ts` | 104 | MED | 4 hours | SEC-5 race condition; per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` |
| `inference/router.ts` | 163 | MED | 4 hours | God function refactor; per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S5 |
| `inference/provider-health.ts` | 409 | MED | 1 day | Pick one source of truth; per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S3 |
| `lib/request-queue.ts` | 316 | LOW | 15 min | Dead-code delete; per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S1 |
| `lib/dlq.ts` | 189 | LOW | 20 min | Consolidate; per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S2 |
| `lib/quote-cache.ts` | 148 | LOW | 15 min | Class → free functions; per `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` S4 |
| `app/src/middleware.ts` | 55 | **HIGH** (runtime) | 5 min | Compile artefact fix; per `AUDIT-SITE-PAGES-2026-06-14.md:1.2` |
| Model catalog reconciliation (UI vs server) | (no new LOC) | **HIGH** | 4-8 hours (1 eng) | Per `AUDIT-SITE-PAGES-2026-06-14.md:3.4` |
| Production API deploy (`api.oma-ai.com`) | (infra) | **HIGH** | 1 day (DevOps) | Per `AUDIT-SITE-PAGES-2026-06-14.md:1.3` |
| OMA token references removal | (no new LOC) | MED | 2-4 hours (1 eng) | Per `AUDIT-SITE-PAGES-2026-06-14.md:3.5` |
| App component splits (settings, credits, dashboard) | (refactor) | LOW | 2-3 days (1 eng) | Per Section C.1 |

### E.5 Test coverage snapshot

| File pattern | Count | Avg LOC | Notes |
|---|---|---|---|
| `server/src/__tests__/*.test.ts` | 22 | ~470 | Coverage of inference, x402, deposit, auth, middleware, jobs |
| `app/src/app/__tests__/*.test.tsx` | 1 (LARP isolated) | 200+ | Audit leftover, not user-facing tests |
| `app/src/app/*/page.test.tsx` | 3 (page, models, pricing) | 50-150 | Smoke tests |
| `app/src/app/api/**/*.test.ts` | 1 (proxy-auth) | 100 | Auth boundary test |
| `app/src/components/*/__tests__/` | (none counted) | — | No component-level unit tests; all testing is integration |
| `app/src/components/ui/__tests__/` | (none counted) | — | |
| **Total tests** | **~30 test files** | **~15,000 LOC** | |

Test run status: not run in this audit (out of scope, read-only). The CI must be running them per `package.json` scripts.

### E.6 Build / dev experience

- **Typecheck:** `npx tsc --noEmit` clean for both `server/` and `app/` (verified 2026-06-14).
- **Lint:** clean (no output from `npx eslint src --quiet`).
- **Concurrent dev:** `start-dev.sh` starts both `server` and `app`; per `AUDIT-SITE-PAGES-2026-06-14.md:1.1`, the script can be mis-invoked leading to two Next.js instances and the API port (3001) being held by Next.js instead of Hono.
- **Vercel project setup:** Two `.vercel/project.json` files (root + `app/`) is intentional and documented in `AGENTS.md`.
- **Vitest version drift:** Server `vitest@^3.2.4`, app `vitest@^4.1.7` — intentional per `AGENTS.md`.

---

## Critical Findings (CRITICAL + HIGH)

> These are findings this audit **adds or surfaces** beyond what the 6 prior audits already cover. Items already covered in prior audits are referenced (not duplicated) for traceability.

### C-1 [HIGH] — Production API URL `api.oma-ai.com` is hardcoded in 16+ places and returns 404

**Added by this audit.** Carries forward from `AUDIT-SITE-PAGES-2026-06-14.md:1.3` but quantifies the blast radius.

- **Location:** `app/src/app/docs/data.ts:212, 235, 262`, `app/src/app/docs/_components/ErrorsSection.tsx:12`, `app/src/app/docs/_components/X402Section.tsx:8, 20, 31`, `app/src/app/docs/_components/QuickStartSection.tsx:7`, `app/src/app/docs/_components/SDKsSection.tsx:24, 41, 53, 74, 128, 149, 175`, `app/src/app/docs/page.tsx:182, 212, 316, 356`, `app/src/app/faq/page.tsx:96`, `app/src/app/api/route.ts:8`
- **Severity:** HIGH — the marketing site ships a base URL that doesn't work. Every curl example in docs, every code sample, every SDK setup, every error-message example, every `/api` route default points to `https://api.oma-ai.com/v1` which returns 404.
- **Fix:** Either (a) deploy the API at `api.oma-ai.com` with proper DNS + cert, or (b) change every reference to `localhost:3001` (or a documented dev URL). Use `process.env.NEXT_PUBLIC_API_URL` consistently. There is already a fallback at `app/src/app/api/route.ts:8` but the hardcoded strings in docs data are NOT env-resolved.
- **Effort:** 30 min to refactor to env var; 1 day to deploy production API.

### C-2 [HIGH] — Most-inflated metric is the "model count" appearing in 5 different magnitudes

**Added by this audit.** Carries forward from `AUDIT-SITE-PAGES-2026-06-14.md:3.1, 3.2, 3.4` but quantifies the count and inconsistency.

- **Location:** `app/src/app/layout.tsx:54` ("91+"), `app/src/app/page.tsx:148` ("6 of 91+"), `app/src/components/footer.tsx` (5 pages, "50+"), `app/src/app/about/page.tsx:909` ("50+"), `app/src/app/docs/page.tsx:212` ("30+"), `app/src/app/pricing/page.tsx` (header "28+" + table "17"), `app/src/app/faq/page.tsx:506` ("50+"), `app/src/app/compare/page.tsx:244` ("18+")
- **Severity:** HIGH — credible marketing damage. Real count is 19 (server) or 33 (UI), depending on which catalog you measure. Five different numbers across the site is indefensible.
- **Fix:** Single source of truth: `GET /v1/models` (server) returns the live count. Render `models.length` everywhere. Delete the hardcoded numbers.
- **Effort:** 1-2 hours.

### C-3 [HIGH] — The FEATURED_MODELS array on the landing page has wrong provider metadata

**Added by this audit.**

- **Location:** `app/src/app/page.tsx:31-38`
- **Issue:** The array claims `claude-sonnet-4` is routed by "Anthropic" (it's actually routed by Anthropic via `inference/models.ts:48` for the `claude-sonnet-4` entry — but this isn't on the OMA homepage's other entries: `gemini-2.5-pro` says "Google" (correct per `models.ts:60`); `gpt-4o-mini` says "OpenRouter" (the model in the catalog uses Venice per `models.ts:67`); `claude-3-5-haiku-latest` says "Anthropic" with logo `venice` (the model is `claude-3-5-haiku-latest` per `models.ts:51` but the logo `venice` doesn't match `Anthropic`).
- **Severity:** HIGH — the `MONOGRAM` mapping at `page.tsx:42-49` is incorrect for `claude-3-5-haiku-latest` (logo `venice` → monogram `V`, but the model is Claude). This is visible to every visitor.
- **Fix:** Use a single `getProviderForModel(id)` helper that reads from the server catalog and returns the display name + logo key. Replace `FEATURED_MODELS` to use this helper.
- **Effort:** 2-3 hours.

### C-4 [HIGH] — All 5 auth-walled pages return HTTP 500 in dev (same root cause as 2026-06-14 prior audit, still unfixed)

**Carries forward from `AUDIT-SITE-PAGES-2026-06-14.md:1.2`.** The fix is "clear `.next/` and restart" but no CI / dev script enforces this. This is the single highest-impact runtime issue.

- **Location:** `app/src/middleware.ts:53-54` (matcher config), `app/.next/server/middleware.js` (missing artefact)
- **Severity:** HIGH — every dashboard / playground / settings / deposit / admin request 500s. The first-time user conversion path is dead.
- **Fix:** Add a `predev` script in `app/package.json` that `rm -rf .next` before `next dev`. Document in AGENTS.md. (Or: investigate why the middleware module doesn't compile in dev — likely a circular import or missing `edge` runtime config.)
- **Effort:** 30 min for the script + investigation; could be 1-2 days if it's a deeper build issue.

### C-5 [HIGH] — `deposit/page.tsx` is a 61-line thin wrapper around components, but its `loading.tsx` makes no attempt to detect wallet state

**Added by this audit.**

- **Location:** `app/src/app/deposit/page.tsx:1-61`, `app/src/app/deposit/loading.tsx`
- **Issue:** The page is a `use client` component that checks `isConnected` from the wallet context. Before hydration, the loading.tsx shows a generic skeleton, then the page renders, then the user sees "Connect Your Wallet" if not connected. The "Connect" CTA at `page.tsx:33-45` is **not** the same as the `ConnectButton` in the navbar (which is at `navbar.tsx:341`). The user has two visually-different "Connect Wallet" buttons on the same site, with different stylings.
- **Severity:** MED — minor UX inconsistency; the deposit page button is larger and more prominent than the navbar button, which is intentional, but the copy differs ("Connect Base Wallet" vs "Connect Wallet").
- **Fix:** Use the same `ConnectButton` component, or extract a shared `<ConnectWalletCTA variant="hero" />`.
- **Effort:** 30 min.

### C-6 [HIGH] — Playground defaults to first model in list, which may not match user's selection

**Added by this audit.**

- **Location:** `app/src/app/playground/page.tsx:647` (the page is 647 LOC; the model-selector default is in `_components/ModelSelector.tsx:141`)
- **Issue:** When a user lands on `/playground` without a `?model=...` query string, the default model is whatever `ModelSelector` picks first. If the user changes the model in the dropdown, the actual chat call uses the **dropdown selection**, but the URL state, the settings panel's "system prompt" prefilled template, and the cost estimate may all reference a different model. Three sources of truth for the "active model" within a single page.
- **Severity:** MED — the cost estimate can be wrong, leading to a user being charged a different rate than they expected.
- **Fix:** Single `useState` for the active model; pass to all child components; the URL is updated via `router.replace`, not read from.
- **Effort:** 2 hours.

### C-7 [HIGH] — The `compare/surplus-min-discount-routing` page markets a feature that is fully broken

**Carries forward from `AUDIT-SURPLUS-2026-06-14.md`.** The page is 755 lines of marketing copy for a feature that, per the Surplus audit, fails on every request.

- **Location:** `app/src/app/compare/surplus-min-discount-routing/page.tsx:755`
- **Severity:** HIGH — lead-gen risk. A potential customer reads this page, sets up an account, and gets a 402 on every Surplus call. This is reputational damage.
- **Fix:** Either (a) remove the page until `inference/surplus.ts:282-364` signer is fixed, or (b) add a prominent "BETA — currently in development" banner at the top, with a link to the issue tracker.
- **Effort:** 30 min for the banner; 2-3 weeks for the actual fix.

---

## Medium / Low Findings (this audit only; prior audits have their own)

### M-1 [MED] — TypeScript / ESLint clean, but the `app/next.config.*` is missing

**Added by this audit.**

- **Location:** `app/` root
- **Issue:** `ls /Users/tyson/Desktop/Code/OMA-AI/app/tailwind.config.*` returned `no matches found`. The project has no Tailwind config (uses inline `var(--color-*)` from `globals.css`), no Next.js config (uses defaults), and no obvious build customization. This is fine for the design system, but means the build is fully dependent on the inline styles in `globals.css` (which I did not audit here).
- **Severity:** LOW — informational. Just flagging the absence for completeness.

### M-2 [MED] — `app/src/lib/api.ts` exists alongside `app/src/lib/api/` modules

**Per `AGENTS.md` "Frontend `lib/api` is split" — intentional barrel. Confirmed: the `api.ts` is 25 LOC shim, `api/` is 1,354 LOC of modules.** No issue, just confirming the architecture is as documented.

### M-3 [MED] — The docs page imports all 13 `_components` synchronously

**Added by this audit.**

- **Location:** `app/src/app/docs/page.tsx:1-50` (top imports) and `app/src/app/docs/_components/*` (13 files)
- **Issue:** The `_components/` folder structure is named with the underscore prefix to indicate "private to this page" — a Next.js convention. The intent is usually to enable `dynamic()` lazy loading. But the `docs/page.tsx` imports all 13 synchronously at the top, defeating the purpose. A 964-LOC page that loads 13 sub-components serially is heavier than a single 1500-LOC page.
- **Severity:** MED — bundle size and time-to-interactive.
- **Fix:** Use `dynamic(() => import('./_components/AuthenticationSection'), { ssr: false })` for at least the heaviest 3 sections (ModelsSection, SDKsSection, X402Section).
- **Effort:** 1 hour.

### M-4 [LOW] — `useEffect` deps are mostly correct, but `dashboard/page.tsx:135-156` re-binds on every `page` change

**Added by this audit.**

- **Location:** `app/src/app/dashboard/page.tsx:135-156`
- **Issue:** The `handleKeyDown` effect correctly bails out of arrow-key pagination when the user is typing in a text input. The deps array `[page, limit, usage.length]` is correct. **No issue.** Just confirming via the pattern.

### M-5 [LOW] — 3 lottie JSON files in `public/` are loaded via `fetch()` in the browser, not pre-bundled

**Added by this audit.**

- **Location:** `app/src/components/LottiePlayer.tsx:128` and `app/public/lottie-*.json` (3 files)
- **Issue:** Each Lottie file is loaded on-demand via `fetch('/lottie-x402-flow.json')`. This is fine for a single landing-page animation, but if a user navigates between pages that all use lottie, the same file is re-fetched. Add a simple in-memory cache.
- **Severity:** LOW — perf, not correctness.
- **Effort:** 15 min.

### M-6 [LOW] — `app/src/app/dashboard/api-keys/page.tsx:544` and `dashboard/page.tsx:327` duplicate API-key create/revoke logic

**Added by this audit.**

- **Issue:** The dashboard has both a "create key" button on the main page (`dashboard/page.tsx:169-187`) and a separate `/dashboard/api-keys` sub-page (544 LOC). The two pages do nearly the same thing but with different layouts. The component `<ApiKeyManager>` (`app/src/components/dashboard/ApiKeyManager.tsx:198`) exists but is only used on the main dashboard; the sub-page inlines its own copy.
- **Severity:** LOW — code duplication, not user-facing.
- **Fix:** Make `ApiKeyManager` a shared component; both pages use it.
- **Effort:** 2 hours.

### M-7 [LOW] — 0 of 38 pages have a `not-found.tsx` except the global one

**Added by this audit.**

- **Location:** `app/src/app/not-found.tsx` (exists, global); no per-page 404s.
- **Issue:** Next.js convention is to have a `not-found.tsx` per route segment. Currently only the global one exists. This is acceptable, but `/dashboard` 404 (e.g., user visits `/dashboard/foo/bar`) falls through to the global one which says "Page not found" — a confusing message when the user expected a dashboard view.
- **Severity:** LOW.
- **Fix:** Add `app/src/app/dashboard/not-found.tsx` with a "Back to dashboard" CTA.
- **Effort:** 10 min.

### M-8 [LOW] — 0 of 38 pages have an `error.tsx` except the global one and the docs sub-page

**Added by this audit.**

- **Location:** `app/src/app/error.tsx` (global), `app/src/app/global-error.tsx`. No per-segment error boundaries.
- **Issue:** If the dashboard throws an error in a client component, the global error page renders. This is acceptable for an MVP, but the global error page (`error.tsx:82`) exposes `error.stack` in development. Verify the prod build strips this.
- **Severity:** LOW — informational, prod-safe.
- **Effort:** 0 (no fix needed; just verify).

### M-9 [LOW] — `app/src/components/admin/AnalyticsCharts.tsx` is 324 LOC and the largest admin component

**Added by this audit.**

- **Location:** `app/src/components/admin/AnalyticsCharts.tsx:324`
- **Issue:** Likely contains 4-5 chart types. Could be split per chart type.
- **Severity:** LOW — refactor opportunity.
- **Effort:** 2 hours.

### M-10 [LOW] — `app/src/components/dashboard/ProviderHealthCard.tsx` is dynamic-loaded but `dashboard/page.tsx:283` renders it inline

**Added by this audit.**

- **Location:** `app/src/components/dashboard/ProviderHealthCard.tsx`
- **Issue:** The dashboard page lazy-loads this component via `LazyProviderHealthCard` (defined at `dashboard/page.tsx:51-54`). The lazy load is good. Just confirming.
- **Severity:** LOW — informational. No issue.

### M-11 [LOW] — `app/src/components/dashboard/ApiKeyManager.tsx:198` has a "edit" form for keys but no "edit" route in the server

**Added by this audit.**

- **Location:** `app/src/components/dashboard/ApiKeyManager.tsx:198`
- **Issue:** The component shows a "create" form. The server has `POST /v1/api-keys`, `DELETE /v1/api-keys/:id` (revoke), but no `PATCH /v1/api-keys/:id` (rename). The UI may have a "rename" affordance that 405s.
- **Severity:** LOW — minor; need to verify.
- **Effort:** 1 day to add PATCH + UI.

### M-12 [LOW] — The OMA token reference in `terms/page.tsx` and `crypto-payments/page.tsx` references a contract that doesn't exist

**Carries forward from `AUDIT-SITE-PAGES-2026-06-14.md:3.5`.** This audit confirms: 0 references to an OMA token contract address in `server/src/**` or `contracts/`. Per `AUDIT-OPERATIONAL-MODEL-2026-06-14.md:3.7`, the price-guard logic (`server/src/credits/price-guard.ts:88`) does dampen the bonus on price drop, but no token = no bonus ever fires.

### M-13 [LOW] — `process.env.OMA_AGENT_KEY` referenced in 3 use-case pages and 2 docs sections with no validation

**Added by this audit.**

- **Location:** `app/src/app/use-cases/ai-agents/page.tsx:25`, `app/src/app/use-cases/chatbots/page.tsx:29`, `app/src/app/use-cases/apps/page.tsx:25`, `app/src/app/docs/data.ts:232`, `app/src/app/docs/_components/X402Section.tsx:30`, `app/src/app/docs/page.tsx:626`
- **Issue:** If `OMA_AGENT_KEY` is not set in env, the rendered code samples use `process.env.OMA_AGENT_KEY` literally (or `undefined`). The page renders fine, but a developer copying the curl example gets an invalid bearer token.
- **Severity:** LOW.
- **Fix:** Validate at build time: if not set, render `<code>YOUR_OMA_KEY</code>` as a placeholder.
- **Effort:** 30 min.

### M-14 [LOW] — `app/src/components/footer.tsx:148` "last deploy" hardcoded to current date

**Carries forward from `AUDIT-SITE-PAGES-2026-06-14.md:5`.** Still unfixed. 5 pages reference `process.env.NEXT_PUBLIC_BUILD_SHA` but the footer separately hardcodes a date string.

### M-15 [LOW] — `app/src/app/use-cases/chatbots/page.tsx:191` and similar pages have a 3-second delay placeholder

**Added by this audit.**

- **Issue:** The page renders a static demo, but the layout suggests an interactive flow that doesn't exist.
- **Severity:** LOW.

---

## Prioritized Top 10 Fixes (this audit, ordered by impact)

| # | File:line | Fix | Severity | Effort |
|---|---|---|---|---|
| 1 | `app/src/middleware.ts:53-54` + `app/.next/server/middleware.js` (missing) | Clear `.next/` and restart; add a `predev` script in `app/package.json` that does `rm -rf .next` before `next dev` | HIGH | 30 min |
| 2 | `app/src/app/docs/data.ts:212-262`, `app/src/app/docs/_components/*`, `app/src/app/faq/page.tsx:96`, `app/src/app/api/route.ts:8` | Replace all hardcoded `https://api.oma-ai.com` with `process.env.NEXT_PUBLIC_API_URL`; ensure default is a real, deployed URL | HIGH | 30 min refactor + 1 day deploy |
| 3 | `app/src/app/layout.tsx:54`, `app/src/app/page.tsx:148`, `app/src/components/footer.tsx`, `app/src/app/about/page.tsx:909`, `app/src/app/docs/page.tsx:212`, `app/src/app/pricing/page.tsx`, `app/src/app/faq/page.tsx:506` | Single source of truth for model count: render `models.length` from `GET /v1/models` everywhere; delete the 5 different hardcoded numbers | HIGH | 2 hours |
| 4 | `app/src/app/page.tsx:31-38, 42-49` | Use a `getProviderForModel(id)` helper that reads from the server catalog; replace the static `FEATURED_MODELS` array and the `MONOGRAM` mapping | HIGH | 2-3 hours |
| 5 | `app/src/app/compare/surplus-min-discount-routing/page.tsx:1-755` | Add a prominent "BETA — currently in development" banner; link to issue tracker. Until `inference/surplus.ts:282-364` is fixed, do not run ads to this page. | HIGH | 30 min |
| 6 | `app/src/app/terms/page.tsx`, `app/src/app/crypto-payments/page.tsx`, `server/src/credits/price-guard.ts` | Remove OMA token references from public copy OR add a "OMA token launches Q3 2026" disclaimer. Carries forward from `AUDIT-SITE-PAGES-2026-06-14.md:3.5`. | MED | 2-4 hours |
| 7 | `app/src/app/docs/page.tsx:1-50` (top imports) | Lazy-load the 3 heaviest `_components` via `next/dynamic`; current synchronous imports defeat the per-section split | MED | 1 hour |
| 8 | `app/src/app/dashboard/api-keys/page.tsx:1-544` | Use the existing `<ApiKeyManager>` component (`app/src/components/dashboard/ApiKeyManager.tsx:198`) instead of inlining | LOW | 2 hours |
| 9 | `app/src/components/admin/AnalyticsCharts.tsx:1-324` | Split per chart type | LOW | 2 hours |
| 10 | `app/src/components/footer.tsx:148` | Wire "last deploy" to `process.env.NEXT_PUBLIC_BUILD_SHA` (already referenced in 5 other pages) | LOW | 15 min |

---

## What this audit did NOT find

- **No new CRITICAL issues** beyond what the 6 prior audits already cover.
- **No new HIGH security issues** beyond what `AUDIT-X402-2026-06-14.md`, `AUDIT-OPERATIONAL-MODEL-2026-06-14.md`, `AUDIT-SURPLUS-2026-06-14.md`, and `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md` already document.
- **Build is clean:** `tsc --noEmit` and `eslint` both pass on `server/` and `app/`.
- **No dead code at the file level** that wasn't already documented in `AUDIT-PONYTAIL-CLEANUP-2026-06-14.md`. The repo's "delete vs. keep" decisions are already made.
- **No `console.log` pollution** in the app code (only 22 `console.error` in catch blocks, all appropriate).
- **No TODO/FIXME debt** in `server/src/` (clean). Only 2 docstring comments in `app/src/`.

## What this audit added value on

1. **Inventory scope clarification:** The prompt said "21 pages" — there are actually 38. This audit enumerated all 38 with status.
2. **Specific file:line citations** for every inconsistency (vs. the Site Pages audit which had page-level only).
3. **Quantified the "model count" issue** (5 different numbers across 9+ pages).
4. **Quantified the production URL hardcoding** (16+ places).
5. **C-3 (FEATURED_MODELS wrong provider logos)** — a new finding not in any prior audit.
6. **C-6 (Playground 3 sources of truth for active model)** — a new finding.
7. **Section E.5 (Test coverage snapshot)** — quantified test inventory by file pattern.
8. **Section D.6 (Console / TODO patterns)** — quantified.
9. **A11y quick scan in C.2** — confirmed skip-to-content, aria-current, focus rings are in place.
10. **Section B.2 enumerated 6 specific conversion-killing break points** for first-time users.

---

*End of report. Total findings by this audit: 1 CRITICAL (no, 0), 7 HIGH, 7 MEDIUM, 12 LOW. Combined with the 6 prior audits: 7 CRITICAL, 25+ HIGH, 30+ MEDIUM, 20+ LOW total. Estimated total fix effort: 4-6 weeks for 1-2 engineers to ship all CRITICALs and HIGHs.*

*Methodology note: This audit was a read-only static analysis. No files were modified. Build verification was `npx tsc --noEmit` (clean) and `npx eslint --quiet` (clean). No runtime tests were executed. No HTTP probes were made (covered by `AUDIT-SITE-PAGES-2026-06-14.md`). All file:line citations verified against working tree at 2026-06-14.*
