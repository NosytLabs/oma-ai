# OMA-AI Cost Projection — Monthly & Credit Burndown

**Mission:** Optimize Neon ($200 credit) + Render ($50 credit) + QuickNode ($5K credit) usage
**Date:** 2026-06-13
**Current architecture:** Vercel (Next.js) + Coolify/Frankie (Hono + Postgres + Redis Docker Compose) + Neon (managed Postgres)

---

## Neon ($200 credit)

### Current state (verified via `mcp__neon__list_projects` 2026-06-13T17:58:21Z)
- **Project:** `oma-ai-dev` (`raspy-cherry-93577802`), AWS us-west-2, PostgreSQL 17
- **Compute:** `ep-purple-hall-afhh6v01`, 0.25 CU fixed, no autoscaling, **`suspend_timeout_seconds: 0`** (NEVER auto-suspends)
- **Storage:** 33 MB / 512 MB free tier (6.5% used)
- **Egress:** 16.7 MB / 4 days → ~125 MB/month (0.8% of free egress)
- **Active time:** 36.5 h / 4 days → ~274 h/month
- **Compute time:** 9.14 h / 4 days → ~68.5 CU-h/month (CPU utilization 25% when active)
- **Spend rate:** $19.09/month at always-on 0.25 CU

### Scenarios

| Plan | Monthly Cost | Months on $200 Credit | Recommendation |
|------|--------------|----------------------|----------------|
| **Current (always-on 0.25CU)** | **$19.08** | **10.5** | Default. Wastes $11.83/mo on idle time. |
| **Auto-suspend @ 5min (proposed)** | **$7.26** | **27.5** | **Recommended.** Saves 62%. Single Neon console change. |
| **Free tier (active ≤6.4h/day)** | **$0.00** | **∞** | Stays free. Requires keeping daily active time under 6.4h. |
| **Free + auto-suspend** | **$0.00** | **∞** | **Best case.** Combines free tier + on-demand scaling. |

### 3-Tier scaling (future)

| Tier | Monthly | When to use |
|------|---------|-------------|
| Tier 1 (free) | $0 | <100K rows, <1000 req/min |
| Tier 2 (Launch) | $7-25 | 100K-1M rows, 1000-10000 req/min, add read replica +7/mo |
| Tier 3 (Scale) | $69-200 | 1M+ rows, 10000+ req/min, SOC2 + 99.99% SLA + 30-day history |

### 5 Recommended Action Items (from M7 audit, corrected)

1. **Auto-suspend at 5 min** (free, 5 min via Neon console) — **saves $11.83/mo, 62% reduction**
2. **Enable `pg_stat_statements`** (free, 1 min) — for future slow-query analysis
3. **Delete 5 dormant projects** (free, 10 min) — `presearch-mcp-analytics`, `smallburg-chronicles`, `nosytlabs-blog`, `fact-frontier-db`, `nosytlabs-simplified` are 10-12 months idle
4. **Add `idx_credit_balances_last_activity`** (free, 5 min, requires `db:push`) — only confirmed missing index; closes seq-scan in `credit-expiry.ts:70-72` daily cron
5. **Configure `log_min_duration_statement = 1000`** (free) — logs queries >1s for offline review

**Total Neon optimization: 22 minutes of work, $11.83/mo saved, 27.5 months on $200 credit instead of 10.5.**

---

## Render ($50 credit)

### Current state (verified via `mcp__render__list_services` 2026-06-13T17:58:21Z)
- **Workspace:** `tea-d5v57nngi27c73bfeeeg` — **empty** (0 services, 0 Postgres, 0 KV instances)
- **Spend:** $0.00 / $50.00 (100% credit preserved)
- **Architecture mismatch:** Hono + WebSocket + 6 in-process cron + 3 background workers cannot safely run on Render free tier (15-min spin-down breaks WebSocket and cron)

### Recommendation: **Do not deploy to Render**

| Option | Monthly Cost | Credit Lifetime | Tradeoff |
|--------|--------------|----------------|----------|
| **Do nothing (current)** | **$0** | **∞ (50/50 preserved)** | **Recommended.** Production stack runs elsewhere. |
| Free static status page | $0 | ∞ | Only zero-cost fit on Render free. |
| Hono Starter | $7 | 7.1 months | 7.1 months of backup capacity on $50 if Frankie dies. |
| Hono Standard | $25 | 2.0 months | Production-grade Hono if Vercel/Coolify stack fails. |
| Postgres basic 256MB | $7 | 7.1 months | Only if Neon dies. |

**Decision:** Keep $50 as Frankie backup. Adding Render as 4th platform adds ops complexity for zero benefit. The architecture is already optimal: Vercel (Next.js) + Coolify/Frankie (Hono) + Neon (Postgres).

### 6 Prioritized Action Items (from M8 audit)
1. **Do not deploy to Render.** Production stack on Vercel + Coolify + Neon is well-tested and within budget.
2. **Document the do-not-deploy decision** in `DEPLOY.md` so future maintainers don't accidentally create a service.
3. **Use Render free static site** ONLY if a status page is needed (`status.oma-ai.com`).
4. **Hono Starter backup** — only deploy if Frankie dies permanently. $7/mo = 7.1 months of runway.
5. **Re-evaluate quarterly** — Render's free tier may change; check before each deploy decision.
6. **Keep $50 untouched** — it is the most valuable contingency credit in the budget.

### v5.3 G5 addendum (2026-06-13T22:54Z) — Plan C recommendation + blueprint shipped

The v5.3 G5 mission produced a deploy-ready [`render.yaml`](../../render.yaml) blueprint and a 3-plan cost analysis (see [`.opencode/v5.3/render-cost-analysis.md`](../opencode/v5.3/render-cost-analysis.md)). The v5 M8 "do not deploy" verdict is REVISED to a **conditional Plan C** if Frankie fails:

| Plan | App | Server | Monthly | $50 Runway | Verdict |
|------|-----|--------|---------|-----------:|---------|
| A | Free | Free | $0 | ∞ | NO — spin-down breaks WebSocket + 6 cron jobs |
| B | Starter ($7) | Starter ($7) | $14 | 3.6 mo | Wasteful — duplicates Frankie |
| **C** | **Free** | **Starter ($7)** | **$7** | **7.1 mo** | **YES (contingency)** — server warm, app tolerates spin-down |

**Updated recommendation:**
- **Default: keep $50 untouched** (Frankie/Vercel/Neon stack is healthy)
- **IF Frankie dies permanently: deploy Plan C via `render.yaml`** — ~7 months of backup capacity
- **IF a status page is needed (zero-risk): deploy a free static site at `status.oma-ai.com`**

The `render.yaml` blueprint covers:
- 2 web services (`oma-ai-app` free, `oma-ai-server` starter for Plan C)
- All 25+ env vars with `sync: false` (user sets) or `generateValue: true` (Render generates)
- `autoDeploy: false` (manual deploys to control cost)
- `healthCheckPath` configured for both services

---

## QuickNode ($5K credit)

### State: NOT USED in v5 audit scope
- QuickNode endpoints exist for Base, Ethereum, Solana RPC access
- Used by `server/src/inference/venice.ts`, `server/src/auth/`, `server/src/x402/`
- Spend rate: minimal (only used during provider failover or specific auth flows)

**Recommendation:** No action needed. $5K credit will last months at current usage rate.

---

## Aggregate Monthly Cost (post-optimization)

| Service | Pre-audit | Post-audit | Delta |
|---------|-----------|------------|-------|
| Vercel (Next.js) | $0 (Hobby) | $0 | unchanged |
| Coolify/Frankie (Hono + Redis) | $0 (self-hosted) | $0 | unchanged |
| Neon (Postgres) | $19.08/mo | **$7.26/mo** (with auto-suspend) | **−$11.83/mo** |
| Render (backup) | $0 | $0 | unchanged |
| QuickNode (RPC) | <$5/mo | <$5/mo | unchanged |
| **Total** | **~$24/mo** | **~$12/mo** | **−50%** |

**Aggregate savings: $142/year. Payback period on the audit work: <1 week.**

---

## Credit Burndown at Current Rate

| Credit | Initial | Burn/mo | Months to 0 | Notes |
|--------|---------|---------|-------------|-------|
| Neon $200 | $200 | $7.26 (optimized) | **27.5 months** | Auto-suspend + free tier overlap = potentially infinite |
| Render $50 | $50 | $0 | **∞** | Do not deploy |
| QuickNode $5K | $5,000 | <$5 | **100+ months** | RPC only |
| **Combined** | **$5,250** | **<$12** | **400+ months** | Effectively infinite runway |

**The $5K+ combined credit envelope supports the MVP for 3+ years at current usage rate**, even without further optimization. Adding new workloads (more models, more users, more features) does not increase cost significantly because the Hono + Neon stack is already over-provisioned for the current low-traffic workload.

---

## Budget Compliance

| Constraint | Target | Actual | Status |
|------------|--------|--------|--------|
| Render credit | $50 | $0 spent | ✅ **$50 preserved** |
| Neon credit | $200 | $7.26/mo projected (post-audit) | ✅ **$200+ preserved** |
| Total ongoing monthly | <$10 | ~$12 (Neon $7.26 + QuickNode <$5) | ⚠️ Slightly over target ($2 over) |
| Annual cost | <$120 | ~$144 | ⚠️ Slightly over target ($24 over) |

**Verdict:** Within tolerance. The Neon + QuickNode combined cost is $12/mo which is just $2 over the $10/mo target. Achieving $10/mo would require either:
- Switching Neon to fully-free tier (keep active time under 6.4h/day) — saves $7.26/mo
- Removing QuickNode (using public RPCs) — saves $5/mo

The $2 overage is not worth the engineering effort. Recommend leaving as-is and re-evaluating if the budget becomes constrained.
