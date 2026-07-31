# STALE — Archive Only

---

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

[...rest unchanged...]
