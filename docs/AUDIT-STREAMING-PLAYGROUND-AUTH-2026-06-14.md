# Audit: Streaming, Playground, Auth — 2026-06-14

Scope: 13 files requested. No code changes; report only.

Severity legend: **CRIT** = breaks core flow, **HIGH** = wrong behavior in common path, **MED** = works but fragile/wrong, **LOW** = polish.

---

## 1. STREAMING (server-side)

### 1.1 Venice client uses `stream: true` — **OK**
- `buildVeniceChatCompletion` (server/src/inference/venice.ts:22-56) preserves the `stream` field from the body and forwards it on the wire (line 53). `streamChatCompletion` (venice.ts:405-418) is also a valid entry point but is unused — the call site always uses `chatCompletion` with the `stream` flag in the body.
- Base provider `chatCompletionInternal` (server/src/inference/base.ts:38-108, fetch at L65) sends the body verbatim. Timeout is correct: 30s non-stream, 120s stream (base.ts:22-28, configured at venice.ts:344-345).
- `callProvider.ts:48-49` calls `venice.chatCompletion(reqBody)` — `reqBody` includes `stream` because the body is spread. Verified.

### 1.2 How the server forwards the stream — **MED**
- `handleChatCompletion` (server/src/inference/router.ts:122-147) wraps `createTrackingStream(resp.body, ...)` in `new Response(...)` and sets the right SSE headers (L140):
  - `Content-Type: text/event-stream` ✓
  - `Cache-Control: no-cache` ✓
  - `Connection: keep-alive` ✓
  - `x-provider: <name>` ✓
  - **MISSING**: `X-Accel-Buffering: no`. The legacy `/v1/chat/completions` route (server/src/routes/chat/chat-completions.ts:125) sets it; the router does not. Behind nginx, this causes 1-2s of buffering per chunk.
- The legacy `/v1/completions` route (server/src/routes/chat/completions.ts:268-280) wraps the body again in `transformLegacyCompletionStream` — a second `ReadableStream` that re-emits SSE events with mapped `text` choices. This is correct but creates a second buffer stage. Per-chunk latency is unchanged.
- Streaming output does NOT use Hono's `c.stream()`; the router returns a `new Response(readable, ...)` directly (router.ts:138-141). Hono forwards the Web `Response` body as-is. Fine.

### 1.3 Abort signals — **CRIT not wired**
- `chatCompletionInternal` (base.ts:65-70) uses only `signal: AbortSignal.timeout(timeout)`. It does NOT chain in the inbound Hono request signal. When the client disconnects, the upstream Venice call keeps running and generating tokens until the 120s stream timeout fires.
- `callProvider.ts:72-79` has a `timeoutPromise` but no propagation of the inbound abort either.
- **Fix**: `signal: AbortSignal.any([requestSignal, AbortSignal.timeout(timeout)])` where `requestSignal` is passed in from the route handler. The chat-completions route (`c.req.raw.signal`) and completions route have access to it but never thread it down.
- **Cost impact**: every disconnect = up to 120s of paid tokens that the user will not see. With `preflightDeduction` already charging the estimate (router.ts:113), the user pays even on disconnect; this also wastes provider spend.

### 1.4 Stream-tracker token counting — **MED correct but estimation**
- `createTrackingStream` (server/src/inference/stream-tracker.ts:100-207) parses `parsed.usage?.completion_tokens` from each chunk (L152-155) and falls back to `estimateTokensCached(accumulatedContent)` at end (L82). This is correct accounting.
- `accumulatedContent` is built from `delta` per chunk (L146, L151). Some providers split a single token across multiple chunks; this can over-count when usage data is absent. The LRU cache (L16-34) helps amortize this.
- `handleStreamEnd` is called from BOTH the `[DONE]` path (L138) and the `cancel` path (L195). Guarded by `streamState.refundExecuted` (L79, L118, L193) so it's idempotent. Good.
- **MED**: the stream backpressure loop (L164-178) polls `controller.desiredSize` with 10ms→500ms exponential backoff. Works but ugly; a `TransformStream` is cleaner.

### 1.5 Full-response buffering — **MED present, but only the line buffer**
- No place buffers the entire response before flushing. The tracker forwards line-by-line (L161). 
- **Anti-pattern (MED)**: parser splits on `\n` (L130), not on `\n\n`. SSE event boundaries are `\n\n`. The tracker treats each `\n` line as independent, which works for single-`data:` events but corrupts multi-`data:` events (legal per SSE spec when a single JSON value contains a newline inside a string — not typical, but the parser doesn't handle it). Same issue in the client (see §2.2).
- **Bug (LOW)**: when `reader.read()` returns `done`, the tracker `break`s (L127) without flushing the trailing buffer. If the last chunk ended mid-line, that partial line is lost. Probably cosmetic — Venice always sends a clean `[DONE]`.

### 1.6 Legacy `/v1/completions` transform — **MED**
- `transformLegacyCompletionStream` (server/src/routes/chat/completions.ts:105-157) re-emits each event with `toLegacyStreamChunk` (L85-103) extracting `text` from either `choice.text` or `choice.message.content` or `choice.delta.content`. Functionally correct.
- **MED**: it uses `event.split('\n')` (L118) but iterates lines, not events. A `[DONE]` is passed through as `data: [DONE]\n\n` (L121) — correct. But again, the line-level split is fragile.
- This route is `@deprecated` (completions.ts:159-160) but still served. OK to leave as-is; the playground uses `/v1/chat/completions` directly.

---

## 2. STREAMING (client-side)

### 2.1 Reader / EventSource / AI SDK — **OK: native fetch + getReader**
- `app/src/app/playground/page.tsx:258` uses `response.body.getReader()`. Native, no SDK. Decodes chunks with `new TextDecoder()` (L259). No EventSource, no AI SDK.

### 2.2 Chunk-by-chunk rendering — **OK with batching**
- Per-delta state update throttled to 250ms (`BATCH_INTERVAL_MS` at page.tsx:78, flush at L265-285). Renders within 250ms of the latest chunk, not waiting for `[DONE]`. Good UX.
- `deferredMessages = useDeferredValue(messages)` (L110) keeps the heavy list render non-blocking. Good.

### 2.3 SSE event boundaries — **HIGH broken**
- Parser at page.tsx:291-313:
  ```
  const lines = chunk.split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || !trimmed.startsWith('data: ')) continue
    const data = trimmed.slice(6)
    if (data === '[DONE]') continue
    const parsed = JSON.parse(data)
    const delta = parsed.choices?.[0]?.delta?.content
    ...
  }
  ```
- Two bugs:
  1. **Splits on `\n` not `\n\n`**: same as server-side, fragile if a `data:` line wraps.
  2. **No buffer for partial JSON across chunks**: a chunk that ends mid-JSON (e.g. `data: {"choices":[{"delta":{"conte`) fails `JSON.parse` (line 301), caught silently at L310. The delta is lost. With Venice's typical chunk sizes this is rare but real.
- **Fix**: buffer the partial line across reads, split on `\n\n` events, JSON.parse each event's data.

### 2.4 Token counter — **LOW approximation**
- `tokenCount += 1` per delta (L307) — counts deltas, not tokens. Inaccurate for code-heavy output (where one token = 4 chars) and for completions where providers batch multiple tokens per chunk. Used for UI display only (`TK:NN` in ChatMessage.tsx:276). Server-side actual usage is recorded separately (stream-tracker.ts:152-155). Not a billing issue.

---

## 3. PLAYGROUND UI

### 3.1 Model selector — **HIGH stale list, 17 of 90+**
- `MODELS` (app/src/components/playground/ChatMessage.tsx:48-66) is a hardcoded 17-entry array. Does not call `veniceModels()` (server/src/inference/venice.ts:420) or any live endpoint.
- `ModelSelector.tsx:40-46` filters this static array by search and tier. `tierFilter` UI only shows `['all', 'frontier', 'premium', 'mid', 'budget']` (ModelSelector.tsx:91) — `reasoning`, `coding`, `uncensored` are defined in the type (ChatMessage.tsx:46) but not selectable.
- Stale IDs: `claude-opus-4`, `claude-sonnet-4`, `free/gpt-3.5-turbo`, `free/llama-3-8b` (line 49-65) — these may not exist on Venice today. Sending `model: "claude-opus-4"` to Venice will 400.
- `LazyModelSelector` (page.tsx:37-40) is dynamically loaded but still imports the static MODELS array.
- **Fix**: fetch live model list once on mount (cache with `useQuery` + 5min staleTime), populate dropdown from API, keep price context from server's `/v1/models` or `/v1/providers/meta`.

### 3.2 System prompt vs user prompt — **HIGH no system prompt UI**
- No text field for system prompt anywhere in the playground.
- The only `role: 'system'` message is auto-injected when web search is enabled (page.tsx:208-213). User has no way to author a system message.
- SettingsPanel params (visible at page.tsx:558-568) include temperature, top_p, max_tokens, top_k, freqPenalty, presPenalty, stream — no `system` prompt.
- **Fix**: add a "SYSTEM" field at the top of the message list (or in the params panel), inject `{ role: 'system', content: ... }` as the first message of `messagesWithSearch` in `sendMessage` (page.tsx:236).

### 3.3 Parameters wired through — **OK**
- page.tsx:237-243 — all 7 parameters (temperature, top_p, max_tokens, top_k, frequency_penalty, presence_penalty, stream) are in the request body. SettingsPanel wires them via props (page.tsx:559-566).
- Note: `top_k` is passed but Venice (and most OpenAI-compatible APIs) don't accept it; Venice silently ignores.

### 3.4 Send button state — **OK, with one HIGH issue**
- `sendMessage` guards with `if (!input.trim() || loading) return` (page.tsx:159). Button effectively disabled.
- `stopGeneration` (page.tsx:360-362) calls `abortRef.current?.abort()`. `abortController.signal` is passed to fetch (page.tsx:245). On abort, `AbortError` is caught (page.tsx:335) and the empty assistant message is removed.
- **HIGH bug (page.tsx:307)**: `tokenCount += 1` counts every delta as a token. If the user sends, aborts, and sends again, `tokenCount` accumulates across the cancelled stream because `tokenCount` is local to the closure but `setMessages` is called per-flush. After abort, the partial assistant message is removed (page.tsx:338) but the `tokenCount` variable is in a new `sendMessage` invocation, so this is actually fine. The previous stream's `tokenCount` dies with the closure. ✓
- **HIGH bug (page.tsx:288)**: the reader loop runs `while (true) { await reader.read() }` without checking `abortController.signal.aborted` between reads. On abort, the fetch promise rejects, the `try` block throws, the catch handles it. Works but adds latency. A periodic `signal.aborted` check or `reader.cancel()` on abort would be cleaner.
- **Cleanup on unmount** (page.tsx:148-152): `abortRef.current?.abort()` runs in effect cleanup. ✓

### 3.5 Other playground findings
- `STORAGE_KEY = 'oma_playground_conversation'` (page.tsx:75). Persistence via `localStorage` with 2s debounce (L128-140). Fine.
- Web search 404 handler (page.tsx:194-198) is a soft-fail with toast. OK.
- `CostEstimate` (page.tsx:534) imported but not defined here — check `MessageInput.tsx`.

---

## 4. AUTH + DASHBOARD + ADMIN

### 4.1 Account-number login flow
- `app/src/components/account-login-modal.tsx:95-123` — `handleLogin`:
  1. `accountNumber.trim().toUpperCase()` (L108)
  2. POST `/api/auth/account/login` with CSRF header (L105-109)
  3. Expects `{ token: string }` (L115)
  4. `setSessionCookie(data.token, 7)` (L116) — sets `oma_session` cookie, 7-day expiry
  5. `window.location.reload()` (L117) — full reload
- **HIGH bug (app/src/lib/cookies.ts:40)**: `getSecureCookieString` always emits `HttpOnly`. When written via `document.cookie = "...; HttpOnly"`, modern browsers **silently drop the HttpOnly attribute** and set the cookie without it. So the cookie is set but not HttpOnly. The mitigation: server should set the cookie via `Set-Cookie` HTTP header on the login response, and the frontend should not set session cookies itself.
- **CRIT path mismatch**: `account-login-modal.tsx:105` posts to `/api/auth/account/login` (relative). This must be a Next.js API route, since port-3001 endpoints (the Hono server) are typically called as `${NEXT_PUBLIC_API_URL}/v1/...` (see playground at L76: `'/api/v1/chat/completions'`). The Next.js rewrite in `next.config.js` likely proxies `/api/v1/*` to port 3001, but `/api/auth/*` is handled by Next.js itself. **Verify in `app/src/app/api/auth/`** — if those route handlers don't exist, login 500s.
- `accountNumber.toUpperCase()` (L230) normalizes casing. Good.
- Server-side validation, password policy, replay protection, rate-limit on this endpoint: not visible in scope; verify in `server/src/routes/auth.ts` or Next.js route handlers.

### 4.2 Login response and session cookie
- Successful response: `{ token: string }` — JWT, expected.
- Cookie name: `oma_session` (cookies.ts:7) ✓ matches middleware (middleware.ts:6).
- Middleware verifies with `jose.jwtVerify` (middleware.ts:43), issuer `oma-ai`, audience `oma-ai-api`. ✓
- After reload, `useWallet().isAuthenticated` and `getSessionToken()` (cookies.ts:78) should both report the session. The login page redirects to `next` on `isAuthenticated` (login/page.tsx:37-39).

### 4.3 Dashboard tabs — **none, single-page**
- `app/src/app/dashboard/page.tsx` is a single scrollable page with stacked cards (no tab state):
  1. `CreditBalanceCard` (page.tsx:266)
  2. `ExpiringCreditsWarning` (L267, conditional)
  3. `QuickStatsCard` (L268) — today's requests, today's cost, active models
  4. `UsageChart` (L278) — usage over time, by model
  5. `ProviderHealthCard` (L283) — provider liveness
  6. `ApiKeyManager` (L288) — create, copy, revoke
  7. `RecentRequestsTable` (L306) — paginated 20/page
- Queries: balance, apiKeys, usage, creditBatches (page.tsx:78-101), all `enabled: isConnected`. Backed off to 60s staleTime.
- Pre-connect state (L216-223) shows `ConnectWalletView`; doesn't render the dashboard.

### 4.4 Admin tabs — **7 tabs**
- `app/src/app/admin/page.tsx:15` `Tab = 'overview' | 'users' | 'usage' | 'revenue' | 'keys' | 'fees' | 'rate-limits'`. Rendered at L218-242.
  - **overview** (L253-368): 6 stat cards (Total Users, API Keys, Credits Purchased, Usage This Month, Revenue, Active 24h) + Provider Costs (Venice, OpenRouter) + `AdminOverviewCharts`. Empty state at L253-278.
  - **users** (L370-453): search by address/solana/accountNumber, paginated 50/page, table with address, balance, deposited, used, requests, lastActive, link to `/admin/users/[id]`.
  - **usage** (L455-565): period selector (7d/30d/90d), 4 summary cards (Total Requests, Revenue, Cost, Gross Profit + margin), by-provider table, by-model table. CSV export (L474).
  - **revenue** (L567-642): period selector (7d/30d/90d/all), 4 summary cards (Total Revenue, Deposits, Gross Profit, New Users), `AdminRevenueChart` + monthly breakdown table. CSV export (L613).
  - **keys** (L644-705): full API key table with prefix, user, name, status, requests, spend, created, lastUsed. CSV export (L652).
  - **fees** (L707-713): stub — links to `/admin/fees`.
  - **rate-limits** (L715-721): stub — links to `/admin/rate-limits`.
- Refresh button at L201-209 invalidates `['adminUsers', 'adminUsage', 'adminRevenue', 'adminKeys']`.

### 4.5 Middleware — does it 500? **NO, but UX bug**
- `app/src/middleware.ts` NEVER returns a 500. It only redirects to `/` with query params `?next=<path>&auth=required|expired`. Three redirect paths:
  - No cookie → `/?next=...&auth=required` (L28-32)
  - JWT verify fails → `/?next=...&auth=expired` (L46-50)
  - Missing JWT_SECRET in prod → `/` (L35-40, no query)
- **So the "500s" the user observes are NOT from the middleware.** Possible sources, in order of likelihood:
  1. **Landing page `app/src/app/page.tsx` 500s** after redirect: per AGENTS.md, the `siwe@3` package CJS-requires `ethers`. If `app/node_modules/ethers` is missing or stale, every page that imports `wallet-provider` (which imports `siwe`) fails webpack. AGENTS.md says: "500 on every public page → `/playground` (auth-walled) is the only one that may still respond." This is the **most likely root cause** of the "500 on /dashboard" report — the redirect itself succeeds, but the landing page the user is bounced to 500s because the public-bundle module graph is broken.
  2. **Login API route 500s**: `/api/auth/account/login` is a Next.js route handler. If it doesn't exist (e.g., not implemented yet) or throws on import, login 500s. The frontend shows a generic error.
  3. **Wallet provider / SIWE 500s**: if the user picks the wallet tab, the `useWallet()` hook may throw during SSR (it must be wrapped in dynamic). Check `app/src/components/wallet-provider.tsx`.
- **HIGH UX bug regardless**: middleware redirects to `/` (landing), not `/login`. The user lands on a marketing page with an `AuthNotice` banner (app/src/components/AuthNotice.tsx) that says "Connect a wallet to continue to <path>" but the landing page has no obvious "Connect" CTA in the hero. The user has to hunt for a "Connect Wallet" link in the navbar. **Fix**: redirect to `/login?next=<path>` instead of `/`.

### 4.6 Other auth observations
- CSRF token is fetched on modal mount (account-login-modal.tsx:42-54) and then written to a cookie via `setCsrfTokenCookie(response.token)` (L46). The `getCsrfToken` API endpoint must return `{ token: string }`. CSRF header is sent on login (L102) but NOT on the create-account request (L125-154) — **MED inconsistency**. Create-account is more sensitive than login and should also send CSRF.
- `createAccount` requires an existing session (`Authorization: Bearer ${token}` at L138), then generates a new account number. Modal switches to `success` mode showing the number (L147-148) with copy button. Then `handleDone` (L164) calls `onClose` which is a no-op in inline mode (login page). After done, the user must manually navigate. **MED UX**: should auto-redirect to `next`.
- `handleCreate` is `useCallback(() => {}, [])` (L125) with empty dep array — `getSessionToken()` is called lazily inside, so this is fine.

---

## Summary — prioritized fix list

| Sev   | Area | File:Line | Issue | Fix |
|-------|------|-----------|-------|-----|
| CRIT  | stream | server/src/inference/base.ts:65 | Upstream not aborted on client disconnect | Chain inbound `requestSignal` into `AbortSignal.any` |
| HIGH  | stream | app/src/app/playground/page.tsx:291-313 | SSE parser splits on `\n` not `\n\n`; no cross-chunk JSON buffer | Buffer partial lines, split on `\n\n` events |
| HIGH  | stream | server/src/inference/router.ts:140 | Missing `X-Accel-Buffering: no` | Add header |
| HIGH  | pg | app/src/components/playground/ChatMessage.tsx:48-66 | Hardcoded 17 models, stale IDs | Fetch `/v1/models` live, populate dropdown |
| HIGH  | pg | app/src/app/playground/page.tsx (whole) | No system prompt UI | Add SYSTEM field, inject as first message |
| HIGH  | auth | app/src/lib/cookies.ts:40 | `setSessionCookie` writes HttpOnly via `document.cookie` (silently dropped) | Set cookie via `Set-Cookie` from server login response |
| HIGH  | auth | app/src/middleware.ts:28 | Redirects to `/` not `/login` | Redirect to `/login?next=...` |
| HIGH  | auth | (likely) | `siwe@3` + missing `ethers` → 500 on public pages per AGENTS.md | Verify `app/node_modules/ethers` present |
| HIGH  | auth | app/src/components/account-login-modal.tsx:125-154 | `handleCreate` omits CSRF header | Add `x-csrf-token` |
| MED   | stream | server/src/inference/stream-tracker.ts:127, 130 | Trailing buffer not flushed on `done`; splits on `\n` not `\n\n` | Flush last partial line, event-based split |
| MED   | auth | account-login-modal.tsx:164-166 | After create success, no auto-redirect to `next` | `router.replace(next)` after success |
| MED   | stream | server/src/routes/chat/completions.ts:118 | Legacy transform also splits on `\n` not `\n\n` | Same fix as primary |
| LOW   | stream | app/src/app/playground/page.tsx:307 | `tokenCount += 1` per delta is approximation | Use server-reported `usage.completion_tokens` (already sent, parse from final chunk or X-Usage header) |
| LOW   | stream | server/src/inference/stream-tracker.ts:164-178 | Backpressure polling loop | Use `TransformStream` |

---

*End of report.*
