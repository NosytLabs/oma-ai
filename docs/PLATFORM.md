# OMA platform

This document describes the platform as implemented. It is not a roadmap or a list of planned features.

For where each tier runs and how to deploy it, see [`DEPLOYMENT.md`](DEPLOYMENT.md). This is the source of truth for platform behavior and configuration; [`../BRAND.md`](../BRAND.md) owns visual and messaging guidance, and [`../README.md`](../README.md) is the repository entry point.

## Public host and API entry point

The canonical website host is `https://www.oma-ai.com`. The apex domain, `https://oma-ai.com`, 308-redirects to the `www` host. There is no `api.oma-ai.com`; the API is same-origin under `/api/*`.

Public SDK clients should use:

```text
https://www.oma-ai.com/api/v1
```

The OpenAI-compatible chat endpoint is therefore:

```text
POST https://www.oma-ai.com/api/v1/chat/completions
```

The Anthropic-compatible messages endpoint is:

```text
POST https://www.oma-ai.com/api/v1/messages
```

The model catalog is available without authentication at `GET https://www.oma-ai.com/api/v1/models`.

The x402 funding endpoints are not under `/api/v1`. Through the website's same-origin proxy they are:

```text
GET https://www.oma-ai.com/x402/info
POST https://www.oma-ai.com/x402/verify
POST https://www.oma-ai.com/x402/settle
```

## Billing model

OMA sells prepaid credits, not subscriptions and not recurring usage-based plans. A customer funds a credit balance, then successful API requests deduct the cost of those requests from that balance.

The conversion is:

```text
1 credit = US$0.01 = 1 US cent
```

The current card credit packs are:

| Pack | Price | Credits |
|---|---:|---:|
| Hobby | $10 | 1,000 |
| Builder | $50 | 5,000 |
| Scale | $250 | 25,000 |

The Postgres credit ledger is the authoritative record of deposits, remaining balance, and usage. Model prices are quoted in US dollars per 1 million input or output tokens. OMA converts the request cost to credits when recording the charge.

Website chat has a separate free daily allowance for eligible models. API-key requests always use the prepaid balance, including requests to models that are free in browser chat.

## Funding rails

### Card checkout

Polar is the merchant of record for card checkout. Card details are entered on Polar-hosted checkout and do not pass through OMA. A successful paid order triggers a signed Polar webhook, and OMA credits the purchased pack to the internal ledger.

Card checkout is available only when the Polar configuration is complete and the card rail is enabled. If it is unavailable, `POST /api/v1/checkout` returns an error and the deposit UI reports the live rail status.

| Endpoint | Auth | Purpose |
|---|---|---|
| `POST /api/v1/checkout` | Session cookie | Create a Polar checkout session for a credit pack; the card rail for real revenue. Callbacks arrive at `POST /webhooks/polar`. |

### USDC on Base

Users can fund the same internal balance with USDC on Base mainnet. Direct deposits are confirmed against the configured Base treasury address and credited after on-chain confirmation.

The browser uses the customer's injected EIP-1193 wallet, discovered through
EIP-6963 or legacy injection. It does not create a custodial OMA wallet or store
the customer's private key. WalletConnect QR/mobile sessions are implemented and
appear only when the website has a valid public `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
from OMA's Reown project. Configure its allowed origins, including the canonical
website host, before enabling it. The provider loads on an explicit connection
action, uses `/api/rpc/base` for Base RPC, and forwards account/disconnect events.
Discovery does not initialize the relay or open a pairing prompt. Until the ID is
configured, injected wallets remain available and the QR connector is hidden.
Magic-link users can sign in without a wallet and use card checkout when enabled.

Direct deposits first request `/api/v1/deposit/usdc/challenge` for the account
and sending wallet, then broadcast a USDC transfer and sign ownership proof bound
to its hash, recipient and amount. If proof signing or registration fails, the
UI preserves that transfer in account-scoped session storage and offers a fresh
proof/registration attempt. It never sends a second transfer on retry. This
recovery survives a reload in the same tab while storage is available; it is not
cross-device synchronization or evidence that funds confirmed. The sending
account is checked before transfer/signing, and account/disconnect events update
the form. Recovery requires the original sending account; the form offers wallet
selection before enabling registration. See the [settlement runbook](settlement-runbook.md) for recovery.

Programmatic direct-deposit registration uses the same EIP-191 message, joined
with newline characters and no trailing newline:

```text
OMA-AI deposit authorization

Sending wallet: <fromAddress>
Deposit to: <depositAddress>
Challenge: <challengeToken>
Transaction: <txHash>
Amount USD: <amountUsd>
```

Use the addresses and token returned for the original transfer, its actual hash,
and the same numeric USD value submitted to `/api/v1/deposit/usdc`. The amount
line uses JavaScript's string representation of that value (`10`, not `10.00`).
Request a fresh challenge before retrying proof registration; retain the hash
and transfer details instead of sending another transfer.

Three wallet roles are distinct: the customer holds the USDC; the configured
treasury receives it; the operator's facilitator key pays Base ETH gas for x402
relaying. A direct deposit instead requires gas in the customer's wallet. The
admin treasury panel reads each configured role's balance without transferring
funds. Configuration flags do not prove a funded gas wallet or successful payment.

Agents can use the x402 funding flow:

1. Establish a SIWE website session with the wallet that will pay. Its linked EVM address must equal the USDC payer; an API key or email-only session cannot claim the payment.
2. Read `payTo` from `GET /x402/info`. Sign an EIP-3009 USDC `transferWithAuthorization` for that recipient and the intended amount. The direct-deposit address from `/api/v1/deposit/usdc` can differ; do not substitute it for the x402 recipient.
3. Call `POST /x402/verify` with the signed envelope in `PAYMENT-SIGNATURE`. **This endpoint broadcasts the transfer and waits for on-chain confirmation. It is not a dry run.** The facilitator pays gas. Save the returned `txHash`, `amount`, and `networkId`.
4. Call `POST /x402/settle` with `{ txHash, networkId }` and the same payer's session cookie. Settlement credits the account balance; it does not initiate another transfer.
5. Use an API key from that account against the credited balance. Ordinary chat inference does not issue a mid-request x402 challenge.

The standard v2 header is base64-encoded JSON with `x402Version: 2`, `accepted: { scheme: "exact", network: "eip155:8453", asset, amount, payTo }`, and `payload: { signature, authorization }`. Authorization contains `from`, `to`, `value`, `validAfter`, `validBefore`, and `nonce`. The accepted amount and authorization value are integer strings in atomic USDC units (6 decimals) and must match; the accepted recipient must match the signed recipient. The treasury and Base USDC contract are server-pinned. Legacy raw-JSON OMA envelopes and the older base64 `X-PAYMENT` header remain supported.

A successful verify response returns top-level `{ valid: true, txHash, amount, networkId }`, with `amount` in decimal USDC. A successful settle response returns `{ settled: true, receipt, creditedCents }`; `receipt` is a signed string, and `PAYMENT-RESPONSE` is a base64 summary. Settlement accepts network `base` or `eip155:8453`, derives amounts from payment evidence, and preserves fractional credits.

Crediting is idempotent by transaction hash. If the verification cache is lost after a server restart, settlement can recover a confirmed transfer from Base USDC Transfer logs and bind its payer to the session wallet. The transaction's gas payer is the facilitator and must not be confused with the USDC sender. If funds moved but crediting failed, retry settlement with the same hash and payer session. A 409 `payment_already_credited` or `payment_reconciliation_required` conflict is not retryable; use support reconciliation, without authorizing another payment. A verification timeout can return a hash with `valid: false`; reconcile its chain receipt before authorizing another payment. See [`settlement-runbook.md`](settlement-runbook.md) for recovery procedures.

## Why there are zero Polar meters

There are intentionally zero Polar usage meters.

The three Polar products are one-time credit packs, not recurring subscriptions. Polar's metered prices require a subscription product and are not a valid mechanism for granting these packs. More importantly, the Postgres credit ledger is OMA's authoritative spendable balance. Adding a second usage entitlement or meter would create conflicting sources of truth for the same balance.

Polar is used to collect the one-time card payment and deliver signed order events. OMA uses those events to issue credits in Postgres, then records API usage in that same ledger. Optional Polar reporting or cost-insight data must not be treated as the customer's spendable balance.

## Authentication

Programmatic API calls use an API key:

```http
Authorization: Bearer oma_sk_...
```

Website sessions support email magic-link authentication and SIWE wallet authentication. Better Auth owns the `oma`-prefixed `HttpOnly` session cookies, with `SameSite=Lax` and secure cookies on HTTPS deployments. Browser requests forward those cookies through the same-origin proxies; browser sessions are not API-key bearer tokens. Session cookies are accepted by authenticated account and funding endpoints. API keys and sessions are distinct from payment settlement: x402 verification uses the signed `PAYMENT-SIGNATURE`, while x402 settlement requires a SIWE session whose linked wallet matches the USDC payer; API keys do not authenticate settlement.

The user account has one home at `/dashboard`: Overview, Usage, API Keys and Settings. Settings sections use `?tab=settings&section=profile|appearance|sessions|danger`. `/settings` remains a compatibility redirect, preserving demo/query parameters and legacy section/hash bookmarks. Account controls do not depend on analytics loading. Demo controls are read-only. Usage model/provider percentages describe request share, including free chat; charges remain separate and preserve sub-cent values. Request details expose a copyable correlation ID, requested/served models and timestamp without storing prompt content.

Usage downloads use the selected dashboard range and the summary's UTC snapshot end. The session-authenticated `/v1/export/usage` accepts optional ISO-8601 `since` and `until` filters and `format=csv|json`. It returns at most 10,000 requests with `X-Export-Row-Count` and `X-Export-Truncated`; the dashboard reports truncation and suggests a smaller range. Exports include request/key IDs, requested/served models, tokens, latency, original and billed cents, refund time and UTC timestamps. Numeric amounts retain sub-cent precision; CSV text is escaped and neutralizes spreadsheet formulas. Demo views cannot export, duplicate clicks are blocked, and account changes cancel pending downloads. These private responses use `no-store`.

API key creation, listing and revocation require a Better Auth session; a bearer key cannot manage credentials. Keys expire after 90 days by default. Creation accepts `expiresInDays` from 1 to 365 and an optional `allowedModels` list of catalog IDs. The list constrains the primary model and all client/server fallback routes on both inference APIs. Optional `ipAllowlist` accepts up to 20 IPv4/IPv6 addresses or CIDR ranges; callers outside those ranges receive 403. Omit it for unrestricted access. Use the application's public outbound address, not its private network address. Restrictions cannot be edited; revoke and replace the key. Metadata includes expiry, last use and restrictions; expired keys cannot authenticate even if still listed. Website chat uses the account session, so creating a key does not install it in a browser cookie. `max_tokens` cannot exceed the selected model's published output limit; smaller-limit fallbacks are skipped. Provider credential failures are gateway errors, not customer authentication failures.

Key validity is read from Postgres on each request, with only concurrent in-flight reads shared. Positive Redis records do not authorize a revoked, expired or deleted key. Explicit invalid API credentials return 401 rather than becoming guest chat requests. Protected requests also require an existing, active account; failure to verify account status returns a safe 503. User IDs in query strings or request bodies never select the owner for personal keys, sessions, usage, exports or account deletion. On mixed session/key usage endpoints, the authenticated browser session takes precedence.

Database URLs and provider/operator secrets belong only in server environment variables. The browser receives public API origins and account-scoped responses, not direct database access. Both website proxies discard incoming `x-neon-*` headers, and `/api/internal/*` is blocked. Internal recovery jobs accept the operator recovery token or a native Neon scheduler header only in the Neon runtime, never through the website proxy. Neon removes client-supplied runtime headers on the native function boundary; this platform behavior is documented in [Neon's scheduler guide](https://neon.com/blog/your-neon-functions-can-now-run-on-a-schedule).

`Idempotency-Key` (or `idempotency_key` in the body) accepts at most 512 UTF-8 bytes.
Both inference APIs share the same account-scoped key space, including calls made
with different API keys. Postgres atomically admits one worker: concurrent duplicates
return 409 `request_in_progress` and `Retry-After: 5`. The claim spans the response
stream and token metering. Completed keys return 409 `already_processed` without
another provider call or charge; clients must retain their response because OMA
does not store completion bodies. Failed/cancelled attempts release the claim and
use a new usage ID on retry, avoiding an old failed usage record suppressing billing.
Abandoned pending worker claims expire after five minutes; completed billing records
still prevent reclaiming them. Completed claim metadata is retained with the account;
it contains a key hash and request ID, never raw keys or prompts.

The OpenAPI document is served at:

```text
https://www.oma-ai.com/api/v1/openapi.json
```

## Privacy and availability

The OMA gateway does not persist prompt or completion content. It stores account, billing, and usage metadata required to operate the service. Website chat saves conversations and drafts in the current browser, separately for guests and each signed-in account; this history does not sync between devices. See [Chat UI](chat-ui.md) for local storage and deletion behavior. Upstream providers handle inference content according to their own policies, which can differ by provider and model; do not interpret the gateway's storage policy as a universal no-training or no-retention promise.

The live model endpoint is the source of truth for current availability and prices. The bundled catalog is a fallback reference and must not be presented as a count of callable models. Website examples and animated request illustrations do not establish live availability.

Inference shares a 240-second total time budget across retries, fallbacks, and response reads. OpenBroker attempts allow up to 180 seconds for host selection and completion; other provider attempts allow 60 seconds for JSON responses or 120 seconds for streams. The website proxy waits up to 270 seconds and declares a 300-second Vercel function limit. Caller cancellation propagates to the provider and stops further retries. SDK clients should allow at least 270 seconds and inspect the actual-model/fallback headers. OpenBroker can queue longer than OMA's budget; a catalog-enabled model is not a guarantee of immediate capacity.

Free website quotas count admitted attempts, including requests that later fail upstream: 20 per guest IP or 100 per signed-in account per UTC day. Enforcement and `GET /v1/usage/today` read the same counter; reading the snapshot never consumes quota. Both shared Redis and bounded per-process fallback counters reset at midnight UTC. The fallback retains usage already observed by that process, but resets on restart and does not replace shared durable enforcement. Paid API-key calls do not consume the free quota, even with the website source header; prepaid balance and API rate limits still apply. Daily-cap responses include `Retry-After`; quota snapshots are private and non-cacheable.

Default inference limits allow a 60-request burst, refilling at 20 requests/second,
under a 60-RPM ceiling. Model overrides can add token ceilings. Script failures
preserve token weights in a per-process fixed window. When shared limiter state
is unavailable, inference uses a five-request/minute emergency allowance per
account/instance (IP for guests); rotating keys does not reset that allowance.
Further requests return 503 and `Retry-After`. `X-RateLimit-Policy` identifies
whether reported limit/remaining units are requests, tokens or degraded memory.
Local fallback does not replace distributed enforcement or upstream capacity.

The contact form delivers through `SUPPORT_WEBHOOK_URL`. It reports success only after that service acknowledges the request. There is no database queue or SMTP fallback: missing configuration returns 503, and a failed or timed-out delivery returns 502. The form preserves the message and offers the support email address on failure. Configure and verify the webhook before relying on form delivery.

Settings opened with `?demo=1` are read-only previews, including when the visitor has a real session. The preview must preserve that flag while navigating, avoid fetching private account data, and disable profile changes, exports, session actions, preference changes, history clearing, and deletion.

## Admin console and usage records

`/admin` requires an authenticated account with the `admin` role. User accounts and anonymous requests cannot read the private usage, user-management, or site-control endpoints. The console provides:

- A 24-hour, 7-day, or 30-day overview with UTC request/error and charge/cost charts. Charts use persisted usage metadata; anonymous guest requests are counted in Redis and worker HTTP counters instead of these account-linked charts.
- Spend grouped by model, provider, or account; totals include the entire selected range, even when the group list is truncated. Customer charges exclude refunds and failed credit deductions. Canceled streams and failed requests generate no customer charge.
- Searchable usage logs with outcome and date filters, 25-row pages, request IDs, requested/served models, provider routes, attempts, tokens, charges, and latency. Prompts and completion content are not stored. Cursor pagination preserves database timestamp precision.
- Payment configuration and the public x402 treasury recipient. A configured rail does not prove a successful transaction, a funded gas wallet, or sufficient provider credits.
- User search, lifetime usage, copied account IDs, credit adjustments, suspension, maintenance controls, and per-user rate-limit overrides. The current admin cannot suspend itself. Deductions lock and cap at the available balance; missing/empty balances and zero adjustments are rejected. Responses and audit events retain both the requested and applied amount, with an accurate partial-deduction flag.

The private endpoints include `GET /api/v1/admin/site-settings`, `GET /api/v1/admin/usage/timeline?days=7`, and `GET /api/v1/admin/usage/logs?days=7&limit=25`. Analytics ranges are bounded to 90 days. These responses are not cacheable. The operator settings endpoint includes the maintenance message and raw rail switches; the public settings endpoint reports effective customer availability.

Venice costs are catalog estimates, not settled invoices. Gonka/OpenBroker costs are paid in GNK; they remain unknown in dollars until a procurement cost basis is recorded. Gross margin is unavailable when the selected range contains unknown costs. Worker HTTP counters reset at restart and are labeled separately from durable usage history.

For local user/admin testing, `server/scripts/seed-test-auth.mjs` creates short-lived magic links for test identities. It refuses non-local databases and app origins, and production/staging/preview environments. `pnpm --filter oma-server run test:auth:integration` exercises real HTTP authentication, admin controls, and migrations against a disposable local database.

## Required operator configuration

Production requires durable Postgres and Redis-compatible rate-limit state, real authentication secrets, real Base addresses and RPC configuration, and valid inference-provider credentials. At minimum, set the following for each deployed server environment.

### Core and data stores

- `DATABASE_URL`: Neon Postgres connection string. This is the authoritative credit-ledger store.
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: shared rate-limit and daily-counter state. The compatibility pair is an HTTPS `REDIS_URL` plus `REDIS_TOKEN`. The HTTP Redis client cannot use a `redis://` TCP connection or a plain local Redis daemon. Without REST credentials, local development uses bounded memory fallback and reports degraded Redis readiness; production requires shared state.
- `CONNECTION_POOL_SIZE`: pool size appropriate for the deployed runtime.
- `TRUSTED_PROXY_IPS`: comma-separated reverse-proxy egress IPs allowed to supply trusted client IPs.
- `INTERNAL_PROXY_SECRET`: shared secret between the Vercel frontend proxy handlers (`app/api/**`) and the Neon API. The frontend forwards it on every proxied hop; the server rejects unauthenticated proxied traffic. Required, live-billing safety relevant.

### Public URLs, CORS, and authentication

- `PUBLIC_APP_URL=https://www.oma-ai.com`
- `PUBLIC_API_URL=https://www.oma-ai.com/api`
- `CORS_ORIGIN=https://www.oma-ai.com` (or a comma-separated explicit allowlist; never `*` in production)
- `PRIMARY_DOMAIN=www.oma-ai.com`
- `BETTER_AUTH_URL=https://www.oma-ai.com`
- `BETTER_AUTH_SECRET`: unique high-entropy secret, shared with the frontend deployment that verifies sessions.
- `ENCRYPTION_KEY`: unique production secret, at least 40 characters (enforced by config validation), used for deposit challenges.
- `RESEND_API_KEY` and `RESEND_FROM`: required for production magic-link email.
- `ADMIN_WALLET_ADDRESSES`: comma-separated admin addresses, if admin access is enabled.

The app also needs `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, and the same `BETTER_AUTH_SECRET` used by the server. In normal production, browser traffic uses the website's same-origin `/api/*` and `/x402/*` proxies.

Sponsored website chat uses `POST /api/chat/completions`, forwarded to the backend's `/website/chat/completions`. The frontend requires the same origin and rejects cross-site Fetch Metadata; the production backend requires the authenticated proxy secret and configured application origin. Generic API proxies strip caller sponsorship headers and block `/website/*`. Public `/api/v1/chat/completions` is always prepaid, even when a client copies website headers. The daily quota and billing gate share the same eligibility check. Secretless development is restricted to loopback backend requests; production never accepts that fallback. This separates the API contract from website sponsorship, but does not claim browser headers prevent automated use of the public website. Shared quotas, rate limits, and abuse controls remain necessary.

### Inference providers and Base RPC

Set the provider credentials required by the intended catalog routes:

- `VENICE_API_KEY` for Venice routes.
- `OPENBROKER_API_KEY` for OpenBroker/Gonka routes (`GONKA_API_KEY` and `OBK_API_KEY` are accepted aliases).

For Base:

- `CHAIN_RPC_URL` or its QuickNode alias `QUICKNODE_RPC_URL`
- `CHAIN_RPC_URL_FALLBACK` or `QUICKNODE_RPC_URL_FALLBACK`
- `ETH_RPC_URL` for ENS/SIWE support
- `TREASURY_BASE_ADDRESS`: real Base treasury address; required in production
- `USDC_DEPOSIT_ADDRESS`: real direct-deposit receiver; defaults to the treasury when unset
- `USDC_DEPOSIT_NETWORK=base`
- `USDC_DEPOSIT_MIN_CENTS` and `USDC_DEPOSIT_MAX_CENTS`
- `BASE_CHAIN_ID=8453`

The website's `/api/rpc/base` and `/api/rpc/base-sepolia` handlers prefer
server-only `BASE_RPC_URL` / `BASE_SEPOLIA_RPC_URL`, then public Base and
PublicNode endpoints for read failures. Public services have their own limits;
fallbacks do not guarantee availability. Broadcasts, including mixed batches,
get one attempt so a lost response never triggers an automatic replay.
Requests and responses have streamed byte limits, and unsupported HTTP
subscription/debug methods are rejected. These website guards use a bounded
per-instance limiter and Vercel's platform IP; custom hosts without verified
client provenance share the unknown-IP bucket. API rate limits remain separate.

### x402 settlement

For live x402 settlement:

- `FACILITATOR_MODE=live`
- `X402_FACILITATOR_PROVIDER=coinbase-cdp`
- `FACILITATOR_PRIVATE_KEY`: real 32-byte private key used by the self-hosted facilitator
- `RECEIPT_HMAC_SECRET`: strong secret for receipt signatures
- `RECEIPT_HMAC_SECRET_PREVIOUS`: optional comma-separated verification-only keys during rotation

`mock` is for local development and is rejected in production and staging. QuickNode can provide Base RPC, but it is not accepted as a generic x402 settlement provider.

### Polar card rail

Card checkout remains disabled when the Polar configuration is absent. To enable it, configure all of the following:

- `POLAR_ACCESS_TOKEN`
- `POLAR_WEBHOOK_SECRET`
- `POLAR_ORGANIZATION_ID`
- `POLAR_SERVER=production`
- `POLAR_HOBBY_PRODUCT_ID`
- `POLAR_BUILDER_PRODUCT_ID`
- `POLAR_SCALE_PRODUCT_ID`

The three product IDs must point to the one-time Hobby, Builder, and Scale credit packs. Do not attach Polar metered prices or expect Polar meters to maintain the spendable credit balance.

### Optional service configuration

- `FREE_SIGNUP_CENTS`: new-account trial credit amount; `0` disables it. The tracked .env.example ships `100`; set `0` to disable.
- `DEFAULT_KEY_EXPIRY_DAYS`: API-key lifetime; `0` means keys do not expire by default.
- `MODELS_CONFIG_PATH` and `MODEL_OVERRIDES_PATH`: optional server catalog and runtime override files.
- `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_SERVICE_NAME`: optional observability settings.
- `RECOVERY_TOKEN`: secret accepted by the deposit-recovery endpoint for a long-running HTTP deployment.

## What this platform does not claim

- It does not sell recurring subscriptions.
- It does not use Polar meters as the credit ledger.
- It does not attach a mid-request x402 challenge to ordinary chat inference. x402 is a funding flow that credits the prepaid balance.
- `api.oma-ai.com` is not the public API host.
- Catalog size does not guarantee that every model is currently healthy or available at a given moment.
