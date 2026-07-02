# OMA-AI → Profitable Venice-AI Gateway: Strategy & Implementation Plan

**Author:** OMA-AI research subagent
**Date:** 2026-07-01
**Status:** Draft v1 (decision-ready)
**Scope:** Turn the existing OMA-AI codebase into the highest-quality, highest-margin third-party gateway for the Venice AI API.

> **TL;DR.** OMA is already a working, audited, Venice-routed OpenAI-compatible gateway with x402 + USDC + wallet auth + credit accounting. It is not a greenfield product; it is a **monetization + go-to-market problem**. This document proposes three concrete, code-anchored phases to get to positive unit economics inside one month and $10k+ MRR inside one quarter, anchored to three defensible wedges: **(1) crypto-native payment UX**, **(2) privacy-first inference (no logs, USDC, x402)**, and **(3) Venice's VVV/DIEM token flywheel**.

---

## 1. Current State

### 1.1 What works today (verified by reading code)

| Surface | Evidence |
|---|---|
| Production Hono.js API | `server/src/index.ts` — 25+ route modules mounted, graceful shutdown, correlation IDs, security headers, CORS, compression |
| OpenAI-compatible inference | `server/src/routes/chat/`, `server/src/inference/router.ts`, `venice.ts` (22 KB provider), `call-provider.ts`, `surplus.ts`, circuit breaker failover (`circuit-breaker.ts`), `provider-health.ts` with background probing |
| 88 text + 5 video models | `server/models.json` — all routed through Venice (primary) + Surplus (secondary); no other upstreams (see `config.ts:25–29`, the "ponytail" note) |
| Wallet-based auth | `server/src/auth/` — SIWE (Ethereum) + SIWS (Solana); no email/password |
| Credit accounting | `server/src/credits/` — batches, expiry (`CREDIT_EXPIRY_DAYS=365` default), atomic deduction (`deduction.ts`), insufficient-credits guards, preflight |
| Payments | `server/src/routes/deposit/` — `usdc.ts` (Base), `houdini.ts` (100+ chains via HoudiniSwap), `cctp.ts` (Circle CCTP), `lifi.ts` (LiFi aggregator); plus `jupiter.ts` for SOL→USDC |
| x402 facilitator | `server/src/x402/facilitator.ts` (1250 LOC) — Coinbase CDP default, QuickNode-hosted alternative; nonce/replay protection via Redis SET NX EX; nonce-stamped receipt HMAC |
| Subscriptions + budgets | `routes/credits.ts` (441 LOC) — `/v1/credits/purchase`, `/balance`, `/transactions`, `/usage`, `/auto-reload`, `/budget-alerts` (50/75/90/100% thresholds, email + webhook), `/price-estimate` |
| Admin surface | `routes/admin/*`, `admin-observability.ts`, `analytics-admin.ts`, `metrics.ts`, `admin-observability.ts`, `analytics.ts`, `log.ts`, `export.ts` |
| OpenAPI | `routes/openapi.ts` (80 KB — full spec generated) |
| Configurable fee markup | `routes/config.ts` — `fee_config` admin endpoint, `markupPercent` per model in `models.json` (defaults to `OMA_MARKUP_PCT=25` in `config.ts:101`) |
| Rate limits | `routes/config.ts:103–110` — tiers `free:60rpm/10k tpm`, `basic:120/50k`, `pro:300/200k`, `enterprise:1000/1M` |
| Deploy | `render.yaml` — server on `starter` ($7/mo, always-on), app on `free` (cold-starts OK because SSG); $50 Render credit ≈ 7 months runway |
| Tests | 82 test files; CI green (per README audit footer 2026-06-30) |
| Frontend | Next.js 15 + React 19; pages at `/pricing`, `/models`, `/dashboard`, `/deposit`, `/chat`, `/docs`, `/playground` |

### 1.2 Revenue model today

- **Single revenue lever:** 25% markup over Venice base cost (uniform across all models), per `markupPercent` in `server/models.json`.
- **Default rate-limit tiers exist in config** but I see no subscription/billing endpoints that enforce them in `routes/credits.ts` — the `purchase` route is for **credits**, not subscriptions. **Subscriptions are scaffolded but not wired to billing.** (Confirmed by absence of `/v1/subscriptions` routes in `index.ts:161–187`.)
- **x402 default price:** `X402_PRICE_USD=0.01` in `render.yaml:81` — i.e., $0.01/request by default, hard-coded to per-call not per-token. This is mispriced for chat completions (a $0.05 chat call returns 500 tokens).
- **No free tier.** The minimum purchase is $1 (`purchaseSchema.min(100)` cents in `credits.ts:26`). The "free" tier in `routes/config.ts:104` is **only a rate-limit tier**, not a credit-allocation tier — there is no entry point to use it without paying.
- **No SDKs.** Direct HTTP only.
- **No prompt caching**, **no batch API**, **no webhooks**, **no usage dashboard** for end users.

### 1.3 Tech stack summary

| Layer | Tech | Notes |
|---|---|---|
| Backend | Hono.js + Node 22 | TS strict, Zod-validated env, Drizzle ORM, Redis-backed rate limiting + nonce store |
| Database | PostgreSQL (Neon) | Users, credit batches, deposits, usage records, subscriptions, audit log |
| Cache | Redis (Upstash) | Rate limits, x402 nonces, session cache |
| Chains | Base (primary), Solana, 20+ via Houdini/LiFi, CCTP v2 (Ethereum/Solana/Arbitrum/Optimism/Polygon/Avax) | Treasury wallet on Base; QuickNode mainnet RPC |
| Auth | SIWE + SIWS + API keys | No email/password — by design |
| Frontend | Next.js 15 + React 19 | SSG-friendly, deployed free on Render |
| Hosting | Render Blueprint | App free + server $7/mo = ~7mo runway on $50 credit |

### 1.4 The good news

- **All required primitives are built and audited.** No new infrastructure needed for Phase 1.
- **The 25% uniform markup is closer to OpenRouter's effective take rate (5.5% × ~3 effective provider markup) than Portkey's $49/mo + overage.** You are already in the competitive band.
- **The provider cost is subsidized by Venice itself** if you qualify for Partner Tier (60 RPM / 1M TPM, 3× the default L tier — see §2.3).
- **Render $50 credit buys ~7 months.** No need to monetize before the runway ends.

---

## 2. Market Context

### 2.1 Venice AI positioning

Venice is the **only major consumer + developer LLM provider that builds privacy as the core brand promise**: no prompt logs on Private mode, uncensored open-weights, in-browser inference option, VVV token economics, and a hardware-isolation story (TEE / E2EE for 15+ models as of 2026-07-01).

**Consumer tiers (`venice.ai/pricing`, scraped 2026-07-01):**

| Tier | $/mo | What you get |
|---|---|---|
| Free | $0 | 10 text/day, 15 images/day, base models, **API access included** |
| Pro | $18 | Unlimited text, 1k images/day, Pro models, 100 credits/mo |
| Plus | $68 | 7,500 credits/mo, 10% credit bonus, 2-mo banking |
| Max | $200 | 22,500 credits/mo, 12.5% bonus, 3-mo banking |

> Key fact: **100 Venice credits = $1.** Their math is identical to OMA's (`CREDIT_VALUE_PER_DOLLAR=1` in `config.ts:80`). This is a happy coincidence: OMA credits can be priced as Venice credits 1:1 and feel native.

**API (`docs.venice.ai/overview/pricing`, scraped 2026-07-01):**

- Per-token, model-specific (see `server/models.json` for OMA's reflection of Venice's rates × 1.25).
- Free-tier API exists; paid plans upgrade rate limits.
- Cache pricing added May–June 2026 for many models (e.g., `zai-org-glm-5` cache read $0.20/M vs full input $1.25/M).
- Partner tier available on application: L-tier goes from **20 RPM / 500K TPM** to **60 RPM / 1M TPM** (3× boost); XS 500→500, S 75→150, M 50→100. Required for any serious gateway.

**VVV token economics (`venice.ai/token`, scraped 2026-07-01):**

- ERC-20 on Base. Stake VVV → receive **DIEM** at $1 of daily inference capacity (proportional to stake share).
- 7-day unstaking cooldown.
- "Stakers enjoy ongoing access to AI inference via the API at zero marginal cost" — Venice's words, not mine.
- **This is the killer feature.** OMA can stake VVV → mint DIEM → subsidize a free tier or pad margin, depending on how we want to use the credits.

**Rate limits (`docs.venice.ai/api-reference/rate-limiting`, scraped 2026-07-01):**

- Default L-tier (frontier models): **20 RPM, 500K TPM** — bottleneck for any gateway.
- Partner tier (email `api@venice.ai`): 60 RPM, 1M TPM. Requires "sustained demand."
- Abuse lockout: 20 failed requests in 30s → 30s ban.

### 2.2 Competitor benchmark (scraped 2026-07-01)

| | OMA-AI (today) | OpenRouter | Portkey | Unify | LiteLLM (Enterprise) |
|---|---|---|---|---|---|
| **Pricing model** | 25% uniform markup on Venice base | 5.5% flat fee, no markup | $49/mo + $9/100k log overage | $75/mo Team + free starter | $250/mo–$30k/yr |
| **Free tier** | None (min $1 deposit) | 25+ models, 50 reqs/day, 4 providers | 10k logs/mo, 3-day retention | Starter credits (1 week) | Open-source self-host |
| **Models** | 88 (Venice + Surplus) | 400+, 70+ providers | Universal (BYO) | Workspace credit pool | 100+ (BYO) |
| **Payment methods** | USDC, SOL, Houdini 100+, x402 | Card, crypto, bank | Card, invoice | Card, invoice | Self-hosted |
| **x402 / agent pay** | ✅ native | ❌ | ❌ | ❌ | ❌ |
| **Wallet auth (no email)** | ✅ SIWE/SIWS | ❌ | ❌ | ❌ | ❌ |
| **Privacy posture** | Strong (Venice-only routing) | Weak (logs everything by default) | Enterprise (audit logs) | Enterprise | Self-hosted = private |
| **SDKs** | None | TS, Python, Agent SDK | TS, Python | TS, Python | TS, Python, Go |
| **Prompt caching** | ❌ | ✅ | ✅ | ✅ | ✅ |
| **Batch API** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Webhooks** | ❌ | ❌ | ✅ | ✅ | ✅ |
| **SSO/SAML** | ❌ | ✅ (Enterprise) | ✅ (Enterprise) | ✅ (Enterprise) | ✅ (Enterprise) |
| **OpenAPI** | ✅ (full 80 KB spec) | ✅ | ✅ | ✅ | ✅ |
| **MCP server** | ❌ | ✅ | ✅ | ❌ | ✅ |
| **llms.txt** | ❌ | ✅ | ✅ | ❌ | ❌ |
| **Status page** | ✅ (`/health` + `/ready` + `/live`) | ✅ | ✅ | ✅ | ❌ |

**Sources:** `openrouter.ai/pricing`, `portkey.ai/pricing`, `unify.ai/pricing`, `docs.litellm.ai/docs/proxy/provider_margins` — all scraped 2026-07-01.

### 2.3 Pricing benchmarks (concrete numbers)

| Provider | GPT-5.4-class frontier model | Markup floor | Effective revenue per $1 spent by customer |
|---|---|---|---|
| OpenAI direct | $2.50 / $10 per 1M | — | $0 |
| OpenRouter | (same) + 5.5% fee | $0.14 per $1 | $0.055 |
| Venice (claude-opus-4-7) | $6 / $30 per 1M (private) | — | $0 |
| OMA (claude-opus-4-7 in `models.json:954`) | $6 / $30 per 1M → **$7.50 / $37.50** | 25% | **$0.20** |
| Portkey | Underlying cost + $49/mo subscription + log overage | ≈$0.10 effective | $0.10 + sub |
| OMA's *premium-tier recommendation* (Phase 2) | 40–50% markup on E2EE + uncensored | $0.40–$0.50 | $0.40–$0.50 |

**Verdict:** OMA's current 25% markup is **4× OpenRouter's effective take** on cost-equivalent spend. That's defensible if the privacy story carries — but the privacy story is currently invisible (no marketing, no docs). Without the privacy story, customers will switch to OpenRouter for 5.5%.

---

## 3. Recommended Strategy

### 3.1 Positioning

**One-liner:** *"The crypto-native, privacy-first AI gateway. Same models as OpenRouter — but no logs, USDC payments, and an x402 endpoint your AI agent can pay-per-call."*

**Positioning matrix:**

| vs. | OMA's claim |
|---|---|
| OpenRouter | "OpenRouter logs your prompts by default. OMA doesn't (we route only through Venice Private). Same models. Crypto pay." |
| Portkey | "Portkey is for ops teams who want observability. OMA is for builders who want pay-as-you-go with crypto." |
| Venice direct | "Same models, same privacy. Plus: USDC at 1:1, x402 for agents, no Venice account, batch pricing." |
| LiteLLM self-host | "Same models, no infra. We run the gateway; you run the agent." |

**Word discipline** (lifted from README "Brand & Voice", reinforced):
- USE: *private inference*, *zero data retention*, *wallet-based*, *x402*, *USDC-native*, *agent-native*, *pay-per-call*, *crypto-friendly*.
- AVOID: *anonymous*, *no KYC*, *untraceable*, *bypass*, *cheap*, *dark*, *underground*.

### 3.2 Pricing model

**Three changes to make immediately:**

| Tier | Markup | Free credit allocation | Use case |
|---|---|---|---|
| **Pay-as-you-go (default)** | 25% over Venice (existing) | None — minimum $1 | Power users who already know they want privacy |
| **Free (new)** | 30% over Venice | $0.05 one-time faucet on wallet signup | Developers evaluating; converts to paid at ~$1 spend |
| **Pro subscription (new)** | 20% over Venice | $10/mo included credits, then pay-as-you-go | Builders who run > $10/mo of inference |
| **Enterprise (new)** | 15% over Venice + flat fee | Custom | Teams > $500/mo, SSO, audit log |

**Differentiated per-model markup (Phase 2):**

| Model class | Current | Recommended | Rationale |
|---|---|---|---|
| Budget (DeepSeek V3.2, Llama 3.2, GPT OSS 120B) | 25% | **20%** | High volume, low elasticity. Keep competitive vs direct Venice. |
| Mid (GLM 5, Qwen 3.6, Mistral Small 4) | 25% | **25%** | Match OpenRouter parity. |
| Premium (Claude Sonnet 4.6, GPT-5.4, Grok 4.20) | 25% | **35%** | Low elasticity, business critical, low churn risk. |
| Frontier (Claude Opus 4.7, GPT-5.4 Pro, Claude Fable 5) | 25% | **45%** | Min-cost decisions; willingness to pay is highest. |
| Uncensored / roleplay | 25% | **50%** | Niche, differentiated, no direct competition. |
| E2EE / Private | 25% | **45%** | Privacy premium is the value prop. |
| Cache reads | (not exposed) | **10%** | High volume, low unit price — keep as customer perk. |

**x402 pay-per-call (already wired, currently mispriced):**

- Default in `render.yaml:81`: `$0.01` flat per request.
- New: price dynamically from estimated tokens at the same per-model markup as credits. Use `server/src/inference/billing-service.ts:estimateCost()` and surface in the 402 challenge.

### 3.3 Venice-specific wedges

**Wedge 1: VVV/DIEM flywheel (high-leverage, Phase 2).**

- Stake 50,000 VVV on Base → receive ~$50/day in DIEM at 1% network share (illustrative; depends on total staked).
- DIEM can be redeemed 1:1 for Venice API credits.
- OMA uses DIEM to subsidize the free tier: every wallet gets $0.05 of free inference, paid for by VVV staking yield, not by OMA's balance sheet.
- Optional Phase 3: launch OMA's own staking pool so users can stake VVV through OMA and earn a cut.

**Wedge 2: Partner-tier upgrade (high-leverage, immediate).**

- Email `api@venice.ai` with: monthly spend projection, use case summary, request for Partner tier.
- Receiving Partner tier (L = 60 RPM / 1M TPM, 3× default) lets OMA:
  - Sell a "Pro" tier with realistic rate limits instead of getting throttled at 20 RPM.
  - Support more concurrent users without hitting Venice's 20 RPM ceiling.
  - Serve image/audio/video (40 RPM queue, 120 RPM retrieve — already plenty).

**Wedge 3: Cache pricing pass-through (medium-leverage, Phase 2).**

- Venice added cache pricing May–June 2026; OMA's `ModelDef` schema has no `cacheReadPricePer1M` / `cacheWritePricePer1M` fields.
- Adding these fields and passing the cache tokens through:
  - Cuts long-context costs by 50–90% on supported models (GLM 5, Qwen 3.7, Claude Opus).
  - Becomes a marketing differentiator vs OpenRouter (which exposes cache but at 100% markup).
  - Drives repeat-usage lock-in.

**Wedge 4: x402 as the killer agent-native feature (already built, not marketed).**

- Already implemented in `server/src/x402/facilitator.ts`. Not used in marketing.
- Add to landing page: "Your AI agent can pay-per-call with USDC on Base. No account, no API key exchange, no pre-funded balance."
- Add to docs: complete x402 walkthrough + a Python example with `x402-fetch` library.
- Position vs competitors: OpenRouter/Portkey/Unify all require API keys + pre-payment. OMA's x402 lets an AI agent on another machine pay for itself.

### 3.4 Growth levers

| Lever | Effort | Expected impact | Phase |
|---|---|---|---|
| **Free tier via $0.05 faucet on wallet signup** | Low | Removes largest signup friction (was: $1 minimum) | Phase 1 |
| **Python SDK (`pip install oma-ai`)** | Med | Removes second-largest friction (no SDK today) | Phase 1 |
| **TypeScript SDK (`npm i oma-ai`)** | Med | Same for web devs | Phase 1 |
| **`llms.txt` + `agents.md`** | Low | Indexable by AI agents; competitive parity | Phase 1 |
| **Official MCP server** | Med | Coding-agent install path (Claude Code, Cursor) | Phase 2 |
| **Venice Partner Tier** | Low (just email) | 3× rate limits, unblocks growth | Phase 1 |
| **VVV staking** | Med | Subsidizes free tier, adds token-aligned moat | Phase 2 |
| **Webhooks for image/video async** | Med | Unlocks batch workflows | Phase 2 |
| **Batch API at 50% discount** | Med | Attracts high-volume users | Phase 2 |
| **Per-model markup differentiation** | Low | 60–80% gross margin on premium tier | Phase 2 |
| **Usage dashboard with cost breakdown** | Med | Matches OpenRouter UX | Phase 2 |
| **Affiliate / referral program (15% rev share)** | Med | Viral growth; defer to Phase 2 | Phase 2 |
| **OpenRouter import tool** | Med | Migration ease from largest competitor | Phase 3 |
| **OpenAI/Anthropic feature parity (vision, tools, structured outputs)** | High | Table stakes; mostly already done via Venice passthrough | Phase 3 |

---

## 4. Concrete Implementation Plan

### Phase 1 — This week (zero infra cost, immediate revenue impact)

**Goal:** Remove signup friction + capture the easy revenue from new Venice models + qualify for Partner Tier.

#### 1.1 Catalog hygiene (highest-leverage, ~3 hours)

Apply the recommendations in `docs/venice-research-2026-07-01.md`:

- [ ] **ADD** `claude-sonnet-5` (newest frontier, premium tier, 1M ctx) → `models.json` at `premium` tier, markup 35%
- [ ] **ADD** `zai-org-glm-5-2` and `e2ee-glm-5-2-p` → `mid` tier, markup 25%
- [ ] **ADD** `kimi-k2-7-code` → `mid` tier, markup 25%
- [ ] **REMOVE** `claude-opus-4-7-fast` before 2026-07-23 (Venice sunset)
- [ ] **REMOVE** or live-verify `arcee-trinity-large-thinking`, `tencent-hy3-preview`, `minimax-m3` (3 stale)
- [ ] **FIX** `zai-org-glm-4.6`: drop input from $0.85 → $0.54, output from $2.75 → $2.19 (Venice cut price ~36%; current effective markup is 98%)
- [ ] Mark all new models with `cacheReadPricePer1M` / `cacheWritePricePer1M` fields where Venice publishes them

**Code:** `server/models.json` only. Zero server code change. Schema is already extensible.

#### 1.2 Free tier ($0.05 faucet) (~6 hours)

- [ ] **Add** `credit_batches` row on first-time wallet signup: 5 cents, 30-day expiry, paymentMethod=`oma_faucet`, marked so it cannot be abused by creating multiple wallets (one wallet per chain address).
- [ ] **Apply** in `server/src/auth/middleware.ts` after successful SIWE verify for users with zero existing batches.
- [ ] **Track** `faucet_claims` counter; rate-limit to 1 per wallet per 30 days.
- [ ] **Cap** monthly faucet spend at $50 via the existing `CT_DAILY_USDC_CENTS_MAX` pattern (or new `FAUCET_MONTHLY_CENTS_MAX=5000`).

**Revenue impact:** Negligible direct ($50/mo ceiling), but unlocks developer adoption funnel. Removes the $1 minimum signup friction.

**Code locations:**
- `server/src/routes/auth.ts` — already issues wallets
- `server/src/credits/add-credits.ts` — already has batch-issuance logic

#### 1.3 Email Venice for Partner Tier (~30 minutes)

- [ ] Send email to `api@venice.ai` from a real business address.
- [ ] Include: current monthly Venice spend projection (even if $0 — say "preparing to launch"), use case (crypto-native privacy gateway), target customer base.
- [ ] Request: Partner tier rate limits (L: 60 RPM / 1M TPM).
- [ ] Expected response: 3–7 days.

**Revenue impact:** Unblocks Pro tier (20 RPM ceiling makes "Pro" unusable without it).

#### 1.4 SDK v0.1: thin OpenAI-compatible wrappers (~8 hours)

- [ ] **Python SDK** at `sdks/python/`:
  ```python
  from oma_ai import Oma
  client = Oma(api_key="oma_sk_...", base_url="https://api.oma-ai.com/v1")
  resp = client.chat.completions.create(model="zai-org-glm-4.7", messages=[...])
  ```
  Drop-in replacement for `openai.OpenAI()`. Auto-detects models endpoint. 200 LOC.
- [ ] **TypeScript SDK** at `sdks/ts/`:
  ```typescript
  import Oma from "oma-ai";
  const client = new Oma({ apiKey: "oma_sk_..." });
  const resp = await client.chat.completions.create({ model: "zai-org-glm-4.7", messages: [...] });
  ```
  ESM-first, tree-shakeable, type-safe. 300 LOC.
- [ ] Publish both to PyPI + npm under `@oma-ai` / `oma-ai` scopes.

**Revenue impact:** Removes second-largest friction (no SDK today). 30–50% expected conversion lift from dev-to-first-API-call.

#### 1.5 Landing page: privacy + x402 hero (~3 hours)

- [ ] Update `app/src/app/(landing)/page.tsx` (or equivalent) with two-column hero:
  - **Left:** "Private AI inference. Pay with USDC. Zero data retention."
  - **Right:** live `curl` example showing x402 402 challenge + signed USDC receipt
- [ ] Update `app/src/app/pricing/page.tsx` to add **Free tier** card with the $0.05 faucet callout (line 80–102 already has payment-methods grid; add a tier card row above)
- [ ] Update `app/src/app/pricing/page.tsx:104–121` FAQ to include: "What's the free tier?" / "Why is my prompt data not logged?" / "How does x402 work for agents?"

**Revenue impact:** Funnel throughput, no direct revenue. Page is currently all model-table and FAQ — no conversion copy.

#### 1.6 `llms.txt` + `agents.md` (~2 hours)

- [ ] Add `app/public/llms.txt` with all model IDs, capabilities, pricing, and 5 example curl calls.
- [ ] Add `app/public/agents.md` with install-on-Cursor/Claude-Code/Cline instructions.
- [ ] Cheap SEO for the AI-agent install path.

**Revenue impact:** Zero direct, but enables AI-agent driven signups (a growing channel).

#### 1.7 Phase 1 verification (do not skip)

- [ ] Run `pnpm test` in `server/` — must remain green
- [ ] Run `pnpm typecheck` — must remain green
- [ ] Smoke-test deposit flow: deposit $1 USDC on Base → credits appear → spend on `gpt-oss-120b`
- [ ] Smoke-test free faucet: sign up with a fresh wallet → 5¢ credits appear → spend
- [ ] Smoke-test SDK: `pip install -e sdks/python/`, run a 1-line chat completion
- [ ] Commit per-task with descriptive message; run code-reviewer on the commit

### Phase 2 — This month ($15k/mo MRR target if launch lands)

**Goal:** Differentiated pricing tiers + caching + usage dashboard + webhooks + Venice Partner tier activated.

#### 2.1 Per-model markup differentiation (~4 hours)

- [ ] Edit `server/models.json` to override `markupPercent` per category:
  - budget: 20% (was 25%)
  - mid: 25% (unchanged)
  - premium: 35% (was 25%)
  - frontier: 45% (was 25%)
  - uncensored/roleplay: 50% (was 25%)
  - e2ee-*: 45% (was 25%)
- [ ] Add `MARKUP_TIER_OVERRIDES` env-var support so operators can tune without code changes
- [ ] Update `app/src/app/pricing/page.tsx` model table to show category-driven markup badge

**Revenue impact:** Estimated +30% gross margin on premium-tier usage (Claude Opus, GPT-5.4 Pro).

#### 2.2 Prompt caching (~12 hours)

- [ ] Add `cacheReadPricePer1M` / `cacheWritePricePer1M` to `ModelDef` interface (`server/src/inference/models.ts:6–23`)
- [ ] Update `billing-service.ts:calculateCost()` to handle cached tokens (Venice returns `cache_read_input_tokens` / `cache_creation_input_tokens` in usage)
- [ ] Add a `/v1/credits/price-estimate?cached=true` test path
- [ ] Document the cost-savings in `app/src/app/docs/`

**Revenue impact:** Cost-driven retention, not direct revenue. Users who cache stay longer.

#### 2.3 Usage dashboard for end users (~16 hours)

- [ ] New page at `app/src/app/dashboard/usage/page.tsx`:
  - Per-model cost breakdown (last 30 days)
  - Daily spend chart
  - Top 10 most-expensive requests
  - Cache hit rate
  - Export to CSV
- [ ] Add API endpoint at `server/src/routes/analytics.ts` (already exists, expand)
- [ ] Match OpenRouter UX — this is the single biggest DX gap per `competitor-analysis.md`

**Revenue impact:** Retention. Users with visibility don't churn.

#### 2.4 Webhooks for async (image/video) (~10 hours)

- [ ] Add `webhooks` table to `server/src/db/schema.ts`
- [ ] Add `POST /v1/webhooks` and `DELETE /v1/webhooks/:id`
- [ ] Emit on image/video job completion
- [ ] HMAC-signed payload
- [ ] 5-attempt exponential-backoff retry
- [ ] Replicate-style dashboard for managing webhook URLs

**Revenue impact:** Enables async-image and async-video use cases. Currently OMA only supports synchronous image generation (a hard cap on volume).

#### 2.5 Batch API at 50% discount (~12 hours)

- [ ] New endpoint `POST /v1/batches` accepting a JSONL of chat-completion requests
- [ ] Status endpoint `GET /v1/batches/:id`
- [ ] Async dispatch with priority queue
- [ ] 50% discount applied via existing `discountPercent` parameter in `billing-service.ts:38`

**Revenue impact:** Captures bulk-eval users (~$0.005/1k tokens at budget models → attract eval/finetune/nightly jobs).

#### 2.6 VVV/DIEM staking integration (~20 hours)

- [ ] New endpoint `POST /v1/stake/vvv` accepting VVV deposits
- [ ] Track OMA treasury VVV position in `server/src/credits/staking.ts` (already exists; expand)
- [ ] Auto-convert DIEM → Venice credits daily (cron job, already wired in `.github/workflows/`)
- [ ] Use DIEM-funded credits to subsidize free tier beyond the $0.05 faucet
- [ ] Document the flow publicly: "We stake VVV to keep your first 1000 requests free."

**Revenue impact:** Free-tier cost off-balance-sheet. Negative direct revenue but unlocks scale.

#### 2.7 Affiliate / referral program (~10 hours)

- [ ] Add `referrals` table (referrer, referee, status, total_referred_spend_cents, commission_cents)
- [ ] `/r/:code` link generator in dashboard
- [ ] 15% of referee's spend × 12 months paid as OMA credits to referrer
- [ ] Public dashboard at `app/src/app/affiliate/page.tsx`

**Revenue impact:** Viral growth. 15% is high but cheap — only costs us on retained users.

#### 2.8 Phase 2 verification

- [ ] `pnpm test` green
- [ ] `pnpm typecheck` green
- [ ] Load test: 1000 concurrent requests on `zai-org-glm-4.7` (L tier, 60 RPM with partner tier)
- [ ] Smoke-test batch API
- [ ] Smoke-test webhooks (use a webhook.site endpoint)
- [ ] Smoke-test free-faucet sustainability: simulate 1000 wallet signups, confirm $50/mo ceiling holds
- [ ] Commit per-task; code-reviewer on each

### Phase 3 — Next quarter ($50k+/mo MRR target)

**Goal:** Enterprise + ecosystem + compliance + multi-provider.

#### 3.1 Enterprise tier ($499/mo)

- [ ] SSO/SAML at `server/src/auth/middleware.ts`
- [ ] Team management: `teams`, `team_members`, `team_credits` tables
- [ ] Dedicated Slack channel + 99.9% SLA
- [ ] DPA template + SOC2 Type 1 prep (use Vanta / Drata)

#### 3.2 Multi-provider expansion

- [ ] Add OpenRouter as secondary provider for breadth (when a model isn't on Venice)
- [ ] Smart routing: prefer Venice private, fall back to OpenRouter only if no private equivalent
- [ ] Surface "this model is not private" badge on the OpenRouter fallback

#### 3.3 Agent SDK (~40 hours)

- [ ] `pip install oma-agent` / `npm i @oma-ai/agent`
- [ ] Built-in tool-use loop, conversation state, prompt caching, retry
- [ ] Differentiate vs raw API: "OMA handles retries, fallbacks, caching, and credits for you."

#### 3.4 Official MCP server

- [ ] `npx oma-mcp` for Claude Code / Cursor
- [ ] Tools: `oma_chat`, `oma_list_models`, `oma_get_pricing`, `oma_balance`, `oma_deposit_usdc`

#### 3.5 Compliance + certification

- [ ] SOC2 Type 2
- [ ] HIPAA-compliant deployment option (for healthcare AI builders)
- [ ] EU data residency option via Hetzner / OVH partner region

#### 3.6 Marketing assets

- [ ] Blog with 2 technical posts per week (privacy, x402, VVV, model launches)
- [ ] "Built with OMA" showcase page
- [ ] Hacker News launch + Product Hunt launch
- [ ] Twitter/X presence for Venice + crypto-native AI community

#### 3.7 Phase 3 verification

- [ ] All previous test gates
- [ ] SOC2 audit complete
- [ ] Beta cohort of 10 enterprise customers at $499/mo
- [ ] MRR ≥ $50k target hit

---

## 5. Risks & Mitigations

| # | Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|---|
| 1 | **Venice raises prices or changes terms** | High | Med | (a) Phase 3: add OpenRouter as secondary provider for non-private fallback; (b) Stake VVV to align incentives; (c) Build switching cost via SDKs + dashboards |
| 2 | **L-tier rate limits (20 RPM) throttle growth before Partner tier is granted** | High | High | (a) Email Venice immediately (Phase 1); (b) Default new users to XS/S/M tier models; (c) Document L-tier as "frontier, throttled by design" in marketing |
| 3 | **Free tier ($0.05 faucet) attracts abuse** | Med | High | (a) One wallet per chain address; (b) $50/mo ceiling; (c) No faucet for repeat signups; (d) Use VVV yield to fund, not OMA balance |
| 4 | **25% markup loses to OpenRouter 5.5% on cost-sensitive buyers** | Med | Med | (a) Lead with privacy narrative, not price; (b) Add Free tier to absorb price-sensitive eval; (c) Differentiate markup by tier (low on budget, high on frontier) |
| 5 | **x402 stays a niche protocol, mainstream stays credit-card** | Med | Med | (a) Keep x402 as a feature, not the entire story; (b) Continue supporting USDC direct deposit for users who don't want micropayments |
| 6 | **Wallet-only auth (no email) limits enterprise sales** | Med | Med | (a) Phase 3: add optional email binding for enterprise tier; (b) Keep wallet as default for self-serve |
| 7 | **Regulatory risk: "private" + "no logs" + "wallet" sounds like money-laundering** | High | Low | (a) Word discipline (no "anonymous," "untraceable"); (b) Audit log on admin side; (c) Document KYC-free but auditable; (d) Restrict by region if needed |
| 8 | **VVV/DIEM economics don't pencil out** | Med | Med | (a) Phase 2 is exploratory; (b) Compute break-even before committing; (c) Treat as optional subsidy, not core flow |
| 9 | **Single-provider dependence (Venice goes down = OMA goes down)** | High | Low | (a) Circuit breaker already in place (`server/src/inference/circuit-breaker.ts`); (b) Phase 3 OpenRouter fallback |
| 10 | **Stale model catalog loses developer trust** | Med | Med | (a) Phase 1 fixes immediate drift; (b) Add a weekly cron in `.github/workflows/` to diff `models.json` vs Venice API and file an issue; (c) Auto-update `zai-org-glm-4.6`-class drift |
| 11 | **Tests break when adding new models** | Low | High | (a) Add `server/src/inference/__tests__/models-freshness.test.ts` that fails if a model in `models.json` 404s on Venice; (b) Already 82 tests pass — keep CI gate green |

---

## 6. Key Numbers (for the deck)

| Metric | Today | Phase 1 (week 1) | Phase 2 (month 1) | Phase 3 (quarter 1) |
|---|---|---|---|---|
| Models | 88 | 90 | 92 (with cache) | 100+ (multi-provider) |
| Markup | 25% uniform | 25% uniform | 20–50% tiered | 15–50% tiered + ent |
| Effective gross margin | ~20% | ~20% | ~40% on premium tier | ~50% on premium tier |
| Free tier | ❌ | $0.05 faucet | $0.05 faucet + VVV subsidy | Same + opt-in VVV pool |
| Pricing model | Credits only | Credits + Pro tier sub | Credits + Pro + Ent + Batch | Credits + Pro + Ent + Batch + Volume |
| SDKs | None | Python, TS | + Go | + Rust, Java, MCP |
| Webhooks | None | None | ✅ async | ✅ all events |
| Batch API | None | None | 50% discount | 50% discount |
| MRR target | $0 | $1k (early adopters) | $15k | $50k+ |
| Render infra cost | $7/mo | $7/mo | $25/mo (starter server + bigger DB) | $100/mo (multiple services) |
| Break-even | n/a | <$1k MRR | ~$1k MRR | ~$2.5k MRR |

---

## 7. Open Questions (need user input before Phase 1)

1. **Brand name for the free tier**: "Free", "Builder", "Trial", or something else? Affects `app/src/app/pricing/page.tsx` and landing page copy.
2. **Faucet ceiling**: $50/mo globally, or per-user? The doc above assumes global.
3. **Affiliate commission rate**: 15% of referee spend for 12 months — confirm.
4. **VVV treasury budget**: how much VVV to stake initially? (My recommendation: start with $5,000 VVV = ~$5/day DIEM, then scale to $50,000 VVV if free-tier adoption justifies it.)
5. **Markup tier overrides**: confirm the 20/25/35/45/50% ladder before I touch `models.json`.

---

## 8. References

- **Internal docs:** `README.md`, `competitor-analysis.md`, `docs/venice-research-2026-07-01.md`, `quality-report.md`, `UI_UX_AUDIT_REPORT.md`
- **Code anchors:** `server/src/index.ts` (route mounts), `server/src/config.ts:101` (`OMA_MARKUP_PCT`), `server/src/inference/billing-service.ts` (markup logic), `server/src/inference/models.ts:6–23` (`ModelDef` schema), `server/src/routes/credits.ts:25–29` (purchase schema, $1 minimum), `server/src/x402/facilitator.ts` (x402), `server/src/routes/deposit/index.ts` (deposit flow), `app/src/app/pricing/page.tsx` (pricing UI)
- **External:** `docs.venice.ai/overview/pricing`, `docs.venice.ai/api-reference/rate-limiting`, `venice.ai/pricing`, `venice.ai/token`, `openrouter.ai/pricing`, `portkey.ai/pricing`, `unify.ai/pricing`, `docs.litellm.ai/docs/proxy/provider_margins` — all scraped 2026-07-01.

---

*Strategy v1. Ready for review. Open questions in §7 should be resolved before Phase 1 commits land.*