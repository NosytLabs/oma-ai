# OMA-AI Audit V6 — Inference Routing & Gateway (2026-06-14)

**Auditor:** Planner D (read-only, no source modifications)
**Scope:** `server/src/inference/{router,call-provider,provider-factory,provider-selector,provider-health,cheaptokens,surplus,models}.ts`, `server/src/x402/{facilitator,crosschain,types}.ts`, `server/src/{config,index,constants}.ts`, `server/.env.example`.
**Method:** Direct file read + cross-reference with `call-provider.ts`, `provider-selector.ts`, and route mount order in `index.ts`. No code was modified.

---

## Summary Table

| # | Severity | Area | Issue | File:Line |
|---|----------|------|-------|-----------|
| 1 | **HIGH** | x402 routing | `POST /v1/x402/proxy/chat/completions` is mounted twice — the 501 stub in `x402/facilitator.ts` shadows the real implementation in `x402/crosschain.ts`. Cross-chain inference is **unreachable** in production. | `x402/facilitator.ts:791` vs `x402/crosschain.ts:373`, mount order `index.ts:140-141` |
| 2 | **HIGH** | Config / docs | `.env.example` documents 4 env vars (`X402_FACILITATOR_MARGIN_PERCENT`, `X402_QUOTE_TTL_SECONDS`, `X402_QUOTE_LOCK_TTL_SECONDS`, `X402_MAX_QUOTE_CACHE_SIZE`) that **do not exist in `config.ts`**. Operators will set them and get no effect. | `.env.example:170-173` vs `config.ts` (no matching keys) |
| 3 | **HIGH** | Config / docs | `ONRAMP_QUOTE_CACHE_TTL_MS=86400000` (24h) in `.env.example` but `config.ts` default is `600000` (10 min). Same env var, two conflicting documented defaults. | `.env.example:157` vs `config.ts:119` |
| 4 | **MED** | Inference | `inferProviderFromModel` (`provider-selector.ts:14-26`) has an `OPENSOURCE_PREFIXES` loop whose only branch is `return "antseed"`, and the fallthrough is also `return "antseed"`. The loop is functionally a single line. | `provider-selector.ts:12-25` |
| 5 | **MED** | Inference | `call-provider.ts:66-68` has a default `else` branch that calls `litellm.chatCompletion` for any provider not matched. A typo in a Provider name (e.g. `"venie"`) silently routes to LiteLLM. | `call-provider.ts:48-68` |
| 6 | **MED** | Inference | `provider-factory.ts` type union includes `"tinyfish"` (lines 15, 77) but `ALL_PROVIDERS` in `provider-selector.ts:10` does **not**. Tinyfish is documented as a provider but not in routing. | `provider-factory.ts:15,77` vs `provider-selector.ts:10` |
| 7 | **MED** | x402 / Surplus | `surplus.ts:282-364` `signPayment()` uses dynamic `await import("viem")` + `await import("viem/accounts")` + `await import("viem/chains")` inside the function. Adds 100-300ms latency on first call (module resolution + parse). Top-level imports would amortize this. | `surplus.ts:318-320` |
| 8 | **MED** | x402 security | `/x402/verify` endpoint (facilitator.ts:669-704) accepts any valid USDC transfer regardless of who the `payee` is — it only checks the tx happened, not that the merchant received it. The settle route pins the payee, but verify is the public-facing entry point and is rate-limited (10/min) but unauthenticated. Could be used to "launder" a free verification receipt for an arbitrary tx. | `facilitator.ts:669-704` |
| 9 | **MED** | x402 / mock-mode | `/x402/pay-req-test` (facilitator.ts:745) and `/x402/middleware-test` (facilitator.ts:782) both fall back to `0x0000…0000` if `HOUDINI_ADDRESS_TO` is unset. In dev with `FACILITATOR_MODE=mock` and no env vars set, a curl to these routes returns 402 pointing at the zero address as the merchant. Could be confusing in misconfigured prod. | `facilitator.ts:748, 784` |
| 10 | **MED** | Inference | `call-provider.ts:90-91, 99-105` attaches the full `requestBody` (including user prompts) to the thrown error and to the structured log. Sensitive PII / prompts will land in error logs. | `call-provider.ts:90-96, 99-106` |
| 11 | **MED** | x402 routing | `facilitator.ts:805-807` — malformed `X-PAYMENT` JSON header in the proxy endpoint is silently swallowed (`catch {}`) and the request falls through to 501. Should 400. | `facilitator.ts:805-807` |
| 12 | **LOW** | Inference | `provider-selector.ts:12` `OPENSOURCE_PREFIXES` contains `"minimax"` — looks like a typo for some other model family (MiniMax?). This silently routes requests starting with `"minimax"` to Antseed. Worth confirming the intent. | `provider-selector.ts:12` |
| 13 | **LOW** | Inference | `provider-selector.ts:12` `OPENSOURCE_PREFIXES` includes `"antseed/"` as a prefix mapping to "antseed" — but the Antseed provider expects raw model names (e.g. `"llama-3-70b"`), not `"antseed/llama-3-70b"`. The path-stripping is only in `getModelIdForProvider` for `litellm/`. So `"antseed/llama-3-70b"` would be sent to Antseed as the literal model id `antseed/llama-3-70b`, which Antseed will reject. | `provider-selector.ts:12`, `getModelIdForProvider` `provider-selector.ts:46-50` |
| 14 | **LOW** | x402 | `surplus.ts:15-22` clamps `minDiscountPct` to 0-90 (returning 0 out-of-range) but `config.ts:178` allows 0-100. Same input validated by two different rules. | `surplus.ts:15-22` vs `config.ts:178` |
| 15 | **LOW** | x402 / Settlement | `atomicCacheSet` (`facilitator.ts:136-149`) uses `setTimeout` recursion as a lock. If the process exits mid-recursion, the cache write is lost. A real mutex / `Map` is fine since this is single-process JS. | `facilitator.ts:136-149` |
| 16 | **LOW** | x402 | `addSettlementToDlq` (`facilitator.ts:564`) is called with `lastError?.message` as the 4th argument; the DLQ helper expects an error string but the parameter naming at the call site is opaque. | `facilitator.ts:564` vs `lib/dlq.ts` |
| 17 | **INFO** | Inference | `OPENSOURCE_PREFIXES` (22 entries) is checked after the 7 explicit prefix checks. Every miss falls through to the default `return "antseed"` at line 25. Net effect: any unknown model is sent to Antseed. The loop is logically equivalent to `if (!any prefix matched) return "antseed"`. See issue #4. | `provider-selector.ts:14-26` |
| 18 | **INFO** | Inference | `provider-health.ts:323-338` exports `reserveProvider` / `releaseProvider` (used in tests but **never called from production code**). Same for `recordTraffic` (line 340) — defined but unused outside the test file. | `provider-health.ts:323, 331, 340` |
| 19 | **INFO** | x402 | `x402/facilitator.ts:847-849` documents the naming collision between x402 routes and the Houdini crosschain routes. The two routers both register `POST /v1/x402/proxy/chat/completions` and `POST /v1/x402/quote` (in different modules). The Houdini one is mounted second and so loses route conflicts — see issue #1. | `facilitator.ts:847-849` and `crosschain.ts:80, 176, 250, 347, 357, 373` |
| 20 | **INFO** | Config | `MAX_CACHE_SIZE` for `settlementCache` is `1_000` (facilitator.ts:112) but `settlementInProgress` is capped at `1_000` (facilitator.ts:431) — both are 1k but driven by separate constants. | `facilitator.ts:112, 431` |

---

## Section 1: Inference Routing

### 1.1 — Router entry & selection (server/src/inference/router.ts)

- **handleChatCompletion** (line 82) is the single entry point used by all 3 chat routes (`chat-completions.ts`, `completions.ts`, `chat-ws/index.ts`) and by `x402/crosschain.ts:444`. Single implementation, multiple call sites — good.
- **Caching:** no LRU on `getModel`, `getStakingDiscount`, `getModelPricing`, `getEstimatedOutputTokens`. Every request re-resolves pricing and token estimates from the DB / catalog. For high-RPS this is hot. (INFO, not a bug.)
- **Credit preflight refund on failure** (line 124): when streaming response body is null, refunds `estimatedCostCents` and throws 502. Correct.
- **Non-streaming refund** (line 75-76): `refund = parseInt(estimatedCostCents) - parseInt(actualCost.totalCents)` — `parseInt` truncates, so a 1.99-cent refund that should be 1.99 will be parsed as 1 cent and 1 cent will be lost. Same in `credit-preflight.ts:46`. (LOW — micro-cents leak, $1/1000/req = $0.10/1000 reqs.)

### 1.2 — call-provider.ts (server/src/inference/call-provider.ts)

- **All 9 named providers are explicitly matched** (lines 48-65) with a final `else` calling `litellm.chatCompletion`. The `else` is **functionally reachable only if `Provider` enum drifts** (e.g. someone adds `"foo"` to the type but not the switch). In that case the typo silently routes to LiteLLM. Suggestion: throw `Unknown provider: ${provider}` and let the upstream error surface.
- **Per-request correlationId is plumbed** (line 31) and attached to the error (line 94) and structured log (line 99-106). Good.
- **`requestBody` is attached to the thrown error AND the log line** (lines 90-91, 99-106). For a chat completions proxy this leaks user prompts into error logs. Suggestion: redact `messages`, `prompt`, `input` from the attached body. See issue #10.
- **Timeout is provider-level (config.PROVIDER_TIMEOUT_STREAM_MS / PROVIDER_TIMEOUT_NON_STREAM_MS)** — same timeout for every provider. Streaming is `120_000`, non-stream `60_000`. No provider-specific tuning. (INFO.)
- **Circuit breaker open path** (lines 36-43) throws 503 with `type: CIRCUIT_BREAKER`. Router will refund and re-throw. Good.
- **No client-side retry** — the breaker is provider-level, retries are provider-internal (via `withRetry` in `antseed.ts`, `litellm.ts`, `morpheus.ts`). Venice/OpenRouter/Together/DeepInfra do not appear to use `withRetry`. (INFO.)

### 1.3 — provider-factory.ts (server/src/inference/provider-factory.ts)

- **`createProvider<T>`** is the abstraction but **only `provider-factory.ts` itself uses it** in this codebase. The actual providers (`antseed.ts`, `litellm.ts`, `morpheus.ts`) extend `BaseInferenceProvider` directly and **do not call `createProvider`**. The factory is dead code in production. (LOW.)
- **`healthCheck` (lines 76-95) is exported and called by `provider-health.ts:356`** for the idle-probe path. Works.
- **"tinyfish" in the type union** (lines 15, 77) — no tinyfish routing in `call-provider.ts`. Drift. See issue #6.

### 1.4 — provider-selector.ts (server/src/inference/provider-selector.ts)

- **`ALL_PROVIDERS` is `const` (line 10)** — immutable list of 10 providers. Used by:
  - `getAvailableProviders()` (line 77) — iterates and calls `isProviderAvailable` for each
  - `selectFromWeights` (line 84) — uses the cached list
  - `selectProvider` (line 117) — fallback loop iterates and calls `isProviderAvailable` *again*, **bypassing the cache** (the cache is keyed by provider, not TTL-stamped, so subsequent calls do hit it — the redundant work is the `await ensureProviderRecord` DB read on cold start).
  - The dead `OPENSOURCE_PREFIXES` loop. See issues #4, #17.
- **`inferProviderFromModel` (lines 14-26)** is only called when `getModel(model)` returns null (line 97-98). So for any model in `models.json` catalog, `modelDef.primaryProvider` wins. For unknown models, "antseed" is the catchall. This is OK by design but the `OPENSOURCE_PREFIXES` loop is misleading because the default `return "antseed"` (line 25) always wins for non-matches.
- **`getAvailableProviders` cache** (line 70-82): 60s TTL, but `selectFromWeights` (line 86) reads this AND `selectProvider` (line 117-120) iterates `ALL_PROVIDERS` directly, calling `isProviderAvailable(p)` for each (which calls `ensureProviderRecord` → DB read on cold start). The two paths are inconsistent.

### 1.5 — provider-health.ts (server/src/inference/provider-health.ts)

- **Background probing is wired** (index.ts:70 calls `startBackgroundProbing()` which sets a 45s `setInterval` running `probeIdleProviders`). Probes only providers with no traffic in the last 60s. Good.
- **Circuit breaker is stateful** with CLOSED → OPEN (5 fails) → HALF_OPEN (60s cooldown) → CLOSED. Correct.
- **Redis is the source of truth for cross-process state**; the in-process `healthCache` is hydrated from Redis at startup. DB write happens every 30s via `syncProviderHealthToDb`. Multi-instance safe (per the design docstring).
- **`getProviderBaseUrl` and `getProviderHealthPath` (lines 364-393) hardcode the URLs.** If a provider changes their base URL or health path, you have to edit this file. The same hardcoding is duplicated in each provider's `*Provider` class. Suggestion: source-of-truth in `vendor-meta.ts` (which already has a `baseUrlEnv` field per provider).
- **`pendingRequests` is decremented only by `releaseProvider`** (line 331) — if a request crashes before release, the slot leaks. With MAX_PENDING_PER_PROVIDER=3, three crashed requests permanently disable a provider. (LOW.)
- **`reserveProvider` / `releaseProvider` are exported but never called outside tests** (grep confirms). See issue #18.

---

## Section 2: Provider Health & CheapTokens

### 2.1 — cheaptokens.ts (server/src/inference/cheaptokens.ts)

- **5-minute cache TTL** (line 85) is effective: `isStale = now - cachedAt > CACHE_TTL_MS` triggers a refresh on the next call. The 30s backoff (line 87) prevents tight retry loops. Both work.
- **`isRefreshing` lock** (line 82, 204) — only one refresh at a time. Good.
- **Daily USDC cap** (line 228-238): `CT_DAILY_USDC_CENTS_MAX` is checked BEFORE signing the on-chain transfer. If the cap is hit, the buy is skipped. Daily counter resets at UTC midnight. Per-process, not Redis-backed (documented in comment line 53-57). OK for single-instance.
- **`triggerRefresh` failure is swallowed** (line 194-196, `catch (err) { logger.error... }`) — no retry, no DLQ. If the upstream is down for the full TTL window, the cached key continues to be served until expiry.
- **`buyKey` in live mode** (line 122-168): requires `FACILITATOR_PRIVATE_KEY`, signs USDC transfer to `CHEAPTOKENS_ADDRESS || TREASURY_BASE_ADDRESS`, POSTs to `/api/buy` with `{usdPaid, networkId, payee, txHash}`. The placeholder checks (line 127-128) reject `0x0000…0000` and `0x3333…3333` (the placeholder for TREASURY_BASE_ADDRESS default). Good.
- **Mock mode** (line 113-120) returns a fake key + 24h expiry. Safe for dev.
- **The `getActiveVeniceKey` function** (line 173-201) is the only public consumer of the cache. It's called from `venice.ts` (per the `getActiveVeniceKey` import in the diff). Cache is single-process; if multiple instances run, each pays for its own key. (INFO — documented limitation.)

### 2.2 — surplus.ts (server/src/inference/surplus.ts)

- **402-then-retry pattern** (lines 154-217): probe → 402 → parse PAYMENT-REQUIRED → build payload → sign → retry. Three sub-spans, correct tracing.
- **`clampMinDiscountPct` (lines 15-22)** clamps to 0-90 but config schema allows 0-100. See issue #14.
- **`signPayment` does NOT check that `payTo === config.HOUDINI_ADDRESS_TO`** before signing — it just signs whatever `_payload.payTo` says. The comment block (line 302-311) explicitly tracks this as a known issue (`github.com/oma-ai/oma-ai/issues/surplus-x402-schemes`). The verifier is now `0x0770…c137` (settlement proxy), not the recipient.
- **Dynamic `import("viem")` inside signPayment** (line 318-320). 3 separate dynamic imports per call. Top-level import would amortize. See issue #7.
- **Surplus health check** (lines 414-459) is wired into `provider-health.ts:351-358` — uses the special-case branch. Works.

---

## Section 3: x402 Gateway

### 3.1 — facilitator.ts (server/src/x402/facilitator.ts)

- **Routes mounted in this file (line 667+):**
  - `POST /x402/verify` (line 669) — public, rate-limited 10/min/IP. No auth. Returns 200/422 based on `verifyPayment`. Payee is NOT pinned. See issue #8.
  - `POST /x402/settle` (line 706) — requires `sessionAuth`. Pins `payee` to `HOUDINI_ADDRESS_TO || TREASURY_BASE_ADDRESS`. Good.
  - `POST /x402/pay-req-test` (line 745) — test helper, returns 402 with mock payment-required.
  - `POST /x402/middleware-test` (line 787) — protected by `paymentMiddleware` with `$0.50` price.
  - **`POST /v1/x402/proxy/chat/completions` (line 791)** — **STUB RETURNS 501**. This shadows the real implementation in `crosschain.ts:373`. See issue #1.

- **Mount order in `index.ts`:**
  - line 140: `app.route("/", x402Routes);`   ← 501 stub lands first
  - line 141: `app.route("/", crosschainRoutes);`   ← Real proxy is unreachable
  - Hono's `route()` does NOT raise a duplicate-route error. The first match wins.

- **`mockVerifyPayment`** (lines 355-374) accepts any signature and returns a valid 200. Only safe because `config.ts:225-227` throws if `FACILITATOR_MODE=mock` is used in production. Good.
- **`verifyEvmPayment` (lines 207-345):**
  - Verifies `tx.to === USDC_BASE`
  - Verifies `tx.from === payload.payFrom`
  - Decodes calldata, checks `transfer` / `transferFrom`
  - Checks `recipient === payload.payee`
  - But does NOT check `payload.payee === config.HOUDINI_ADDRESS_TO` (the merchant). So a verify request can validate a USDC transfer to *any* address. As noted in #8.
- **`settlePaymentAsync`** (line 443): idempotency via Redis lock + in-progress map + DB unique-constraint handling. The flow is correct but the duplicate-receipt prevention relies on `cacheLock` + `inProgressGeneral` (lines 493-497) and the same Redis lock. Two concurrent calls for the same `settleKey` will serialize. Good.
- **Receipt signing** (line 163-189) uses HMAC-SHA256 with `RECEIPT_HMAC_SECRET`. In production the placeholder is rejected (config.ts:252-255). Good.
- **`atomicCacheSet` (lines 136-149) uses `setTimeout` recursion** as a mutex. JS is single-threaded so this works, but a real `Promise`-based lock would be cleaner. See issue #15.

### 3.2 — crosschain.ts (server/src/x402/crosschain.ts)

- **Routes:**
  - `POST /v1/x402/quote` (line 80) — Houdini cross-chain deposit quote.
  - `POST /v1/x402/deposit` (line 176) — creates a Houdini exchange order.
  - `GET /v1/x402/deposit/:orderId/status` (line 250) — polls order status, validates block confirmations, calls `verifyPayment` and `settlePayment` on success.
  - `GET /v1/x402/chains` (line 347), `GET /v1/x402/tokens` (line 357).
  - **`POST /v1/x402/proxy/chat/completions` (line 373)** — bearer-auth + rate-limit, requires `X-Houdini-Order-Id` header, looks up the order, verifies payment, then calls `handleChatCompletion`. **This is the working implementation**, but it's shadowed by facilitator.ts's 501 stub. See issue #1.

- **Quote cache eviction** (lines 142-153): scans Redis with MATCH `quote:*` to count keys. SCAN with COUNT=100. After 1000 quotes, evicts the 10 oldest. The eviction is by key sort order, not actual age. Could evict hot keys. (LOW.)
- **Lock ownership check** (lines 202-206): compares Redis lock value to the requestId captured at acquire time. Defends against stale locks. Good.
- **`mapHoudiniStatus` (lines 474-499):** mapping for FINISHED / FAILED / EXPIRED / REFUNDED / WAITING / CONFIRMING / EXCHANGING / ANONYMIZING. Logs refund events. Good.
- **`checkBlockConfirmations` (lines 501-527):** reads current block + receipt, computes confirmations. Returns `confirmed: false` on error. Good.
- **`settlePayment` (sync, line 588) is called for the x402 proxy path** (crosschain.ts:424) without awaiting — fire-and-forget. The return value is ignored. The receipt is later retrieved via `settlementReceipt(orderId)` (line 470) which calls `getSettlementReceipt` (facilitator.ts:642). If the async DB write races, the receipt might not be in the cache yet. (LOW — race window is ms-scale.)

### 3.3 — types.ts (server/src/x402/types.ts)

- **Duplicate of types in `facilitator.ts`** — `PaymentPayload`, `PaymentSignature`, `PaymentRequired`, `PaymentResponse`, `SettlementRecord`, `SettlementResponse`, `PaymentMiddlewareConfig` are defined in BOTH files. The types in `facilitator.ts` declare `scheme: "evm"` only, while `types.ts` declares `scheme: "evm" | "solana"`. Drift. (LOW.)
- **`SolanaInstruction` / `SolanaRpcResponse`** (lines 69-91) are defined but never imported anywhere in the codebase. Grep confirms zero usages. Dead code. (LOW — could be cut.)

---

## Section 4: Config + Env

### 4.1 — config.ts (server/src/config.ts)

- **Production guards are in place** (lines 220-267): CSRF_SECRET, JWT_SECRET, RECEIPT_HMAC_SECRET, FACILITATOR_MODE, TREASURY_BASE_ADDRESS, DATABASE_URL are all validated. Good.
- **JWT_SECRET minimum 40 chars in prod** (line 242) — `.env.example` has `your-40-char-secret-key-here-minimum` which is 38 chars (would fail). Minor.
- **Four env vars in `.env.example` don't exist in the schema** (see #2). The schema is authoritative (config.ts is read at module load), so setting them has no effect.
- **One env var has conflicting defaults** (see #3): `ONRAMP_QUOTE_CACHE_TTL_MS`.
- **JWT_SECRET default is `"dev-secret-change-me-in-prod-32ch"`** (line 71), which is exactly 32 chars. The validation says `min(32)` (line 71) which passes, but in production the dev secret is rejected (line 237-239) AND must be 40+ chars (line 242). So the dev default works for dev (≥32), fails for prod (matches INSECURE_DEFAULTS). Good.
- **ENCRYPTION_KEY default is `"dev-encryption-key-32-chars-min-for-dev"`** (line 72) — NOT in the INSECURE_DEFAULTS list (line 4-10) so even in prod, setting ENCRYPTION_KEY to a wrong value still works if it's ≥32 chars. This is a weaker check than for JWT_SECRET. (LOW — TOTP 2FA secrets are encrypted with this key, so a weak prod key is a real risk.)

### 4.2 — .env.example (server/.env.example)

- **Missing env vars referenced in source but not documented:**
  - `SOLANA_RPC_URL`, `SOLANA_RPC_URL_FALLBACK` (config.ts:64-65)
  - `TRUSTED_PROXY_IPS` (config.ts:158)
  - `BEDROCK_*` (config.ts:49-51) — Bedrock provider (likely never wired)
  - `GROQ_API_KEY`, `CEREBRAS_API_KEY` (config.ts:45-46) — likely never wired
  - `SURPLUS_VERIFIER_CONTRACT` (config.ts:183) — documented (line 196)
  - `OMA_API_KEY`, `OMA_AGENT_KEY` — documented (lines 134-140)
  - `OTEL_*` (config.ts:127-129) — not documented at all

- **Env vars documented but missing from schema** (issue #2):
  - `X402_FACILITATOR_MARGIN_PERCENT` (line 170)
  - `X402_QUOTE_TTL_SECONDS` (line 171)
  - `X402_QUOTE_LOCK_TTL_SECONDS` (line 172)
  - `X402_MAX_QUOTE_CACHE_SIZE` (line 173)
  All four are hardcoded constants in `crosschain.ts` (lines 23, 24, 27, 26). Either the docs are aspirational, or someone needs to add them to the schema.

- **Comment drift:**
  - `FACILITATOR_MODE=production` (line 81) — but the schema is `z.enum(["mock", "live"])` (config.ts:66). The doc value `production` would fail validation. **Operators copying this file will get a startup crash.**
  - `ONRAMP_QUOTE_CACHE_TTL_MS=86400000` (line 157) — 24h, but config.ts default is 10 min (line 119). Inconsistent.

- **Undocumented dev-only / internal envs referenced in code:**
  - `RATIO_SYNC_RUN_IMMEDIATELY` (referenced in `server/src/jobs/ratio-sync-cron.ts:50`)
  - `DEBUG_STREAM` — in schema (config.ts:77) but not in `.env.example`

### 4.3 — constants.ts (server/src/constants.ts)

- **`USDC_BASE` (line 1)** = `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base mainnet USDC). Matches Coinbase x402 v2 spec. Good.
- **`PLACEHOLDER_ADDRESSES` (line 6-11)** includes `0x3333…3333` (which is the **default** for `TREASURY_BASE_ADDRESS` in config.ts:69). The production guard correctly rejects this. Good.
- **CACHE_TTL_MS = 86_400_000 (24h)** (line 22) — used in `facilitator.ts:119` for `cleanExpiredCache`. 24h is a long time to keep settled records in memory; only the receipt would still be valid (RECEIPT_EXPIRY_SECONDS is 365 days, line 27). (INFO.)

---

## Section 5: Models Catalog

### 5.1 — models.ts (server/src/inference/models.ts)

- **17 fallback models** (lines 69-359). All have a `provider` field that maps to a real wired provider. All have a `primaryProvider` matching `provider` (or "both"/"all" for the dual-routed ones — but I see none of those in FALLBACK).
- **No dead models:** every model in FALLBACK_MODELS has at least one `{provider}Id` field set AND a matching wired provider in `call-provider.ts`.
- **Models loaded from `models.json`** (line 397-410): file-path configurable via `MODELS_CONFIG_PATH`. If the file is missing, falls back to the 17 in-code models. The catalog is `Record<string, ModelDef>` and `getModel` does a `MODEL_CATALOG[modelId] ?? null` lookup.
- **`__setModelCatalog` (line 539-544)** is a test-only hook. Documented in the comment. Used in isolated tests. Good.
- **`MODEL_CATALOG` and `VIDEO_MODELS` are `export let`** (lines 66-67) — mutable module-level. Reassigned in `reloadModelCatalog`. Not a race in single-process but worth noting. (INFO.)
- **Video models** (lines 361-386): only `venice` is listed as provider. The `seedance-2-0-text-to-video` and `kling-v3-pro-text-to-video` would call `venice.chatCompletion` if routed — but video generation is a separate code path, not chat completions. (INFO.)

---

## Section 6: Server Entry

### 6.1 — index.ts (server/src/index.ts)

- **Health endpoint lives in `routes/health.ts`** (line 33 import) — `/health`, `/ready`, `/live`, `/version`. Mounted at `app.route("/", healthRoutes)` (line 129), BEFORE the auth-protected routers. Good (comment at line 123-128 documents the reason).
- **Mount order for x402 routers** (lines 140-141) is the source of issue #1. The 501 stub lands first.
- **Background jobs started on boot** (lines 67-81): `initProviderResultReporter`, `startBackgroundDbSync`, `startBackgroundProbing`, `startCacheCleanup`, `scheduleCreditExpiry`, `scheduleSubscriptionCheck`, `scheduleNonceCleanup`, `scheduleDepositRetry`, `scheduleWrongNetworkRecovery`, `scheduleDepositNotifications`, `triggerCheapTokensRefresh`. All gated by `NODE_ENV !== "test"`. Good.
- **Shutdown** (lines 192-219) stops: background DB sync, background probing, cache cleanup, queue processor. Closes Redis. 10s forced timeout. Does NOT stop scheduled cron jobs (`scheduleCreditExpiry` etc.) — they have their own cleanup that the shutdown might not call. (LOW.)
- **CORS** (lines 94-119): explicit allowlist parsing via `new URL(allowed).origin`. Wildcard `"*"` is logged and denied credentials. Good.
- **Correlation ID** (lines 85-90) generated per-request and set on `c.set("correlationId")` + returned in `X-Request-ID` header. Good.
- **Error handler** (lines 167-179): maps `HTTPException` to its own response, others to 500/422. `errWithStatus.status` is read but a 500 fallback is used. Good.

### 6.2 — Provider summary

| Provider | Wired in call-provider.ts? | Health check? | Models in catalog? | Env vars required |
|----------|---------------------------|---------------|---------------------|-------------------|
| venice | ✅ | ✅ | 5 | VENICE_API_KEY |
| antseed | ✅ | ✅ | 0 (all use literal prefix routing) | ANTSEED_PROXY_URL |
| litellm | ✅ | ✅ | 0 | LITELLM_PROXY_URL (+optional API key) |
| openrouter | ✅ | ✅ | 4 (incl. 3 free/* + gpt-4o-mini) | OPENROUTER_API_KEY |
| together | ✅ | ✅ | 1 (llama-3.3-70b-together) | TOGETHER_API_KEY |
| deepinfra | ✅ | ✅ | 0 | DEEPINFRA_API_KEY |
| morpheus | ✅ | ✅ | 0 | MORPHEUS_API_KEY |
| claude | ✅ | ✅ | 4 (claude-3.5-sonnet, -haiku, sonnet-4, opus-4) | ANTHROPIC_API_KEY |
| gemini | ✅ | ✅ | 4 (gemini-2.5-pro, -flash, both thinking variants) | GEMINI_API_KEY |
| surplus | ✅ | ✅ (special) | 0 | (uses wallet signer) |
| tinyfish | ❌ (in factory type only) | ❌ | 0 | TINYFISH_API_KEY |
| bedrock | ❌ (env vars only, no code) | ❌ | 0 | BEDROCK_* |
| groq | ❌ (env vars only, no code) | ❌ | 0 | GROQ_API_KEY |
| cerebras | ❌ (env vars only, no code) | ❌ | 0 | CEREBRAS_API_KEY |

**Action items:**
- Either wire `tinyfish` (mentioned in `.env.example:39-40` as "Web search MCP") into `call-provider.ts` and `provider-selector.ts`, or remove the dead type union and env var.
- Either wire `bedrock` / `groq` / `cerebras` (their env vars are in `config.ts` but no code references them) or remove from the schema. The code grep `grep -r "BEDROCK_\|GROQ_API_KEY\|CEREBRAS_API_KEY" server/src/inference/` returns no matches.

---

## Recommended Fix Priority

1. **Issue #1 (HIGH)** — `x402` route shadowing. Re-mount the crosschain proxy route at a non-conflicting path (e.g. `/v1/x402/crosschain/proxy/chat/completions` per the rename plan in the v2 comment block), OR remove the 501 stub from `x402/facilitator.ts` since `x402/crosschain.ts:373` is the real implementation. Critical: the cross-chain inference flow is currently dead.
2. **Issue #2 (HIGH)** — Either add the 4 `X402_*` env vars to `config.ts:139-143` (with `parseFloat` / `int().min().default(...)` validators) OR remove them from `.env.example:170-173`. The docs are currently a trap.
3. **Issue #3 (HIGH)** — Reconcile the `ONRAMP_QUOTE_CACHE_TTL_MS` defaults: 24h in `.env.example` vs 10min in `config.ts`. Pick one.
4. **Issue #8 (MED)** — `/x402/verify` should pin the merchant payee. Currently any valid USDC transfer verifies.
5. **Issue #5 (MED)** — Add `throw new Error(...)` to the `else` branch in `call-provider.ts:66-68` so unknown providers surface immediately.
6. **Issue #10 (MED)** — Redact `messages` / `prompt` / `input` from the request body before attaching to the error in `call-provider.ts:90-106`.
7. **Issue #6 (MED)** — Either wire `tinyfish` end-to-end or remove the dead code. Same for `groq` / `cerebras` / `bedrock` env vars.
8. **Issue #7 (MED)** — Hoist `viem` imports in `surplus.ts:318-320` to the top of the file.
9. **Issue #11 (MED)** — Malformed `X-PAYMENT` in `facilitator.ts:805-807` should 400, not fall through to 501.
10. **Issues #12-16 (LOW)** — All single-line cleanups.

---

## Files Read (for traceability)

- `server/src/inference/router.ts` (163 lines)
- `server/src/inference/call-provider.ts` (108 lines)
- `server/src/inference/provider-factory.ts` (97 lines)
- `server/src/inference/provider-selector.ts` (137 lines)
- `server/src/inference/provider-health.ts` (409 lines)
- `server/src/inference/cheaptokens.ts` (261 lines)
- `server/src/inference/surplus.ts` (468 lines)
- `server/src/inference/antseed.ts` (78 lines)
- `server/src/inference/litellm.ts` (88 lines)
- `server/src/inference/morpheus.ts` (142 lines)
- `server/src/inference/models.ts` (543 lines)
- `server/src/x402/facilitator.ts` (964 lines)
- `server/src/x402/crosschain.ts` (528 lines)
- `server/src/x402/types.ts` (91 lines)
- `server/src/config.ts` (319 lines)
- `server/src/index.ts` (225 lines)
- `server/src/constants.ts` (31 lines)
- `server/.env.example` (196 lines)
