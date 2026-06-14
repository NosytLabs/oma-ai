# OMA-AI Operational Model Audit — 2026-06-14

**Question:** "If an operator funds ONE wallet with USDC, will the whole system work end-to-end, or are there gaps?"

**Verdict (TL;DR):** **NO — funding one wallet is insufficient.** The system requires at minimum **three funded addresses** plus API keys for at least one upstream AI provider, and **two provider paths are currently broken in code** (the Surplus x402 signer, and the `/v1/x402/proxy/chat/completions` direct route). This audit traces every flow with `file:line` citations and ends with a minimum-viable deployment checklist.

---

## 1. The "one wallet" question — which wallet, and what does it do?

There is no single wallet. The system has **three operational keys** + **one cold-side sweep key**, each deriving a separate on-chain address:

| Key (env var) | Purpose | Code reference | Address role |
|---|---|---|---|
| `TREASURY_PRIVATE_KEY` | Cold-side sweep signer (moves USDC out of hot wallet to operator's destination) | `server/src/config.ts:20-23`; `server/src/routes/admin/ledger.ts:71-77` | **Sweeps USDC out** |
| `FACILITATOR_PRIVATE_KEY` | HOT signer — (a) signs outbound USDC transfers for CheapTokens key purchases, (b) is the implicit "from" address when the system acts as a USDC sender | `server/src/config.ts:67`; `server/src/inference/cheaptokens.ts:125-146`; `server/src/routes/admin/ledger.ts:206-209` | **Sends USDC to CheapTokens** |
| `SURPLUS_WALLET_PRIVATE_KEY` | HOT signer — signs EIP-712 typed data for Surplus x402 payments | `server/src/config.ts:52`; `server/src/inference/surplus.ts:285-293` | **Sends USDC to Surplus** |
| `TREASURY_BASE_ADDRESS` | Merchant/recipient address (default) for **incoming** x402 customer payments | `server/src/config.ts:69`; `server/src/x402/facilitator.ts:727` | **Receives USDC from customers** |
| `CHEAPTOKENS_ADDRESS` | Payee for the $1 CheapTokens purchase (falls back to `TREASURY_BASE_ADDRESS` if unset) | `server/src/inference/cheaptokens.ts:124` | **Receives USDC from FACILITATOR** |
| `ADMIN_SWEEP_ADDRESS` | Cold destination for the operator's profit sweep | `server/src/config.ts:26-29` | **Receives USDC from TREASURY** |

### What funding one wallet actually buys

| Which wallet you fund | What works | What doesn't |
|---|---|---|
| `TREASURY_BASE_ADDRESS` | Customers can deposit USDC into the system via x402 routes (`/v1/x402/settle`, payment middleware) | CheapTokens can't auto-buy Venice keys (FACILITATOR signer has no USDC). Surplus provider can't pay for inference. |
| `FACILITATOR_PRIVATE_KEY` address | CheapTokens auto-buy works → 24h Venice reseller key refreshes every 5 min | Customers have no merchant address to pay. Surplus fails. |
| `SURPLUS_WALLET_PRIVATE_KEY` address | Surplus has funds to sign payments with (still broken — see §4) | Everything else fails. |

**The only way to make the whole system work** is to fund the FACILITATOR address (so CheapTokens can buy keys) AND the TREASURY_BASE_ADDRESS (so customers have a payee) AND ideally the SURPLUS address. They are **three distinct addresses** unless the operator deliberately reuses the same key — which is not advised because each address has its own Base nonce sequence and concurrent txs from one address can collide.

There is also no built-in mechanism for the FACILITATOR to be refilled automatically. The operator must top it up manually. The `TREASURY_PRIVATE_KEY` sweep endpoint (`/admin/ledger.ts`) moves funds OUT of the hot wallet to `ADMIN_SWEEP_ADDRESS`; it does NOT move funds INTO the FACILITATOR hot wallet.

---

## 2. Per-provider env var requirements

The "what works" of the inference router depends on which API keys the operator has acquired. Reading `server/src/inference/provider-selector.ts:14-26` and `server/.env.example:18-46`:

| Provider | Required env vars | What happens if missing |
|---|---|---|
| **Venice** (primary) | `VENICE_API_KEY` | `checkVeniceConfig()` throws 503 (`venice.ts:134-141`); every Venice call fails |
| **CheapTokens auto-buy** | `VENICE_API_KEY` (still required as fallback) + `FACILITATOR_PRIVATE_KEY` + `CHEAPTOKENS_ADDRESS` + `CHAIN_RPC_URL` + `FACILITATOR_MODE=live` | Falls back to `config.VENICE_API_KEY` at request time (`venice.ts:59`); no auto-buy happens |
| **OpenRouter** | `OPENROUTER_API_KEY` | Selector picks it but `chatCompletion` fails with 401/403 |
| **Together** | `TOGETHER_API_KEY` | Same — fails when selected |
| **DeepInfra** | `DEEPINFRA_API_KEY` | Same — fails when selected |
| **Antseed** | `ANTSEED_PROXY_URL` (no key in schema; assumed proxy auth) | Same |
| **LiteLLM** | `LITELLM_PROXY_URL` + `LITELLM_API_KEY` | Same |
| **Morpheus** | `MORPHEUS_API_KEY` | Same |
| **Claude** | `ANTHROPIC_API_KEY` | Same |
| **Gemini** | `GEMINI_API_KEY` | Same |
| **Surplus (x402 pay-per-call)** | `SURPLUS_WALLET_PRIVATE_KEY` + `SURPLUS_SETTLEMENT_CONTRACT` (or `SURPLUS_VERIFIER_CONTRACT`) | `signPayment` throws 500 (`surplus.ts:285-293`) |

**Note on model routing** (`provider-selector.ts:14-26`): if the request model name doesn't have a `provider-weights` override and the model's `primaryProvider` is unavailable, the router falls back through `ALL_PROVIDERS` in fixed order until one answers. This means **one working API key is technically enough to serve all model names** — but the model may not actually exist on that provider.

---

## 3. Flow traces

### 3.1 Venice API key flow — direct env var

`server/src/inference/venice.ts:58-64`:
```ts
function veniceHeaders(): Record<string, string> {
  const activeKey = getActiveVeniceKey() || config.VENICE_API_KEY;
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${activeKey}`,
  };
}
```

- `getActiveVeniceKey()` (from `cheaptokens.ts:173-201`) returns the **cached CheapTokens key** if one exists and is within its expiry, else triggers a background refresh and returns whatever cached key is there (even if expired — see §3.2).
- The env var `VENICE_API_KEY` is the **fallback** when `getActiveVeniceKey()` returns `null` (no key cached at all).

**What this means:** if you only set `VENICE_API_KEY` and `FACILITATOR_MODE=mock` (or no `FACILITATOR_PRIVATE_KEY`), `getActiveVeniceKey()` returns `null` and `config.VENICE_API_KEY` is used. **Direct env var works without any auto-buy** — the auto-buy is a pure optimization on top.

### 3.2 CheapTokens auto-buy flow

`server/src/inference/cheaptokens.ts:203-261` shows the full flow:

1. **Trigger points** (only TWO):
   - **At server startup**: `server/src/index.ts:78` calls `triggerCheapTokensRefresh()` once.
   - **On every Venice request that hits a stale cache**: `cheaptokens.ts:194` calls `triggerRefresh()` if `cachedKey` is null OR `(now - cachedAt) > 5 minutes`. Note: 5 min is a soft TTL — if the cached key is still within its own `cachedExpiry` (up to 24h), the function returns the cached key WITHOUT triggering refresh (`cheaptokens.ts:177-182`).
   - There is **no cron / scheduled job / interval** for CheapTokens. The only automatic triggers are "server started" and "a Venice request hit a stale cache." If no Venice request comes in for 5+ minutes, the cache is never re-validated.

2. **Purchase flow** (`cheaptokens.ts:112-168`, live mode):
   - Reads `CHEAPTOKENS_ADDRESS` or falls back to `TREASURY_BASE_ADDRESS` as payee (line 124).
   - Reads `FACILITATOR_PRIVATE_KEY` (line 125) and throws if missing (line 126).
   - Sends an on-chain USDC `transfer(to=payee, amount=$1)` using `FACILITATOR_PRIVATE_KEY` as signer (lines 131-146).
   - POSTs to `https://cheaptokens.ai/api/buy` with `{usdPaid, networkId: "base", payee, txHash}` (lines 148-157).
   - Returns `{veniceApiKey, expiresAt}` and caches it in-process (lines 242-253).

3. **Spending cap** (line 228-238): `CT_DAILY_USDC_CENTS_MAX` defaults to `0` which means "no cap" (the `if (capCents > 0)` check at line 230 means the cap is only enforced when explicitly set).

4. **What happens when the cached key expires mid-request** (e.g., a 24h mock key at hour 25):
   - `getActiveVeniceKey()` (`cheaptokens.ts:174-201`) checks `cachedKey && now < cachedExpiry` — since expiry is past, the `now < cachedExpiry` check fails, so it does NOT short-circuit.
   - It triggers a background refresh (`triggerRefresh()` at line 194) and returns `cachedKey` (line 200) — **the EXPIRED key is returned to the request**.
   - The request will hit Venice with an expired Bearer token, get a 401, and the error mapper (`venice.ts:97-100`) sets `code: "venice_unauthorized"`, `retryable: false`. The router (`router.ts:42-56`) refunds credits and surfaces a 502 to the user.
   - The 401 does **NOT** trigger a key refresh — the refresh is only triggered by stale-cache checks (5 min) or server startup.
   - **Bug-shaped behavior:** if you make 1,000 requests in a 1-minute window while the cached key is expired, you get 1,000 refresh attempts (with a 30-second backoff per `cheaptokens.ts:212-217`).
   - **The fallback to `config.VENICE_API_KEY` does NOT fire** because `getActiveVeniceKey()` returns the (expired) cached key, not `null` (`venice.ts:59`: `getActiveVeniceKey() || config.VENICE_API_KEY`). Only when there has never been a cached key does the env var get used.

5. **In mock mode** (`FACILITATOR_MODE=mock`): the `buyKey` returns a random string as the Venice key with a 24h expiry (lines 113-120). This is purely for development — calling Venice with a `ct_sk_venice_mock_*` token will get a 401 from Venice.

### 3.3 Surplus Intelligence flow

`server/src/inference/surplus.ts:111-243` shows the full x402 dance:

1. Operator calls chat with a model that maps to `surplus` in `provider-selector.ts`.
2. `callProvider` dispatches to `surplusChatCompletion` (`call-provider.ts:60-61`).
3. First call hits Surplus POST `/x402/api/inference/v1/chat/completions` (line 119).
4. If Surplus returns 402, the client decodes the `PAYMENT-REQUIRED` header (base64 JSON, line 175).
5. `buildPaymentPayload` (line 245-280) picks either the `upto` or `exact` scheme from the accept list.
6. `signPayment` (line 282-364) signs the EIP-712 payload and constructs the envelope `{x402Version, signature, authorization: "", payload}` (line 181-186).
7. Retry with `PAYMENT-SIGNATURE: <JSON>` header.

**The `signPayment` function is BROKEN** (see §4.1). The current EIP-712 domain is:
```ts
domain: {
  name: "Surplus Intelligence",
  version: "1",
  chainId,                  // 8453
  verifyingContract,        // SURPLUS_VERIFIER_CONTRACT ?? SURPLUS_SETTLEMENT_CONTRACT
}
types: { Payment: [
  { name: "payTo",  type: "address" },
  { name: "asset",  type: "address" },
  { name: "amount", type: "uint256" },
  { name: "network", type: "string" },
] }
primaryType: "Payment"
```

**What actually happens today:** per the in-code TRACKED ISSUE at `surplus.ts:295-311`:
- Surplus rejected earlier signatures because `0x8581…c402` (the previous `verifyingContract`) was the **payTo/treasury** address, not the verifier.
- The current code signs against the settlement proxy `0x0770…c137` (line 312-314), but the actual scheme is wrong:
  - `exact` should sign **EIP-3009 TransferWithAuthorization** against USDC (`name: "USD Coin"`, `version: "2"`, `chainId: 8453`)
  - `upto` should sign **Permit2 PermitWitnessTransferFrom** against `0x0000…BA3` (`name: "Permit2"`, `chainId: 8453`)
- The current "Payment" struct is neither.
- The retry at line 198 catches the 402 and throws `Surplus payment failed: ...` to the caller.
- **Net effect: every Surplus chat completion that requires payment (which is all of them) fails with 402/500 today.**

### 3.4 Provider health / router

`server/src/inference/provider-selector.ts:96-132`:
1. Look up model in `models.ts`; if no model def, infer from name prefix (lines 14-26).
2. If `MODEL_WEIGHTS` env var is set for this model → weighted random among available providers (line 100-106).
3. Else if `PROVIDER_WEIGHTS` env var is set globally → same (line 108-111).
4. Else if the model's `primaryProvider` is `isProviderAvailable()` → use it (line 113-115).
5. Else iterate `ALL_PROVIDERS` excluding the preferred one, take the first that is `isProviderAvailable()` (line 117-128).
6. **If none are available, throw 503** with "All inference providers are currently unavailable" (line 130-131).

`server/src/inference/provider-health.ts:300-321` (`isProviderAvailable`):
- Circuit `OPEN` + cooldown not yet passed → `false`.
- Circuit `HALF_OPEN` → `true` (try again).
- 3+ in-flight requests for the same provider → `false` (backpressure, see `MAX_PENDING_PER_PROVIDER = 3` at line 76).

Circuit breaker (`provider-health.ts:203-256`): 5 consecutive failures → `OPEN` for 60s (`RECOVERY_TIMEOUT_MS` at line 9).

Background probing (`provider-health.ts:344-407`): every 45s, pings all providers that haven't seen traffic in 60s and updates their liveness.

**What this means for the operator:** if you set only `VENICE_API_KEY` and Venice is up, every model routes to Venice. If Venice goes down, the router tries OpenRouter, Together, DeepInfra, Antseed, LiteLLM, Morpheus, Claude, Gemini, Surplus **in fixed order** — and the first one that is both "available" AND has the model AND has the right key will answer. If none of them have working keys, the request fails with 503.

### 3.5 On-chain payment verification

`server/src/x402/facilitator.ts:380-419` (`verifyPayment`):
- Cache hit (`settlementCache`, line 386) → return cached result. Cache TTL is `CACHE_TTL_MS` (60s).
- Check `validBefore` / `validAfter` (lines 397-402).
- **If `FACILITATOR_MODE=mock`**: accept any signature as valid (line 410-411). Throws FATAL if `NODE_ENV=production` (line 408).
- **If `FACILITATOR_MODE=live` + scheme=evm**: call `verifyEvmPayment` (line 414).

`verifyEvmPayment` (lines 207-345): reads the tx from `CHAIN_RPC_URL` (or `CHAIN_RPC_URL_FALLBACK` if primary fails), decodes the calldata, and verifies the USDC `transfer` / `transferFrom` against `payload.payee` and `payload.payFrom` (lines 247-301).

**The settlement flow does NOT require a private key** — the customer sends USDC themselves, and the server verifies on-chain. The `FACILITATOR_PRIVATE_KEY` is only used for OUTBOUND transfers (CheapTokens).

### 3.6 The `/v1/x402/proxy/chat/completions` 501 stub

`server/src/x402/facilitator.ts:791-820`:
- The route exists but returns 501 with `code: "x402_proxy_pending"`.
- Comment at line 812: "x402 direct proxy is not yet enabled. Use the credit-proxy flow via /v1/chat/completions with an API key, or call /v1/x402/quote to deposit credits first."
- The route does a payee check (lines 793-808) but always returns 501.

**This is the only direct x402-pay-per-call chat path, and it doesn't work.** The credit-proxy flow (deposit USDC → mint credits → call `/v1/chat/completions` with an API key) is the only way to consume inference via x402 today.

### 3.7 The Oracle (credit pricing)

`server/src/credits/oracle.ts:18-70`:
- Reads CoinGecko for the `oma-2` ID every 60s.
- If CoinGecko is unreachable AND no `OMA_PRICE_OVERRIDE` → falls back to `$0.10` (line 57-68).
- `isOracleLive()` returns `false` in the fallback state (line 83-85), and consumers are expected to check this before billing (oracle.ts:62-65 comment).
- **No external API key required** — CoinGecko's public endpoint is used.

**Operational impact:** the OMA price oracle is independent of any wallet. It can be down without blocking inference, but the credit-USD conversion will be wrong unless `OMA_PRICE_OVERRIDE` is set.

### 3.8 Budget alerts

`server/src/credits/budget-alerts.ts`:
- No env vars — fully DB-driven per user. `getBudgetAlertConfig` (line 48-65) reads `budgetAlerts` table.
- Email/webhook channels log only (lines 321-334) — there is no real email integration wired up. `sendEmailNotification` is a `logger.info` stub (line 321-323).
- `sendWebhookNotification` (line 325-334) has a basic SSRF block (line 328-332) against localhost/`.local` hostnames, but is also a `logger.info` stub — it does not actually POST anywhere.
- **No wallet interaction.** Budget alerts are notifications only.

---

## 4. What is BROKEN today

### 4.1 Surplus EIP-712 scheme mismatch (BLOCKING)

`server/src/inference/surplus.ts:282-364` signs a `Payment` type with `name: "Surplus Intelligence"`, `version: "1"`, against the settlement proxy. The TRACKED ISSUE comment at lines 295-311 is unambiguous:
- `exact` should be EIP-3009 `TransferWithAuthorization` (USDC contract `0x833589…29913`, `name: "USD Coin"`, `version: "2"`)
- `upto` should be Permit2 `PermitWitnessTransferFrom` (`0x0000…BA3`, `name: "Permit2"`)
- Current signer does neither; Surplus verifier rejects every payment.

**Result:** routing a model to surplus today = a guaranteed 402 on first paid call. The `surplusChatCompletion` will return 200 only on the rare "free" probe response (if Surplus ever returns 2xx on the unauthenticated probe at `surplus.ts:154-159`). Tracked: `github.com/oma-ai/oma-ai/issues/surplus-x402-schemes` (in-code reference).

### 4.2 x402 proxy 501 stub (BLOCKING for direct pay-per-call)

`server/src/x402/facilitator.ts:791-820`. There is no x402 pay-per-call chat path today. The credit-proxy flow is the only way to consume inference via x402.

### 4.3 CheapTokens expiry-mismatch sends expired key (BUG-SHAPED)

`server/src/inference/cheaptokens.ts:200` returns `cachedKey` even after `cachedExpiry` has passed (the `getActiveVeniceKey()` function). The caller in `venice.ts:59` falls back to `VENICE_API_KEY` only when `getActiveVeniceKey()` returns `null` (never set), not when it returns an expired key.

**Effect:** between expiry and the next successful refresh, every Venice request through CheapTokens returns 401. The fallback env key is bypassed. The fix would be one line: `return cachedKey && now < cachedExpiry ? cachedKey : null;` (let `venice.ts:59` do the env-var fallback).

### 4.4 CheapTokens is lazy, not scheduled

There is no cron / interval for CheapTokens. Refresh happens at startup and on every stale cache hit. If your server has been up 24+ hours with no Venice traffic, the cache is "stale" (>5min) and the next call will trigger refresh — but if the refresh fails (e.g., CheapTokens upstream is down, or the FACILITATOR key has no USDC), the next 5+ min of calls will all use the expired key. No backoff beyond the 30s per-call guard.

### 4.5 Surplus wallet is separate from FACILITATOR (CONFIG TRAP)

`server/src/inference/surplus.ts:285` reads `SURPLUS_WALLET_PRIVATE_KEY` — a **separate** hot wallet from `FACILITATOR_PRIVATE_KEY`. An operator who funds only the FACILITATOR address will see Surplus fail with "wallet private key not configured" (or, if configured, fail with "Failed to sign Surplus payment" because the EIP-712 scheme is wrong). Two distinct addresses, two distinct USDC balances, two distinct nonce sequences.

### 4.6 Mock mode is the default — silently accepts any "payment"

`server/src/config.ts:66` (`FACILITATOR_MODE: ... .default("mock")`) and `server/src/x402/facilitator.ts:404-411`. In dev, the facilitator accepts any signature. Production has a hard guard (`config.ts:225-227`), but **anything in staging/preview that doesn't override the default is also a problem**: there is no warning that the default is `mock` outside `production`/`staging` (line 225 only checks `isProductionEnv` for `["production", "staging", "prod", "preview"]`).

### 4.7 `CHEAPTOKENS_ADDRESS` falls back to `TREASURY_BASE_ADDRESS`

`server/src/inference/cheaptokens.ts:124`. If you don't set `CHEAPTOKENS_ADDRESS`, the $1 USDC payment for a Venice key is sent to **your own TREASURY address**. The only validation against this is the `0x000…0000` / `0x333…3333` placeholder check at line 127, which does NOT catch a real TREASURY address. There is no test confirming the payee is a real CheapTokens-controlled address — the operator must set this correctly or they will be transferring $1 to themselves every 5 minutes.

### 4.8 Cached-key reuse after provider failure (UNDEFINED BEHAVIOR)

`server/src/inference/cheaptokens.ts:194-201`: when `getActiveVeniceKey()` triggers a refresh, it returns the cached key while the refresh is in flight. If the refresh fails (e.g., upstream 500), the existing cached key is still returned. If the cached key has been expired for hours, every request keeps getting 401 from Venice, refreshing in the background with the 30s backoff, and surfacing 502s to users. There is no escalation path: no alert, no fallback, no circuit-open, no deactivation of the Venice provider in `provider-health.ts`.

### 4.9 TREASURY_PRIVATE_KEY is optional → no sweep = funds stranded in hot wallet

`server/src/config.ts:20-23` is optional. `server/src/routes/admin/ledger.ts:323-334` returns 501 ("Sweep is not available: TREASURY_PRIVATE_KEY is not configured"). If you set only `FACILITATOR_PRIVATE_KEY` and skip `TREASURY_PRIVATE_KEY`, all profits sit in the hot wallet forever, exposed to the hot key's compromise risk.

---

## 5. Minimum viable deployment

To get the gateway actually serving inference with one upstream model, you need:

### 5.1 Required (server will not start, or will 503 on first call, without these)

| Env var | Value | Why |
|---|---|---|
| `DATABASE_URL` | `postgresql://user:pass@host/oma` | `config.ts:13`. Required for users, credits, usage records, settlements, provider health. |
| `REDIS_URL` | `redis://...` | `config.ts:14`. Required for rate limiting, settlement locks, provider health cache, budget cache. |
| `JWT_SECRET` | 40+ random chars | `config.ts:71, 242-245`. FATAL in prod if < 40. |
| `ENCRYPTION_KEY` | 32+ chars | `config.ts:72`. AES-256-GCM for TOTP 2FA at-rest. |
| `RECEIPT_HMAC_SECRET` | 32+ chars | `config.ts:75, 247-255`. FATAL in prod. Signs x402 receipts. |
| `CSRF_SECRET` | 32+ chars | `config.ts:134, 220-223`. FATAL in prod. |
| `NODE_ENV` | `production` | `config.ts:76`. Triggers prod guards. |
| `FACILITATOR_MODE` | `live` | `config.ts:66, 225-227`. FATAL in prod if `mock`. |
| `TREASURY_BASE_ADDRESS` | `0x...` real address | `config.ts:69, 230-235`. FATAL in prod if placeholder. Merchant payee. |
| `CHAIN_RPC_URL` | `https://base-rpc.publicnode.com` (or your own) | `config.ts:61`. Used for verifyEvmPayment and CheapTokens USDC transfer. |

### 5.2 Required for ANY inference to succeed

Pick **at least one**:

| Env var | Notes |
|---|---|
| `VENICE_API_KEY` | Primary path (`venice.ts:134-141`); also used as fallback when CheapTokens fails (`venice.ts:59`). |
| `OPENROUTER_API_KEY` | Failover path 1 (`.env.example:22`). |
| `TOGETHER_API_KEY` | Failover path 2. |
| `DEEPINFRA_API_KEY` | Failover path 3. |
| `MORPHEUS_API_KEY` | Optional; decentralized provider. |
| `LITELLM_PROXY_URL` + `LITELLM_API_KEY` | Optional; self-hosted proxy. |
| `ANTHROPIC_API_KEY` | Required for `claude-*` models. |
| `GEMINI_API_KEY` | Required for `gemini-*` models. |

### 5.3 Required for CheapTokens optimization (recommended)

| Env var | Notes |
|---|---|
| `FACILITATOR_PRIVATE_KEY` | 0x + 64 hex. **Required for `FACILITATOR_MODE=live` AND for CheapTokens live purchases (`cheaptokens.ts:125-126`).** This is the HOT signer. |
| `CHEAPTOKENS_ADDRESS` | **Must be set to the real CheapTokens hot wallet address**, NOT your own TREASURY. The fall-back to TREASURY is a config trap (`cheaptokens.ts:124, 127`). |
| USDC in the FACILITATOR address | $1 per buy; refresh every 5 min. Fund 1-10 USDC for days of operation. |
| `CT_DAILY_USDC_CENTS_MAX` | Optional; set to e.g. `500` (=$5/day) as a safety cap (`cheaptokens.ts:174, 230`). |

### 5.4 Required for Surplus provider (BROKEN — do not enable until §4.1 is fixed)

| Env var | Notes |
|---|---|
| `SURPLUS_WALLET_PRIVATE_KEY` | 0x + 64 hex. **Separate from FACILITATOR_PRIVATE_KEY** (`surplus.ts:285`). |
| `SURPLUS_SETTLEMENT_CONTRACT` | `0x0770d2124C0a581C28Cfc47a659817145e6Cc137` (Base settlement proxy; from `.env.example:189`). |
| `SURPLUS_USDC_CONTRACT` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` (Base USDC; from `.env.example:191`). |
| `SURPLUS_PERMIT2_CONTRACT` | `0x000000000022D473030F116dDEE9F6B43aC78BA3` (from `.env.example:190`). |
| `SURPLUS_CHAIN_ID` | `8453` (default). |
| `SURPLUS_MIN_DISCOUNT_PCT` | `0` (default) — accept any. |
| `SURPLUS_DEFAULT_SCHEME` | `upto` (default) or `exact`. |
| USDC in the SURPLUS address | Per-call. Budget unknown; depends on discount. |

**Until §4.1 is fixed, do not route models to `surplus`. The provider-health probe (`surplusHealthCheck` at `surplus.ts:414-459`) will succeed (it doesn't need payment), so the provider will appear "up" and waste a slot in the failover chain.**

### 5.5 Optional (recommended for production hygiene)

| Env var | Notes |
|---|---|
| `TREASURY_PRIVATE_KEY` | 0x + 64 hex. Cold-side sweep. Without this, `/admin/sweep` returns 501 and funds are stranded in the hot wallet. |
| `ADMIN_SWEEP_ADDRESS` | 0x + 40 hex. Destination for sweeps (`config.ts:26-29`). |
| `HOUDINI_ADDRESS_TO` | 0x + 40 hex. Alternative merchant payee (`facilitator.ts:727`). |
| `CORS_ORIGIN` | Comma-separated. Default `http://localhost:3000` (`config.ts:73`). Refuses `*` in prod (`index.ts:62-65`). |
| `ONRAMP_WEBHOOK_SECRET` | For fiat-ramp webhooks. Warn-only in prod (`config.ts:265-267`). |
| `OMA_PRICE_OVERRIDE` | Number. Forces oracle price. If unset and CoinGecko is down, oracle returns `$0.10` and `isOracleLive()` returns false (`oracle.ts:57-68`). |
| `CHAIN_RPC_URL_FALLBACK` | Alternative Base RPC. Used in `verifyEvmPayment` retry (`facilitator.ts:335-340`). |
| `TRUSTED_PROXY_IPS` | Comma-separated. Only trust X-Forwarded-For from these (`config.ts:158`). |
| `ADMIN_WALLET_ADDRESSES` | Comma-separated EVM addresses. Allowlist for admin routes (`config.ts:94`). |
| `PLATFORM_TEAM_ID` | Internal team id. |
| `JWT_SECRET`, `RECEIPT_HMAC_SECRET`, `CSRF_SECRET`, `ENCRYPTION_KEY` | Production-grade random values, NOT the dev defaults. |

### 5.6 NOT needed for inference (despite names)

- `TINYFISH_API_KEY` — only needed for `/v1/fetch` and search-augmented chat (`routes/fetch.ts`, `.env.example:39-40`).
- `HOUDINI_API_KEY` / `HOUDINI_API_SECRET` / `HOUDINI_WEBHOOK_SECRET` — only for the cross-chain Houdini bridge (`routes/deposit/houdini*`).
- `SURPLUS_VERIFIER_CONTRACT` — legacy EIP-712 verifier; superseded by `SURPLUS_SETTLEMENT_CONTRACT` per `surplus.ts:312-314`.
- `OPENROUTER_REFERRER`, `OPENROUTER_VENICE_KEY`, `OPENROUTER_ALLOW_FALLBACKS` — fine-tuning, not required.

---

## 6. Step-by-step "fund 3 wallets, run the thing" recipe

```bash
# 1. Generate three EVM addresses (use any tool — viem, cast, MetaMask).
#    We will refer to them as:
#       TREASURY  = 0x1111...   (merchant payee, receives customer USDC)
#       FACILITATOR = 0x2222... (signs CheapTokens USDC transfers)
#       SURPLUS   = 0x3333...   (signs Surplus x402 payments — DEFER until §4.1 fixed)

# 2. Send USDC to TREASURY on Base. This is where customers will pay.
#    Also send a small amount of ETH to TREASURY for any future on-chain ops.

# 3. Send ~5 USDC to FACILITATOR. This funds auto-buy of Venice keys ($1 each,
#    refresh every ~5 min, so 5 USDC ≈ 8 hours of cheap-key operation).

# 4. (Skip SURPLUS for now — surplus is broken per §4.1.)

# 5. Derive private keys for TREASURY (you control the cold sweep key —
#    ideally a hardware wallet) and FACILITATOR (a hot key the server uses).

# 6. Set env:
export DATABASE_URL=postgresql://...
export REDIS_URL=redis://...
export JWT_SECRET=$(openssl rand -hex 32)            # 64 chars
export ENCRYPTION_KEY=$(openssl rand -hex 16)        # 32 chars
export RECEIPT_HMAC_SECRET=$(openssl rand -hex 32)
export CSRF_SECRET=$(openssl rand -hex 16)           # 32 chars
export NODE_ENV=production
export FACILITATOR_MODE=live
export TREASURY_BASE_ADDRESS=0x1111...
export FACILITATOR_PRIVATE_KEY=0x<facilitator-pk>
export CHEAPTOKENS_ADDRESS=0x<cheap-tokens-real-payee>  # get from cheaptokens.ai — do NOT use your own
export CHAIN_RPC_URL=https://base-rpc.publicnode.com
export VENICE_API_KEY=sk-...                        # buy one from venice.ai as fallback
# Optional but recommended:
export OPENROUTER_API_KEY=sk-or-...                 # failover
export TREASURY_PRIVATE_KEY=0x<treasury-cold-pk>    # for sweeps
export ADMIN_SWEEP_ADDRESS=0x<your-custodial-cold>  # where profits go
export CORS_ORIGIN=https://app.your-domain.com

# 7. Start the server. First request to Venice will trigger CheapTokens
#    refresh in the background; meanwhile VENICE_API_KEY is used directly.
#    Once CheapTokens successfully buys, the next request uses the
#    24h reseller key. Repeat every ~5 min if cache is stale (line 194).
```

---

## 7. Risk register (for the operator's eyes only)

1. **Single FACILITATOR key compromise = unbounded USDC drain.** Every CheapTokens refresh is a fresh on-chain transfer; the key has no daily limit by default (`CT_DAILY_USDC_CENTS_MAX=0` = no cap). Set the cap to a sane number (e.g. $5 = `500` cents) before exposing to production traffic.
2. **No automatic refill of FACILITATOR.** When the $1 buys drain the FACILITATOR's USDC, all subsequent CheapTokens refreshes fail silently, and Venice falls back to `VENICE_API_KEY` (which you must buy separately). There is no alert, no webhook, no email.
3. **No automatic refill of SURPLUS.** Same problem. And there is no working Surplus path today (§4.1), so this is moot until that is fixed.
4. **`VENICE_API_KEY` is the only thing that survives CheapTokens failure.** If the FACILITATOR key is compromised and you rotate it, you still need a working `VENICE_API_KEY` from Venice directly (paid plan) to keep inference alive. This is a hard dependency on a third-party SaaS.
5. **Provider health is in-process + Redis.** Restart the server → all circuit breaker counters reset. A brief flood of failing requests right after restart can re-open a circuit that was just about to recover.
6. **`FACILITATOR_MODE=mock` is the default.** Any deployment that forgets to set `FACILITATOR_MODE=live` will silently accept unsigned payments. The fatal-guard at `config.ts:225-227` only fires when `NODE_ENV` is in `["production", "staging", "prod", "preview"]` AND the env is set to `mock`. A misconfigured `NODE_ENV=production` + `FACILITATOR_MODE` unset is the worst case: production env-guard fires, but if the operator typed `FACILITATOR_MODE=development` (not a valid enum value) the zod parse at line 66 will throw, which is good. If they omit it entirely, the default `mock` will be used and the prod guard will fail at startup. So the trap is only real in dev/staging/preview where `mock` is allowed.
7. **Oracle fallback at $0.10 is silently cheap.** If CoinGecko is unreachable AND no `OMA_PRICE_OVERRIDE` is set, the oracle reports `$0.10` per OMA and `isOracleLive()` returns false. Any consumer that fails to call `isOracleLive()` before billing will undercharge ~80% (assuming a real OMA price closer to $0.50).

---

## 8. Summary table — what the operator must do

| Goal | What to do | What it costs |
|---|---|---|
| Serve any chat completion | Set `VENICE_API_KEY` (or one of: OpenRouter / Together / DeepInfra / Morpheus / LiteLLM / Anthropic / Gemini key) | Subscription to that provider |
| Receive customer x402 payments | Set `TREASURY_BASE_ADDRESS` (real address, not placeholder) + fund with USDC | USDC balance on Base |
| Auto-buy cheap Venice keys | Set `FACILITATOR_PRIVATE_KEY` + `CHEAPTOKENS_ADDRESS` (real CheapTokens payee) + fund FACILITATOR with USDC + set `FACILITATOR_MODE=live` | ~$5 USDC for a day of operation |
| Use Surplus provider | **DO NOT** — broken per §4.1. Wait for `github.com/oma-ai/oma-ai/issues/surplus-x402-schemes` | n/a |
| Sweep profits to cold storage | Set `TREASURY_PRIVATE_KEY` + `ADMIN_SWEEP_ADDRESS` (must be reachable from TREASURY_BASE_ADDRESS) | Operator action |
| Direct x402 pay-per-call chat | **DO NOT** — endpoint returns 501 per §4.2 | n/a |
| Prevent runaway CheapTokens spend | Set `CT_DAILY_USDC_CENTS_MAX` (e.g. `500` = $5/day cap) | Free |

---

*Audit date: 2026-06-14. All `file:line` citations verified against the working tree at this date. Tracked issues referenced:*
- *Surplus EIP-712 scheme mismatch (`server/src/inference/surplus.ts:295-311`)*
- *x402 proxy 501 stub (`server/src/x402/facilitator.ts:791-820`)*
- *CheapTokens lazy refresh + expired-key reuse (`server/src/inference/cheaptokens.ts:194-201`)*
- *CHEAPTOKENS_ADDRESS falls back to TREASURY_BASE_ADDRESS (`server/src/inference/cheaptokens.ts:124`)*
