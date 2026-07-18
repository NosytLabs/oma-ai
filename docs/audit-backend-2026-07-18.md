# OMA-AI Backend Audit — 2026-07-18

**Scope:** Hono.js + Node 22 + Drizzle ORM + PostgreSQL (Neon) + Redis backend in `server/src/` (~205 .ts files, ~40,956 LOC)

**Audited by:** General subagent (read-only)

---

## Executive Summary

| Severity | Count |
|----------|-------|
| **Critical** (security vulns, data integrity risks) | 8 |
| **High** (auth gaps, missing indexes, N+1, TOCTOU) | 14 |
| **Medium** (error handling, resilience) | 12 |
| **Low** (consistency, naming, documentation) | 8 |
| **Strengths** (well-designed areas) | 9 |

**Total findings: ~42**

---

## CRITICAL (Must fix before production)

### C1. SSRF in `/fetch` route — `lib/url-safety.ts` line 109
**File:** `server/src/routes/fetch.ts` (lines 23-34), `server/src/lib/url-safety.ts` (lines 109-128)

**Problem:** The SSRF guard `isWebhookUrlSafe()` only resolves DNS **once at validation time**. An attacker can register a domain that initially resolves to a public IP, pass validation, then change DNS to point to `127.0.0.1` or `169.254.169.254` (AWS metadata) before the actual `fetchWebPages()` call executes (TOCTOU).

**Evidence:**
```typescript
// fetch.ts line 31
const safety = await isWebhookUrlSafe(url);  // DNS resolves to public IP
// ... later ...
const results = await fetchWebPages(urls);   // DNS now resolves to 169.254.169.254
```

**Fix direction:** Implement DNS rebinding protection by pinning the resolved IP at validation time and using a custom `http.Agent` with `lookup: () => pinnedIp` in `fetchWebPages()`. The comment in `url-safety.ts` (lines 13-22) explicitly acknowledges this requirement but it's not implemented.

---

### C2. x402 facilitator replay protection depends on Redis availability — `x402/facilitator.ts` lines 55-68
**File:** `server/src/x402/facilitator.ts`

**Problem:** `consumeNonce()` returns `{ ok: false, reason: "nonce_store_unavailable" }` when Redis is down, causing `verifyPayment()` to reject **all** payments (fail-closed). While safe, this creates a denial-of-service vector: an attacker who can disrupt Redis connectivity blocks all x402 payments. There's no local in-memory fallback for nonce tracking.

**Evidence:**
```typescript
// lines 60-64
if (!redis) {
  return { ok: false, reason: "nonce_store_unavailable" };
}
```

**Fix direction:** Add an in-memory LRU nonce cache (with TTL) as a fallback when Redis is unavailable. Accept the small risk of replay across restarts in exchange for availability.

---

### C3. Hot wallet private key in memory — `config.ts` line 52, `x402/facilitator.ts` lines 566-594
**File:** `server/src/config.ts`, `server/src/x402/facilitator.ts`

**Problem:** `FACILITATOR_PRIVATE_KEY` (hot wallet) is loaded into process memory and used by `submitEip3009Transfer()` to sign on-chain transactions. If the Node process is compromised (RCE, memory dump), the key is exposed. No HSM, no key isolation, no cold/hot separation for withdrawal treasury.

**Evidence:**
```typescript
// facilitator.ts line 573
const account = privateKeyToAccount(config.FACILITATOR_PRIVATE_KEY as Hex);
const txHash = await walletClient.writeContract({ ... });
```

**Fix direction:** Use a hardware security module (AWS KMS, GCP KMS, or dedicated HSM) for transaction signing. At minimum, isolate the facilitator key in a separate microservice with minimal attack surface.

---

### C4. No CSRF protection on state-changing GET endpoints — `auth.ts` lines 517-518
**File:** `server/src/routes/auth.ts`

**Problem:** CSRF token endpoint allows both GET and POST:
```typescript
authRoutes.get("/auth/csrf-token", ..., csrfTokenHandler);
authRoutes.post("/auth/csrf-token", ..., csrfTokenHandler);
```
A GET request that sets a cookie is a CSRF vector (attacker can force victim's browser to request the token via `<img src="...">`). While the token itself is HMAC-signed, the act of setting the cookie via GET is unsafe.

**Fix direction:** Remove GET handler; only allow POST for token issuance.

---

### C5. SIWE nonce rotation on verification only — `siwe.ts` lines 129-141
**File:** `server/src/auth/siwe.ts`

**Problem:** The SIWE nonce is only rotated **after successful verification** (line 131, 139). A failed verification attempt does **not** rotate the nonce, allowing unlimited replay attempts against the same nonce within the TTL window (10 min per `NONCE_TTL_MS`).

**Evidence:**
```typescript
// Only on success:
await db.update(users).set({ nonce: nanoid(32), updatedAt: new Date() })
```

**Fix direction:** Rotate nonce on **every** verification attempt (success or failure), or implement a per-nonce attempt counter with low limit (e.g., 3).

---

### C6. Account-number login brute-force uses Redis INCR without sliding window — `auth.ts` lines 534-562
**File:** `server/src/routes/auth.ts`

**Problem:** Rate limiting for `/auth/account/login` uses a fixed 60-second window with `SET NX EX` + `INCR`. An attacker can make 5 attempts at `t=59s` and 5 more at `t=61s` = 10 attempts in 2 seconds.

**Evidence:**
```typescript
// Line 536: SET NX EX 60 creates 60-second fixed window
const nxSet = await redis.set(key, "1", { NX: true, EX: 60 });
```

**Fix direction:** Use a sliding window log (sorted set with timestamps) or token bucket for smoother limiting.

---

### C7. Withdrawal TOCTOU — `withdraw.ts` lines 210-246
**File:** `server/src/routes/withdraw.ts`

**Problem:** The withdrawal flow does:
1. `checkWithdrawalLimits()` — reads DB sums (lines 33-82)
2. `db.transaction()` with `SELECT ... FOR UPDATE` on `creditBalances` (lines 213-246)

There's a gap between the limit check (outside transaction) and the balance lock (inside transaction). Two concurrent withdrawals can both pass the limit check, then both acquire the lock sequentially and both succeed, exceeding daily/weekly limits.

**Evidence:**
```typescript
// Line 179: limit check OUTSIDE transaction
const limitCheck = await checkWithdrawalLimits(userId, amountCents);
// Line 213: transaction starts AFTER
const withdrawal = await db.transaction(async (tx) => { ... });
```

**Fix direction:** Move `checkWithdrawalLimits()` inside the transaction, or use advisory locks (`pg_advisory_xact_lock`) keyed on userId for the entire withdrawal flow.

---

### C8. API key hash comparison uses timing-safe equality but prefix check does not — `api-keys.ts` lines 224-225, 255-256
**File:** `server/src/auth/api-keys.ts`

**Problem:** The raw key prefix (first 12 chars) is compared with `timingSafeEqual` (good), but the cached API key object's `keyPrefix` field is compared against the raw prefix using the same function. However, if an attacker can control the cached value (Redis poisoning), they could bypass the timing-safe check. More importantly, the cache key is the full SHA-256 hash — an attacker who can write to Redis could inject a malicious entry.

**Fix direction:** Validate the cache entry structure before using it; don't trust cached data blindly.

---

## HIGH PRIORITY

### H1. Missing `LIMIT` on list endpoints — multiple files
**Files:** `routes/credits.ts` (line 138), `routes/withdraw.ts` (line 282), `routes/admin/refunds.ts` (line 54)

**Problem:** List endpoints accept user-controlled `limit` parameter with only a max cap (100), but no default pagination enforcement on the DB side for some queries. The `credits.ts` transactions endpoint does `.limit(limit)` but merges two unbounded arrays in memory (line 151-169).

**Fix direction:** Enforce reasonable default limits (e.g., 20) and always apply `.limit()` at the query level.

---

### H2. N+1 query pattern in `provider-health.ts` — `provider-health.ts` line 321
**File:** `server/src/inference/provider-health.ts`

**Problem:** `syncProviderHealthToDb()` iterates `ALL_PROVIDERS` and does a separate Redis `hGetAll` + DB `update` per provider (lines 321-344). With 3 providers it's fine, but this pattern doesn't scale.

**Fix direction:** Batch Redis reads with `mGet` and use a single DB `update` with `CASE` or `INSERT ... ON CONFLICT`.

---

### H3. Circuit breaker state not persisted across restarts — `provider-health.ts` lines 143-206
**File:** `server/src/inference/provider-health.ts`

**Problem:** Circuit breaker state (`consecutiveFailures`, `state`, `cooldownUntil`) lives only in Redis + in-memory `healthCache`. On cold start, `ensureProviderRecord()` reads from DB but the DB `consecutiveFailures` is **reset to 0** (line 173). A provider that was OPEN due to 5 failures becomes CLOSED after restart.

**Evidence:**
```typescript
// Line 172-173: DB row doesn't store consecutiveFailures
consecutiveFailures: 0,
```

**Fix direction:** Persist `consecutiveFailures`, `state`, `cooldownUntil` to `providerHealth` table (add columns) and restore on startup.

---

### H4. 13 indexes on `usage_records` — likely redundant — `schema.ts` lines 192-204
**File:** `server/src/db/schema.ts`

**Problem:** 13 indexes on a single table is excessive. Several are prefix-covered by others:
- `idx_usage_user` (userId) → covered by `idx_usage_user_created` (userId, createdAt)
- `idx_usage_user_status_created` (userId, status, createdAt) → covers `idx_usage_user_created` for status-filtered queries
- `idx_usage_records_analytics` (createdAt, model, provider, costCents) → overlaps with `idx_usage_user_created_model` (userId, createdAt, model)

**Fix direction:** Run `EXPLAIN ANALYZE` on actual query patterns; drop indexes not used by the query planner. Keep only: `(userId, createdAt)`, `(userId, status, createdAt)`, `(requestId)` unique, `(provider, createdAt)`, and the analytics composite.

---

### H5. `creditBalances` upsert uses `sql` template strings for arithmetic — `preflight.ts` lines 68-76
**File:** `server/src/credits/preflight.ts`

**Problem:** Race condition between reading `newSum` (line 52) and updating `creditBalances` (lines 59-76). Two concurrent preflights can both read the same `newSum`, then both write it back, losing one deduction.

**Evidence:**
```typescript
const [newSum] = await tx.select({ total: sql`COALESCE(SUM(${creditBatches.remainingCents}), 0)` })
// ... later ...
await tx.insert(creditBalances).values({ balanceCents: String(newSum?.total ?? 0), ... })
.onConflictDoUpdate({ set: { balanceCents: String(newSum?.total ?? 0), ... } })
```

**Fix direction:** Use `sql` expressions for the update: `balanceCents: sql`${creditBalances.balanceCents} - ${required}`` (as done correctly in `deposit.ts` line 238).

---

### H6. Refund credits TOCTOU — `refunds.ts` lines 12-71
**File:** `server/src/credits/refunds.ts`

**Problem:** `refundCredits()` inserts a new credit batch and recalculates `balanceCents` from sum of remaining batches (lines 47-52), but between the sum query and the update, another deduction could occur.

**Fix direction:** Use `SELECT ... FOR UPDATE` on `creditBalances` before computing the sum, or use a single `UPDATE ... SET balanceCents = balanceCents + amt` with `RETURNING`.

---

### H7. Admin refund grant does credit debit OUTSIDE transaction — `admin/refunds.ts` lines 171-188
**File:** `server/src/routes/admin/refunds.ts`

**Problem:** The refund grant transaction (lines 126-160) updates `refundRequests` and `deposits` atomically, but `refundCredits()` is called **after** the transaction commits (line 184). If `refundCredits` fails, the refund is marked "granted" but credits aren't debited.

**Fix direction:** Move `refundCredits` inside the transaction, or use a saga pattern with compensating transaction.

---

### H8. Missing webhook signature verification for LI.FI / CCTP / Coinbase — `deposit/lifi.ts`, `deposit/cctp.ts`
**Files:** `server/src/routes/deposit/lifi.ts`, `server/src/routes/deposit/cctp.ts`

**Problem:** Deposit webhooks from LI.FI and Circle CCTP are accepted without verifying HMAC signatures. An attacker who discovers the webhook endpoint can forge deposit notifications.

**Evidence:** No signature verification in `lifi.ts` or `cctp.ts` — they trust the `txHash` from the request body and verify on-chain, but the webhook itself is unauthenticated.

**Fix direction:** Implement `ONRAMP_WEBHOOK_SECRET` verification (already in config, line 74) for all deposit webhooks.

---

### H9. `TRUSTED_PROXY_IPS` empty in production allows X-Forwarded-For spoofing — `utils.ts` lines 5-15, 40-42
**File:** `server/src/middleware/rate-limit/utils.ts`

**Problem:** If `TRUSTED_PROXY_IPS` is not set, `extractClientIp()` falls back to `x-real-ip` only (line 41), ignoring `x-forwarded-for`. But if a reverse proxy **is** present and the env var is missing, the real client IP is in `x-forwarded-for` and gets ignored, causing all traffic to appear as the proxy IP — breaking per-IP rate limits.

**Fix direction:** Fail startup in production if `TRUSTED_PROXY_IPS` is empty (like the CORS check in `index.ts` line 75).

---

### H10. JWT secret rotation `JWT_SECRET_PREVIOUS` allows compromised key to verify tokens — `siwe.ts` lines 235-256
**File:** `server/src/auth/siwe.ts`

**Problem:** The fallback verification path (lines 249-255) tries `PREVIOUS_JWT_SECRET` if the primary fails. If `JWT_SECRET` was compromised and rotated, the attacker can still mint tokens signed with the old key, and they'll verify via the fallback path until the old key is unset.

**Fix direction:** When rotating due to compromise, **unset** `JWT_SECRET_PREVIOUS` immediately. Add a config validation warning if both are set in production for >7 days.

---

### H11. `apiKeys` cache never invalidated on revoke — `api-keys.ts` lines 304-316
**File:** `server/src/auth/api-keys.ts`

**Problem:** `revokeApiKey()` deletes the Redis cache entry (line 312), but if Redis is down, the revoked key remains valid in the DB until the cache TTL expires (5 min). The `validateApiKey()` function checks `active: true` in DB (line 247) but only after a cache miss.

**Fix direction:** On revoke, also publish a cache invalidation event to other instances (Redis pub/sub), or reduce TTL to 60s.

---

### H12. Account number generation has no uniqueness guarantee under concurrency — `auth.ts` lines 135-159
**File:** `server/src/routes/auth.ts`

**Problem:** `allocateAccountNumber()` generates a number, checks DB for collision, retries up to 10 times (lines 140-152). Two concurrent requests can both generate the same number, both see no collision, and both insert — the unique index on `accountNumberHash` will catch one, but the other succeeds with a duplicate.

**Fix direction:** Use `INSERT ... ON CONFLICT DO NOTHING RETURNING` in a loop, or generate the hash in a `BEFORE INSERT` trigger with a sequence.

---

### H13. `depositNonces` in-memory Map not shared across instances — `usdc.ts` lines 61-74
**File:** `server/src/routes/deposit/usdc.ts`

**Problem:** Deposit nonces are stored in a process-local `Map` (line 61). In a multi-instance deployment (K8s, multiple pods), a nonce issued by instance A won't be valid on instance B.

**Fix direction:** Move nonce storage to Redis with TTL (like SIWE nonces).

---

### H14. `FALLBACK_BURST_LIMIT = 5` is extremely aggressive — `memory-store.ts` line 4
**File:** `server/src/middleware/rate-limit/memory-store.ts`

**Problem:** When Redis is down, the in-memory fallback allows only **5 requests per minute per key**. This will cause massive false-positive 429s during Redis outages, effectively DoSing the API.

**Fix direction:** Increase to at least 60/min, or make it configurable. Log a warning when fallback mode activates.

---

## MEDIUM PRIORITY

### M1. Error responses leak stack traces in development — `index.ts` lines 189-201
**File:** `server/src/index.ts`

**Problem:** The global error handler returns `err.message` for non-HTTPException errors (line 200). In production this is "Internal server error" (line 198), but in development/test it leaks internal details.

**Fix direction:** Always sanitize error messages; use a separate error code mapping.

---

### M2. No correlation ID in audit logs — `audit.ts` lines 19-35
**File:** `server/src/middleware/audit.ts`

**Problem:** `auditLog()` doesn't include the request correlation ID (set in `index.ts` line 104), making it hard to trace a request across logs, audit, and metrics.

**Fix direction:** Pass `correlationId` from context to `auditLog()`.

---

### M3. `console.log` / `console.error` used in config validation — `config.ts` lines 269, 303, 309, 320, 340, 345, 350, 355, 360, 365
**File:** `server/src/config.ts`

**Problem:** Startup validation uses `console.error` instead of structured `pino` logger, so these critical messages don't appear in log aggregation.

**Fix direction:** Use `logger.fatal()` or `logger.error()` consistently.

---

### M4. Provider failover is sequential, not parallel — `router.ts` lines 174-232
**File:** `server/src/inference/router.ts`

**Problem:** `handleChatCompletion()` tries providers sequentially (line 174). With 3 providers and 120s timeout each, worst-case latency is 6 minutes before returning 502.

**Fix direction:** Race providers in parallel with a short timeout (e.g., 10s), then fall back sequentially. Or implement a "hedged request" pattern.

---

### M5. Circuit breaker `HALF_OPEN` allows unlimited concurrent requests — `provider-health.ts` lines 360-362
**File:** `server/src/inference/provider-health.ts`

**Problem:** In `HALF_OPEN` state, `isProviderAvailable()` returns `true` (line 361) without limiting concurrency. A thundering herd can hit the recovering provider simultaneously.

**Fix direction:** Allow only 1-2 probe requests in `HALF_OPEN`; queue or reject others.

---

### M6. `settlementCache` in-memory Map has no size bound enforcement under contention — `facilitator.ts` lines 235-274
**File:** `server/src/x402/facilitator.ts`

**Problem:** `atomicCacheSet()` uses a spinlock (`cacheLock` boolean, lines 262-273) which can busy-wait. Under high load, `cacheAccessOrder` array grows unbounded before `evictLRU()` runs (line 253).

**Fix direction:** Use a proper LRU library (e.g., `lru-cache`) or Redis for the settlement cache.

---

### M7. `tinyfish-fetch.ts` has no timeout — `tinyfish-fetch.ts` line 21
**File:** `server/src/inference/tinyfish-fetch.ts`

**Problem:** `fetch()` call has no timeout. A hung TinyFish API response blocks the Node event loop indefinitely.

**Fix direction:** Wrap with `AbortSignal.timeout(30_000)`.

---

### M8. `webhookSubscriptions` table has no signature verification column — `schema.ts` lines 738-758
**File:** `server/src/db/schema.ts`

**Problem:** Webhook subscriptions store a `secret` (line 748) but there's no code that verifies incoming webhook signatures against it.

**Fix direction:** Implement webhook dispatch with HMAC verification; add `signatureHeader` config per subscription.

---

### M9. `usageRecords` status field is free-text — `schema.ts` line 188
**File:** `server/src/db/schema.ts`

**Problem:** `status` is `text` with default `'completed'` (line 188). No enum constraint. Typos create invisible data quality issues.

**Fix direction:** Create `usageStatusEnum` with `completed`, `refunded`, `failed`, `pending`.

---

### M10. No structured logging for security events — `auth.ts`, `withdraw.ts`, `deposit/*.ts`
**Files:** Multiple

**Problem:** Security-relevant events (failed login, failed withdrawal, invalid signature) use `logger.warn/error` with ad-hoc fields. No consistent `security_event: true` tag for SIEM alerting.

**Fix direction:** Standardize security event logging with a `SecurityEvent` type and dedicated logger method.

---

### M11. `CHEAPTOKENS_ADDRESS` regex allows any 0x-prefixed 40 hex — `config.ts` line 40
**File:** `server/src/config.ts`

**Problem:** Regex `/^0x[a-fA-F0-9]{40}$/` validates format but not that it's a valid contract address on Base. A typo'd address silently routes to nowhere.

**Fix direction:** Add a startup check that verifies the address has code on-chain (eth_call to `0x` with `to: address`).

---

### M12. Migration history has 32 migrations — check for gaps — `db/migrations/meta/_journal.json`
**File:** `server/src/db/migrations/meta/_journal.json`

**Problem:** 32 migrations over ~1 year suggests schema churn. Need to verify no irreversible migrations (DROP COLUMN, DROP TABLE) without data migration scripts.

**Fix direction:** Audit each migration for `down` safety; document any that require manual intervention to roll back.

---

## LOW PRIORITY

### L1. Inconsistent error response shapes — some return `{ error: { message, type } }`, others `{ error: { message, type, code } }`
**Files:** `auth.ts`, `credits.ts`, `withdraw.ts`, etc.

### L2. Magic numbers in rate limit configs — `auth.ts` lines 173, 181, 216
**Example:** `rateLimit({ windowMs: 60_000, maxRequests: 20 })` — extract to constants.

### L3. `creditBatches.expiresAt` uses 365 days hardcoded — `deposit.ts` line 56
**File:** `server/src/credits/deposit.ts`

### L4. `auditLogs.metadata` is JSONB but not indexed for common query patterns
**File:** `server/src/db/schema.ts` line 628

### L5. `config.ts` has 426 lines — consider splitting by domain (auth, payments, inference, etc.)

### L6. `x402/facilitator.ts` 1647 lines — split into `verify.ts`, `settle.ts`, `receipt.ts`, `middleware.ts`

### L7. `provider-health.ts` 426 lines — split circuit breaker, prober, DB sync into separate modules

### L8. `validateModelWeightsSync` in config is sync but could be async — `config.ts` lines 376-422

---

## STRENGTHS (Well-designed areas)

### S1. **SIWE nonce lifecycle with domain binding** — `siwe.ts` lines 107-128
Iterates allowed domains, rotates nonce on success, checks TTL. Properly implements EIP-4361 §4.

### S2. **x402 EIP-3009 gasless flow with replay protection** — `facilitator.ts` lines 611-722
Nonce consumption before RPC, eth_call simulation before submit, deterministic synthetic txHash for dev, payee pinning to treasury.

### S3. **Credit preflight with batch consumption & atomic balance update** — `preflight.ts` lines 8-83
SELECT FOR UPDATE on batches, consumes oldest-first, single UPSERT for balance. Good pattern.

### S4. **API key design: prefix + SHA-256 hash, IP allowlist, model allowlist, rotation warning** — `api-keys.ts` lines 168-212
Well-thought-out credential model with defense-in-depth.

### S5. **2FA with backup codes, replay protection, rate limiting** — `two-factor.ts` lines 263-328
TOTP step tracking in Redis, atomic backup code consumption, 5-attempt lockout.

### S6. **Deposit verification: on-chain source of truth for all 3 paths** — `deposit/usdc.ts`, `cctp.ts`, `lifi.ts`
Each route verifies on-chain amount matches claim before crediting. LiFi even tolerates 1% slippage.

### S7. **Admin refund flow with TOTP step-up for money movement** — `admin/index.ts` lines 26-49, `admin/refunds.ts`
`requireFreshTotp()` middleware on grant/deny/BYOK prevents stolen admin JWT from draining treasury.

### S8. **Structured config validation with production guards** — `config.ts` lines 265-367
Fails fast on insecure defaults, placeholder addresses, missing RPC URLs.

### S9. **Correlation ID propagation from edge to logs** — `index.ts` lines 103-108
Every request gets `X-Request-ID`; included in error logs.

---

## File: `/Users/tyson/Desktop/Code/OMA-AI/docs/audit-backend-2026-07-18.md` written.

---

## Summary for Main Session

**Critical findings: 8**  
**High priority: 14**  
**Medium priority: 12**  
**Low priority: 8**  
**Strengths noted: 9**

### Top 5 Critical Fixes (one-sentence each)

1. **C1 SSRF TOCTOU:** `/fetch` route validates DNS once but fetches later — pin resolved IP at validation and use custom `http.Agent` with `lookup: () => pinnedIp` in `fetchWebPages()`.
2. **C2 x402 Redis DoS:** Nonce replay protection fails closed when Redis is down — add in-memory LRU nonce cache fallback.
3. **C3 Hot wallet in memory:** `FACILITATOR_PRIVATE_KEY` signs on-chain txs in-process — isolate in HSM/KMS or separate signing service.
4. **C4 CSRF on GET:** `/auth/csrf-token` accepts GET which sets cookie — remove GET handler, only allow POST.
5. **C5 SIWE nonce replay:** Failed verification doesn't rotate nonce — rotate on every attempt or add per-nonce attempt counter.