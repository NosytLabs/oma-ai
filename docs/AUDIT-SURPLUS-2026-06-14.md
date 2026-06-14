# OMA-AI Audit — Surplus Intelligence Provider Viability (2026-06-14)

**Auditor:** Planner D (read-only, no source modifications)
**Scope:** `server/src/inference/{surplus,models,router,provider-factory,provider-health,credit-preflight,billing-service,call-provider,provider-selector,vendor-meta,types,affinity,base}.ts` + `server/src/routes/admin/surplus.ts` + `server/src/config.ts` + `server/models.json` + `server/.env.example` + `server/src/jobs/*` + `server/src/middleware/rate-limit/utils.ts` + `https://surplusintelligence.ai/llms.txt`.
**Method:** Direct file read, cross-reference with router + call-provider, fetch of vendor docs, grep for wallet-replenishment / 402 / x402 patterns. No code was modified.

---

## TL;DR

**Verdict: NOT VIABLE to resell Surplus Intelligence inference today.** Three independent breaks would prevent any end-to-end success even in the best-case deployment:

1. **The EIP-712 payment signature is wrong** (the TRACKED ISSUE comment at `surplus.ts:303` is still unfixed). Every 402 retry will be rejected by the facilitator. Tests pin the wrong behavior, masking the bug.
2. **The model catalog contains zero Surplus entries** in both `models.json` and `FALLBACK_MODELS`. The router has no model to send to Surplus even if signing worked.
3. **`inferProviderFromModel` never returns `"surplus"`** — the unknown-model fallback is `antseed`, and every opensource prefix (deepseek, llama, etc.) is also pinned to `antseed`. Surplus is reachable only via explicit `primaryProvider: "surplus"` in the catalog or `MODEL_WEIGHTS` env var.

Two more operational gaps make it a paper-only path:
- **No wallet-replenishment job.** The `SURPLUS_WALLET_PRIVATE_KEY` hot wallet will drain to $0 with no recovery path short of the operator manually sweeping USDC in. The only wallet-balance visibility is a one-shot read in `GET /v1/admin/ledger/hot-vs-cold-report`.
- **Vendor docs show the x402 protocol is v2 with a base64-encoded `PAYMENT-SIGNATURE` header.** OMA emits `x402Version: String(paymentData.x402Version)` but writes the header as raw JSON, not base64. Probably a hard fail.

Two P0 fixes (correct signer + add models) would unblock testing. Two more (wallet-replenishment cron, header encoding) are required before any production traffic.

---

## Summary Table

| # | Severity | Area | Issue | File:Line |
|---|----------|------|-------|-----------|
| 1 | **P0** | EIP-712 signing | `signPayment()` signs a custom `Payment` type with `verifyingContract = settlement proxy (0x0770…c137)`. Per Surplus docs, the `upto` scheme requires a Permit2 `PermitWitnessTransferFrom` signed against the **Permit2 contract** (0x0000…BA3, name "Permit2"), and `exact` requires EIP-3009 `TransferWithAuthorization` signed against the **USDC contract** (0x833589…2913, name "USD Coin", version "2"). The current signature will be **rejected by the facilitator on every retry**. The TRACKED ISSUE comment in source acknowledges this is unfixed. | `surplus.ts:282-364` (signer), `surplus.ts:303-311` (TRACKED ISSUE), `surplus.ts:330-351` (wrong domain/types) |
| 2 | **P0** | Model catalog | `server/models.json` has 0 entries with `surplusId` or `"provider": "surplus"`. `FALLBACK_MODELS` in `models.ts` has 0 Surplus entries. Router has no model to route to Surplus. | `models.json` (0 matches), `models.ts:69-359` (no Surplus in FALLBACK_MODELS) |
| 3 | **P0** | Provider selection | `inferProviderFromModel` (`provider-selector.ts:14-26`) never returns `"surplus"`. The default fallthrough is `"antseed"`. Even if catalog had Surplus models, a request like `model: "deepseek-v3"` would always pick Antseed. Surplus is reachable only via explicit `primaryProvider: "surplus"` in catalog or a `MODEL_WEIGHTS` env var that names `"surplus"`. | `provider-selector.ts:14-26` |
| 4 | **HIGH** | Wallet ops | **No background job replenishes the `SURPLUS_WALLET_PRIVATE_KEY` USDC balance.** The wallet is the only signer for x402 payments; once it runs out, every retry 402-fails with no auto-recovery. The `/v1/admin/ledger/hot-vs-cold-report` endpoint shows balance but does not trigger a sweep. Operator must monitor and top up manually. | `server/src/jobs/*` (no replenishment job exists; 0 hits on `replenish\|top.?up\|low.?balance`); `admin/ledger.ts:199-260` (read-only report) |
| 5 | **HIGH** | x402 protocol | Vendor docs say `PAYMENT-SIGNATURE` is a **base64-encoded** JSON payload; OMA sends it as **`JSON.stringify(...)` (raw JSON)** (`surplus.ts:192`). Facilitator will likely fail to decode. The test (`__tests__/surplus.test.ts:99-100`) explicitly asserts `JSON.parse(paymentSignatureHeader)` succeeds — which only proves the wrong format. | `surplus.ts:192`, `llms.txt` (Step 2 example), `__tests__/surplus.test.ts:97-100` |
| 6 | **HIGH** | x402 protocol | Vendor is on x402 **v2**; OMA stamps `x402Version: String(paymentData.x402Version)` (i.e. `"2"`) but the rest of the payload and the envelope shape were written for v1 (a custom `Payment` EIP-712 type, no `accepted` field, no `resource` field forwarded as nonce). Without a real v2 client (e.g. `@x402/evm`'s `UptoEvmScheme`), this is a guess. | `surplus.ts:181-186`, `llms.txt` (Step 2 SDK example) |
| 7 | **HIGH** | Test coverage | The test at `__tests__/surplus.test.ts:121-126` **pins the wrong behavior** — it asserts the `verifyingContract` is the settlement proxy and explicitly forbids the recipient address. The test was written to match the buggy implementation, not the correct x402 scheme. Any future fix to the signer will fail tests, hiding the bug from CI. | `__tests__/surplus.test.ts:115-129` |
| 8 | **MED** | Network field | Surplus `accepts[].network` is `"eip155:8453"` (CAIP-2 form per vendor docs); the signed `Payment` type's `network` field is `string` and is passed through verbatim to EIP-712. The facilitator expects the same `eip155:8453` token in both the signed message and the 402 challenge. Mostly fine, but any downstream facilitator change that strict-matches the format would break. | `surplus.ts:348`, `llms.txt` (402 example) |
| 9 | **MED** | Health check URL drift | `provider-health.ts:372` has `surplus: "https://api.surplusintelligence.ai"` but the actual x402 base is `https://www.surplusintelligence.ai` (per `surplus.ts:7` and `llms.txt`). The `getProviderBaseUrl` value is dead code (the surplus branch in `probeIdleProviders` at `provider-health.ts:351-354` calls `surplusHealthCheck()` directly), but it's a drift trap for future refactors. | `provider-health.ts:372` vs `surplus.ts:7` |
| 10 | **MED** | Rate limits | `middleware/rate-limit/utils.ts:12-110` (MODEL_LIMITS) has no entries for any Surplus-served model. If a model *is* added to the catalog with `primaryProvider: "surplus"`, it falls through to the catch-all 60-rpm cap. Downstream 429s from Surplus would also hit the catch-all (no per-provider throttle). Provider circuit breaker does treat 429 as retryable (`base.ts:269`), so a Surplus-side rate-limit storm will flap the breaker. | `middleware/rate-limit/utils.ts:12-110`, `base.ts:269` |
| 11 | **MED** | Credit preflight | `credit-preflight.ts` does **not** account for the fact that the user is charged OMA credits while OMA pays Surplus in USDC. The x402 cost basis is the `amount` field in the 402 response, but OMA pre-deducts against `getModelPricing()` which (for unknown model ids) falls back to `0.001 / 0.002` per 1k tokens with 150% markup. For most `surplus/*` model ids this means OMA charges the user a flat rate and pays Surplus the exact 402 quote. There is no margin floor for Surplus specifically. | `credit-preflight.ts:1-32`, `billing-service.ts:36-38` (fallback), `router.ts:99-114` |
| 12 | **MED** | Dynamic imports | `surplus.ts:318-320` `await import("viem")` + `await import("viem/accounts")` + `await import("viem/chains")` inside `signPayment()`. Adds 100-300ms latency on first call after process start. Top-level imports would amortize this. (Carried over from V6 audit #7, restated because it's more impactful here — the signer is on the hot path for every Surplus request.) | `surplus.ts:318-320` |
| 13 | **MED** | Empty authorization field | `surplus.ts:184` sets `authorization: ""` in the `SurplusPaymentSignatureEnvelope`. The envelope is non-standard (Surplus docs show a base64-encoded JSON, not a `{x402Version, signature, authorization, payload}` shape). The empty `authorization` may or may not be accepted depending on the facilitator's parser. | `surplus.ts:181-186` |
| 14 | **LOW** | Config range mismatch | `surplus.ts:15-22` clamps `minDiscountPct` to 0-90 (returns 0 out-of-range); `config.ts:178` allows 0-100. Same input validated by two different rules. (Carried from V6 audit #14.) | `surplus.ts:15-22` vs `config.ts:178` |
| 15 | **LOW** | Provider health — idle-only | `surplusHealthCheck` is only called by the idle-probe loop (`provider-health.ts:351-354`). Under sustained load, Surplus is never re-probed. The circuit breaker still tracks per-request success/failure via `callProvider` (via `reportProviderResult` in `call-provider.ts:83-88`), so the breaker will trip on real failures — but the health record's `isUp` flag will not flip from a successful load period. (INFO-grade, not a bug.) | `provider-health.ts:344-362` |
| 16 | **LOW** | Health-check semantics | `surplusHealthCheck` treats any 200 from `/api/inference/v1/models` as "up". The endpoint may return 200 with an empty `data` array during a market outage. Acceptable approximation but masks partial degradation. | `surplus.ts:414-459` |
| 17 | **LOW** | `vendor-meta.ts` `baseUrl` | `vendor-meta.ts:147` says `baseUrl: "https://api.surplusintelligence.ai/v1"`. This is the OpenAI-compatible endpoint that the docs say exists only for **API-key authenticated** users (`inf_xxx`), not for x402 per-request. The OMA surplus client targets `https://www.surplusintelligence.ai/x402/...` — the two are not interchangeable. Used only in admin/debug displays, not on the hot path. | `vendor-meta.ts:147` |
| 18 | **LOW** | `models.ts` test entry | The existing test (`__tests__/surplus.test.ts:89`) calls `surplusChatCompletion({ model: "surplus/deepseek-r1", ... })` and the unit passes, but this is a *unit test of the client* — the `model` field is just passed through. Nothing in the catalog registers `surplus/deepseek-r1`, so a real `/v1/chat/completions` request with that model id would 400 at `chat-completions.ts:81-89` ("Model not found"). | `__tests__/surplus.test.ts:89`, `chat-completions.ts:80-89` |

---

## Section 1: Question-by-Question Answers

### Q1 — EIP-712 signing scheme

**Verdict: BROKEN. The TRACKED ISSUE is still open.**

`surplus.ts:282-364` `signPayment()` builds a single, scheme-agnostic EIP-712 message:

```ts
domain: {
  name: "Surplus Intelligence",      // line 331
  version: "1",                      // line 332
  chainId,                           // 8453
  verifyingContract,                 // 0x0770…c137 (settlement proxy)
}
types: {
  Payment: [
    { name: "payTo", type: "address" },
    { name: "asset", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "network", type: "string" },
  ],
}
```

The vendor docs (`https://surplusintelligence.ai/llms.txt`) are explicit about the correct schemes:

> "For `upto`, sign a Permit2 witness authorization for the maximum `amount` in the 402 response. SI settles only the actual usage after inference succeeds. For `exact`, sign an EIP-3009 `TransferWithAuthorization` for the fixed amount."

The vendor's recommended `UptoEvmScheme` client signs against:

- **Permit2 contract** `0x000000000022D473030F116dDEE9F6B43aC78BA3`
- EIP-712 domain `{ name: "Permit2", chainId: 8453, verifyingContract: 0x0000…BA3 }`
- A `PermitWitnessTransferFrom` typed structure with `permitted`, `spender`, `nonce`, `deadline`, `witness` fields (the witness carries the payment intent).

For `exact` (EIP-3009) the verifier is the USDC contract `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` with domain `{ name: "USD Coin", version: "2", chainId: 8453, verifyingContract: USDC }`.

The OMA code signs against the **settlement proxy** (`0x0770…c137`) with a **made-up `Payment` type**. Neither the domain nor the types match either of the two valid schemes. The facilitator will reject on signature recovery.

**Concrete fix:** Replace `signPayment()` with two scheme-specific signers:
- `signExact(paymentData)` — use `@x402/evm`'s `ExactEvmScheme` or hand-roll an EIP-3009 `TransferWithAuthorization` against USDC with `{ name: "USD Coin", version: "2", chainId: 8453, verifyingContract: 0x833589…2913 }`.
- `signUpto(paymentData)` — use `@x402/evm`'s `UptoEvmScheme` (which signs Permit2 `PermitWitnessTransferFrom`).

This is a 2-3 day refactor. The `payTo` field is the recipient address from the 402 response, the `asset` is USDC, and the EIP-712 types differ by scheme. See the vendor's llms.txt SDK example for the canonical `UptoEvmScheme.createPaymentPayload(2, upto)` call.

### Q2 — Wallet-replenishment cron

**Verdict: DOES NOT EXIST.**

```
$ grep -r "replenish\|top.?up\|low.?balance\|wallet.?balance" server/src/jobs/
$ ls server/src/jobs/
credit-expiry.ts  deposit-notifications.ts  deposit-recovery.ts
deposit-retry.ts  nonce-cleanup.ts          ratio-sync-cron.ts  subscription-cron.ts
```

None of the 7 jobs touch `SURPLUS_WALLET_PRIVATE_KEY`. The only place the wallet is read is:

- `surplus.ts:285-293` — read the private key, throw if missing.
- `admin/ledger.ts:199-260` — derive the address, report USDC + ETH balance. **Read-only**, no sweep.

There is no auto-replenish, no alerting, no "low balance" hook. The operator must:
1. Watch `/v1/admin/ledger/hot-vs-cold-report` manually (the report endpoint will show the USDC balance).
2. Send USDC to the derived address from cold storage.
3. Optionally call `setBalanceAlert` (does not exist — only an admin sweep route via `ADMIN_SWEEP_ADDRESS`/`TREASURY_PRIVATE_KEY` exists for the *facilitator* wallet, not the Surplus wallet).

**Concrete fix:** Add a `wallet-balance-monitor.ts` job to `server/src/jobs/` that:
1. Derives the Surplus wallet address from `SURPLUS_WALLET_PRIVATE_KEY`.
2. Reads the USDC balance via the existing public client.
3. If balance < threshold (e.g. $25), emits a structured log + a webhook/notification.
4. Optionally triggers a `TREASURY_PRIVATE_KEY → SURPLUS_WALLET_PRIVATE_KEY` USDC transfer for amounts up to a daily cap (similar to the existing `deposit-retry.ts` pattern).

Until this exists, production Surplus routing is operationally unsafe — a single bad day of traffic drains the wallet, and the gateway starts 502-failing silently.

### Q3 — Rate limits on Surplus side

**Verdict: Vendor does not publish a rate limit.** The `llms.txt` endpoint table is the only rate-limit-adjacent field: `maxTimeoutSeconds: 120` in the 402 response (a payment-validity window, not a request-per-second cap). Vendor says "no marketplace per-hour seller quota cap" on the seller side but does not commit to a per-buyer limit.

**What OMA does today:**
- Per-model RPM/TPM in `middleware/rate-limit/utils.ts:12-110` is the *inbound* throttle. No Surplus-served model is in this table.
- Default catch-all (`utils.ts:51-60`) caps at 60 rpm / 120k tpm.
- Surplus-side 429s are mapped to `type: "rate_limit"` by `base.ts:269` (retryable in circuit breaker) and by the catch-all in `provider-error.ts`.

**Risk:** A Surplus-side 429 (which we have no visibility into until it happens) will open the circuit after `FAILURE_THRESHOLD = 5` consecutive failures (`provider-health.ts:8, 226-234`). At that point the breaker is open for 60s before re-probing. During the open period, every Surplus-eligible request is rerouted to the next fallback provider, which may itself be overloaded. No model-specific damping is in place.

**Concrete fix:** Add Surplus-served models to `MODEL_LIMITS` (use the same values as the equivalent Venice/OpenRouter tier, or 60/120k as a safe default). Optionally add a `surplus: { rpm: 100 }` provider-level cap and gate it via `surplusHealthCheck()` recent success. Also consider: when a 402 is returned, treat the response as a *signal that we have a viable payment path* and do **not** increment the circuit-breaker failure counter for that request.

### Q4 — Minimum user setup for end-to-end Surplus routing

For `/v1/chat/completions` to route to Surplus and return 200, the operator must:

1. **Set `SURPLUS_WALLET_PRIVATE_KEY`** in `server/.env` to a 0x-prefixed 64-hex-char key for a Base address that holds USDC. (Already documented in `server/.env.example:91-93`.)
2. **Set `SURPLUS_SETTLEMENT_CONTRACT=0x0770d2124C0a581C28Cfc47a659817145e6Cc137`** in `server/.env` (or rely on the future default; the current default is unset).
3. **Set `SURPLUS_PERMIT2_CONTRACT=0x000000000022D473030F116dDEE9F6B43aC78BA3`** and **`SURPLUS_USDC_CONTRACT=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`** (vendor mandates both for `upto`).
4. **Approve Permit2 to spend USDC on behalf of `SURPLUS_WALLET_PRIVATE_KEY`** — a one-time tx from the operator. Without this, every `upto` request will fail at the facilitator's Permit2 pull step. This is not currently automated anywhere in the codebase.
5. **Top up the wallet with USDC** (Base mainnet).
6. **Add at least one model to `server/models.json`** with `"primaryProvider": "surplus"` and a `"surplusId"` field set to the Surplus model name (e.g. `"llama-3.3-70b"`, `"deepseek-v3"`, or any of the 104 listed in the vendor's catalog).
7. **(Optional but recommended)** Set `SURPLUS_MIN_DISCOUNT_PCT` to a floor (e.g. 25) to avoid routing to Surplus when the discount is unattractive.
8. **Fix the EIP-712 signer** (issue #1 above) — without this, step 6 will not produce a successful retry, regardless of all other configuration.

That is the minimum. Without issue #1 fixed, no amount of configuration will produce a successful response.

### Q5 — Is `surplusHealthCheck` actually called?

**Yes, but only in the idle-probe path.**

```
provider-health.ts:351-354:
  if (provider === "surplus") {
    const result = await surplusHealthCheck();
    isUp = result.isUp;
    latencyMs = result.latencyMs ?? 0;
  }
```

This runs every `PROBE_INTERVAL_MS = 45_000` ms (line 79) for any provider that has been idle for `IDLE_THRESHOLD_MS = 60_000` ms. So:
- If the gateway is at sustained >1 rpm on the surplus provider, surplus is **never** probed. (Health is derived from `callProvider`'s `reportProviderResult` instead, which is fine.)
- If the gateway is idle, surplus is probed every 45s and the result updates the in-memory + Redis + DB health record.

It is **also** wired to `GET /v1/admin/surplus/health` (`admin/surplus.ts:20-28`) so an operator can force a check.

The call site is correct. The only concern is the *base URL drift* (issue #9): the fallback `getProviderBaseUrl("surplus")` is `https://api.surplusintelligence.ai` (no `www.`), which is never used in practice because the surplus branch always calls `surplusHealthCheck()` directly — but it's a code-smell.

### Q6 — Is the model list from `/api/inference/v1/models` actually populated?

**No. Not in the runtime catalog.**

```
$ grep -c '"surplusId"' server/models.json
0
$ grep -c '"surplus"' server/models.json
0
```

`server/models.json` is the runtime catalog (loaded at `index.ts:60` via `reloadModelCatalog()`). The `vendor-meta.ts:144-159` entry for Surplus is *metadata for the admin UI / provider-usage reports* — it does not populate `MODEL_CATALOG`.

`models.ts:69-359` `FALLBACK_MODELS` (used when `models.json` is missing) has 0 Surplus entries either.

**Two consequences:**
1. `/v1/admin/surplus/models` will work (it calls `surplusListModels()` directly, hits the vendor, returns the live list) — but the result is not merged into the gateway's routing catalog.
2. `getModel("surplus/llama-3.3-70b")` returns `null`, so `chat-completions.ts:81-89` rejects the request with 400 "Model not found". A user cannot select a Surplus model by passing `surplus/...` as the model id.

**Concrete fix:** Either (a) add manual entries to `server/models.json` for the 5-10 most popular Surplus models with the correct upstream id (`llama-3.3-70b`, `deepseek-v3`, `gpt-5.2`, `claude-sonnet-4.5`, etc.), or (b) extend `reloadModelCatalog()` to merge the live Surplus catalog into `MODEL_CATALOG` on a 5-minute cron (similar to `ratio-sync-cron.ts`). Option (a) is the lazy, explicit choice. Option (b) is the "always up to date" choice but requires the signer to actually work first (otherwise the cron will hammer Surplus with 402s and never get a model list).

### Q7 — Does the router use Surplus as a fallback?

**Conditional on the catalog and weights, not automatic.**

`provider-selector.ts:96-132` `selectProvider(model)` does, in order:

1. **`MODEL_WEIGHTS`** env var — if it names a weight for this model, pick from that distribution (so `MODEL_WEIGHTS=llama-3.3-70b=surplus:100` works).
2. **`PROVIDER_WEIGHTS`** env var — same logic at the provider level.
3. **`isProviderAvailable(modelDef.primaryProvider)`** — the model's `primaryProvider`. If catalog has no entry, this falls through to `inferProviderFromModel()`.
4. **Fallback** — `ALL_PROVIDERS` minus preferred, in order, pick the first `isProviderAvailable` one.

`inferProviderFromModel()` (`provider-selector.ts:14-26`) returns `"surplus"` **never**. Every prefix check goes to antseed/openrouter/together/deepinfra/litellm/morpheus/claude/gemini. The fallthrough is `"antseed"`.

So: Surplus is reachable only if the operator (a) adds catalog entries with `primaryProvider: "surplus"`, or (b) sets `MODEL_WEIGHTS` / `PROVIDER_WEIGHTS` to include `"surplus"`. There is no automatic failover *to* Surplus.

**Concrete fix:** Add an explicit "discount routing" path. When all preferred providers return 429/503 (or specifically, when the Surplus min-discount is attractive), the router should consider surplus as a primary. Two options:
- Add a `discountFloor` threshold per provider and only route to Surplus when the live 402 `amount` implies a discount ≥ the floor.
- Treat Surplus as the *first* fallback in `ALL_PROVIDERS` (move `"surplus"` to position 0) so it gets picked if the primary is open-circuit. (Cheap, no extra logic, but means Surplus is hit on every primary failure — may drain the wallet faster than expected.)

---

## Section 2: How the pieces fit (or don't)

```
                          ┌──────────────────┐
                          │  /v1/chat/       │
                          │  completions     │
                          └────────┬─────────┘
                                   │ (1) validate body
                                   ▼
                          ┌──────────────────┐
                          │  router.ts:      │  ◄── (a) catalog empty → 400
                          │  handleChat      │      (b) signer broken → 402 forever
                          │  Completion      │      (c) no Surplus in selector → never picked
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  selectProvider  │  ◄── (d) primaryProvider = "surplus" requires
                          │  (provider-      │      catalog entry (none today)
                          │  selector.ts)    │  ◄── (e) no MODEL_WEIGHTS → no Surplus pick
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  callProvider    │
                          │  → surplus.surplus│
                          │  ChatCompletion  │
                          └────────┬─────────┘
                                   │ (probe POST)
                                   ▼
                          ┌──────────────────┐
                          │  POST /x402/...  │  ◄── 200 happy path
                          │  402 payment req │      returns immediately (no x402)
                          └────────┬─────────┘
                                   │ (probe returns 402)
                                   ▼
                          ┌──────────────────┐
                          │  signPayment()   │  ◄── BROKEN: wrong EIP-712 type + wrong
                          │  surplus.ts:282  │      verifyingContract; also:
                          │                  │      - PAYMENT-SIGNATURE is raw JSON, not base64
                          │                  │      - uses dynamic viem imports
                          └────────┬─────────┘
                                   │
                                   ▼
                          ┌──────────────────┐
                          │  POST /x402/...  │  ◄── facilitator rejects signature → 402
                          │  with PAYMENT-   │      → Surplus throws "payment failed"
                          │  SIGNATURE       │      → circuit-breaker failure
                          └──────────────────┘      → wallet just paid gas for nothing
```

The 4 things that must all be true for a single end-to-end success:
1. Model id exists in `MODEL_CATALOG` with `primaryProvider: "surplus"` (or `MODEL_WEIGHTS` includes surplus).
2. `selectProvider` returns `provider: "surplus"` (no circuit open, no `isProviderAvailable` rejection).
3. EIP-712 signature is scheme-correct (Permit2 for `upto`, EIP-3009 for `exact`) and the `PAYMENT-SIGNATURE` header is **base64-encoded** JSON per vendor spec.
4. `SURPLUS_WALLET_PRIVATE_KEY` wallet holds enough USDC; the `Permit2` contract has been approved to spend USDC on its behalf (one-time setup).

**None** of the 4 are true today.

---

## Section 3: Recommended Fix Order

1. **(P0) Fix the EIP-712 signer.** Replace `signPayment()` with two scheme-specific signers using `@x402/evm`'s `ExactEvmScheme` and `UptoEvmScheme`. Update `__tests__/surplus.test.ts` to assert the correct domain (USDC or Permit2) — *not* the settlement proxy. Land with `npm run typecheck && npm run test && npm run lint`.
2. **(P0) Base64-encode the `PAYMENT-SIGNATURE` header.** `surplus.ts:192` change `JSON.stringify(paymentSignature)` → `Buffer.from(JSON.stringify(paymentSignature)).toString("base64")`. Update the test that asserts `JSON.parse(...)` succeeds.
3. **(P0) Add catalog entries.** Insert 5-10 popular Surplus models into `server/models.json` with `primaryProvider: "surplus"`. Suggested set: `llama-3.3-70b`, `deepseek-v3`, `qwen3-235b`, `gpt-5.2`, `claude-sonnet-4.5`. Set markup to 10% (matches other providers). Add a corresponding test in `__tests__/models.test.ts`.
4. **(HIGH) Wallet-replenishment job.** New `server/src/jobs/wallet-balance-monitor.ts` registered in `index.ts` alongside the other 7 jobs. Reports USDC balance; alerts (logs + admin notification) when below threshold; optionally sweeps from `TREASURY_PRIVATE_KEY` for amounts up to a daily cap.
5. **(HIGH) Permit2 approval runbook.** Add a one-time CLI script (`server/scripts/surplus-permit2-approve.ts`) that approves Permit2 to spend the operator's USDC. Document in `OWNER-ONBOARDING.md`.
6. **(MED) `inferProviderFromModel` parity.** Add a `surplusId` lookup so the prefix `surplus/` (or no-prefix models that the catalog maps to surplus) routes correctly. Even better, make the `OPENSOURCE_PREFIXES` loop exclude any model the catalog has explicitly mapped to Surplus.
7. **(MED) Add `surplus/*` to `MODEL_LIMITS`.** Pick 60 rpm / 120k tpm for premium and 120/240k for budget tier. Provider-level throttle of 100 rpm as a safety cap.
8. **(LOW) Move viem imports to top-level.** `surplus.ts:318-320` → `import { createWalletClient, http } from "viem"` etc. at the top of the file.
9. **(LOW) Fix `provider-health.ts:372` base URL drift.** Change to `https://www.surplusintelligence.ai` to match `surplus.ts:7` and the vendor docs.
10. **(LOW) Fix the `OPENSOURCE_PREFIXES` `"antseed/"` and `"minimax"` entries.** (Carried from V6 audit #12-13 — out of scope for this audit but worth noting since they affect the same `inferProviderFromModel` path.)

---

## Section 4: What was checked, what wasn't

**Read in full:**
- `server/src/inference/surplus.ts` (468 lines)
- `server/src/inference/__tests__/surplus.test.ts` (224 lines)
- `server/src/inference/models.ts` (544 lines)
- `server/src/inference/router.ts` (163 lines)
- `server/src/inference/provider-factory.ts` (97 lines)
- `server/src/inference/provider-health.ts` (409 lines)
- `server/src/inference/credit-preflight.ts` (32 lines)
- `server/src/inference/billing-service.ts` (93 lines)
- `server/src/inference/provider-selector.ts` (138 lines)
- `server/src/inference/call-provider.ts` (109 lines)
- `server/src/inference/vendor-meta.ts` (lines 130-170)
- `server/src/config.ts` (319 lines)
- `server/src/routes/admin/surplus.ts` (46 lines)
- `server/src/routes/admin/ledger.ts` (lines 180-260)
- `server/src/index.ts` (lines 1-80)
- `server/.env.example` (192 lines)
- `server/models.json` (grep for "surplus" — 0 hits)
- `server/src/middleware/rate-limit/utils.ts` (first 50 lines, grep for "surplus" — 0 hits)
- `server/src/jobs/*` (7 files, grep for "replenish\|top.?up\|low.?balance\|wallet.?balance" — 0 hits)

**Fetched:**
- `https://surplusintelligence.ai/llms.txt` (cached, full content)

**Not checked (out of scope or low value):**
- `server/src/__tests__/vendor-meta.isolated.test.ts` (just confirms `surplus` shows up in the meta list — not relevant to viability)
- `server/src/routes/admin/__tests__/surplus.test.ts` (admin route unit test, identical findings to the inference test)
- `server/src/inference/__tests__/provider-health.test.ts` (only relevant line 323-338, confirms the call site)
- `server/src/db/migrations/meta/0000_snapshot.json` (just contains `"surplus"` as a provider enum value — no action)
- `server/src/inference/affinity.ts:49,102` (lists `surplus` in the type union, no behavior)
- `server/src/inference/types.ts:11` (lists `surplus` in the type union, no behavior)

---

*Generated 2026-06-14 by read-only audit. No source files were modified.*
