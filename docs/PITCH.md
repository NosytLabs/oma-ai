# OMA-AI — One-page pitch

**OMA-AI: the crypto-native, privacy-first AI gateway.**

> *"One gateway. Every model. No lock-in. Pay with USDC."*

---

## The problem

Every serious AI builder hits the same three walls:

1. **Privacy.** OpenRouter, Together, and Replicate log your prompts by default. Sending customer data through them is a compliance problem waiting to happen.
2. **Payment friction.** To use any major API you need a credit card, an account, an API key, and a pre-funded balance. AI agents can't do any of that.
3. **Vendor lock-in.** Each provider has its own SDK, its own tool format, its own rate limits. Migrating costs weeks.

## What OMA-AI is

A single OpenAI-compatible API that routes every call through **private inference providers** — primarily Venice AI, with Surplus as a backup — so your prompts are never logged. You pay with USDC on Base, SOL on Solana, or any token via HoudiniSwap (100+ chains). And your AI agent can pay-per-call with x402 — no account, no API key exchange, no pre-funded balance.

The codebase is already shipping: 88 models, 25+ route modules, 82 passing tests, deployed on Render at $7/mo. We're not building a product; we're growing one.

## Why now

Three forces converged in 2026:

- **Venice AI's VVV token** lets us stake → mint DIEM ($1/day of inference per 1% stake share) and subsidize a real free tier with no balance-sheet cost.
- **x402 (Coinbase CDP)** is becoming the standard for AI-agent-native payments. We already speak it.
- **Privacy is the wedge.** OpenRouter charges 5.5% but logs everything. We're 25% over cost but don't. The buyers who care about this — healthtech, fintech, legaltech, defense — already pay 5–10× more for HIPAA/GDPR-aligned infrastructure.

## Numbers

| | Today | Phase 1 (1 wk) | Phase 2 (1 mo) | Phase 3 (1 qtr) |
|---|---|---|---|---|
| Models | 88 | 90 | 92 + cache | 100+ multi-provider |
| Markup | 25% uniform | 25% uniform | 20–50% tiered | 15–50% + Ent |
| Free tier | ❌ | $0.05 faucet | + VVV subsidy | + VVV pool |
| SDKs | 0 | 2 | 3 | 6 |
| MRR target | $0 | $1k | $15k | $50k+ |
| Infra cost | $7/mo | $7/mo | $25/mo | $100/mo |

Break-even on infra at **$2.5k MRR**. Every dollar above that is gross profit at >70% margin.

## Why us

1. **The product is built.** All primitives are wired: 25+ routes, x402 facilitator, USDC deposits, HoudiniSwap bridge, Jupiter swap, wallet auth, credit accounting, OpenAPI spec, admin dashboard. 82 tests green. Two-week shipping speed.
2. **The moat is real.** Wallet-only auth + private-routing + crypto-native + x402 = no competitor has all four. OpenRouter has 1 (crypto). Portkey has 0.
3. **The cost structure is insane.** Render $7/mo server + $25/mo DB + free app = $40/mo all-in. We can run at $0 MRR for 7 months on the existing $50 Render credit, then break-even at <$2.5k MRR.
4. **The token flywheel.** VVV staking turns the free tier from a cost center into an arbitrage opportunity.

## The ask

We're not raising right now. We're shipping Phase 1 this week and aiming for $15k MRR by month-end. If you want early access, want to integrate, or want to stake VVV with us — reach out.

**Live now:** https://oma-ai.com
**Docs:** https://oma-ai.com/docs
**Models:** https://oma-ai.com/models
**Pricing:** https://oma-ai.com/pricing

---

*OMA-AI = Open Model Access. Built for builders who value privacy, control, and crypto-native payments. Position as "low-friction signup", not "no KYC"; "private inference", not "anonymous"; "privacy-focused", not "untraceable".*