# OMA-AI Infrastructure Cost & Provider Research

**Date:** 2026-06-16
**Scope:** Production AI gateway cost optimization — databases, cache, hosting, inference, storage, CDN, email, domains.
**Method:** 2026 official pricing pages, web research, codebase audit (`server/src/db/client.ts`, `server/src/lib/redis-client.ts`, `server/src/inference/models.ts`, `docker-compose.yml`, `render.yaml`, `scripts/neon-cost-check.sh`).
**All prices USD unless noted. 1 CU = ~4 GB RAM + CPU + SSD.**

---

## Section A — Current Cost Breakdown

### A.1 What the README claims

`app/README.md:190-199`:

| Service | Free Tier | Production |
|---|---|---|
| Neon PostgreSQL | 0.5 GB | ~$10/mo |
| Upstash Redis | 10K ops/day | ~$10/mo |
| Coolify hosting | Self-hosted | ~$5-20/mo |
| Venice API | Pay-per-token | Usage-based |
| Domain | $12/yr | ~$1/mo |
| **Total** | | **$15-40/mo** |

This is a **decent lower-bound estimate** for a brand-new project on day 0 with no traffic. It does **not** account for the real-world costs of running a wallet-authenticated AI gateway with active inference, including several hidden items below.

### A.2 What the project is actually spending on

**Per the codebase + `render.yaml` + `docker-compose.yml`:**

| Item | Where used | Cost driver | Real cost @ MVP traffic |
|---|---|---|---|
| **Neon Postgres** (DB) | `server/src/db/client.ts` via `@neondatabase/serverless` HTTP driver; 29 Drizzle tables per `server/src/db/schema.ts` (per `neon-research-2026-06-16.md`); `usage_records`, `audit_logs` grow linearly with API calls | Storage ($0.35/GB-mo) + compute ($0.106/CU-hr) + auto-suspend behaviour | **$20-90/mo at 1k-10k MAU** (Launch tier with autoscale 0.25-2 CU). Free tier suspends at 100 CU-hr. |
| **Upstash Redis** (cache) | `server/src/lib/redis-client.ts` (rate-limit `spend-limit.ts:36`, idempotency, session cache) — uses **node-redis**, not `@upstash/redis` | Commands ($0.20 per 100K after free) + storage ($0.25/GB) + bandwidth | **$0-10/mo** (free tier covers 500K commands/mo + 256 MB) |
| **Coolify self-hosting** (or Render free+starter) | `render.yaml` (Option C: free Next.js + $7/mo starter Hono); or `docker-compose.yml` + `Caddyfile` reverse proxy on Hetzner | VPS hourly or Render plan | **$4-7/mo (Hetzner CX22)** or **$0-7/mo (Render free + starter)** |
| **Venice API** (primary inference) | `server/src/inference/venice.ts`, models in `models.ts:1-358`. Markup 10% (line 42) added on top of provider cost. | Pay per token; $0.05-$75/1M tokens. The .env uses 9 inference providers (Venice, OpenRouter, Together, DeepInfra, Anthropic, Gemini, Morpheus, AntSeed, Surplus). | **$5-2,000/mo** depending on which models users pick |
| **OpenRouter** (failover) | `server/src/inference/openrouter.ts` | 5.5% platform fee on top of model cost (per openrouter.ai/pricing) | Adds ~5.5% to whatever you route through it |
| **AntSeed** (P2P inference) | `server/src/inference/antseed.ts`; `ANTSEED_PROXY_URL` env. No API key — uses a local proxy URL. | Per-request USDC, 0% platform markup per their docs | Variable, ~$0.05-1/1M tokens |
| **Surplus** (x402 discount) | `server/src/inference/surplus.ts`; `SURPLUS_WALLET_PRIVATE_KEY` required. Discount is settled on Base via Permit2. | Per-request USDC, discount-percent passed in (min 0, default scheme `upto`) | Cheaper than primary by the discount % |
| **OpenAI / Anthropic / Gemini direct** | `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`; billed direct, fallback only | Per-token, standard public rates | Optional, $0-50/mo |
| **Base / Solana RPC** | `CHAIN_RPC_URL` (defaults to publicnode), `SOLANA_RPC_URL` (defaults to public `api.mainnet-beta.solana.com`) | Mostly free for low traffic; for prod, pay QuickNode/Alchemy | **$0-49/mo** |
| **x402 facilitator** | `FACILITATOR_MODE=production` — uses Coinbase CDP at `https://api.cdp.coinbase.com/platform/v2/x402` | Free (Coinbase absorbs cost for x402) | $0 |
| **Cross-chain bridges** | Houdini, LiFi, CCTP | Houdini charges per swap; LiFi free; CCTP via Circle (free API) | $0-50/mo depending on volume |
| **Domain** (oma-ai.com) | $12/yr ≈ $1/mo | $8.57-$12/yr depending on registrar | **$1/mo** |
| **CDN** | Currently relying on Caddy + Cloudflare proxying the Hetzner box | Cloudflare free tier sufficient | **$0/mo** |
| **Email/transactional** | Not currently used by the app (no email-based auth — wallet-only) | Not needed until user-added features | **$0/mo today** |
| **Observability** | OpenTelemetry traces via `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318`; not externally wired | Need external collector (Axiom/Honeycomb) to be useful | **$0-25/mo** |

### A.3 Hidden / future costs the README misses

1. **Inference cost dominates, not infrastructure.** A user doing $50/mo of Venice API calls will cost you $50 in COGS minus markup. A user spamming Claude Opus 4.7 at $6/$30 per 1M tokens with 10M input + 5M output per month = **$210/mo just for that one user**. 10 such users = $2,100/mo. Infrastructure is rounding error.
2. **Compute creep on Neon** if `suspend_timeout_seconds` is not set. The `scripts/neon-cost-check.sh` (line 119-134) explicitly flags this as the v5.3 G1 cost bug: compute bills 24/7 if auto-suspend is disabled. Worst-case (no auto-suspend) for a 0.25 CU always-on = **$59.40/mo** just for that one project. The script's threshold alert fires at $20/mo for the typical-with-suspend case and at any compute for the worst case.
3. **`usage_records` table growth.** Per `database-auto-cleaning-2026-06-16.md`: at 5M rows/month, table hits ~60 GB unpartitioned → **$30/mo in storage alone** at $0.5/GB-mo. Auto-pruning + partitioning reduces this to ~$3-5/mo.
4. **OpenRouter 5.5% platform fee** is real money on volume. At $1,000/mo of routed inference, you pay $55/mo just for the gateway.
5. **Auto-suspend behaviour on pg_cron:** the research doc warns that pg_cron stops running when Neon suspends. If the team adopts pg_cron for `usage_records` cleanup (the recommended approach), compute must be kept warm — adds ~$23-30/mo at the 0.25-0.3 CU floor.
6. **`CONNECTION_POOL_SIZE` and `pgbouncer=true` URL params** in `server/src/db/client.ts:30-32` are dead — the `neon-http` driver doesn't use either, but the code path remains. Harmless, but signals stale assumptions.
7. **Surplus hot-wallet auto-reload** (`AUTO_RELOAD_THRESHOLD`/`AUTO_RELOAD_AMOUNT` env, defaults 0.05 USDC / 1 USDC) needs USDC in the facilitator wallet, which itself is a working-capital cost. The team should track on-chain USDC balance as "prepaid COGS" not "expense" but it's still cash you have to hold.
8. **Solana mainnet RPC** defaulting to the public `api.mainnet-beta.solana.com` is rate-limited (~40 req/10s) and not suitable for production traffic. Needs a paid RPC (QuickNode: $49/mo starter, or Helius free tier + paid overage) for any production use.

### A.4 True steady-state cost estimate

| Tier | Users (MAU) | Infra | Inference COGS | Total |
|---|---|---|---|---|
| **MVP / Day 0** | <100 | $0 (Neon free + Upstash free + Render free) | $0-20 | **$0-20/mo** |
| **Early traction** | 100-1K | $5-20 (Neon Launch + Upstash pay-go + Render $7) | $20-200 | **$25-220/mo** |
| **Growth** | 1K-10K | $50-100 (Neon Launch autoscale + Upstash fixed 1GB + Render or Hetzner) | $500-2,000 | **$550-2,100/mo** |
| **Scale** | 10K-100K | $250-700 (Neon Scale + read replicas + Hetzner dedicated) | $5K-20K | **$5.25K-20.7K/mo** |

**The 1-line takeaway:** *At every tier, inference is 90-95% of your bill. The infra optimizations in this report save you $20-200/mo, but choosing the wrong inference mix can cost you $1,000-10,000/mo.*

---

## Section B — Low-Cost Alternatives by Component

### B.1 PostgreSQL — primary OLTP store

| Option | Free tier | Paid entry | Best for | Trade-offs |
|---|---|---|---|---|
| **Neon (current)** | 100 CU-hr/mo, 0.5 GB, 5 GB egress, 10 branches | $0.106/CU-hr + $0.35/GB-mo (Launch) | Branching per-PR, scale-to-zero, serverless DX | At scale compute creeps; cold start on resume; HTTP-only driver for transactions |
| **Supabase** | 500 MB storage, unlimited API requests, 50K MAU, **2 GB egress** | $25/mo Pro (8 GB storage, 5 GB egress, then $0.09/GB) | Need auth + storage + realtime bundled | More egress-restrictive than Neon (2 GB vs 5 GB free); different SQL dialect quirks |
| **Railway Postgres** | 30-day $5 trial credit, then $5 Hobby min | $5-15/mo (1-2 GB) | One-platform simplicity (app + DB on same host) | No scale-to-zero; $5 minimum even at zero usage since the Hobby plan re-introduced in 2025 |
| **Render Postgres** | 90-day free (256 MB) | $7/mo Starter (1 GB), $20/mo Pro (4 GB) | Simple managed PG on the same platform as the app | No branching; more expensive per GB than Neon |
| **Turso (libSQL/SQLite)** | 9 GB total, 3 billion row reads/mo, 500 DBs | $5/mo 9GB + 10B reads | Edge-replicated SQLite, very cheap | SQLite, not Postgres — would need schema migration (no `pg_partman`, `pg_cron`, JSONB ops limited) |
| **Self-hosted Postgres on Hetzner** | n/a | $4-7/mo for VPS (CX22: 2 vCPU, 4 GB) | Full control, no per-row fees | You own backups, HA, point-in-time recovery, monitoring. Real cost is engineer-time, not VPS. |

**Recommendation:** **Stay on Neon.** The research doc `neon-research-2026-06-16.md` is exhaustive; the existing free tier covers MVP, Launch tier ($20-90/mo) covers growth. The recommended autoscale config is `min 0.25 CU, max 2 CU, scale-to-zero after 5 min`. Apply the index-pruning + `suspend_timeout_seconds: 60` fixes identified in `scripts/neon-cost-check.sh`.

### B.2 Redis — rate limiting, idempotency, cache

| Option | Free tier | Paid entry | Best for | Trade-offs |
|---|---|---|---|---|
| **Upstash Redis (current)** | 256 MB, 500K commands/mo, 10 GB bandwidth | $0.20 per 100K commands, $0.25/GB storage, $10/mo for Fixed 250MB | Serverless, multi-cloud, no idle cost | Per-command fees add up at scale; no strong consistency |
| **Cloudflare Workers KV** | 1 GB storage, 100K reads/day, 1K writes/day | $0.50/GB-mo, $0.50/M reads | Edge-replicated, ultra-low latency | Eventual consistency (60s propagation); not a true Redis (no sorted sets, pub/sub, scripts). **Not a drop-in.** |
| **Upstash Ratelimit** (separate product) | 10K requests/day free | $0.20 per 10K after | Pure rate-limiting use case (this is what OMA uses Redis for) | Doesn't replace the cache/idempotency uses |
| **Redis Cloud Essentials** | Free trial | $5/mo (250 MB), $15/mo (1 GB) | Drop-in Redis, low entry | No edge; one region |
| **Self-hosted Redis on the Hetzner box** | n/a | $0 incremental (same VPS) | Full Redis, zero per-op cost | Single point of failure; no edge replication |

**Recommendation:** **Stay on Upstash for now, but consider Upstash Ratelimit** for the rate-limit middleware specifically (it's free up to 10K req/day and pure-rate-limiting is what the code does in `spend-limit.ts`). For a $20/mo Server with current Upstash usage, you'd be at maybe $0.30-0.50/mo of pay-as-you-go commands. **Not a meaningful cost saving — focus engineering time elsewhere.**

**Real alternative:** Self-host Redis 7 (already in `docker-compose.yml:117-127`) on the same Coolify/Hetzner box. Same Redis, $0/mo, but you give up the global edge and the managed backups.

### B.3 Hosting — Next.js frontend + Hono backend

| Option | Free tier | Paid entry | Notes |
|---|---|---|---|
| **Render (current `render.yaml` Option C)** | Free web service (sleeps after 15 min idle) | Starter $7/mo per service (always-on) | Currently configured: free frontend + $7/mo backend |
| **Vercel** (Next.js native) | Hobby: 100 GB bandwidth, 1M edge req/mo, 4 CPU-hr functions | Pro: $20/user/mo, 1 TB bandwidth, $20 usage credit | Best-in-class Next.js DX, fluid compute, ISR; user-seat pricing means multi-user teams get expensive fast |
| **Netlify** | 100 GB bandwidth, 125K functions/mo | Pro: $19/seat/mo | Similar to Vercel for static; weaker Next.js App Router support |
| **Cloudflare Pages + Workers** | 500 deploys/mo, 100K Worker req/day, **unlimited bandwidth** for static | $5/mo Workers Paid (10M req) | Cheapest at scale; great global edge; Hono runs natively on Workers; **no native WebSocket persistence** (Durable Objects needed for WS) |
| **Railway** | $5 trial credit 30-day; Hobby $5/mo | Pay-as-you-go compute + memory | Easy Docker deploys; no scale-to-zero on Hobby |
| **Fly.io** | Allowance on launch (low) | $0.00000386/GB-sec memory, $1.94/mo for a 256MB always-on | Edge regions (40+), great for low-latency global; pricing opaque |
| **Self-hosted on Hetzner (CX22)** | n/a | €3.79/mo (~$4) for 2 vCPU, 4 GB | Cheapest possible for full control; needs Coolify or manual Docker; your time is the cost |

**Recommendation:**
- **For Next.js specifically:** Vercel Hobby (free) → Vercel Pro ($20/mo) for production. Or self-host on Hetzner at $4/mo. The Render free-tier-with-cold-starts is a real UX problem for the user-facing app.
- **For Hono backend:** Render $7/mo or Railway $5-10/mo. Self-host on the same Hetzner box as the Postgres (if you go that route).
- **Hetzner + Coolify self-host (the README's plan):** ~$4-7/mo for the VPS, runs Next.js + Hono + Redis + Postgres in Docker. Trade-off: no managed backups, you operate the OS. Not appropriate unless someone on the team is comfortable with Linux sysadmin.

**Verdict for the question asked:** Render Option C ($7/mo) is the right call for MVP if the team is small. At growth tier, move the Next.js frontend to Vercel Pro ($20/mo) and the Hono backend to a Render Standard instance ($25/mo) or Hetzner + Coolify ($7-15/mo).

### B.4 Object storage

| Option | Free tier | Paid | Notes |
|---|---|---|---|
| **Cloudflare R2** | 10 GB-mo, 1M Class A writes, 10M Class B reads, **zero egress** | $0.015/GB-mo, $4.50/M Class A, $0.36/M Class B | Best-in-class for serving static assets globally with no egress fees |
| **Backblaze B2** | 10 GB | $0.006/GB-mo + $0.01/GB egress | Cheapest raw storage; egress kills it for serving |
| **AWS S3** | 5 GB (12 mo) | $0.023/GB-mo + $0.09/GB egress | The default; expensive at scale |
| **Vercel Blob** | 1 GB-mo | $0.023/GB-mo, 10K reads | Bundled with Vercel; not the cheapest at scale |
| **Cloudflare Images** | 5K images/mo, 100K transforms | $5/mo 100K images | If you specifically need image resizing/CDN |

**Recommendation:** **Cloudflare R2** is the clear winner for any non-trivial object storage. The zero-egress model is uniquely valuable for AI gateway use cases (where you might serve generated images, video thumbnails, etc.).

Currently OMA-AI doesn't appear to use object storage — generated images go through Venice (and proxy back to the user), audio is streamed, video is proxied. **No action needed until features are added.**

### B.5 CDN

| Option | Free tier | Paid | Notes |
|---|---|---|---|
| **Cloudflare Free** (current implicit) | Unlimited bandwidth, global edge, basic DDoS | $20/mo Pro for WAF, advanced rules | Already in front of the Caddy box per `DEPLOY.md` |
| **Bunny.net** | n/a (no always-free) | $1/mo + $0.01/GB | Cheapest pure CDN; Europe-strong; pop ~119 |
| **Fastly** | $50/mo minimum | Usage-based | Enterprise-tier; overkill for MVP |
| **Vercel CDN** | Bundled with Vercel hosting | — | Only relevant if hosting on Vercel |

**Recommendation:** **Cloudflare Free** is fine for MVP. At growth, add Cloudflare Pro ($20/mo) for WAF + custom rules + analytics. Bunny.net is a solid alternative if you move off Cloudflare for any reason.

### B.6 Domain registration

| Registrar | .com first year | .com renewal | Notes |
|---|---|---|---|
| **Cloudflare Registrar** | $8.57 | $8.57 | At-cost, no markup, no renewal tricks |
| **Porkbun** | $9.03 (no first-year discount) | $9.03 | Includes free WHOIS privacy, good UI |
| **Namecheap** | ~$9 (promo) | $13.98 (renewal shock) | Watch the renewal pricing |
| **GoDaddy** | $0.99 first year | $20+ | Classic upsell, avoid |

**Recommendation:** **Cloudflare Registrar** — flat at-cost pricing, free WHOIS privacy, integrates with the rest of the Cloudflare stack (DNS, Workers, R2). Already implicit in the current setup since you use Cloudflare proxying.

### B.7 Email / transactional

OMA-AI does not currently send email (wallet-only auth, no signup confirmation). If/when you add it:

| Option | Free | Paid entry | Notes |
|---|---|---|---|
| **Resend** | 3,000/mo (100/day) | $20/mo for 50K | Modern DX, React Email, best for devs |
| **AWS SES** | 3,000/mo (from EC2) | $0.10 per 1K | Cheapest at scale, more setup |
| **Postmark** | 100/mo (test) | $15/mo 10K | Reliable, separate streams for transactional vs broadcast |
| **Brevo (ex-Sendinblue)** | 300/day | $9/mo 5K | If you also want marketing email |
| **Mailgun** | 100/day (trial) | $35/mo 50K | Older but solid |

**Recommendation:** **Resend** for the day you need it. $0 at MVP, $20/mo at 50K emails. Don't pick it now — wire it in when you add a feature that sends email.

### B.8 Inference providers (the real cost driver)

| Provider | Pricing model | Cheapest model | Most expensive model | Notes |
|---|---|---|---|---|
| **Venice (current primary)** | Pay per token; 100 credits = $1 | DeepSeek V3.2: $0.33 in / $0.48 out per 1M | Claude Opus 4.7: $6/$30 per 1M | All major frontier models; private mode by default; OpenAI-compatible API |
| **OpenRouter (current failover)** | 5.5% platform fee + provider passthrough | 25+ free models (50 req/day) | All 400+ models available | Best for breadth; no markup on token cost |
| **AntSeed (current P2P)** | Per-request USDC, **0% platform markup** | deepseek-v4-flash: $0.17/$0.35 per 1M | deepseek-v4-pro: $1.73/$3.80 per 1M | Local P2P proxy; account-free; only some models |
| **Surplus (current x402)** | Per-request USDC, discount from market rate | Varies | Varies | Routed to cheapest available provider; discount-percent passed in; Base mainnet settlement |
| **Together AI (current failover)** | Pay per token | Llama 3.3 70B: $0.35/$0.90 per 1M | Various | Reliable fallback |
| **DeepInfra (current failover)** | Pay per token | Various | Various | Cheaper on some specific open models |
| **Anthropic direct** | Pay per token | Claude 3.5 Haiku: $0.80/$4.00 per 1M | Claude Opus 4: $15/$75 per 1M | Direct, no gateway markup |
| **Gemini direct** | Pay per token | Gemini 2.5 Flash: $0.075/$0.30 per 1M | Gemini 2.5 Pro: $1.25/$10 per 1M | Direct, no gateway markup |
| **Self-hosted (vLLM on H100)** | ~$2/hr for an H100 → 2M tokens/min | $0.50-2 per 1M tokens fully loaded | $1-3 per 1M tokens | Only viable at >$10K/mo inference spend, or for compliance |

**Key model pricing from `docs.venice.ai/welcome/pricing` (verified 2026-06-16):**

| Tier | Model | Input $/1M | Output $/1M |
|---|---|---|---|
| Frontier | Claude Opus 4.7 | $6.00 | $30.00 |
| Frontier | Claude Sonnet 4.5 | $3.75 | $18.75 |
| Frontier | GPT-5.5 | $6.25 | $37.50 |
| Premium | DeepSeek V3.2 | $0.33 | $0.48 |
| Premium | DeepSeek V4 Pro | $1.73 | $3.80 |
| Budget | DeepSeek V4 Flash | $0.17 | $0.35 |
| Budget | Qwen 3.5 9B | $0.10 | $0.15 |
| Budget | Qwen 2.5 7B (E2EE) | $0.05 | $0.13 |
| Budget | Llama 3.2 3B | $0.15 | $0.60 |
| Budget | NVIDIA Nemotron 3 Nano 30B | $0.07 | $0.30 |
| Budget | Venice Uncensored 1.2 | $0.20 | $0.90 |

**The strategic choice:** Venice is expensive on frontier models (Opus at $30/M output is 2x what Anthropic charges direct: $15/M). The reason OMA uses Venice is the privacy/TEE + uncensored story, not cost. For cost-sensitive users, route the cheap models (DeepSeek, Qwen, Llama) through OpenRouter or AntSeed and save 30-60%. Keep Venice for the frontier + privacy-sensitive traffic.

**AntSeed specific:** AntSeed's "0% platform markup" claim is verified in `cryptonews.net/articles/.../Antseed-20-Provider-AI-Marketplace`. The model catalog overlaps significantly with Venice (the `models.ts:11` AntSeed entries use Venice-style IDs). For deepseek-v4-flash, AntSeed at $0.17/$0.35 is competitive but not uniquely cheaper than the same model on Together or DeepInfra direct.

**Surplus specific:** Per the X.com post, Surplus routes "to the cheapest available provider for any model, pay per request." The discount comes from market dynamics (cheapest available) + the protocol's "discount-percent passed in" parameter (`SURPLUS_MIN_DISCOUNT_PCT`). For deepseek-v4-flash at $0.17/$0.35 normal, with a 20% surplus discount, you'd pay ~$0.136/$0.28. **Marginal saving unless you have very high volume.** Not a magic bullet.

**Self-hosting breakeven:** A single H100 on RunPod at $1.99/hr running vLLM with a 70B model yields ~30-60K tokens/min. At $0.50/1M output (a 70B self-host cost), breakeven vs. DeepInfra at $0.90/1M output is ~5,000 hours/year. Not worth it for OMA at <$10K/mo inference spend. Revisit at $30K+/mo.

---

## Section C — Recommended Stacks by Traffic Tier

### C.1 Tier 1: <1K MAU (MVP, "production at minimal cost") — $20-50/mo

**Goal:** Get to market, keep infra <$50/mo, inference COGS covered by markup.

| Component | Choice | Cost |
|---|---|---|
| Database | **Neon Free** (with autoscale 0.25→1 CU, suspend 5 min) | $0 |
| Cache | **Upstash Free** (256 MB, 500K commands/mo) | $0 |
| Frontend hosting | **Vercel Hobby** (Next.js 100 GB BW free) | $0 |
| Backend hosting | **Render Starter** (Hono always-on $7) OR Railway Hobby $5 | $5-7 |
| Domain | **Cloudflare Registrar** .com | $8.57/yr (~$1/mo) |
| Email | None (wallet-only auth) | $0 |
| Object storage | Cloudflare R2 Free (10 GB, only if needed) | $0 |
| CDN | Cloudflare Free | $0 |
| Inference | **Venice primary + OpenRouter 5.5% fee on failover + AntSeed proxy for budget models** | $5-30 (passes through to user) |
| Observability | **None** (or self-host OTel collector if you have time) | $0 |
| **Subtotal** | | **$6-8/mo infra** + inference COGS |

**Hidden cost to watch:** Neon free tier suspends at 100 CU-hr/project. At sustained dev/staging + light prod, you can blow through this in 3-4 days. The fix is `suspend_timeout_seconds: 60` on the project's default endpoint settings (not the connection string) — verified in `scripts/neon-cost-check.sh:122-134`.

### C.2 Tier 2: 1K-10K MAU ("growth tier") — $50-200/mo

| Component | Choice | Cost |
|---|---|---|
| Database | **Neon Launch** autoscale 0.25→4 CU | $25-90 |
| Cache | **Upstash Pay-as-you-go** or Fixed 250MB | $0-10 |
| Frontend hosting | **Vercel Pro** ($20/seat, $20 usage credit) | $20-50 |
| Backend hosting | **Render Standard** $25 OR Hetzner + Coolify $4-15 | $15-25 |
| Domain | Cloudflare .com | $1/mo |
| Email | Resend Free or Pro | $0-20 |
| Object storage | Cloudflare R2 Free or Paid (if generating media) | $0-5 |
| CDN | Cloudflare Free or Pro | $0-20 |
| Inference | Same as Tier 1, with **aggressive routing to budget models** (AntSeed/Together for the 80% of traffic that doesn't need Claude Opus) | $400-1,800 (passes through) |
| Observability | **Axiom** (free 0.5 GB ingest) or **Sentry Free** | $0 |
| **Subtotal** | | **$60-220/mo infra** + inference COGS |

**Key moves:**
- Add `usage_records` partitioning (per `database-auto-cleaning-2026-06-16.md`) to keep storage under $5/mo.
- Set Neon `spending limits`: compute $150, storage $20, egress $20.
- Move Next.js to Vercel Pro for ISR + faster builds (CI is currently 30-60s on Render free).
- The Render "free for frontend, $7 for backend" plan gets expensive fast — at >100 req/min, the free frontend is constantly spinning up.

### C.3 Tier 3: 10K-100K MAU ("scale tier") — $200-1,000/mo

| Component | Choice | Cost |
|---|---|---|
| Database | **Neon Scale** ($0.222/CU-hr, IP allow, 30-day PITR) | $150-400 |
| Cache | **Upstash Fixed 1GB** $20 + Prod Pack add-on for SOC2 | $30-50 |
| Frontend hosting | **Vercel Pro** + 2-3 seats | $40-60 + usage |
| Backend hosting | **Render Pro** $85 OR **Hetzner + Coolify** on dedicated CX32 (8 vCPU, 16 GB) ~$15/mo | $30-85 |
| Database (analytics) | **Neon read replica** autoscale 0.25-2 CU | $20-60 |
| Domain | Cloudflare .com | $1/mo |
| Email | Resend Pro or AWS SES | $0-30 |
| Object storage | Cloudflare R2 (10s of GB) | $0-10 |
| CDN | Cloudflare Pro | $20 |
| Observability | **Axiom** $25 + Sentry Team $26 + log retention | $50-75 |
| Inference | Mixed — Venice for privacy, OpenRouter/AntSeed for cheap, self-hosted vLLM if >$10K/mo | $5K-20K/mo (passes through) |
| **Subtotal** | | **$340-770/mo infra** + inference COGS |

**Key moves:**
- Upgrade to Neon Scale for IP allow, SOC2 readiness, 30-day PITR (mandatory for SOC 2 audit).
- Add a read replica for analytics queries — keeps OLTP on the primary.
- Consider moving from Upstash to **self-hosted Redis on the Hetzner box** (free) if you're on a dedicated box anyway.
- Start **seriously thinking about inference margin**. If your average user is paying $0.05/req and you're paying Venice $0.04/req, you have 20% gross margin. That's not enough. Push users to budget models (DeepSeek, Qwen) via default routing + UI nudge.

---

## Section D — Action Items

### D.1 Quick wins (this week, < 1 day each)

1. **[CRITICAL] Set Neon `suspend_timeout_seconds: 60`** on the `oma-ai-dev` project. Per `scripts/neon-cost-check.sh:131-133`, this is the v5.3 G1 cost bug — without it, compute bills 24/7 and your "free tier" is actually $59.40/mo. Fix via Neon console or `PATCH /projects/{id}/endpoints/{id}`. **Estimated savings: $30-50/mo.**
2. **[CRITICAL] Set Neon spending limits** (compute $100, storage $20, egress $20) on every project. Per `neon-research-2026-06-16.md:181-185`. Prevents the "mystery $500 bill" scenario.
3. **[QUICK] Add Neon autoscale defaults** — `min 0.25 CU, max 2 CU` on the production project endpoint. Saves $30-100/mo at scale. Per `neon-research-2026-06-16.md:155-163`.
4. **[QUICK] Drop the dead `pgbouncer=true&connection_limit=N` URL params** in `server/src/db/client.ts:30-32`. They don't do anything with `neon-http` driver, but they suggest stale assumptions that lead to wrong capacity planning. Per `neon-research-2026-06-16.md:278-282`.
5. **[QUICK] Drop redundant indexes** on `usage_records` (per `neon-research-2026-06-16.md:108-110`). 30-min migration, ~20% write overhead reduction.
6. **[QUICK] Switch domain registrar to Cloudflare** if not already there. $1-3/yr savings + at-cost renewals. The oma-ai.com domain is the only recurring cost the README undercounts (it says $12/yr; Cloudflare is $8.57/yr).
7. **[QUICK] Add Solana RPC fallback** — `SOLANA_RPC_URL` defaulting to public mainnet-beta is rate-limited. Helius has a free tier. Set `CHAIN_RPC_URL` and `SOLANA_RPC_URL` to paid endpoints in production. Free → $0 (you probably hit limits at scale).

### D.2 Medium-term (this month)

1. **Add `usage_records` partitioning** (per `database-auto-cleaning-2026-06-16.md:108-170`). 1-2 day migration. Saves 60-90% storage cost at >6 months of data.
2. **Add automated cleanup jobs** (`app/server/src/jobs/usage-records-cleanup.ts` + `audit-logs-cleanup.ts` + `branch-archival-monitor.ts`). 4-6 hours. Prevents storage bloat.
3. **Move Next.js frontend from Render free to Vercel Hobby (or Pro)**. Render free's 15-min idle + cold start is bad UX; Vercel's edge network and ISR are better. Free on Hobby if you stay under 100 GB/mo. **At growth tier, Pro $20/mo.**
4. **Configure provider weight routing** (`PROVIDER_WEIGHTS` in `.env`). Default to Venice 0%, AntSeed 70%, Together 30% for the budget tier. Free to change, can save 30-50% on the model costs you route the most. Per `server/src/.env.example:319-323`.
5. **Add 3 failover RPCs** for Base and Solana (free tier services) to avoid single point of failure. Per `server/src/.env.example:135-150`.
6. **Move from `OPENROUTER_ALLOW_FALLBACKS=true` to explicit model pinning** for the 5 most-used models. Per `openrouter.ai/pricing`: "BYOK" gives you 1M free req/mo — at the right volume, this is real money.

### D.3 Long-term (next quarter)

1. **Build a provider cost dashboard** (admin/analytics route). Show per-model margin, which users are unprofitable, which providers failed in the last 24h. Without visibility, you can't make cost decisions.
2. **Implement model-tiered UI defaults** — show users the cheap models first, de-emphasize Opus/Opus-tier unless they explicitly opt in. The current README lists Opus 4.7 and GPT-5.5 prominently in the catalog. Most users don't need them.
3. **Evaluate self-hosted vLLM** once inference COGS exceed $10K/mo. Realistic timeline: when MRR > $30K/mo. Per `models.ts:223-290`, Claude and GPT are the dominant COGS.
4. **Move from Coolify to managed hosting** if/when the team grows past 3 engineers. Self-hosting costs you 5-10 hours/month of Linux sysadmin time, which is $500-2,000 in opportunity cost.
5. **Get SOC 2 Type 2 in motion** at $5K+/mo MRR. Requires Neon Scale (IP allow + PITR) + Uptime SLA + monitoring retention. Per `neon-research-2026-06-16.md:100-102`.
6. **Negotiate Venice + OpenRouter enterprise contracts** at $10K+/mo inference spend. Both have volume commitments per their pricing pages. OpenRouter offers "discounted OpenRouter fees in enterprise plan" — that's the 5.5% platform fee getting reduced.

---

## Section E — Open Questions

I cannot finalize some recommendations without more information:

1. **What is the current actual monthly spend?** Run `bash scripts/neon-cost-check.sh` and report the output. The cost projections in this report assume MVP traffic; if you're already at 1K MAU, the numbers shift by 10x.
2. **What % of inference traffic goes through each provider?** (Venice vs. AntSeed vs. OpenRouter vs. Surplus vs. Anthropic-direct vs. Gemini-direct). The router logs this. Without it, the "savings from rebalancing" recommendations are theoretical.
3. **Is the project using the `CONNECTION_POOL_SIZE` env var anywhere** other than the dead code in `client.ts:31`? If so, what value? The "stay on `neon-http`" recommendation depends on it.
4. **Are cron jobs in `app/server/src/jobs/` running 24/7 as long-lived processes, or as scheduled one-shots?** Per `neon-research-2026-06-16.md:170-177`, long-lived cron jobs prevent scale-to-zero. If they're long-lived, the auto-suspend fix in D.1 will not work.
5. **Does the team have a Linux sysadmin?** This decides Coolify/Hetzner self-host vs. managed Render/Railway.
6. **What's the breakdown of payment-facilitator costs?** Specifically, the `FACILITATOR_PRIVATE_KEY` hot wallet holds USDC; what's the current balance, and how often does `AUTO_RELOAD_AMOUNT` (default 1 USDC) trigger?
7. **Is there an active user count we can use to estimate the `usage_records` table growth rate?** At 100 active users doing 50 inferences/day, you write 5,000 rows/day = 1.8M/year. At 1,000 users, 18M/year. This determines whether partitioning is worth the migration effort now or in 6 months.
8. **What is the geo distribution of users?** If 80% are EU, the Hetzner + Cloudflare EU edge config beats Hetzner US-only. If 100% US, Render US-East is fine.
9. **Are there any compliance requirements** (SOC 2 in progress, HIPAA, PCI for stored card data)? This determines whether you need Neon Scale (IP allow) or can stay on Launch.
10. **What is the current Render or hosting bill?** If it's $0 (Option A both-free), the savings from switching are small. If it's $7-14/mo, the move to Vercel + Render or Hetzner + Coolify is more attractive.

---

## Appendix A — Quick reference: providers OMA-AI uses (verified 2026-06-16)

| Provider | Pricing page | Per 1M token | Free tier | Markup |
|---|---|---|---|---|
| Venice (text) | `docs.venice.ai/welcome/pricing` | $0.05-37.50 in / $0.13-225 out | n/a (Pro $18/mo with 100 credits = $1) | OMA adds 10% |
| OpenRouter | `openrouter.ai/pricing` | Passthrough + **5.5% platform fee** | 50 req/day, 25+ free models | None on token |
| AntSeed | `antseed.com` (P2P, USDC) | $0.05-1.73 in / $0.13-3.80 out | n/a | **0% platform markup** |
| Together AI | `together.ai/pricing` | $0.18-3+ per 1M | $5 free credit on signup | None |
| DeepInfra | `deepinfra.com/pricing` | $0.05-3+ per 1M | $5 free credit on signup | None |
| Anthropic | `anthropic.com/pricing` | $0.80-15 in / $4-75 out | n/a (pay-as-you-go) | None |
| Gemini | `ai.google.dev/pricing` | $0.075-1.25 in / $0.30-10 out | Free tier with rate limits | None |
| Surplus | `surplus.market` (live, see OMA x402 docs) | Market-discounted, USDC on Base | n/a | Discount-percent passed in |

## Appendix B — Hidden gotchas

1. **Vercel Functions Active CPU** is the 4-hour free cap on Hobby, billed at $0.128/GHz-hr after. If you have cron jobs in Vercel functions, check the function dashboard.
2. **Upstash region add-ons** — Fixed 250MB at $10/mo is per single region; multi-region is +$5/region. Don't enable multi-region unless you have global users.
3. **Neon storage** is averaged daily (GB-month) so spiky workloads don't cost extra, but consistent 5 GB = ~$1.75/mo always.
4. **Coolify self-hosted** is free (open source), but the VPS you run it on isn't. CX22 at €3.79/mo + 1 TB egress (free) = ~$4/mo total. CAX11 (ARM, 2 vCPU, 4 GB) at €3.29/mo even cheaper.
5. **Venice privacy mode** (`venice_parameters.private=true` per `.env.example:69-73`) costs more in some cases — Private models are sometimes higher latency. If a user opts out via `OMMA_ALLOW_NON_PRIVATE_VENICE=true`, no extra cost.
6. **Surplus hot-wallet auto-reload** ($0.05 threshold, $1.00 refill, $1.00 daily cap) is intentionally small. At >100 settlements/day, this throttles. Per `.env.example:276-281`.

---

*Compiled 2026-06-16 from official pricing pages, web search, and OMA-AI codebase audit. Prices in USD. Numbers verified against live pages; recommend re-verifying before any major spend commitment.*
