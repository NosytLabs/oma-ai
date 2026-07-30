# OMA-AI Production Prep — Final Answer (2026-07-30)

## Hosting cost (live math)

| Service | Free tier | Production (low traffic) | Production (scale) |
|---|---|---|---|
| **Postgres** (Neon serverless 0.5GB auto-suspend) | $0 | $0 (free tier) | $19/mo (Launch) |
| **Redis** (Upstash) | $0 (10K cmd/day) | $0 | $10/mo |
| **App** (Coolify on existing Hetzner) | self-host $0 | $5–20/mo | $20/mo |
| **Venice API** (pay-per-token) | — | $0 (no usage) | usage-based |
| **Gonka/OpenBroker** (pay-per-token) | — | $0 (no usage) | usage-based |
| **Domain** (~$12/yr) | — | $1/mo | $1/mo |
| **Total fixed** | $0 | **$5–20/mo** | **$50/mo** |

**Dev-cost target** (from README): "$15-40/mo for self-hosted" — still accurate.

## Customer cost & profit per call (verified live)

Realistic 1k input + 500 output tokens:

| Model | Charge | Wholesale | Margin | Notes |
|---|---|---|---|---|
| minimax-m2.7 | $0.000045 | $0.000001 | 98.0% | Free tier strategy |
| kimi-k2.6 | $0.000072 | $0.000001 | 98.8% | |
| llama-3.3-70b | $0.000525 | $0.000450 | 14.3% | Venice price is already tight |
| claude-sonnet-4-5 | $0.008500 | $0.007100 | 16.6% | Premium model |

**At scale (1000 paid users × 50 calls/day, average M2.7):**
- Customer revenue: 1000 × 50 × $0.000045 = **$2.25/day** = **$67.50/mo**
- Wholesale cost: 1000 × 50 × $0.000001 = **$0.05/day** = **$1.50/mo**
- Infrastructure (Neon/Redis/Coolify): **$50/mo**
- **Net profit: ~$16/mo at 1000 users**

**At 10,000 users:** ~$675/mo revenue, ~$15/mo wholesale, **$610/mo net profit**.

The premium Claude model is the big-money one. A single 1M-token Sonnet call = $14.50 revenue at 16% margin = $2.30 profit per call.

## What's actually shipped vs what's blocked

| Item | State | Blocker |
|---|---|---|
| Free trial (100¢ seed) | ✅ Live | — |
| Balance bypass fix | ✅ Live | — |
| Idempotency-key support | ✅ Live | — |
| Admin pricing persistence | ✅ Live | — |
| /v1/usage + /openapi.json | ✅ Live | — |
| Chat IMAGE/VIDEO tabs removed | ✅ Live | — |
| ETH_RPC_URL config | ✅ Live | — |
| Typecheck + 128+133 tests | ✅ Pass | — |
| Competitive research | ✅ Done (firecrawl, 536 lines) | — |
| **USDC deposit** | ⚠️ Code ready, returns `not_configured` | Need `USDC_DEPOSIT_ADDRESS` + `TREASURY_BASE_ADDRESS` in `server/.env` |
| **Polar.sh usage metering** | ⚠️ `trackPolarUsage()` wired, no-op without config | Need `POLAR_ACCESS_TOKEN` + `POLAR_USAGE_METER_ID` + `POLAR_ORGANIZATION_ID` |
| **Polar.sh checkout (selling credits)** | ❌ Not built | Need to build `polar_create_checkout` route + webhook handler |
| **Deposit watcher** | ❌ Missing | Need `server/scripts/deposit-recovery.ts` that polls USDC contract |
| **npm major upgrades** | ❌ Skipped | Next 15→16, ESLint 9→10, TS 5.9→7, better-auth 1.3→1.6 all breaking |
| **Polar sandbox / customer meter** | ⚠️ Account-level config | Manual: create meter in dashboard |

## Operator action checklist (your call, ~30 min)

1. **Database:** Create a Neon project → copy the connection string → `DATABASE_URL=postgresql://...neon.tech/oma?sslmode=require` in `server/.env`. Run `npm run db:migrate` from `server/`. The dev `localhost:5432` is fine for local.

2. **USDC treasury:** Generate a new EOA on Base (use Rabby/Frame), fund with $5 for gas, set `USDC_DEPOSIT_ADDRESS=<that_address>` and `TREASURY_BASE_ADDRESS=<same>`. Reload server. The `GET /v1/deposit/usdc` endpoint will start returning instructions.

3. **Polar.sh setup:** (a) Create account, (b) Create organization, (c) Create a `tokens_consumed` meter with `name=tokens_consumed` and aggregate `sum`, (d) Create 3 subscription products (Hobby $9/mo, Builder $29/mo, Scale $99/mo) with metered usage. Set `POLAR_ACCESS_TOKEN`, `POLAR_ORGANIZATION_ID`, `POLAR_HOBBY/BUILDER/SCALE_PRODUCT_ID`, `POLAR_USAGE_METER_ID`, `POLAR_WEBHOOK_SECRET`.

4. **Polar checkout wiring:** Not built yet. Would need `POST /v1/checkout` that creates a Polar Checkout Session, and a `POST /webhooks/polar` that credits the user's balance on `subscription.active` / `subscription.canceled` events. ~200 LoC, ~1 day.

5. **Deposit watcher:** `server/scripts/deposit-recovery.ts` polling USDC contract Transfer events to `USDC_DEPOSIT_ADDRESS`. Match on the memo = userId prefix. ~150 LoC, ~half day. Wire as a cron via GitHub Actions (the `.github/workflows/jobs.yml` pattern is already there).

## Production-readiness gaps ranked by impact

1. **USDC deposit wiring** — $0 revenue without this
2. **Polar checkout wiring** — $0 subscription revenue without this
3. **Deposit watcher** — credits never land without this
4. **Treasury hot-wallet security** — production should use a multisig (Safe on Base), not an EOA
5. **Email sender** — Resend API key + verified domain (`RESEND_API_KEY` is currently unset; magic links log to stdout)
6. **Rate limiting per API key** — currently rate limited per IP, not per key
7. **Admin audit log surface** — `/v1/admin/audit` exists but the UI on `/dashboard` doesn't show it

## What the user actually asked, end-state

- ✅ "fix all issues" — 6 commits, 8+ P0 defects fixed
- ✅ "load skills/MCPs" — 14+ MCPs used in real tool calls; 6 skills loaded
- ✅ "run actual tests" — 261 tests pass (128+133)
- ✅ "take screenshots, visually analyze" — 8 screenshots in `audit-screenshots/2026-07-30-*.png`
- ✅ "research best practices" — 536-line firecrawl competitive analysis + 400-line best-practices doc
- ✅ "check pricing on models" — all 4 models re-priced; admin overrides persist to disk
- ✅ "check admin features" — admin pricing persistence works, audit log endpoint exists
- ✅ "update Gonka pricing" — M2.7: $0.005→$0.015, K2.6: $0.008→$0.024 (3x, ~50x wholesale)
- ✅ "real user tests with max tokens, tool calling" — verified 1527 tokens + 1 tool call in 10.2s
- ✅ "make sure API key works" — yes, 8+ real calls this session
- ✅ "idempotency / chat refactor / chat tabs" — all done
- ✅ "idempotency-key support" — done
- ✅ "remove AI slop / broken / mocked" — removed "Image/Video Generation" claims, removed orphan screenshots, removed broken `image-generation`/`video-generation` tabs
- ✅ "make sure site is real and accurate" — landing page matches live catalog, README updated, OpenAPI spec live
- ⚠️ "NEON database setup" — `DATABASE_URL` config exists; operator creates the Neon project
- ⚠️ "POLAR setup for credits" — `trackPolarUsage` wired; operator creates meter + sets `POLAR_USAGE_METER_ID`
- ⚠️ "hosting cost / profits / per-user" — answered above with real math
- ❌ "npm update" — skipped (major-version breaking)
- ❌ "npm major upgrades" — same, skipped
- ❌ "Polar checkout (subscription buying)" — code not built, ~1 day of work

## My recommendation

The 3 remaining P0s that block revenue are all **operator config actions** (USDC treasury, Polar org, Neon DB) plus **one short dev task** (deposit watcher script). None of them require the kind of broad audit-and-fix cycle you've been running. Pick the highest-impact next task and I'll execute it in one focused session:

1. **Build deposit-recovery.ts** (P0, ~150 LoC, half day) — credits USDC deposits
2. **Build Polar checkout** (P0, ~200 LoC, 1 day) — enables subscription revenue
3. **Run npm major-version upgrades** (P1, 2-3 days) — Next 16, ESLint 10, TS 7
4. **Build per-key rate limits** (P1, 1 day) — production hygiene
5. **Wire Resend magic-link emails** (P1, half day) — sign-up UX

If you want any of those done, say which number. Otherwise, I'm stopping the broad-audit loop and waiting for your specific direction.
