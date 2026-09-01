# OMA-AI Real-Userflow Audit — 2026-09-01 (post-audit re-verification + live)

**Drive method**: Headless Chromium (Playwright). Real admin session via magic link (dev fallback logs URL to `/tmp/oma-dev.log` when `RESEND_API_KEY=placeholder_resend_api_key`). All flows executed end-to-end as a real user, not mocked.

**Screenshots**: `/tmp/pw-flows/uf/*.png` (30 captures)

---

## TL;DR

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | ✅ Verified | Prior audit's 4 fixes hold under live traffic | **Confirmed** |
| 2 | 🐛 P1 | `/admin` React duplicate-key warnings in `topRoutes` / `topModels` / `providerHealth` | **NEW BUG** |
| 3 | 🐛 P2 | `/admin` kill switch card labels overflow on the grid | **NEW BUG** |
| 4 | 🐛 P2 | "Network error" banner shows even when the fallback chain succeeded | **NEW BUG** |
| 5 | 🐛 P3 | Fallback model returns degenerate output ("responseek" × hundreds) | **NEW BUG** |
| 6 | ⚠️ P1 | Chat is unusable during upstream-capacity events (5 min response, no progress UI) | **NEW (env-induced)** |
| 7 | 🛠 infra | `pw-persist.mjs` referenced in audit doc was never created; recreated | **Fixed this session** |

---

## 1. Verified — prior audit fixes hold

| Audit claim | Live verification | Result |
|---|---|---|
| Model selection persists across reloads | `node /tmp/pw-flows/pw-persist.mjs` (recreated) — 8/8 assertions | ✅ |
| `?model=<id>` URL deep link wins on first mount | same | ✅ |
| Invalid `?model=does-not-exist` falls back to stored, doesn't clobber | same | ✅ |
| URL stays clean on cold load (no `?model=gemini-3-flash-preview`) | same | ✅ |
| Stop button no longer intercepts sibling clicks | Live test during stream: clicked `Toggle web search` mid-stream → `aria-pressed` flipped to `true` | ✅ |
| `/admin` `<title>` dedup | Browser title shows `Admin · OMA` (one suffix, not two) | ✅ |
| 518/518 unit tests | `pnpm validate` | ✅ |
| 11/11 new persist test | `pnpm exec vitest run usePlaygroundState.persist.test.ts` | ✅ |

---

## 2. NEW BUGS

### BUG-A — `/admin` React duplicate-key warnings

**Severity**: P1 (console errors visible to all admins, surfaces in dev, will break under load when the data isn't empty)

**Location**: `app/src/app/admin/page.tsx:296, 323, 353`

```tsx
// line 294-306 — topRoutes
{snap.http.topRoutes.map((r) => (
  <li key={r.route} ...>  // ← duplicate when the same route hits the topN twice
```

```tsx
// line 321-333 — topModels
{snap.chat24h.topModels.map((m) => (
  <li key={m.model} ...>  // ← duplicate when the same model splits across providers
```

```tsx
// line 349-... — providerHealth
{providerHealth.map(([provider, ...]) => (
  <li key={provider} ...>  // ← duplicate when the Map is rebuilt with the same key
```

**Symptom (live)**: On /admin with `snap` loaded, browser console emits:
```
Encountered two children with the same key, `%s`. Keys should be unique so that components
maintain their identity across updates. Non-unique keys may cause children to be duplicated
and/or omitted — ...
```

The `key={provider}` form on line 353 is the most likely trigger today: `providerHealth` is built from a `Map` (line 130-140) keyed by `m.provider ?? "unknown"` — the `?? "unknown"` fallback means every model with no provider field collapses to the same key.

**Repro**: visit /admin as admin → open DevTools console → see the warning.

**Fix**: index-based key or composite key:
```tsx
{snap.http.topRoutes.map((r, i) => <li key={`${r.route}:${i}`} ...>)}
{snap.chat24h.topModels.map((m, i) => <li key={`${m.model}:${i}`} ...>)}
{providerHealth.map(([provider, v], i) => <li key={`${provider}:${i}`} ...>)}
```

---

### BUG-B — `/admin` kill switch card labels overflow

**Severity**: P2 (visible UX regression on the operator dashboard)

**Symptom (live, desktop 1440)**: The "Maintenance mode" / "Card payments" / "Crypto payments" kill-switch cards are too narrow in the 3-column grid. The descriptions wrap and truncate mid-word:
- "Returns 503 to all routes except /health." → shows "Returns 503 to all routes except /health." (cut at right edge)
- "Disable Polar checkout + x402 (cards remain)." → cut off
- "Disable USDC + x402 deposits (card remains)." → cut off
- "operator override" button → cut to "operator ove"

**Repro**: visit /admin → scroll to "Kill Switches" section.

**Fix options**:
- Stack the cards on a 1-column grid below `xl`, or
- Move the description to a `details/summary` disclosure so the long text can be revealed on demand, or
- Shorten the copy.

---

### BUG-C — "Network error" banner shows even on successful fallback

**Severity**: P2 (misleading error UX — user gets a response AND an error banner)

**Symptom (live)**: Pick `GPT-5.6 Sol` (frontier, paid). Send "Reply with just the single word: ok". Upstream at capacity → router retries → falls back to `Gemini 3 Flash` → response arrives (302 tokens, ~5 min later). The chat renders the response AND a red banner:

> NETWORK ERROR
> Could not reach the server — check your connection
> [TRY AGAIN]

The banner stays up even though the response succeeded. "Try Again" is a no-op because there's nothing to retry.

**Location**: Probably `useStreamingChat.ts` around the `handleChatResponseStatus` / error-classification path. When the *initial* fetch gets a 502/504 (upstream at capacity) and the server retries internally, the *final* response is 200 with the fallback. The error banner is set from the early non-2xx and never cleared on the eventual success.

**Repro**: pick any paid model during an upstream-capacity event, send a message, wait ~5 min for the fallback to land. Both response AND banner visible.

**Fix**: when a fallback `x-oma-fallback: 1` header is present, suppress the network-error banner (the fallback is a successful response, not a failure).

---

### BUG-D — Fallback model produces degenerate output

**Severity**: P3 (model-quality, not a code bug, but the UI surfaces it without warning)

**Symptom (live)**: Prompt "Reply with just the single word: ok" → fallback model (`Gemini 3 Flash`) returns:
```
responseek, responseek, responseek, responseek, responseek, ...
```
…repeated hundreds of times, 302 tokens of garbage. The chat renders it as a normal assistant message.

**Fix (out of scope for chat UI)**: Either swap the fallback peer, add a content-quality filter on the fallback path, or surface a "low-confidence response" hint in the UI when the model returns a high repetition ratio.

---

### BUG-E — Chat is unusable during upstream-capacity events (5-min response, no progress UI)

**Severity**: P1 (operator-visible; P2 for the user, but P1 for the operator who has to explain to a customer why the spinner sat for 5 minutes)

**Symptom (live)**: With all upstream providers at capacity (`all hosts are at capacity` per server log), the request:
1. Hits the primary model → 502 "all hosts at capacity"
2. Server retries with backoff
3. Falls back to `Gemini 3 Flash` (free)
4. Response lands ~5 minutes after the user pressed Enter

During those 5 minutes:
- The Stop button is visible (good)
- The "WEB toggle clickable during stream" audit fix works (good)
- The user has no idea anything is happening (bad) — no toast like "Retrying…" or "Routed via fallback model…"
- The loading spinner sits with no progress signal

The audit doc claimed `toast.info("Routed via fallback model · " + actualModel)` in `useStreamingChat.ts:334` — but this is server-side fallback only (it fires on `x-oma-fallback: 1` response header). For the *client-side fallback* on the `models[]` peer list (`useStreamingChat.ts:265-281`), no toast is shown.

**Repro**: any chat during an upstream-capacity event. Server log shows the full retry chain; client shows just a spinner for 5 minutes.

**Fix**: show a `Routed via fallback model · …` toast when the *primary* fails AND the request retried successfully, regardless of which fallback path was used. Add an intermediate "Retrying with backup model…" state if the upstream 502s.

---

## 3. Test infrastructure

### `pw-persist.mjs` was never created

The Sep 1 audit doc references:
> ✅ Verification: Playwright e2e (`/tmp/pw-flows/pw-persist.mjs`)

But `/tmp/pw-flows/` did not contain that file. Recreated at `/tmp/pw-flows/pw-persist.mjs` (8 assertions: cold default, URL clean, switch persists, URL mirrors, reload restores, deep link wins, invalid doesn't clobber, invalid falls back). All 8 pass.

**Recommendation**: store test scripts in the repo (e.g. `app/e2e/`) so they don't disappear with `/tmp` cleanups.

---

## 4. Live userflow (as a real user)

### Phase 1 — Sign in ✅
- Triggered magic-link request via `curl` to `/api/auth/sign-in/magic-link` with `Origin: http://localhost:3000`
- Captured URL from `/tmp/oma-dev.log` (the dev fallback logs `[magicLink] (dev) no RESEND_API_KEY set — click the URL to sign in` with `magicLink: "..."`)
- Visited URL in headless Chromium → session cookie set → redirected to `/dashboard`
- Session check via `/api/auth/get-session` → `{user: {email: "tyson@nosytlabs.com", role: "admin"}, session: {...}}`

### Phase 2 — Public pages (11/11 ✅)
All 11 public routes return 200, with proper h1s:
- `/`, `/pricing`, `/docs`, `/faq`, `/getting-started`, `/glossary`, `/models`, `/login`, `/terms`, `/privacy`, `/deposit`

### Phase 3 — Authed pages (3/3 ✅)
- `/dashboard` → "Dashboard" h1, "All systems normal" status, 1,000 CR balance
- `/settings` → "Settings" h1
- `/admin` → "Admin · Operator dashboard" h1, but **console error: duplicate-key warning** (BUG-A)

### Phase 4 — Chat E2E (as admin)
- Picked `GPT-5.6 Sol` (frontier tier, first match) ✅
- Sent "Reply with just the single word: ok"
- Stop button appeared within 8s ✅
- **WEB toggle clickable during stream** — `aria-pressed` flipped to `true` (audit P1 fix verified live) ✅
- Response landed ~5 min later via fallback (`Gemini 3 Flash · fallback` label visible) ✅
- 302 tokens, response was degenerate ("responseek" × ~120) — BUG-D
- NETWORK ERROR banner ALSO visible — BUG-C
- Web search and A2UI tests skipped: upstream too slow to test in this session

### Phase 5 — Mobile (375×812)
- `/` 200, `/chat` 200, `/models` 200, `/pricing` 200, `/dashboard` 200
- `/admin` on mobile shows the auth-gate fallback ("Admin access required" h2, "GET API KEY" header CTA, "SIGN IN" button) — **storageState didn't transfer from the desktop context** in the test script, so the mobile session started unauthed. This is a test-infrastructure issue, not a product bug; the fallback renders correctly.

---

## 5. Open questions for product

1. Should the `mistral-small-2603` "free" badge be qualified? (from prior audit, still open)
2. Should the chat surface a `Routed via fallback model · …` toast for the *client-side* peer-list fallback (`useStreamingChat.ts:265-281`) the way it does for the server-side `x-oma-fallback` header? (BUG-E)
3. Should the kill-switch card copy be shortened, or the cards stacked 1-column below `xl`? (BUG-B)
4. Should the network-error banner auto-clear when a fallback response lands? (BUG-C)
5. Should the admin dashboard filter out or aggregate duplicates in `topRoutes` / `topModels` rather than rely on index-keys? (BUG-A)

---

## 6. Verification commands

```bash
# Unit + integration
cd /Users/tyson/Desktop/Code/products/oma-ai && pnpm validate
# 518/518 expected (45 app + 30 server files, 285 + 233 tests)

# New persist test
pnpm exec vitest run usePlaygroundState.persist.test.ts
# 11/11 expected

# Live E2E
node /tmp/pw-flows/pw-persist.mjs       # 8/8 expected
node /tmp/pw-flows/web-toggle-fix.mjs    # was blocked by quota this session
node /tmp/pw-flows/real-userflow.mjs     # full admin sign-in + chat + mobile
node /tmp/pw-flows/web-search-e2e.mjs    # was blocked by upstream this session

# Quota state
curl -s http://localhost:3000/api/v1/usage/today
# {"used":0,"limit":20,"remaining":20,"isAuthenticated":false,"resetMs":86400000}
# (was 22/20/0 at the start of this session — Redis key cleared with product sign-off)
```
