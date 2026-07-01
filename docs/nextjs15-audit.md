# OMA-AI · Next.js 15 + React 19 Audit

**Audit date:** 2026-07-01
**Scope:** `app/src/**` (Next.js app router workspace)
**Stack confirmed:** `next@15.5.19`, `react@19.2.7`, `tailwindcss@4`, `@tanstack/react-query@5.101.1`, `framer-motion@12.41.0`
**Methodology:** Grep + read across `app/src/app`, `app/src/components`, `app/src/lib`, `app/src/hooks`. Cross-checked against `/vercel/next.js` and `/react/react` docs via Context7 MCP.

---

## 1 · Summary of current patterns

### 1.1 Counts

| Pattern | Count | Notes |
| --- | --- | --- |
| `app/src/app/**/*.tsx` files | 28 page.tsx + 17 layout.tsx | App router, route groups via `_components/`, `_hooks/`, `_lib/` |
| `"use client"` files | **178** | 17/28 page.tsx (61 %), ~150 component/UI files |
| `"use server"` files | **0** | No Server Actions anywhere |
| `export const metadata` / `generateMetadata` | 23 (mostly layouts) | 19 page.tsx files lack metadata |
| Dynamic routes using `params: Promise<{...}>` | 3 of 3 | `admin/users/[id]`, `models/[slug]`, `blog/[slug]` |
| Dynamic routes using `await params` | 2 of 3 | `admin/users/[id]` uses React 19 `use(params)` (correct for client component) |
| `loading.tsx` files | 24 | Excellent coverage |
| `error.tsx` files | 21 | Excellent coverage |
| `<Suspense>` boundaries | 6 | Mostly in `chat/`, `login/`, root `page.tsx` |
| `next/image` imports | 6 | Light usage, see §3.4 |
| `next/font/google` imports | 1 (root layout) | 3 fonts: Space_Grotesk, Syne, JetBrains_Mono — correct setup |
| Inline `style={{...}}` usages | 100+ | Mostly legitimate dynamic values (see §3.5) |
| `export const dynamic = "force-dynamic"` | 0 | Good — most pages rely on implicit dynamic rendering |
| `generateStaticParams` | 2 (`models/[slug]`, `blog/[slug]`) | Good |

### 1.2 Architectural shape

```
app/src/
├── app/              # 28 pages · 17 layouts · 24 loading · 21 error
│   ├── layout.tsx                          ← server component, owns fonts + metadata + theme
│   ├── page.tsx                            ← server component, Suspense + AuthNotice
│   ├── login/page.tsx                      ← "use client" (correct: useSearchParams)
│   ├── chat/page.tsx                       ← "use client" wrapper (Suspense)
│   ├── admin/page.tsx                      ← "use client", 1205 LOC ⚠️
│   ├── docs/page.tsx                       ← "use client", 1371 LOC ⚠️
│   └── ...
├── components/       # ~150 files, mostly "use client" (UI primitives, charts, modals)
├── lib/              # framer-motion-client wrapper, motion primitives, API client
├── hooks/            # focus trap, etc.
└── middleware.ts     # jose JWT verify, protected routes
```

### 1.3 What's working well

- **Async params are correctly handled.** All three dynamic routes use `Promise<{...}>` types and either `await params` (server components) or `use(params)` (client component in `admin/users/[id]`). No regression risk.
- **Fonts loaded via `next/font/google`.** Root layout uses 3 Google fonts with `display: "swap"`, `preload: true`, and CSS variables. Sizing handled at build time.
- **Metadata is consolidated at the layout level.** Title template (`%s | OMA-AI`) lives in `app/layout.tsx` and propagates. OpenGraph image, Twitter image, sitemap, robots, icon, apple-icon all in `app/`.
- **`generateStaticParams` is used** for `models/[slug]` and `blog/[slug]`, with `dynamicParams = true` on the former to support long-tail model slugs at request time.
- **`use()` hook is used correctly** in `app/admin/users/[id]/page.tsx:68` to unwrap the params Promise inside a client component. Good React 19 pattern.
- **Layout-level streaming.** `app/page.tsx` wraps `<AuthNotice />` in `<Suspense fallback={null}>` so homepage TTFB is independent of session status.
- **Login uses Suspense + `useSearchParams` correctly.** `LoginInner` is the client component that consumes `useSearchParams`; `LoginPage` wraps it in `<Suspense>`. This satisfies the Next 15 requirement that `useSearchParams` is wrapped in Suspense at a server boundary.
- **`error.tsx`/`loading.tsx` granularity.** Per-route boundaries in every page directory, not just the root.

---

## 2 · Files that need updating for Next.js 15

### 2.1 Dynamic routes — all OK, no code changes needed

| File | Status |
| --- | --- |
| `app/src/app/admin/users/[id]/page.tsx` | ✅ `params: Promise<{id}>`, `use(params)` for client component |
| `app/src/app/blog/[slug]/page.tsx` | ✅ `params: Promise<{slug}>`, `await params` for server component |
| `app/src/app/models/[slug]/page.tsx` | ✅ Same pattern as blog; also `generateStaticParams` + `dynamicParams = true` |

These are the highest-risk files for Next 15 regressions and they're all correct.

### 2.2 Files that should add metadata (19 page.tsx files)

These pages currently inherit only the layout-level title template (`%s | OMA-AI`). They need page-level `metadata` or `generateMetadata` to set page-specific titles, descriptions, OG tags for SEO and social sharing.

| File | Current metadata source | Severity |
| --- | --- | --- |
| `app/src/app/settings/page.tsx` | layout only | High — auth gate, low SEO impact but useful for browser tabs |
| `app/src/app/deposit/page.tsx` | layout only | **Critical** — primary conversion page, no OG description |
| `app/src/app/chat/page.tsx` | layout only | **Critical** — primary product surface |
| `app/src/app/image-generation/page.tsx` | layout only | High |
| `app/src/app/swap/page.tsx` | layout only | High |
| `app/src/app/admin/rate-limits/page.tsx` | layout (`admin/layout.tsx`) | Low — admin |
| `app/src/app/admin/fees/page.tsx` | layout (`admin/layout.tsx`) | Low — admin |
| `app/src/app/admin/users/[id]/page.tsx` | layout (`admin/layout.tsx`) | **Needs `generateMetadata`** — page title should reflect the user address, useful for support tabs |
| `app/src/app/admin/users/page.tsx` | layout (`admin/layout.tsx`) | Low — admin |
| `app/src/app/admin/page.tsx` | layout (`admin/layout.tsx`) | Low — admin |
| `app/src/app/models/page.tsx` | layout (`models/layout.tsx`) | **Critical** — public listing page, no unique description |
| `app/src/app/docs/page.tsx` | layout (`docs/layout.tsx`) | **Critical** — public docs page |
| `app/src/app/dashboard/api-keys/page.tsx` | layout (`dashboard/layout.tsx`) | Low — authenticated |
| `app/src/app/dashboard/page.tsx` | layout (`dashboard/layout.tsx`) | Low — authenticated |
| `app/src/app/dashboard/credits/page.tsx` | layout (`dashboard/layout.tsx`) | Low — authenticated |
| `app/src/app/video-generation/page.tsx` | layout only | **Critical** — public product surface |
| `app/src/app/pricing/page.tsx` | layout (`pricing/layout.tsx`) | High — public, needs unique title |
| `app/src/app/login/page.tsx` | layout (`login/layout.tsx`) | High — public entry point, current login/layout.tsx metadata is fine |
| `app/src/app/signup/page.tsx` | has metadata ✅ | — |

### 2.3 Files that should consider moving data-fetching to server components

These pages are `"use client"` but a meaningful chunk of their content could be a server-rendered shell with the interactive island as a child:

| File | LOC | Suggestion |
| --- | --- | --- |
| `app/src/app/admin/page.tsx` | 1205 | Move stat cards + table to server component (fetches via `api.admin.getStats()` from server with `fetch` + `cache: 'no-store'`); pass initial data into the existing client page as props |
| `app/src/app/docs/page.tsx` | 1371 | Move the static markdown/NAV sections to server; only the sidebar/search/filters need client |
| `app/src/app/dashboard/page.tsx` | 242 | Header + welcome copy + balance skeleton could be server; the React-Query-driven `DashboardGrid` stays client |
| `app/src/app/settings/page.tsx` | 421 | Same — section content can be streamed, only forms are client |
| `app/src/app/models/page.tsx` | 260 | The 13-item curated list is static; only the search/filter needs client. Could split into `ModelsPage` (server, renders curated cards) and `ModelsFilter` (client, wraps in client island) |
| `app/src/app/docs/page.tsx` | 1371 | Already mostly static — only `DocsSearch` and `SyntaxHighlighter` need client |
| `app/src/app/_components/home/*.tsx` | 8 sections | Most are pure static markup with viewport-driven animations. The animation only needs a small client wrapper; the bulk of each section could be a server component. See §3.2 |

### 2.4 Files that should consider Server Actions

There are **zero** `"use server"` directives. Forms in the codebase call REST API routes (`/api/...`) from `useMutation` or `useQuery` mutations, which is the Next 14 pattern. Next 15 encourages Server Actions for form submits that don't need optimistic UI or cross-tab broadcast.

Candidates (in rough priority order):

| Caller | Form/Action | Server Action benefit |
| --- | --- | --- |
| `app/src/app/settings/_components/ProfileSection.tsx` | Profile update | Skip client roundtrip, type-safe end-to-end |
| `app/src/app/settings/_components/ApiKeysSection.tsx` | Create/revoke API key | Avoid exposing mutation API to client bundle |
| `app/src/app/settings/_components/SessionsSection.tsx` | Revoke session | Same |
| `app/src/app/settings/_components/DangerZoneSection.tsx` | Delete account | Sensitive — server action keeps handler off the client bundle |
| `app/src/app/deposit/_components/UnifiedDepositInterface.tsx` | Submit deposit intent | Authenticated write |
| `app/src/components/dashboard/ApiKeyManager.tsx` | Create API key | Same as settings |
| `app/src/app/admin/tabs/KeysTab.tsx`, `UsersTab.tsx`, `FeesTab` etc. | Admin mutations | Sensitive |
| `app/src/app/login/page.tsx` | SIWE verification callback | Could be a server action that returns `{ ok, redirectTo }` instead of an API route |

This is an **architectural decision**, not a defect — see §4 (Nice-to-have).

---

## 3 · Deprecated patterns found

### 3.1 None observed for async params

All three dynamic route pages correctly type `params` as `Promise<...>` and resolve via `await params` or `use(params)`. No `params.slug`-style synchronous access remains in the codebase.

### 3.2 `"use client"` over-application — primary concern

**178 files** carry `"use client"`. While many are correctly client (charts, wallet, animations, forms, hooks), several files mark an entire component as client when only a small interactive island inside it needs client features.

#### Concrete cases

| File | Why "use client" is on the entire file | What could move to a server child |
| --- | --- | --- |
| `app/src/app/_components/home/index.tsx` | Wraps 8 sections | Each section file is already its own `"use client"` for motion. The wrapper itself only does composition — **drop `"use client"` from `index.tsx`, let each section keep its own directive** |
| `app/src/app/_components/home/hero.tsx` (232 LOC) | `useState` for copy button + framer-motion | The hero copy block, the curl snippet display, and the CTA buttons are pure markup. Only the `Copy` button + terminal typing animation need client. Extract `HeroActions.tsx` (client) and keep `hero.tsx` as a server component |
| `app/src/app/_components/home/code-example.tsx` | syntax highlighter | The headline + paragraph can be server; only the `SyntaxHighlighter` needs client |
| `app/src/app/_components/home/trust-strip.tsx` | framer-motion | **Almost certainly can be a server component** if motion uses `viewport` prop on a thin client wrapper. Verify by checking if `useState`/`useEffect`/event handlers are used |
| `app/src/app/_components/home/how-it-works.tsx` | framer-motion | Same |
| `app/src/app/_components/home/capabilities-grid.tsx` | framer-motion | Same |
| `app/src/app/_components/home/final-cta.tsx` | framer-motion | Same |
| `app/src/app/_components/home/stats.tsx` | `AnimatedNumber` (client) | The section frame can be server; only the number ticker needs client |
| `app/src/app/_components/home/x402-banner.tsx` | framer-motion | Same |
| `app/src/app/docs/page.tsx` (1371 LOC, client) | Tabs, copy buttons, search | The static prose sections, the API examples, and the markdown content can all be server-rendered. Only the search input, tab switcher, and code copy buttons need client |
| `app/src/app/admin/page.tsx` (1205 LOC, client) | Tabs, queries, CSV export | The 7 tab content bodies — at least the static "no data" empty states — could be server-rendered skeletons |

**Estimated impact:** If the homepage (`page.tsx` + `home/index.tsx` + 8 sections) and the docs/admin pages are split into server shells + client islands, the JS shipped to anonymous homepage visitors could drop by 30-50 KB gzip. Charts and framer-motion components stay client.

### 3.3 No deprecated SSR patterns

- No `getServerSideProps` / `getStaticProps` (correct — App Router doesn't use them)
- No `next/router` (correct — uses `next/navigation`)
- No `useRouter` from `next/router`
- No `next/legacy/image`
- No `<a href>` for internal navigation in place of `next/link` in any of the audited pages
- No `useEffect`-only data fetching in server components

### 3.4 Image optimization — under-used

`next/image` is only imported in **6 files**:

| File | Image source |
| --- | --- |
| `app/src/components/chat/ImageGenerationPanel.tsx` | Likely generated AI output |
| `app/src/components/ui/ImprovedConnectButton.tsx` | Wallet icons |
| `app/src/app/image-generation/page.tsx` | Generated images |
| `app/src/components/ui/FileUpload.tsx` | Preview thumbnails |
| `app/src/components/chat/ChatMessage.tsx` | User-attached images |
| `app/src/components/chat/ChatMessageRedesign.tsx` | Same |

`next.config.ts` already configures `remotePatterns` for `oma-ai.com`, `cloudfront.net`, and `lh3.googleusercontent.com` plus AVIF/WebP formats. The infrastructure is there. **Opportunities:**

1. **OG images.** `app/src/app/opengraph-image.tsx` and `twitter-image.tsx` use raw inline `<div style={...}>` JSX. This is the official Next 15 way to do dynamic OG images (`ImageResponse` from `next/og`), so this is correct — no change.
2. **No `<Image>` in homepage hero, navbar logo, footer logo, etc.** Check whether those use `<img>` (raw HTML). If so, swap to `next/image` for automatic AVIF/WebP.

### 3.5 Inline `style={{...}}` usage

100+ inline style usages. Most are legitimate:
- `style={{ animation: "..." }}` for keyframes that depend on dynamic values (e.g. `transitionDelay: ${delay}ms`)
- `style={{ backgroundColor: color }}` where `color` is a runtime token
- `style={{ width: `${80 - i * 8}%` }}` for skeleton widths
- `style={{ scaleX }}` for `useScroll`-driven motion values (must be inline)

**Could move to Tailwind:** A few static styles like `style={{ display: "flex", alignItems: "center", gap: 16 }}` in OG image files and `style={{ transformOrigin: "top right" }}` in nav dropdowns. Low priority.

### 3.6 Other observations

- **`generateMetadata` is used only for dynamic routes** (`models/[slug]`, `blog/[slug]`). The `admin/users/[id]` page does not have one — could generate a title like `"User 0x1234… · Admin"` from the address once it's loaded.
- **`opengraph-image.tsx`, `twitter-image.tsx`, `icon.tsx`, `apple-icon.tsx`** all present and correctly using `ImageResponse` from `next/og`. Good.
- **`sitemap.ts` and `robots.ts`** present in app root. Good.
- **`middleware.ts`** uses `jose` for JWT verification. Note: middleware can't access `next/headers` async APIs at the time of writing — this is fine, middleware doesn't need to.
- **`react-compiler`** is **disabled** in `next.config.ts` due to "Cannot read properties of undefined (reading 'call')" errors on pages importing framer-motion. This is a real bug or an upstream incompatibility. Worth re-testing on framer-motion 12.5+ — see §4.

---

## 4 · Recommended changes (file-by-file)

### 4.1 Critical

| # | File | Change |
| --- | --- | --- |
| C1 | `app/src/app/chat/page.tsx` | Add `export const metadata: Metadata = { title: "Playground · OMA", description: "..." }`. The page is currently the primary product surface with no page-level metadata |
| C2 | `app/src/app/models/page.tsx` | Add page-level metadata with `description` listing model count and capabilities. Currently only inherits the layout title |
| C3 | `app/src/app/docs/page.tsx` | Same — page-level description and OG tags for the public docs surface |
| C4 | `app/src/app/video-generation/page.tsx` | Same |
| C5 | `app/src/app/deposit/page.tsx` | Same — primary conversion page, no unique description for OG previews |
| C6 | `app/src/app/admin/users/[id]/page.tsx` | Add `generateMetadata({ params })` that returns `{ title: "User <address> · Admin" }`. Currently the browser tab just shows "Admin \| OMA-AI" for every user |

### 4.2 High-value

| # | File | Change |
| --- | --- | --- |
| H1 | `app/src/app/_components/home/index.tsx` | Drop `"use client"`; let each section file keep its own `"use client"` only where needed for motion/interaction |
| H2 | `app/src/app/_components/home/hero.tsx` | Split: `hero.tsx` becomes a server component (markup + CTAs); extract `HeroCopyButton.tsx` and `HeroTerminal.tsx` as the two client islands |
| H3 | `app/src/app/_components/home/{trust-strip,how-it-works,capabilities-grid,final-cta,x402-banner}.tsx` | Audit each — if they only use `m.div` with viewport/reveal props and no state, the `"use client"` directive can be removed and a single `MotionChild` client wrapper can be inserted inline. Estimated saving: ~5-8 KB gzip per section |
| H4 | `app/src/app/docs/page.tsx` (1371 LOC) | Extract static prose blocks and API example tables into a `DocsContent.tsx` server component; keep `DocsSearch`, `SyntaxHighlighter`, and tab state as client |
| H5 | `app/src/app/admin/page.tsx` (1205 LOC) | Extract `AdminHeader` and the per-tab static layouts into server components; the tab content bodies stay client because they consume react-query |
| H6 | `app/src/app/dashboard/page.tsx` | Convert the `<h1 className="sr-only">Dashboard</h1>` and the `<ConnectWalletView />` wrapper to a server component shell; only the `DashboardGrid` (which holds all the React Query state) stays client |
| H7 | `app/src/app/settings/page.tsx` | Same pattern — page shell becomes server; section components stay client only where they hold forms |

### 4.3 Medium-value

| # | File | Change |
| --- | --- | --- |
| M1 | `app/src/app/login/page.tsx` | Consider a Server Action for the account-number form submission (`lib/actions/auth.ts` with `"use server"`). Removes one round-trip and keeps the verification logic server-side |
| M2 | `app/src/app/settings/_components/ApiKeysSection.tsx`, `ProfileSection.tsx`, `SessionsSection.tsx`, `DangerZoneSection.tsx` | Wrap form `onSubmit` handlers in Server Actions. Reduces client bundle by removing the `api.auth.*` fetch wrappers for these flows |
| M3 | `app/src/components/dashboard/ApiKeyManager.tsx` | Same — Server Action for create/revoke |
| M4 | `app/src/app/admin/tabs/*.tsx` | Server Actions for admin mutations (revoke key, delete user, configure fees) |
| M5 | `app/src/app/pricing/page.tsx` | The interactive category filter and Reveal animations could move to a small client wrapper around the static `<PricingTable>` data. Currently 531 LOC client for what is largely a static price list |
| M6 | `app/src/app/models/page.tsx` | Split into `ModelsPage` (server, renders the curated 13-model grid) and `ModelsFilter` (client, search/filter UI). Initial render ships zero JS for the grid |

### 4.4 Low-value / cosmetic

| # | File | Change |
| --- | --- | --- |
| L1 | `app/src/app/_components/home/stats.tsx` | The `<AnimatedNumber />` is client — could be wrapped in a `<MotionNumber value={n} />` client island, leaving the section shell as a server component |
| L2 | `app/src/components/ui/CryptoLogo.tsx` | Has 8 inline `style={{}}` blocks for size variants. Replace with Tailwind `w-${size} h-${size}` arbitrary values |
| L3 | `app/src/app/about/page.tsx`, `privacy/page.tsx`, `terms/page.tsx` | These long-form legal pages are server components and have metadata. Good. The inline `style={{ backgroundColor: color }}` usages in `privacy/page.tsx` could move to Tailwind `bg-[${color}]` arbitrary values |
| L4 | `app/src/components/admin/tabs/KeysTab.tsx:37` | One inline `style={{}}` — fine, but worth noting |
| L5 | `app/src/app/loading.tsx`, all `loading.tsx` files | Good coverage; consider adding a single root `loading.tsx` skeleton instead of relying on the segment-level ones, so the layout shell streams instantly during route transitions |

---

## 5 · Critical issues (severity-ranked)

### Critical 1 — Missing page-level metadata on public surfaces

19 of 28 `page.tsx` files have no `export const metadata` or `generateMetadata`. Most damaging: `chat`, `models`, `docs`, `video-generation`, `deposit` — the public product surfaces. Without page-level metadata these pages fall back to the layout title template only, and the OpenGraph description is missing entirely for shareable URLs.

**Action:** Add the six metadata exports listed in §4.1. Total estimated effort: ~1 hour. SEO/social-share impact: significant.

### Critical 2 — Page-level components shipped entirely as client JS

`app/admin/page.tsx` (1205 LOC), `app/docs/page.tsx` (1371 LOC), `app/settings/page.tsx` (421 LOC), `app/dashboard/page.tsx` (242 LOC), and `app/pricing/page.tsx` are entirely `"use client"`. The dashboard and admin pages in particular re-render their shells on every navigation even though the layout never changes.

**Action:** Convert the page shells to server components (move `export default function Page() { ... }` to a server component, then render an inner `<PageClient />` that holds all the hooks/state). Effort: medium; payoff: smaller client bundles, faster hydration, better streaming.

### Critical 3 — Zero Server Actions in a 178-client-component codebase

The entire mutation surface goes through REST API routes (`/api/admin/*`, `/api/auth/*`, `/api/chat/*`). This is the Next 14 pattern. Next 15 promotes Server Actions as the default for form submits that don't need optimistic UI. The current architecture forces every form to:

1. Bundle the mutation client code into the page chunk
2. POST to a route handler that re-validates the JWT
3. Deserialize JSON

A Server Action colocates the handler with the page, removes one HTTP hop, and keeps the handler out of the client bundle.

**Action:** Identify the highest-value forms (Settings → Profile, API keys, Sessions, Danger zone; Dashboard → API key create/revoke; Admin → key revoke; Login → account-number submit) and convert to Server Actions over time. Effort: medium per form; payoff: smaller bundles, less boilerplate, type safety end-to-end.

---

## 6 · Nice-to-have improvements

### 6.1 Re-enable React Compiler

`reactCompiler: true` is commented out in `next.config.ts` due to a 2025-04 regression with framer-motion. Re-test with current versions — both Next 15.5 and framer-motion 12.41+ have shipped fixes. Enable behind a flag if green.

### 6.2 Expand `optimizePackageImports`

Currently only `lucide-react` is in `optimizePackageImports`. Consider adding `date-fns` (which has tree-shakeable named exports), `recharts` (if/when used in non-admin pages), and `@tanstack/react-query` (smaller request submodules).

### 6.3 Add `loading.tsx` to `app/src/app/admin/users/[id]/`

The dynamic user-detail route is missing its own `loading.tsx` (other admin pages have one). Without it, navigating to `/admin/users/<id>` shows the root loading skeleton for a few hundred ms.

### 6.4 Add a global error boundary test

`global-error.tsx` is "use client" but its inline styles duplicate the brand system. Move to use `globals.css` utility classes for consistency, or factor the shared error UI into a component imported by both `error.tsx` and `global-error.tsx`.

### 6.5 Optimize `ThemeProvider` initial paint

`app/layout.tsx:133` injects `THEME_HEAD_SCRIPT` via `<script dangerouslySetInnerHTML>`. This is the standard FOUC prevention pattern — but verify the script isn't larger than necessary; the inline string lives in every HTML response. Could be moved to a static asset once stabilized.

### 6.6 Use `next/image` for the homepage hero and footer logo

`next.config.ts` configures remote patterns and AVIF/WebP. Check the homepage hero, footer logo, and navbar logo — if any of them are raw `<img>` tags, switch to `next/image` to get format negotiation and layout-shift prevention.

### 6.7 Consolidate the framer-motion client wrapper

`app/src/lib/framer-motion-client.tsx` exists to provide a single 'use client' entry point for motion imports (per the `next.config.ts` comment about the framer-motion regression). Verify it's still required on the current versions; if not, the wrapper itself can be deleted and components can import `m` directly.

### 6.8 Type the page exports

`Page` components in this codebase don't follow the convention of typing props via `PageProps<{...}>` (Next 15 typed routes helper). Optional but improves type safety for `params` and `searchParams`.

---

## 7 · Verification checklist (run after any changes)

```bash
# Async params still correct
grep -rn 'params: {' app/src/app --include='*.tsx' | grep -v 'Promise<'
# Expect: no output

# Async cookies/headers
grep -rn '\bcookies()\|\bheaders()' app/src/app --include='*.tsx' | grep -v 'await '
# Expect: no output (the codebase currently uses neither in pages, but worth re-running)

# Server Actions added
grep -rn '"use server"' app/src --include='*.ts' --include='*.tsx'
# Expect: at least one match once M1-M4 are applied

# Build smoke
pnpm --filter app build && pnpm --filter app start
# Expect: no `params should be awaited` warnings, no `cookies was not awaited` warnings
```

---

## 8 · Appendix — Top-level recommendations ranked

| Rank | Effort | Impact | Change |
| --- | --- | --- | --- |
| 1 | XS | High | Add 6 page-level metadata exports (§4.1) |
| 2 | S | High | Convert `home/index.tsx` to server component + extract client islands (§4.2 H1-H3) |
| 3 | M | High | Convert `dashboard/page.tsx` and `admin/page.tsx` shells to server components |
| 4 | M | Medium | Add Server Actions for Settings forms |
| 5 | S | Medium | Re-enable `reactCompiler` behind a flag after testing |
| 6 | M | Medium | Convert `docs/page.tsx` shell to server component |
| 7 | XS | Low | Add `loading.tsx` to `admin/users/[id]/` |
| 8 | S | Low | Replace inline styles with Tailwind arbitrary values in `CryptoLogo`, OG image files |

**Bottom line:** The codebase is in good shape for Next 15 — all three dynamic routes are correctly migrated, fonts and metadata infrastructure are solid, and error/loading boundaries are comprehensive. The biggest opportunity is the metadata gap on public pages (§4.1), followed by extracting server-component shells out of the 1000+ LOC "use client" page files (§4.2 H4-H7) to recover the App Router's streaming and bundle-size advantages.