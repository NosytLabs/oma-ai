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

Agents can use the x402 funding flow:

1. Establish a SIWE website session with the wallet that will pay. Its linked EVM address must equal the USDC payer; an API key or email-only session cannot claim the payment.
2. Read the current treasury address from `GET /api/v1/deposit/usdc`. Sign an EIP-3009 USDC `transferWithAuthorization` for that treasury and the intended amount.
3. Call `POST /x402/verify` with the signed envelope in `PAYMENT-SIGNATURE`. **This endpoint broadcasts the transfer and waits for on-chain confirmation. It is not a dry run.** The facilitator pays gas. Save the returned `txHash`, `amount`, and `networkId`.
4. Call `POST /x402/settle` with `{ txHash, networkId }` and the same payer's session cookie. Settlement credits the account balance; it does not initiate another transfer.
5. Use an API key from that account against the credited balance. Ordinary chat inference does not issue a mid-request x402 challenge.

The standard v2 header is base64-encoded JSON with `x402Version: 2`, `accepted: { scheme: "exact", network: "eip155:8453", asset, amount, payTo }`, and `payload: { signature, authorization }`. Authorization contains `from`, `to`, `value`, `validAfter`, `validBefore`, and `nonce`. The accepted amount and authorization value are integer strings in atomic USDC units (6 decimals) and must match; the accepted recipient must match the signed recipient. The treasury and Base USDC contract are server-pinned. Legacy raw-JSON OMA envelopes and the older base64 `X-PAYMENT` header remain supported.

A successful verify response returns top-level `{ valid: true, txHash, amount, networkId }`, with `amount` in decimal USDC. A successful settle response returns `{ settled: true, receipt, creditedCents }`; `receipt` is a signed string, and `PAYMENT-RESPONSE` is a base64 summary. Settlement accepts network `base` or `eip155:8453`, derives amounts from payment evidence, and preserves fractional credits.

Crediting is idempotent by transaction hash. If the verification cache is lost after a server restart, settlement can recover a confirmed transfer from Base USDC Transfer logs and bind its payer to the session wallet. The transaction's gas payer is the facilitator and must not be confused with the USDC sender. If funds moved but crediting failed, retry settlement with the same hash and payer session. A verification timeout can return a hash with `valid: false`; reconcile its chain receipt before authorizing another payment. See [`settlement-runbook.md`](settlement-runbook.md) for recovery procedures.

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

The OpenAPI document is served at:

```text
https://www.oma-ai.com/api/v1/openapi.json
```

## Privacy and availability

OMA does not persist prompt or completion content. It stores account, billing, and usage metadata required to operate the service. Upstream providers handle inference content according to their own policies, which can differ by provider and model; do not interpret the gateway's storage policy as a universal no-training or no-retention promise.

The live model endpoint is the source of truth for current availability and prices. The bundled catalog is a fallback reference and must not be presented as a count of callable models. Website examples and animated request illustrations do not establish live availability.

Settings opened with `?demo=1` are read-only previews, including when the visitor has a real session. The preview must preserve that flag while navigating, avoid fetching private account data, and disable profile changes, exports, session actions, preference changes, history clearing, and deletion.

## Required operator configuration

Production requires durable Postgres and Redis-compatible rate-limit state, real authentication secrets, real Base addresses and RPC configuration, and valid inference-provider credentials. At minimum, set the following for each deployed server environment.

### Inference providers

- `LITELLM_API_KEY` and `LITELLM_API_URL`: NVIDIA upstream access via LiteLLM, used by the provider-route fallback path.

### Core and data stores

- `DATABASE_URL`: Neon Postgres connection string. This is the authoritative credit-ledger store.
- `REDIS_URL` or the Upstash REST pair `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`: rate-limit and daily-counter state.
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
- `ENCRYPTION_KEY`: unique production encryption secret, at least 40 characters.
- `RESEND_API_KEY` and `RESEND_FROM`: required for production magic-link email.
- `ADMIN_WALLET_ADDRESSES`: comma-separated admin addresses, if admin access is enabled.

The app also needs `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, and the same `BETTER_AUTH_SECRET` used by the server. In normal production, browser traffic uses the website's same-origin `/api/*` and `/x402/*` proxies.

### Inference providers and Base RPC

Set the provider credentials required by the intended catalog routes:

- `VENICE_API_KEY` for Venice routes.
- `OPENBROKER_API_KEY` for OpenBroker/Gonka routes (`GONKA_API_KEY` and `OBK_API_KEY` are accepted aliases).
- Optional `SURPLUS_API_KEY` and `SURPLUS_API_URL` only if Surplus routes are intentionally enabled.

For Base:

- `CHAIN_RPC_URL` or its QuickNode alias `QUICKNODE_RPC_URL`
- `CHAIN_RPC_URL_FALLBACK` or `QUICKNODE_RPC_URL_FALLBACK`
- `ETH_RPC_URL` for ENS/SIWE support
- `TREASURY_BASE_ADDRESS`: real Base treasury address; required in production
- `USDC_DEPOSIT_ADDRESS`: real direct-deposit receiver; defaults to the treasury when unset
- `USDC_DEPOSIT_NETWORK=base`
- `USDC_DEPOSIT_MIN_CENTS` and `USDC_DEPOSIT_MAX_CENTS`
- `BASE_CHAIN_ID=8453`

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
