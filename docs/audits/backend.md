# OMA-AI backend audit (2026-09-27, read-only)
Scope: server/src (payments, settlement, auth, inference, rate limits, x402). Priority: P0 money correctness, P1 access control, P2 ledger consistency, P3 hygiene.
Source: scoped read-only session. All items below are verified against current HEAD. Repo paths are repo-root relative unless noted.

## P0 — money / correctness

### [B-1] Streamed /v1/messages is never billed or recorded
File: server/src/routes/anthropic/index.ts:128-277,347-353
createAnthropicStream lacks recordUsage entirely. Streaming branch drops billing: clients get full completion, operator absorbs upstream cost, no usage_records row written. The non-streaming branch (line 355) DOES bill correctly. Additionally the normal-completion path hardcodes usage: {output_tokens: 0} at line 162, so anthropic-SDK consumers see zero usage even when billed properly — leaves metering blind.
Impact: unbilled Claude Code / Anthropic-SDK traffic = direct revenue leak; silent because non-streaming is what the tests cover.
Fix: call recordUsage from the streaming close path with the usage from the final message_delta, and fix the hardcoded output_tokens: 0.
Severity: P0 (money)
Status: OPEN

### [B-2] x402 verify cache replay window can be bypassed with validBefore=0
File: server/src/x402/verify.ts:279-321
verifyPayment short-circuits {valid:true} on cache-hit BEFORE consumeNonce. Only the pre-cache expiry check at 306 guards: "if (payload.validBefore && now > payload.validBefore)". Because payload.validBefore = 0 is falsy, that check is skipped entirely for the value 0. The signed-window clamp at 286-292 only LOWERS validBefore when BigInt(payload.validBefore) > signedBefore; 0 > signedBefore is false, so 0 stays 0.
Impact: a captured (signature, nonce) pair with validBefore: 0 replays indefinitely through the 24h cache — no nonce consumption, no window check.
Fix: compare explicitly (payload.validBefore !== undefined) instead of truthiness.
Severity: P0 (replay)
Status: OPEN

### [B-3] order.paid returns 200 even when the credit cannot be applied
File: server/src/routes/polar.ts:392-410
If userId or credits is missing the handler logs a warning and falls through to return c.json({ok:true}) at line 470 without calling markEventProcessed or processInTransaction. Polar sees 200 and STOPS retrying. The customer paid real money and never got credited. There is no repair job for rows stuck processed=0.
Fix: on missing userId/credits return 5xx so Polar retries the webhook.
Severity: P0 (revenue)
Status: OPEN

### [B-4] Double/triple credit from subscription events
File: server/src/routes/polar.ts:423-449
subscription.created, subscription.active, subscription.updated all credit when status==="active". A single active subscription firing created → active → updated (metadata edit, plan touch) grants the full allocation up to 3x. processed dedup runs per event id, not per subscription-period.
Severity: P1 latent (products are one-time today, but the code is live)
Status: OPEN

### [B-5] Client-aborted streams are free
File: server/src/inference/streaming.ts:48-115
recordUsage is only in the done branch (line 64). cancel() (111) and read-error path (100-109) never bill. A client can consume most of a completion and disconnect before done, paying nothing while upstream tokens are consumed. Error path sets upstreamStatus="error" at 109 but never uses it.
Fix: record partial usage on cancel/error with tokens-so-far.
Severity: P0 (revenue leak)
Status: OPEN

## P1 — auth / access control

### [B-6] optionalAuth has no suspension check
File: server/src/auth/middleware.ts:326-366
rejectIfSuspended is invoked from bearerAuth (222), sessionAuth (283), sessionOrBearerAuth (309) but NOT optionalAuth. optionalAuth guards POST /v1/chat/completions (routes/chat/index.ts:113) and GET /v1/usage/today (routes/daily-usage.ts:26). A suspended or banned user retains full chat access via session-cookie path.
Fix: rejectIfSuspended(c) early in optionalAuth when a session resolves.
Severity: P1
Status: OPEN

### [B-7] x-real-ip trusted unconditionally, spoofable
File: server/src/middleware/rate-limit/utils.ts:101,130,149
When TRUSTED_PROXY_IPS is empty (production default), extractClientIp returns xRealIp with no proxy authentication. An attacker rotating X-Real-IP gets unlimited anonymous buckets, defeating the 20/day free tier and per-minute limiter. spoofable-x-forwarded-for.test.ts:93 asserts the current behaviour as intended — the test locks the bug in.
File-status impact: the audit's own tax report says the Vercel /api proxy starts the trust chain; the right fix is x-real-ip SHOULD be trusted only when a trusted proxy header chain is present.
Severity: P1 (abuse)
Status: OPEN

### [B-8] CSRF origin guard misses most cookie-auth mutations
File: server/src/index.ts:407-416
Guard covers /v1/keys*, /v1/history, /sessions* only. Unguarded: DELETE /account (routes/auth.ts:196), POST /v1/deposit/usdc and /challenge (routes/deposit/index.ts:121,182), POST /v1/checkout (routes/polar.ts:125), and ALL POST /v1/admin/* (routes/admin.ts:43,119,188,244).
Impact: SameSite=Lax blocks cross-site POSTs but not same-site sibling-origin or widened-cookie-domain CSRF. Admin credit-adjust and suspend ride the admin's cookie today.
Fix: add "/v1/admin/*" and "/account" to the loop at index.ts:408-414. One-line fix.
Severity: P1
Status: OPEN

### [B-9] originGuard ignores scheme and port semantics
File: server/src/middleware/origin-guard.ts:42-53,79-82
hostMatches compares URL.host (with port) after stripping www. and never compares protocol — http://www.oma-ai.com is accepted for an https:// entry. Referer (full URL) never matches the candidate===a fast path, so Referer requests always go through scheme-blind compare.
Fix: compare URL.protocol too.
Severity: P2
Status: OPEN

## P2 — ledger consistency

### [B-10] Two sources of truth for free-tier quota, different day boundaries
Enforcement: middleware/daily-limit.ts:66 — UTC ISO date slice.
Display: routes/daily-usage.ts:36-38 — server-local setHours(0,0,0,0).
Redis down ⇒ middleware falls back to per-process memory (daily-limit.ts:60-64) while UI still reports DB-derived number. UI can show remaining that the limiter will reject.
Fix: both use UTC date; fallback counter writes the same state/UI path.
Severity: P2
Status: OPEN

### [B-11] Admin credit-adjust can push negative + breaks totalUsedCents
File: server/src/routes/admin.ts:144-162
No floor on deltaCents decrement (refund path uses GREATEST(...,0) at polar.ts:570). Insert branch can create row already negative. totalUsedCents not incremented on deduction ⇒ diverges from ledger.
Fix: floor to 0 and increment totalUsedCents when deltaCents < 0.
Severity: P2
Status: OPEN

### [B-12] Idempotency key truncation collision
File: server/src/routes/chat/index.ts:201-203
requestId = "idem-${userId}-${idempotencyKey}".slice(0,200). With 36-char userId leaves ~163 char keys; two distinct long keys sharing that prefix resolve to the same requestId and the cache-hit branch (206-245) replays the OTHER request's usage. No unique index on usage_records.request_id.
Fix: hash instead of truncate; add unique index.
Severity: P2
Status: OPEN

### [B-13] Preflight vs billed-model mismatch on fallback
File: routes/chat/index.ts:256 vs 279
Preflight prices requested model; billed model is actualModelId. A cheap-request → expensive-failover can pass preflight, then bill higher. Conditional UPDATE in billing.ts:96-102 is the real guard — bounded, but the 402 gate is misleading.
Severity: P3
Status: OPEN

### [B-14] Transient catalog fetch failure permanently pins fallback
File: app/src/lib/models-data.ts:472-486,554-558
_rawPromise assigned once; .catch(() => null) resolves null permanently. loadModels' catch returns MODELS but never rejects or resets _loadPromise or _rawPromise. One failed /api/v1/models request pins the browser session to stale SSR fallback for prices.
Fix: reset the promise in the catch.
Severity: P2
Status: OPEN

## P3 — security hygiene

### [B-15] Live production secrets at rest in two plaintext files
- server/.env (gitignored): NODE_ENV=development, FACILITATOR_MODE=mock, plus REAL FACILITATOR_PRIVATE_KEY (EIP-3009 treasury signer), REAL POLAR_ACCESS_TOKEN / POLAR_WEBHOOK_SECRET, RESEND_API_KEY, DATABASE_URL, ADMIN_WALLET_ADDRESSES, TREASURY_BASE_ADDRESS, OPENBROKER_API_KEY.
- server/.env.neon.prod: PRODUCTION bundle — BETTER_AUTH_SECRET, ENCRYPTION_KEY, RECEIPT_HMAC_SECRET, FACILITATOR_PRIVATE_KEY, RECOVERY_TOKEN, INTERNAL_PROXY_SECRET, UPSTASH_REDIS_REST_TOKEN, POLAR_*.
config.ts:404-441 documents that Neon function was previously published FROM server/.env ⇒ a mis-targeted publish ships a mock facilitator.
Ops action independent of code: rotate treasury key, Polar token, and Polar webhook secret; move to Neon dashboard / Vercel env; put the .env files in a platform-managed secret store.
Severity: P3 (ops)
Status: OPEN

### [B-16] No committed secrets confirmed
git ls-files shows only .env.example files tracked. The 66-hex matches in the tree are Anvil test keys, the secp256k1 half-order constant, and dummy deposit addresses. CLEAN.
Status: NONE

## Fix order (this audit's recommendation)
B-1, B-2 (direct money loss/replay) → B-3, B-7 (revenue + abuse) → B-5, B-6, B-8 → ops items (B-15) go to Neon console / Vercel env rotation work.
