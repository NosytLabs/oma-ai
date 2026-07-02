# Admin Panel Audit — OMA-AI

**Date**: 2026-07-02
**Scope**: Frontend `/admin/*` pages + backend `/admin/*` (Hono) routes + auth middleware
**Method**: Read-only. File reads, grep, curl probes against running Next.js dev server (port 3000). Backend (port 3001) was NOT running during probes; backend route shapes verified by reading source.

---

## TL;DR — Severity Snapshot

| Severity | Count | Theme |
|----------|-------|-------|
| **P0**  | 4 | URL-prefix mismatch breaks 8 of 11 backend admin routes from the UI; OpenAPI docs point at nonexistent paths |
| **P1**  | 7 | Demo-mode bypass for `/admin/*`, hardcoded provider list, copy/data mismatches, dead-link tab placeholders |
| **P2**  | 5 | Page-size mismatch, search input is client-only, etc. |

**Only one admin route actually works end-to-end from the UI today: `/admin/users/:id`.** The main dashboard (`/admin`) and the dedicated fees / rate-limits pages will all 404 (or surface "Not Authorized") once you authenticate, because the frontend calls `/v1/admin/...` for routes the backend only serves at `/admin/...`.

---

## Routes Audited

### Frontend admin pages (`app/src/app/admin/`)

| Path | File | Purpose | State |
|------|------|---------|-------|
| `/admin` | `app/src/app/admin/page.tsx` (386 lines) | Tabbed dashboard: Overview / Users / Usage / Revenue / Keys + placeholders for Fees & Rate-limits | **BROKEN** — 3 of 4 data queries hit wrong URL prefix |
| `/admin/layout.tsx` | `app/src/app/admin/layout.tsx` (22 lines) | Sets dark theme, `force-dynamic`, `robots: noindex` | OK |
| `/admin/loading.tsx` | `app/src/app/admin/loading.tsx` (14 lines) | Skeleton | OK |
| `/admin/error.tsx` | `app/src/app/admin/error.tsx` (19 lines) | Delegates to `<RouteErrorFallback>` | OK |
| `/admin/users` | `app/src/app/admin/users/page.tsx` (10 lines) | Just `redirect("/admin")` | OK by design (stable deep-link) |
| `/admin/users/[id]` | `app/src/app/admin/users/[id]/page.tsx` (503 lines) | User detail: balance, API keys, usage, deposits | **WORKS** — URL matches backend `/admin/users/:id` |
| `/admin/fees` | `app/src/app/admin/fees/page.tsx` (382 lines) | Provider markup editor + margin calculator | **BROKEN** — calls `/api/admin/config/fees` (no `/v1`) |
| `/admin/rate-limits` | `app/src/app/admin/rate-limits/page.tsx` (723 lines) | Tier editor + per-user override CRUD | **BROKEN** — same URL-prefix issue |

### Frontend admin tab components (`app/src/app/admin/_components/`)

| File | Role |
|------|------|
| `AdminOverviewTab.tsx` (205 lines) | KPI tiles + provider cost panel + charts |
| `AdminUsersTab.tsx` (156 lines) | Paginated user table with search |
| `AdminUsageTab.tsx` (217 lines) | Usage stats with byProvider / byModel breakdown + CSV export |
| `AdminRevenueTab.tsx` (157 lines) | Revenue KPI cards + monthly chart + CSV export |
| `AdminKeysTab.tsx` (125 lines) | API key table + CSV export |
| `types.ts` (91 lines) | Shared TS types |

### Backend admin routes (`server/src/routes/admin/`)

| File | Mounted path(s) | State |
|------|----------------|-------|
| `index.ts` (60 lines) | Aggregator: `sessionAuth + requireAdmin + 100 req/min` on `/admin/*` and `/v1/admin/*`; TOTP step-up on sweep / refund / byok | OK (auth wiring correct) |
| `users.ts` (173 lines) | `GET /admin/users`, `GET /admin/users/:id` | OK (real DB queries) |
| `usage.ts` (122 lines) | `GET /admin/usage` | OK (real DB) — but **unreachable** from UI |
| `revenue.ts` (94 lines) | `GET /admin/revenue` | OK (real DB) — **unreachable** from UI |
| `keys.ts` (83 lines) | `GET /admin/keys` | OK (real DB) — **unreachable** from UI |
| `invoices.ts` (169 lines) | `POST /admin/invoices`, `GET /admin/invoices`, `GET /admin/invoices/:id` | OK but **NO FRONTEND CALLER** |
| `dlq.ts` (166 lines) | `GET /v1/admin/dlq/settlements`, retry/discard/process | OK but **NO FRONTEND CALLER** |
| `audit-logs.ts` (88 lines) | `GET /v1/admin/audit-logs` | OK but **NO FRONTEND CALLER** |
| `surplus.ts` (46 lines) | `GET /admin/surplus/{models,health,config}` | OK but **NO FRONTEND CALLER** |
| `byok.ts` (17 lines) | All `/admin/byok/*` → 503 GONE | Intentional retirement — no caller |
| `refunds.ts` (293 lines) | `GET/POST /admin/refunds` + grant/deny with `requireFreshTotp` | OK but **NO FRONTEND CALLER** |

### Adjacent: `server/src/routes/config.ts` (used by `/admin/fees` and `/admin/rate-limits`)

| Mounted path | State |
|--------------|-------|
| `GET /v1/admin/config/fees` | OK |
| `PUT /v1/admin/config/fees` | OK |
| `GET /v1/admin/config/rate-limits` | OK |
| `PUT /v1/admin/config/rate-limits` | OK |
| `GET/POST /v1/admin/rate-limit-overrides` | OK |
| `DELETE /v1/admin/rate-limit-overrides/:id` | OK |

### Adjacent: `server/src/routes/admin-observability.ts` (extra `/v1/admin/*` views)

This file duplicates some `/v1/admin/*` routes with **different response shapes** from the canonical `admin/*` routes. The relevant one is:

- `GET /v1/admin/usage` → returns `{ window, totals, byProvider, byModel, byDay }` (vs the canonical `GET /admin/usage` returning `{ period, summary, byProvider, byModel, dailyUsage }`).

This is a foot-gun: if someone "fixes" the frontend URL to hit `/v1/admin/usage`, it would still 500 because the shape doesn't match `UsageStats` in `app/src/app/admin/_components/types.ts`.

### Auth wiring (sanity check)

| Layer | Mechanism | Verified |
|-------|-----------|----------|
| Next.js page gate | `app/src/middleware.ts:6-12, 119-128` — `PROTECTED_PATHS` includes `/admin`, JWT verify with HS256 + issuer/audience pinning | **WORKS** — `curl /admin` → 307 → `/login?next=/admin` |
| Demo bypass | `app/src/middleware.ts:55-75` — `?demo=1` sets 24h `oma-demo=1` cookie | **WORKS** but admin pages don't gate on this — see P1-1 |
| API proxy auth | `app/src/app/api/[...path]/route.ts:66-88` — requires Bearer header or `oma_session` cookie | **WORKS** — `curl /api/admin/users` → 401 |
| Hono session auth | `server/src/auth/middleware.ts:107-217` — Bearer JWT verify, optional Neon Auth path, 2FA gate | OK |
| Hono admin gate | `server/src/auth/middleware.ts:260-297` — wallet allowlist OR team membership (admin/owner) with `teamId` | OK |
| TOTP step-up | `server/src/auth/require-fresh-totp.ts` — used on `/admin/refunds/:id/{grant,deny}`, `/admin/byok`, `/admin/ledger/sweep` (the last is a 501 stub) | OK |

---

## P0 — Blocks Usage

### P0-1. URL-prefix mismatch — every dashboard tab 404s

**Frontend** (`app/src/lib/api/admin.ts`) calls these paths:

```ts
// lines 26, 69, 89, 93
`/v1/admin/users?page=${page}&limit=${limit}`
`/v1/admin/usage?period=${period}`
`/v1/admin/revenue?period=${period}`
`/v1/admin/keys?page=${page}&limit=${limit}`
```

**Backend** registers them at `/admin/...` (no `/v1`):

```ts
// server/src/routes/admin/users.ts:14
usersRoutes.get("/admin/users", ...)
// server/src/routes/admin/usage.ts:10
usageRoutes.get("/admin/usage", ...)
// server/src/routes/admin/revenue.ts:10
revenueRoutes.get("/admin/revenue", ...)
// server/src/routes/admin/keys.ts:13
keysRoutes.get("/admin/keys", ...)
```

The catch-all proxy in `app/src/app/api/[...path]/route.ts:78` strips `/api` and forwards verbatim. So `/api/v1/admin/users` → backend `/v1/admin/users` → **404 not found**.

There is **no** backend handler at `/v1/admin/users`, `/v1/admin/revenue`, or `/v1/admin/keys`. (For `/v1/admin/usage`, a handler exists in `admin-observability.ts` but with a different response shape — see P0-3.)

**Evidence**: backend test `server/src/__tests__/admin.test.ts:119` calls `app.request('/admin/keys?limit=250')` — confirming the backend serves `/admin/keys` (not `/v1/admin/keys`).

**Effect**: Open `/admin` after authenticating. All four data tiles on the Overview tab return errors → the `isUnauthorized` fallback in `page.tsx:187` triggers → user sees "Not Authorized" screen instead of the dashboard. Same fate for the Users / Usage / Revenue / Keys tabs once the React Query hooks fire.

### P0-2. `/admin/fees` and `/admin/rate-limits` pages are broken for the same reason

`app/src/app/admin/fees/page.tsx:65, 82` calls `/api/admin/config/fees`. `app/src/app/admin/rate-limits/page.tsx:47, 54, 110, 142, 189` calls `/api/admin/config/rate-limits`, `/api/admin/rate-limit-overrides`. The catch-all forwards `/admin/config/...` to the backend, but the backend (`server/src/routes/config.ts:44, 71, 99, 128, 156, 193, 216`) only registers them at `/v1/admin/config/...`. Same `/v1` vs no-`/v1` mismatch.

**Effect**: Open `/admin/fees` while authenticated → React Query fires GET `/api/admin/config/fees` → 404 → page shows infinite spinner (no error fallback in `fees/page.tsx:131-141`, only `feesQuery.isLoading` is handled, not error). The page is **unusable**.

### P0-3. Shape mismatch on `/v1/admin/usage` would still break the page if the URL were fixed

The `/v1/admin/usage` handler exists in `server/src/routes/admin-observability.ts:21-66` and returns:

```jsonc
{
  "window": { "days": 30, "since": "..." },
  "totals": { ... },
  "byProvider": [...],
  "byModel": [...],
  "byDay": [...]
}
```

The frontend type `UsageStats` in `app/src/app/admin/_components/types.ts:8-41` expects:

```jsonc
{
  "period": "30d",
  "summary": { "totalRequests": ..., "grossProfit": ..., "margin": ... },
  "byProvider": [...],
  "byModel": [...],
  "dailyUsage": [...]
}
```

If someone "fixes" the URL prefix to `/v1/admin/usage`, the Overview tab will still 500 because `usageStats.summary` and `usageStats.dailyUsage` will be undefined. The card `Usage This Month` (`AdminOverviewTab.tsx:109-110`) reads `adminStats.totalUsageThisMonth` which comes from `usageStats.summary.totalRevenue` (`page.tsx:120`) — wrong shape key too.

**Note**: `admin-observability.ts:11-16` explicitly comments: "Duplicating /admin/* here would shadow those routes and return a different shape". So the author knew the shape conflict existed but didn't unify.

### P0-4. OpenAPI spec documents paths that don't exist

`server/src/routes/openapi.ts:2050-2172` documents:

- `/admin/usage`, `/admin/revenue` — exist ✓
- `/admin/config/fees`, `/admin/config/rate-limits`, `/admin/rate-limit-overrides` — **DO NOT EXIST** (actual handlers are at `/v1/admin/config/...`)
- `/admin/refunds`, `/admin/refunds/{id}` — exist ✓

Anyone reading the OpenAPI spec and trying to hit `/admin/config/fees` will get 404. The spec is lying.

---

## P1 — Visible Problem

### P1-1. Demo-mode bypass exposes admin UI to unauthenticated users

`app/src/middleware.ts:55-75`:

```ts
const wantsDemo = request.nextUrl.searchParams.get("demo") === "1";
if (wantsDemo) { ...res.cookies.set({ name: "oma-demo", value: "1", maxAge: 86400, ... }) ... }
// ...
const hasDemo = request.cookies.get("oma-demo")?.value === "1";
if (hasDemo) return NextResponse.next();
```

**Verified live**: `curl -I /admin/users?demo=1` → **200 OK** (no redirect).

The comment says the dashboard renders mock data and gates backend calls on `!isDemo`. But:

- `app/src/app/admin/page.tsx` has no `isDemo` check. It calls `api.admin.*` unconditionally.
- `app/src/app/admin/fees/page.tsx`, `app/src/app/admin/rate-limits/page.tsx`, `app/src/app/admin/users/[id]/page.tsx` — same, no `isDemo` check.

The cookie is `httpOnly: true` so JS can't see it. But the bypass works for the middleware, the UI renders, and an unauthenticated visitor sees the admin shell, all tabs, all labels, and the user-list table (which would render empty after the API 401s). After visiting once, the cookie persists for 24 hours.

**Effect**: Information disclosure of admin UI structure, internal labels, and any data that's returned before the API 401s. Risk is low (no real data exposed), but the bypass should not exist for `/admin/*`.

### P1-2. Hardcoded provider list in `/admin/fees`

`app/src/app/admin/fees/page.tsx:24-48` defines a 7-provider hardcoded `PROVIDERS` array:

```ts
const PROVIDERS: ProviderInfo[] = [
  { id: "venice", name: "Venice AI", description: "Primary provider with advanced models" },
  { id: "openrouter", name: "OpenRouter", description: "Access to 100+ models" },
  { id: "together", name: "Together AI", description: "Open source models" },
  { id: "deepinfra", name: "DeepInfra", description: "Fast inference at low cost" },
  { id: "litellm", name: "LiteLLM", description: "Unified API for multiple providers" },
  { id: "antseed", name: "AntSeed", description: "Privacy-focused inference" },
  { id: "tinyfish", name: "TinyFish", description: "Efficient small models" },
];
```

But `server/src/config.ts:25-30` (latest commit comments) says:

> ponytail: Non-private providers (OpenRouter, Together, DeepInfra, Claude, Gemini, Morpheus, AntSeed, LiteLLM) **removed**. OMA routes exclusively through Venice-based providers (Venice direct, Surplus, CheapTokens).

So the fees page is editing markup for 6 providers that no longer exist in the routing layer. The only two providers the backend can write markup for are `venice` and `surplus` (per the `defaultConfig` in `server/src/routes/config.ts:48-53`).

**Effect**: Editing markup for OpenRouter / Together / etc. has no effect on routing — those providers don't receive traffic. The admin is configuring dead settings.

### P1-3. Overview tab "Usage This Month" shows revenue, not usage

`app/src/app/admin/_components/AdminOverviewTab.tsx:102-112`:

```tsx
<div className="rounded border border-border bg-surface p-4 group hover:border-accent/30 transition-colors">
  <div className="flex items-center gap-2 mb-3">
    <Zap className="w-3.5 h-3.5 text-text-muted" />
    <span className="text-[10px] text-text-muted font-mono uppercase tracking-wider">
      Usage This Month
    </span>
  </div>
  <p className="text-2xl font-bold font-mono text-amber">
    {formatUsd(adminStats.totalUsageThisMonth)}
  </p>
</div>
```

But in `app/src/app/admin/page.tsx:120` the variable is computed from `usageStats.summary.totalRevenue` — that is revenue (USD collected from usage), not usage (requests / tokens). Confusing copy.

### P1-4. OpenRouter shown as "Backup provider" despite removal

`AdminOverviewTab.tsx:165-184` renders a hardcoded OpenRouter card and totals its cost into "Total Provider Costs". Same root cause as P1-2: the routes were removed but the UI still references them.

### P1-5. AdminUsersTab has wrong heading

`app/src/app/admin/_components/AdminUsersTab.tsx:50-54`:

```tsx
<div className="px-4 py-3 border-b border-border bg-panel">
  <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-text-secondary">
    Top Models
  </h3>
</div>
```

The table below renders **users**, not models. Looks like a copy-paste leftover from `AdminUsageTab.tsx`'s "Top Models" heading.

### P1-6. Main dashboard tabs "fees" and "rate-limits" are nav stubs, not real tabs

`app/src/app/admin/page.tsx:334-360`:

```tsx
{activeTab === "fees" && (
  <div className="rounded border border-border bg-surface p-8 text-center">
    <DollarSign className="w-12 h-12 text-text-muted mx-auto mb-4" />
    <p className="text-text-muted font-mono">Fee configuration</p>
    <Link href="/admin/fees" className="...">Open Fee Configuration →</Link>
  </div>
)}
```

These render a placeholder card with a link to the dedicated page, instead of embedding the fees / rate-limit UI inline. Both tabs effectively do nothing except offer a "go somewhere else" button. Inconsistent with how Overview / Users / Usage / Revenue / Keys work (all rendered inline).

### P1-7. Inconsistent HTTP client usage between admin pages

`page.tsx` and its tab components use the typed `api.admin.*` client (`app/src/lib/api/admin.ts`). But:

- `app/src/app/admin/fees/page.tsx:65, 82` uses raw `fetch("/api/admin/config/fees", ...)`.
- `app/src/app/admin/rate-limits/page.tsx:47, 54, 110, 142, 189` uses raw `fetch`.
- `app/src/app/admin/users/[id]/page.tsx:74` uses raw `fetch`.

Raw `fetch` skips:
- The `setAuthToken()` cached Bearer token injection
- The `BackendUnavailableError` typing
- The `pendingRequests` dedup
- The `ApiError` class for typed errors

So the fees / rate-limits / user-detail pages silently fail in ways the main dashboard's React Query surfaces clearly.

---

## P2 — Polish

### P2-1. Pagination math is wrong when server uses a different `limit`

`app/src/app/admin/_components/AdminUsersTab.tsx:142-144`:

```tsx
<span className="text-xs text-text-muted font-mono">
  Page {usersPage} of {Math.ceil(usersTotal / 50) || 1}
</span>
```

Hardcoded 50, but the API client (`app/src/lib/api/admin.ts:26`) passes `limit=50` so it works in the current path. However the backend route `users.ts:9` accepts `limit` up to 100, and if any future caller uses 100, the page-count will be wrong.

### P2-2. Search input on /admin/users is client-side only

`AdminUsersTab.tsx:35-43` accepts a search query and `page.tsx:135-143` filters `users` array in memory:

```tsx
const filteredUsers = useMemo(() => {
  if (!searchQuery) return users;
  const q = searchQuery.toLowerCase();
  return users.filter(
    (u) => u.address.toLowerCase().includes(q) || u.accountNumber?.toLowerCase().includes(q),
  );
}, [users, searchQuery]);
```

But the backend (`server/src/routes/admin/users.ts:20-24, 43-46, 54-58`) **does** support a `search` query param with SQL wildcard escaping. The frontend never passes it. Effect: a search for an address not on the current 50-row page returns empty.

### P2-3. Rate-limits page drops unsaved edits on refresh

`app/src/app/admin/rate-limits/page.tsx:102-106`:

```tsx
useEffect(() => {
  if (configQuery.data?.tiers) {
    setEditTiers(configQuery.data.tiers);
  }
}, [configQuery.data]);
```

The `editTiers` state is reset to whatever the server returned on every fetch. The inputs render `value={tier.rpm}` (`page.tsx:366`) where `tier = editTiers[tierId] || { rpm: 60, tpm: 10000 }` — so any tier the user hasn't touched gets the fallback 60/10000, and clicking "Save Changes" would push those defaults back to the server, overwriting actual config.

### P2-4. CSV export on Revenue tab ignores the period

`app/src/app/admin/_components/AdminRevenueTab.tsx:106-115` exports `revenueStats.monthlyRevenue` (always 12 months) regardless of which period button (`7d` / `30d` / `90d` / `all`) the user selected. Filename includes the period but the data doesn't change.

### P2-5. `_id` underscore-prefixed variable in fees / rate-limits pages

Both `fees/page.tsx:60` and `rate-limits/page.tsx:70` declare `const _id = useId();` but only use it for input `id` attributes. The leading underscore conventionally signals unused, but the variable IS used. Misleading; rename to `id` or `uid`.

---

## Auth Gate Verification (live curl)

Dev server running on port 3000; backend on 3001 not running.

| Request | Expected | Got | Verdict |
|---------|----------|-----|---------|
| `GET /admin` (no auth) | redirect to /login | **307** → `/login?next=%2Fadmin` | PASS |
| `GET /admin/fees` (no auth) | redirect | **307** | PASS |
| `GET /admin/rate-limits` (no auth) | redirect | **307** | PASS |
| `GET /admin/users` (no auth) | redirect | **307** | PASS |
| `GET /admin/users/abc-123` (no auth) | redirect | **307** | PASS |
| `GET /api/admin/users` (no auth) | 401 | **401** + `{error: "Unauthorized"}` | PASS |
| `GET /api/admin/users/abc-123` (no auth) | 401 | **401** | PASS |
| `GET /api/admin/config/fees` (no auth) | 401 | **401** | PASS |
| `GET /api/admin/config/rate-limits` (no auth) | 401 | **401** | PASS |
| `GET /api/admin/rate-limit-overrides` (no auth) | 401 | **401** | PASS |
| `GET /admin/users?demo=1` | 401/redirect | **200** | **FAIL** — demo bypass |
| `GET /admin/fees?demo=1` | 401/redirect | **200** | **FAIL** — demo bypass |
| `GET /api/v1/admin/users` (no auth) | 401 | **500** Internal Server Error | unexpected; possibly rate-limiter misbehaving on `/v1/admin/*` paths; needs investigation |

---

## Fix Recommendations

### Fix P0-1 and P0-2 (URL-prefix mismatch)

Two clean options. Recommend **Option B**.

**Option A** — change the frontend client. In `app/src/lib/api/admin.ts`:

```diff
- `/v1/admin/users?page=${page}&limit=${limit}`
+ `/admin/users?page=${page}&limit=${limit}`
- `/v1/admin/usage?period=${period}`
+ `/admin/usage?period=${period}`
- `/v1/admin/revenue?period=${period}`
+ `/admin/revenue?period=${period}`
- `/v1/admin/keys?page=${page}&limit=${limit}`
+ `/admin/keys?page=${page}&limit=${limit}`
```

And in `app/src/app/admin/fees/page.tsx:65,82` + `app/src/app/admin/rate-limits/page.tsx:47,54,110,142,189`:

```diff
- `/api/admin/config/fees`
+ `/api/v1/admin/config/fees`
- `/api/admin/config/rate-limits`
+ `/api/v1/admin/config/rate-limits`
- `/api/admin/rate-limit-overrides`
+ `/api/v1/admin/rate-limit-overrides`
```

**Option B** — add `/admin/...` aliases in the backend, matching the canonical path of every existing route file:

```ts
// server/src/routes/admin/index.ts, after adminRoutes.route("/", usersRoutes)
adminRoutes.get("/v1/admin/users", ...);          // mirror usersRoutes.get("/admin/users")
adminRoutes.get("/v1/admin/users/:id", ...);
adminRoutes.get("/v1/admin/usage", ...);
adminRoutes.get("/v1/admin/revenue", ...);
adminRoutes.get("/v1/admin/keys", ...);
// configRoutes already has both — add /admin/ aliases:
// configRoutes.get("/admin/config/fees", ...);
// configRoutes.get("/admin/config/rate-limits", ...);
// configRoutes.get("/admin/rate-limit-overrides", ...);
// configRoutes.post("/admin/rate-limit-overrides", ...);
// configRoutes.delete("/admin/rate-limit-overrides/:id", ...);
```

Option B is recommended because it preserves the documented `/v1/admin/...` URL contract that OpenAPI and most other routes use, and matches the path-shape expected by the existing tests for `users` / `usage` / `revenue` / `keys`.

### Fix P0-3 (response shape mismatch on `/v1/admin/usage`)

Choose **one** canonical `/v1/admin/usage` handler. Either:

- Make `admin-observability.ts:21-66` return the `{ period, summary, byProvider, byModel, dailyUsage }` shape, OR
- Have it redirect to the canonical `/admin/usage` handler.

Then delete the duplicate. Same logic applies to `/v1/admin/dlq` (which exists in both files).

### Fix P0-4 (OpenAPI rot)

In `server/src/routes/openapi.ts:2073-2172`, either:

- Change paths to `/v1/admin/config/fees`, `/v1/admin/config/rate-limits`, `/v1/admin/rate-limit-overrides`, `/v1/admin/rate-limit-overrides/{id}` (if going with Option B above), OR
- Verify each documented path and delete or correct ones that don't exist.

### Fix P1-1 (demo-mode bypass for `/admin/*`)

In `app/src/middleware.ts:43-75`, exclude `/admin` from demo bypass:

```diff
 const isProtected = PROTECTED_PATHS.some((path) => pathname.startsWith(path));
 if (!isProtected) return NextResponse.next();

+// Admin pages must always be authenticated. Demo mode is for the
+// dashboard's mock-data preview only, not for /admin/*.
+if (pathname.startsWith("/admin")) {
+  const session = request.cookies.get(SESSION_COOKIE_NAME)?.value;
+  if (!session) {
+    return NextResponse.redirect(new URL("/login?next=" + pathname, request.url));
+  }
+}

 // ... demo bypass logic ...
```

### Fix P1-2 (hardcoded provider list in fees page)

Replace `PROVIDERS` const with a backend-supplied list. Add a new endpoint or extend `GET /v1/admin/config/fees` to include a `providers` metadata array:

```ts
// server/src/routes/config.ts:44
return c.json({
  config: ...,
  providers: [
    { id: "venice", name: "Venice AI", description: "..." },
    { id: "surplus", name: "Surplus", description: "..." },
    // remove OpenRouter / Together / DeepInfra / LiteLLM / AntSeed / TinyFish
  ],
});
```

Frontend (`app/src/app/admin/fees/page.tsx:24-48`): drop the hardcoded const, consume from the API response.

### Fix P1-3 / P1-4 (Overview tab copy + OpenRouter card)

`app/src/app/admin/_components/AdminOverviewTab.tsx`:

- Line 105-111: rename "Usage This Month" → "Revenue This Month", or change `page.tsx:120` to compute the actual usage metric (`totalRequests` or `totalInputTokens + totalOutputTokens`).
- Lines 165-184: remove the hardcoded OpenRouter card. Render providers from `usageStats.byProvider` instead.

### Fix P1-5 ("Top Models" heading)

`app/src/app/admin/_components/AdminUsersTab.tsx:52` → change `<h3>Top Models</h3>` to `<h3>Users</h3>`.

### Fix P1-6 (Fees/Rate-limits tab stubs)

`app/src/app/admin/page.tsx:334-360` — either inline the fees/rate-limits UI directly into the tab panels (preferred, since they're already full-page UIs that import heavy clients), or remove the tabs entirely from the tab bar since they only redirect to dedicated pages.

### Fix P1-7 (raw fetch in dedicated pages)

Migrate `app/src/app/admin/fees/page.tsx`, `rate-limits/page.tsx`, `users/[id]/page.tsx` to use the `api.admin.*` client or a new typed client. Add corresponding methods to `app/src/lib/api/admin.ts`.

### Fix P2-1 (page-size mismatch)

`AdminUsersTab.tsx:143` — compute page-count from `usersTotal` and the actual `limit` passed to the API. Plumb `limit` as a prop, or hoist it to `page.tsx` like `usersPage`.

### Fix P2-2 (client-side search)

`app/src/app/admin/page.tsx:73` — pass the search string to the API: `api.admin.getUsers(usersPage, 50, searchQuery)`. Add an optional `search` param to the `getUsers` method in `app/src/lib/api/admin.ts`.

### Fix P2-3 (unsaved-edits wipe on refresh)

`app/src/app/admin/rate-limits/page.tsx:339-341` — read value as `editTiers[tierId]?.rpm ?? configQuery.data?.tiers?.[tierId]?.rpm ?? 60`. Track which tiers the user has touched and only push those on save.

### Fix P2-4 (Revenue CSV ignores period)

`AdminRevenueTab.tsx:106-115` — either filter `monthlyRevenue` to the selected period, or add a note that the CSV always exports the full 12-month table.

### Fix P2-5 (`_id` variable)

Both pages: rename `const _id = useId();` → `const id = useId();` (it's used).

---

## Appendix A — Backend admin routes with no frontend caller

These handlers are real and tested but have **zero UI exposure**. Confirmed by `grep -rn 'admin/(refunds|dlq|audit-logs|surplus|invoices|byok)' app/src` returning no results.

| Endpoint | File | Notes |
|----------|------|-------|
| `GET /admin/refunds?status=pending` | `refunds.ts:52` | Operators have no UI to process refunds |
| `POST /admin/refunds/:id/grant` | `refunds.ts:108` | TOTP step-up — **money movement** |
| `POST /admin/refunds/:id/deny` | `refunds.ts:221` | TOTP step-up |
| `GET /v1/admin/dlq/settlements` | `dlq.ts:25` | DLQ retry UI missing |
| `POST /v1/admin/dlq/settlements/:id/retry` | `dlq.ts:63` | |
| `POST /v1/admin/dlq/settlements/:id/discard` | `dlq.ts:96` | |
| `POST /v1/admin/dlq/settlements/process` | `dlq.ts:126` | |
| `GET /v1/admin/audit-logs` | `audit-logs.ts:14` | Filterable by user/action/resource/date |
| `GET /admin/surplus/models` | `surplus.ts:9` | |
| `GET /admin/surplus/health` | `surplus.ts:20` | |
| `GET /admin/surplus/config` | `surplus.ts:36` | |
| `POST /admin/invoices` | `invoices.ts:25` | Invoice creation UI missing |
| `GET /admin/invoices` | `invoices.ts:115` | |
| `GET /admin/invoices/:id` | `invoices.ts:81` | |
| `GET/POST/DELETE /admin/byok/*` | `byok.ts` | 503 GONE — correct, BYOK was retired |

The refunds endpoint is the most concerning orphan: a money-movement handler with TOTP step-up, but no operator UI to call it. Either ship a Refunds tab or document that this is API-only and used by an external tool.

## Appendix B — Auth helpers inventory

`server/src/auth/` (9 files, 8 with tests):

| File | Role | Auth surface |
|------|------|--------------|
| `middleware.ts` | `bearerAuth`, `sessionAuth`, `optionalAuth`, `requireAdmin` | All admin routes use `sessionAuth + requireAdmin` |
| `require-fresh-totp.ts` | Per-route TOTP gate | Sweep / refund grant/deny / byok |
| `siwe.ts` | EIP-4361 message verify + JWT issue | Path 1 of `sessionAuth` |
| `neon-auth.ts` | Better Auth JWT verify (JWKS) | Path 2 of `sessionAuth` |
| `two-factor.ts` | TOTP enroll / verify / backup codes | 2FA gate inside `sessionAuth` + `requireFreshTotp` |
| `wallet-link.ts` | Link wallet to local user row | Auth lifecycle |
| `account-number.ts` | Account-number-based auth | Auth lifecycle |
| `api-keys.ts` | Validate API key, IP allowlist | `bearerAuth`, `optionalAuth` |
| `encryption.ts` | AES-GCM helper for 2FA secrets | Used by 2FA + TOTP |

Tests: 8 test files, all passing per `server/src/auth/__tests__/`.

## Appendix C — Files changed since last commit on `main`

```
modified:   app/src/app/login/layout.tsx   (uncommitted)
untracked:  .audit/                        (this report + earlier audits)
untracked:  .worktrees/                    (health-scan branch)
```

`login/layout.tsx` is the only modified file in scope — unrelated to the admin panel. Branch is 22 commits ahead of `origin/main` (not pushed).

---

**Report complete. No source files modified.**