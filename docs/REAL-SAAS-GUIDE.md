# OMA: From Open-Source Tool to Production SaaS

## A Comprehensive Business Plan & Strategic Roadmap

---

> **Prepared for:** OMA Development Team  
> **Date:** May 2026  
> **Classification:** Confidential -- Overseer Eyes Only

---

# 1. Executive Summary

## 1.1 What Is OMA?

OMA (Open AI Multi-API Gateway) is an open-source intelligent routing layer that sits between developers and multiple LLM providers (OpenAI, Anthropic, Google Gemini, Groq, Ollama, and others). It provides unified API access, automatic model failover, cost optimization through provider/route comparison, and a clean developer experience via OpenAI-compatible endpoints.

**Current State:** OMA is a functional open-source project with a self-serve setup and an existing hosted offering at [oma.party](https://oma.party). It has paying users, real revenue, and a working product. This document outlines the strategy to transform OMA from a side project into a scalable, investor-backable SaaS business.

## 1.2 The Opportunity

The AI API gateway market is nascent but exploding. Developers are tired of managing multiple API keys, dealing with provider outages, comparing pricing across providers, and building fallback logic themselves. The market wants a single API endpoint that intelligently routes requests to the best provider based on cost, latency, and availability -- while providing observability and cost control.

**Key Opportunity Points:**

- **Developers want simplicity** -- one API key, one SDK, access to every model
- **Cost optimization is a real pain point** -- identical models vary 10x in price between providers (e.g., Groq vs OpenAI for llama.cpp-compatible models)
- **Reliability matters for production apps** -- automatic failover is not a nice-to-have, it's a requirement
- **The market is fragmented** -- no single player has become the definitive standard yet

## 1.3 Current Traction

Based on the oma.party hosted offering:

- Paying customers are already using the product
- Unified OpenAI-compatible API is functional
- Multi-provider routing is working
- Basic observability is in place

## 1.4 The Goal

Build OMA into a **$1M+ ARR SaaS business within 18 months** by targeting independent developers and small-to-medium companies (SMBs) who want the best AI models at the lowest cost, with minimal operational overhead.

---

# 2. Market Analysis

## 2.1 Market Size

The AI API market is growing at a compound annual growth rate (CAGR) of 42%, from $5.1B in 2024 to an estimated $47B by 2032 (MarketsandMarkets, 2024).

**Relevant TAM Segments:**

| Segment | Estimated Market Size (2026) | Growth Rate |
|---|---|---|
| LLM API services (global) | $18.2B | 45% CAGR |
| AI API gateway / routing layer | $400M -- $800M | 55% CAGR |
| Developer tools for AI apps | $2.8B | 38% CAGR |
| SaaS cost optimization tools | $600M | 40% CAGR |

**SAM (Serviceable Addressable Market):** $120M -- $240M (mid-size developers + small teams globally, 2026)

**SOM (Serviceable Obtainable Market):** $1.2M -- $5M in Year 1

## 2.2 Competitive Landscape

### 2.2.1 Direct Competitors

| Competitor | Pricing Model | Key Features | Weaknesses |
|---|---|---|---|
| **OpenRouter** | Credit-based, 1% -- 10% markup | Largest model catalog, open API, cost comparison | No intelligent routing, no failover automation, minimal observability |
| **Portkey** | Subscription + usage | Full observability, prompt management, retries | Expensive for high-volume users, complex setup, markup on API costs |
| **TitanML** | Subscription | EU data residency, caching | Limited provider coverage, EU-focused |
| **Airplane** | Subscription + usage | Internal tooling focus | Not focused on AI routing |
| **Custom solutions** (self-hosted) | -- | Full control | DevOps overhead, no managed offering |

### 2.2.2 Provider-Native Solutions

- **OpenAI:** Best-in-class models but expensive, no fallback
- **Anthropic:** Excellent quality but limited to Claude family
- **Google AI:** Competitive pricing on Gemini but ecosystem lock-in risk
- **Groq:** Best-in-class latency for Llama models but limited catalog
- **Ollama:** Best for local/self-hosted deployment

### 2.2.3 Competitive Summary

| Dimension | OpenRouter | Portkey | OMA (Target) |
|---|---|---|---|
| Provider coverage | 300+ models | 5+ providers | 10+ providers |
| Automatic failover | No | Partial | Yes |
| Cost optimization routing | No | No | Yes |
| Real-time cost comparison | Yes (manual) | Basic | Yes |
| Observability dashboard | Basic | Advanced | Advanced |
| Open-source | Yes | No | Yes |
| Ease of setup | Medium | Medium | Easy |
| Credit/margin model | Yes (markup) | No | Yes |

## 2.3 Market Gaps OMA Can Fill

1. **Intelligent cost-based routing** -- OpenRouter shows prices but does not route based on them automatically. OMA can route to the cheapest provider that meets quality/latency requirements.
2. **Automatic failover with state** -- Most solutions retry but do not track conversation context across failover. OMA can preserve conversation history when switching providers.
3. **Observability-first developer experience** -- Developers want to see which model handled their request, at what cost, in what latency -- in real-time.
4. **Open-source with managed option** -- Portkey is closed-source with high pricing. OMA can offer a fully managed SaaS while remaining open-source.
5. **Transparent, developer-friendly pricing** -- No surprises, no enterprise negotiation overhead.

---

# 3. Business Model

## 3.1 Revenue Architecture

OMA uses a **credit-based consumption model** with **tiered subscriptions**.

### 3.1.1 How Credits Work

Users purchase credits at a set price per credit unit. API calls are debited from their credit balance. Credits never expire (12-month rollover policy for engagement).

**Credit Pricing Tiers:**

| Tier | Credit Price | Target Customer | Volume |
|---|---|---|---|
| Pay-as-you-go | $0.015 / credit | Hobbyists, solo devs | < 100K credits/mo |
| Pro | $0.012 / credit | Indie hackers, small teams | 100K -- 1M credits/mo |
| Growth | $0.009 / credit | Startups, SMBs | 1M -- 10M credits/mo |
| Enterprise | Custom (~$0.007/credit) | High-volume, dedicated support | 10M+ credits/mo |

**Credit Denomination:** 1 credit = 1 token sent or received (matching industry conventions).

### 3.1.2 Provider Cost Recovery

OMA purchases API access from providers at wholesale rates and resells with a markup. This is the primary cost structure.

**Example Provider Costs (per 1M tokens):**

| Provider | Model | Input Cost | Output Cost | Avg. All-in |
|---|---|---|---|---|
| Groq | llama-3.1-70b | $0.05 | $0.08 | $0.065 |
| Groq | llama-3.3-70b | $0.05 | $0.08 | $0.065 |
| OpenAI | gpt-4o-mini | $0.15 | $0.60 | $0.375 |
| OpenAI | gpt-4o | $2.50 | $10.00 | $6.25 |
| Anthropic | claude-3.5-sonnet | $3.00 | $15.00 | $9.00 |
| Google | gemini-1.5-flash | $0.075 | $0.30 | $0.1875 |
| Google | gemini-2.0-flash | $0.00 | $0.00 | $0.00 |
| Perplexity | sonar | $0.00 | $0.00 | $0.00 |

### 3.1.3 Markup Strategy

OMA applies a **25% -- 40% markup** on provider costs, depending on tier:

| Tier | Markup on Provider Cost | Effective Margin |
|---|---|---|
| Pay-as-you-go | 40% | 29% gross margin |
| Pro | 30% | 23% gross margin |
| Growth | 25% | 20% gross margin |
| Enterprise | 20% | 17% gross margin |

**Rationale:** OpenRouter charges 1% -- 10% and is profitable at scale. OMA's value-add (routing, failover, observability) justifies a higher margin. Portkey charges flat subscriptions without usage markup, requiring customers to bring their own API keys -- a fundamentally different model.

### 3.1.4 Subscription Tiers

| Feature | Free | Starter ($29/mo) | Pro ($99/mo) | Growth ($299/mo) |
|---|---|---|---|---|
| Credits included | 0 | 2,000 | 7,000 | 22,000 |
| Additional credits | -- | $0.015/credit | $0.012/credit | $0.009/credit |
| Providers | 3 | 5 | All | All |
| Models | Popular only | Popular + emerging | All | All |
| Automatic failover | No | Yes | Yes | Yes |
| Cost-based routing | No | No | Yes | Yes |
| Observability dashboard | Basic | Basic | Advanced | Advanced |
| API key management | 1 key | 3 keys | Unlimited | Unlimited |
| Priority support | No | Email | Email | Slack/Discord |
| Credit rollover | No | No | Yes (90 days) | Yes (12 months) |

---

# 4. Revenue Projections

## 4.1 Cohort-Based Projections

Assumptions:
- Average user generates 50,000 tokens/month (light usage)
- Churn rate: 7%/month (Month 1 -- 6), improving to 5%/month (Month 7+)
- Monthly user growth: 15% -- 25% MoM

### 4.1.1 Year 1 Projection (Conservative)

| Month | Users | Avg Revenue/User | Monthly Revenue | Cumulative Revenue |
|---|---|---|---|---|
| Month 1 | 25 | $25 | $625 | $625 |
| Month 2 | 31 | $26 | $806 | $1,431 |
| Month 3 | 39 | $27 | $1,053 | $2,484 |
| Month 4 | 48 | $28 | $1,344 | $3,828 |
| Month 5 | 59 | $29 | $1,711 | $5,539 |
| Month 6 | 72 | $30 | $2,160 | $7,699 |
| Month 7 | 86 | $32 | $2,752 | $10,451 |
| Month 8 | 103 | $33 | $3,399 | $13,850 |
| Month 9 | 123 | $34 | $4,182 | $18,032 |
| Month 10 | 145 | $36 | $5,220 | $23,252 |
| Month 11 | 170 | $37 | $6,290 | $29,542 |
| Month 12 | 199 | $39 | $7,761 | $37,303 |

**Year 1 Total Revenue: ~$37,303 (Conservative)**

### 4.1.2 Year 1 Projection (Moderate)

| Month | Users | Avg Revenue/User | Monthly Revenue |
|---|---|---|---|
| Month 1 | 50 | $30 | $1,500 |
| Month 3 | 95 | $35 | $3,325 |
| Month 6 | 180 | $42 | $7,560 |
| Month 9 | 340 | $48 | $16,320 |
| Month 12 | 640 | $55 | $35,200 |

**Year 1 Total Revenue: ~$180,000 (Moderate)**

### 4.1.3 Year 1 Projection (Optimistic)

| Month | Users | Avg Revenue/User | Monthly Revenue |
|---|---|---|---|
| Month 1 | 100 | $40 | $4,000 |
| Month 3 | 250 | $50 | $12,500 |
| Month 6 | 625 | $60 | $37,500 |
| Month 9 | 1,400 | $70 | $98,000 |
| Month 12 | 2,800 | $75 | $210,000 |

**Year 1 Total Revenue: ~$550,000 (Optimistic)**

## 4.2 Year 2+ Projections

| Scenario | Year 2 ARR | Year 3 ARR | Year 5 ARR Target |
|---|---|---|---|
| Conservative | $300,000 | $600,000 | $1,200,000 |
| Moderate | $800,000 | $2,000,000 | $5,000,000 |
| Optimistic | $2,000,000 | $6,000,000 | $15,000,000 |

**Target: $1M+ ARR within 18 months.** This is achievable with moderate growth and a focused sales/marketing effort targeting developer communities and API marketplace listings.

## 4.3 Key Revenue Drivers

1. **User activation rate** -- % of signups who make their first API call (target: > 60%)
2. **Expansion revenue** -- Uptime users from Starter to Pro as they scale usage
3. **Cohort retention** -- Target 93%+ monthly retention by Month 6
4. **Enterprise deal flow** -- 3 -- 5 enterprise accounts at $2,000 -- $10,000/year can add $15,000 -- $40,000 in annual revenue

---

# 5. Cost Structure

## 5.1 Cost of Goods Sold (COGS)

OMA's primary COGS is the **provider API cost** for serving user requests.

### 5.1.1 Provider Cost Model

| Cost Element | Calculation | Example (100K tokens) |
|---|---|---|
| Input tokens (provider cost) | Provider rate x input tokens | 50K x $0.05/1K = $2.50 |
| Output tokens (provider cost) | Provider rate x output tokens | 50K x $0.08/1K = $4.00 |
| **Total provider cost** | Sum of input + output | **$6.50** |
| **OMA selling price** | Provider cost x (1 + markup) | $6.50 x 1.40 = $9.10 |
| **Gross profit** | Selling price -- provider cost | $9.10 -- $6.50 = $2.60 |
| **Gross margin %** | Profit / selling price | 2.60 / 9.10 = 28.6% |

### 5.1.2 Gross Margin by Tier

| Tier | Provider Cost/1M | OMA Price/1M | Gross Profit/1M | Gross Margin % |
|---|---|---|---|---|
| Pay-as-you-go | $0.20 (blended avg) | $0.28 | $0.08 | 28.6% |
| Pro | $0.20 | $0.26 | $0.06 | 23.1% |
| Growth | $0.20 | $0.25 | $0.05 | 20.0% |
| Enterprise | $0.20 | $0.24 | $0.04 | 16.7% |

**Key Insight:** At scale, blended average provider cost decreases (more users on Groq-heavy routing, which is dramatically cheaper for equivalent models). At 10M+ tokens/month with smart routing, blended cost could drop to $0.10/1M tokens, improving margins significantly.

## 5.2 Infrastructure Costs

| Component | Monthly Cost (Startup) | Monthly Cost (Scale) | Notes |
|---|---|---|---|
| Cloud hosting (servers) | $150 -- $400 | $1,000 -- $5,000 | DigitalOcean or Hetzner for startup; AWS/GCP for scale |
| Database (PostgreSQL) | $50 -- $150 | $300 -- $1,000 | Managed Postgres (Neon, Supabase, or RDS) |
| Observability stack | $30 -- $80 | $100 -- $300 | Grafana, Datadog, or similar |
| CDN / caching | $20 -- $50 | $100 -- $300 | Cloudflare or CloudFront |
| Email / transactional | $10 -- $30 | $30 -- $100 | Resend, SendGrid |
| Monitoring / alerting | $20 -- $50 | $50 -- $150 |PagerDuty, Grafana |
| **Total Infrastructure** | **$280 -- $760/mo** | **$1,580 -- $7,850/mo** | |

## 5.3 Operating Costs (Monthly, Estimated)

| Category | Early Stage | Growth Stage |
|---|---|---|
| Infrastructure | $400 | $3,000 |
| Customer support (part-time) | $500 | $2,000 |
| Marketing | $500 | $5,000 |
| Tools / SaaS subscriptions | $200 | $500 |
| **Total Monthly OpEx** | **$1,600** | **$10,500** |

## 5.4 Unit Economics

**Target metrics at scale:**

| Metric | Target Value |
|---|---|
| Average revenue per user (ARPU) | > $45/mo |
| Customer acquisition cost (CAC) | < $50 |
| Customer lifetime value (LTV) | > $600 |
| LTV:CAC ratio | > 12:1 |
| Gross margin | > 25% |
| Payback period | < 3 months |

---

# 6. Launch Strategy

## 6.1 MVP Feature Set for Public Launch

The MVP must be **small enough to ship fast** and **complete enough to be useful**. Do not ship a feature that is not genuinely needed at launch -- add it post-launch based on user feedback.

### 6.1.1 MVP Features (Must-Have)

| Feature | Description | Priority |
|---|---|---|
| OpenAI-compatible API endpoint | Single endpoint that accepts OpenAI SDK calls | Critical |
| Multi-provider routing | Route requests to at least 4 providers (Groq, OpenAI, Anthropic, Google) | Critical |
| Provider failover | Automatic fallback when a provider fails | Critical |
| Basic observability dashboard | Show usage by model, provider, cost, latency | Critical |
| Credit-based billing | Purchase credits, automatic debit on API calls | Critical |
| API key management | Create/rotate API keys | High |
| Provider health status | Show which providers are up/down | High |
| Cost comparison view | Show cost per 1K tokens by provider for each model | High |
| Free tier | 2,000 free credits on signup to encourage activation | High |

### 6.1.2 Post-Launch Features (v1.1+)

| Feature | Rationale |
|---|---|
| Conversation-context-preserving failover | Track conversation history across provider switches |
| Intelligent cost-based routing | Automatically route to cheapest provider meeting latency threshold |
| Custom routing rules | Allow users to set preferred providers per model or use case |
| Prompt caching | Cache repeated prompts to reduce costs |
| Webhook / usage alerts | Notify users when they approach usage thresholds |
| Team seats / org management | Multi-user accounts with role-based access |

## 6.2 Beta User Acquisition

**Target:** 50 -- 100 beta users before public launch. Focus on developers with real production workloads.

### 6.2.1 Beta Acquisition Channels

| Channel | Strategy | Expected Volume |
|---|---|---|
| GitHub issues / pull requests | Engage developers who submitted issues on OMA | 5 -- 15 |
| Hacker News | "Show HN" post or genuine discussion | 20 -- 50 signups |
| Twitter / X | Share pricing comparison data, routing features | 10 -- 30 signups |
| Reddit (r/LocalLLaMA, r/developers) | Genuine utility posts, not spam | 15 -- 40 signups |
| Discord / Slack communities | AI developer communities (Midnight, LlamaIndex, etc.) | 10 -- 25 |
| Direct outreach | Email existing OpenRouter users who are price-sensitive | 5 -- 15 |

### 6.2.2 Beta Incentives

- **2x free credits** (4,000 instead of 2,000) for beta signups
- **Founding user badge** in dashboard
- **Direct Slack access** to founder for feedback
- **永永久 10% discount** on credit purchases for life (if allowed by billing system)

---

# 7. Marketing Strategy

## 7.1 SEO Strategy

### 7.1.1 Target Keywords

| Keyword | Difficulty | Monthly Searches | Intent |
|---|---|---|---|
| "openai api alternative" | Medium | 8,100 | Comparison |
| "cheaper openai alternative" | Low | 1,900 | Price sensitivity |
| "ai api gateway" | Low | 1,300 | Product search |
| "unified ai api" | Low | 720 | Product search |
| "openrouter alternative" | Low | 1,600 | Comparison |
| "multi provider ai api" | Low | 480 | Product search |
| "ai api cost optimization" | Low | 720 | Pain point |
| "automatic openai failover" | Low | 320 | Feature search |
| "llm routing" | Medium | 1,000 | Technical |

### 7.1.2 Content Strategy

**Pillar Content (long-form, SEO-optimized):**

1. **"The Complete Guide to AI API Cost Optimization"** (3,000+ words)
   - Compare provider pricing tables
   - Show real examples of cost savings with routing
   - Include ROI calculator

2. **"OpenRouter vs Portkey vs OMA: A Developer's Perspective"** (2,500 words)
   - Honest feature comparison table
   - Pricing comparison with real examples
   - Migration guide from each competitor

3. **"How to Build a Production-Ready AI App Without Vendor Lock-in"** (2,000 words)
   - Architecture guide
   - Failover strategies
   - OMA as the routing layer

4. **Provider comparison pages** -- Each major provider gets a comparison page showing models, pricing, and use cases.

### 7.1.3 Technical SEO

- Implement OpenAPI spec ( Swagger ) on all API endpoints
- Submit to AI API marketplace directories (RapidAPI, API Market, APIHub)
- Ensure sub-200ms API response times for ranking signals
- Structured data (Schema.org) for SaaS pricing pages

## 7.2 Developer Community Presence

| Community | Strategy | Content Type |
|---|---|---|
| Hacker News | Show HN for launch announcement; genuine utility posts | Text post + demo |
| Reddit (r/LocalLLaMA, r/llamaindex, r/ChatGPT) | Educational posts about cost optimization, routing | Text + comparison tables |
| Twitter / X | Share routing benchmarks, cost savings data, provider comparisons | Thread + single posts |
| LinkedIn | Thought leadership on AI infrastructure, cost optimization | Article posts |
| Discord (LlamaIndex, CrewAI, LangChain communities) | Genuine participation, not spam; offer OMA as a solution | Conversational |
| YouTube | Tutorial videos: "Set up OMA in 5 minutes," "Save 50% on AI API costs" | Video tutorials |

## 7.3 API Marketplace Listings

| Marketplace | Listing Priority | Notes |
|---|---|---|
| RapidAPI | High | Largest API marketplace; submit early |
| API Market (apic.market) | Medium | Developer-focused |
| APIHub (apihub.dev) | Medium | Growing developer community |
| Google Cloud Marketplace | Low (post-launch) | Requires more infrastructure |

## 7.4 Referral Program

Once the product is stable, implement a referral program:

- **Referrer:** 500 free credits per referral who spends > $20
- **Referee:** 1,000 free credits on first purchase
- This drives organic growth within developer networks where one developer recommends tools to their team or online community.

---

# 8. Technical Scaling

## 8.1 Current Architecture (What Needs to Change)

The current OMA setup handles basic routing. For production scale, the following areas need investment:

### 8.1.1 Scalability Requirements

| Component | Current State | Production Requirement |
|---|---|---|
| API Gateway | Basic routing | High-availability with auto-scaling |
| Database | Single instance | Read replicas, connection pooling |
| Rate limiting | Basic | Distributed rate limiting (Redis-backed) |
| Caching | None | LRU cache for repeated prompts |
| Observability | Basic logs | Distributed tracing (OpenTelemetry) |
| Failover logic | Provider-level | Conversation-context-preserving failover |
| Security | API key auth | API key + org-level isolation |

### 8.1.2 Production Architecture Components

```
                    [Client / Developer SDK]
                            |
                            v
                    [Cloudflare/CDN]
                            |
                    [Load Balancer / API Gateway]
                            |
        +-------------------+-------------------+
        |                   |                   |
[v] [Router Service]  [Auth Service]   [Billing Service]
        |                   |                   |
        v                   v                   v
[Provider APIs]      [Database]         [Stripe/Payment]
        |                   |
[Redis Cache]    [PostgreSQL]
        |                   |
[Metrics/    [Read Replicas]
Observability]
```

### 8.1.3 Technical Scaling Roadmap

| Phase | Technical Changes | Priority |
|---|---|---|
| Pre-launch | Redis for rate limiting and session caching; read replicas for Postgres | Critical |
| Post-launch (Month 1 -- 3) | OpenTelemetry for distributed tracing; automated provider health checks | High |
| Month 3 -- 6 | LRU prompt caching; conversation-context-preserving failover | High |
| Month 6 -- 12 | Multi-region deployment; dedicated enterprise tier infrastructure | Medium |
| Year 2 | Custom model fine-tuning pipeline; analytics/BI for user insights | Medium |

## 8.2 Security Requirements

| Requirement | Implementation | Priority |
|---|---|---|
| Data isolation | Org-level namespace isolation in database | Critical |
| API key security | Keys hashed in DB; never logged; rotateable | Critical |
| Transport security | TLS 1.3 on all endpoints | Critical |
| Rate limiting | Per-key, per-org rate limits; Redis-backed | Critical |
| Audit logging | All API calls logged with timestamp, key ID, org | High |
| SOC 2 compliance (future) | Access controls, vulnerability scanning | Medium |

---

# 9. Operations

## 9.1 Customer Support

### 9.1.1 Support Model by Tier

| Tier | Support Channel | SLA |
|---|---|---|
| Free | Documentation, community forum | Best effort |
| Starter / Pro | Email support | 48-hour response |
| Growth | Email + priority queue | 24-hour response |
| Enterprise | Dedicated Slack/Discord + phone | 4-hour response |

### 9.1.2 Support Tools

| Tool | Purpose | Cost |
|---|---|---|
| Crisp or Intercom | In-app chat, email | $50 -- $300/mo |
| GitHub Issues | Public bug tracking | Free |
| Discord / Slack | Community support | Free |

### 9.1.3 Self-Service Support Content

Build a comprehensive documentation site before launch:
- Quick start guide (< 5 minutes to first API call)
- Provider setup guides
- Routing configuration guides
- Cost optimization recipes
- Troubleshooting / error code reference
- Migration guides from OpenRouter, Portkey, direct provider APIs

## 9.2 Billing Operations

### 9.2.1 Payment Infrastructure

| Component | Provider | Notes |
|---|---|---|
| Payments | Stripe | Credit cards, Apple Pay, Google Pay |
| Invoicing | Stripe Invoicing | For Enterprise tier |
| Refunds | Stripe | Full refund within 7 days of purchase |
| Credit system | Custom (OMA database) | Credits tracked separately from payments |

### 9.2.2 Billing Edge Cases

| Scenario | Policy |
|---|---|
| User runs out of credits | API calls return 429; email notification at 80% and 100% usage |
| Provider outage, no failover | Partial refund for affected calls; credits re-credited |
| Subscription cancellation | Retain access until end of billing period; no partial refunds |
| Fraudulent purchases | Stripe Radar; flag and review flagged transactions |
| Chargebacks | Investigate; ban repeat offenders; dispute through Stripe |

### 9.2.3 Credit Expiration Policy

| Tier | Credit Rollover |
|---|---|
| Pay-as-you-go | No rollover; credits expire at purchase if not used within 12 months |
| Pro | 90-day rollover |
| Growth | 12-month rollover |
| Enterprise | Custom (typically no expiration) |

## 9.3 Fraud Prevention

| Fraud Type | Mitigation |
|---|---|
| Card testing | Velocity checks on new API keys; require email verification before first purchase |
| Credit card fraud | Stripe Radar; block high-risk transactions automatically |
| API key theft | Hash keys in database; alert on anomalous usage patterns |
| Subscription fraud | 3D Secure for cards; flag suspicious signup patterns |
| Content misuse | Acceptable Use Policy; terms of service; right to terminate |

---

# 10. Competitive Positioning

## 10.1 Price vs Convenience vs Features Matrix

| Provider | Price Score | Convenience Score | Features Score | Best For |
|---|---|---|---|---|
| OpenRouter | 7/10 | 7/10 | 6/10 | Price-conscious developers |
| Portkey | 5/10 | 7/10 | 9/10 | Enterprise observability |
| TitanML | 6/10 | 6/10 | 6/10 | EU data residency needs |
| Direct provider APIs | 8/10 | 4/10 | 5/10 | Single-provider use cases |
| **OMA (target)** | **8/10** | **9/10** | **8/10** | **Balanced all-in-one** |

*Score: 1 = worst, 10 = best*

## 10.2 Positioning Statement

> **For developers and small teams building AI-powered applications who need reliable access to the best AI models at the lowest cost, OMA is the intelligent API gateway that automatically routes requests to the best provider, handles failover transparently, and provides real-time observability -- all through a single OpenAI-compatible API endpoint.**

## 10.3 Competitive Moat

OMA's moat is not any single feature but the **combination** of:
1. **Open-source with managed SaaS option** -- Transparency and community trust + managed convenience
2. **Cost intelligence** -- Not just routing, but routing based on real-time cost/latency optimization
3. **Developer experience** -- Zero-config setup (OpenAI SDK compatibility), one API key, instant activation
4. **Observability as a first-class feature** -- Every API call is traceable, comparable, optimizable

---

# 11. Risk Mitigation

## 11.1 Provider Dependency Risk

**Risk:** If a major provider (OpenAI, Anthropic) changes pricing, restricts API access, or goes bankrupt, OMA's value proposition degrades.

**Mitigation:**
- Maintain at least 4 -- 6 active providers at all times
- Build routing to reduce dependency on any single provider (blended cost model)
- Maintain open communication channels with provider teams
- If a provider changes pricing adversely, communicate transparently with users and build migration guides

## 11.2 Regulatory Risk

**Risk:** AI regulation (EU AI Act, state-level laws) could impose requirements on AI API gateways.

**Mitigation:**
- Monitor regulatory landscape continuously
- Build data residency options (EU region for enterprise)
- Do not store conversation content beyond what is needed for routing
- Maintain clear Acceptable Use Policy

## 11.3 Competition Risk

**Risk:** OpenRouter, Portkey, or a new entrant aggressively undercuts on price or copies features.

**Mitigation:**
- Move faster than established competitors -- ship features and improvements weekly
- Build community and developer brand loyalty through open-source contribution
- Focus on cost optimization intelligence as a differentiating feature that is hard to replicate quickly
- Maintain transparent pricing; never hide markup in confusing billing structures

## 11.4 Technical Risk

**Risk:** System outage takes down production customer apps, destroying trust.

**Mitigation:**
- Multi-region deployment by Month 6 (at latest)
- Comprehensive health checks and automatic alerts before outages propagate
- Failover documentation so customers understand behavior during outages
- Status page (status.oma.party) with incident reporting
- SLA commitment only for paid tiers; free tier is best-effort

## 11.5 Financial Risk

**Risk:** Credit margins are insufficient to cover operations at scale.

**Mitigation:**
- Target > 25% blended gross margin from Day 1
- Monitor unit economics monthly
- Keep infrastructure costs low using managed services (Neon, Hetzner, Cloudflare)
- Grow revenue faster than fixed costs

---

# 12. Strategic Roadmap

## 12.1 30-Day Plan (Foundation)

| Objective | Actions | Success Metric |
|---|---|---|
| Stabilize current product | Fix critical bugs from current users; ensure 99.5%+ uptime | 0 P0 bugs |
| Define MVP scope | Lock feature list for launch MVP | Documented in Notion/GitHub |
| Set up billing infrastructure | Stripe integration for credit purchases | First real transaction processed |
| Build documentation site | Launch docs.oma.party with quickstart guide | 3+ doc pages live |
| Start beta outreach | Contact 20 -- 30 developers from GitHub/community | 25 beta signups |
| Set up analytics | Implement Mixpanel or PostHog for product analytics | Analytics tracking on all key events |

## 12.2 60-Day Plan (Beta & Feedback)

| Objective | Actions | Success Metric |
|---|---|---|
| Launch beta program | Open beta to all signups; activate free credits | 50+ active beta users |
| Collect usage data | Identify top models, top providers, peak usage times | Usage report generated |
| Ship routing improvements | Implement cost-based routing for top 5 models | Cost savings demonstrated |
| Build community presence | Establish Discord community; publish first blog post | 50+ Discord members |
| Start SEO content | Publish first 2 articles (comparison guide + quickstart) | Articles indexed by Google |
| Implement rate limiting | Redis-backed rate limiting per API key | Rate limits enforced correctly |

## 12.3 90-Day Plan (Public Launch)

| Objective | Actions | Success Metric |
|---|---|---|
| Public launch announcement | HN Show HN + social media + developer communities | 100+ signups in Week 1 |
| Marketplace listings | Submit to RapidAPI, API Market | Listed on 2+ marketplaces |
| Launch referral program | Implement and announce referral credits | 10+ referrals in first month |
| Ship v1.1 features | Conversation-context failover + webhook usage alerts | Features in production |
| First user feedback survey | Collect NPS and feature requests | NPS score > 40 |
| Enterprise outreach | Identify and contact 5 potential enterprise accounts | 1 enterprise discovery call |

## 12.4 6-Month Plan (Scale)

| Objective | Actions | Success Metric |
|---|---|---|
| $25K monthly revenue | Growth from 200+ paying users | $25K MRR |
| Multi-region deployment | Deploy to EU (Frankfurt) and US-East | Multi-region latency < 100ms |
| Enterprise tier launch | Formalize Enterprise tier with SLA | 1 signed Enterprise account |
| Advanced observability | Per-request cost tracking; provider comparison dashboard | Dashboard feature complete |
| Mobile SDK / wrapper libraries | Python, JavaScript, Go SDKs | SDKs on GitHub with basic docs |

## 12.5 12-Month Plan (Establish Market Position)

| Objective | Actions | Success Metric |
|---|---|---|
| $100K monthly revenue | Scale user base and expansion revenue | $100K MRR |
| Open-source community | Active contributors, 500+ GitHub stars | Community growth metrics |
| Partnership conversations | Begin talks with AI tooling platforms (LangChain, Vercel, etc.) | 1 partnership announcement |
| Advanced routing AI | ML-based routing recommendation engine | Routing suggestion feature live |
| International expansion | EU and APAC pricing; localized billing | 15%+ non-US revenue |

---

# 13. Key Performance Indicators (KPIs)

## 13.1 Product Metrics

| Metric | Definition | Target (Month 3) | Target (Month 12) |
|---|---|---|---|
| Activation rate | % of signups who make first API call | > 55% | > 65% |
| API latency (p50) | Median API response time | < 150ms | < 100ms |
| API latency (p99) | 99th percentile response time | < 800ms | < 500ms |
| Provider uptime | Average provider availability | > 99.5% | > 99.9% |
| Failover success rate | % of failover attempts that complete successfully | > 95% | > 99% |

## 13.2 Business Metrics

| Metric | Definition | Target (Month 3) | Target (Month 12) |
|---|---|---|---|
| MRR (Monthly Recurring Revenue) | Subscription + credit revenue | $5,000 | $100,000 |
| ARPU (Average Revenue Per User) | Total revenue / active users | $30 | $45 |
| CAC (Customer Acquisition Cost) | Marketing spend / new customers | < $80 | < $50 |
| LTV (Lifetime Value) | ARPU x average customer lifetime | > $400 | > $600 |
| LTV:CAC | Lifetime value divided by acquisition cost | > 5:1 | > 12:1 |
| Churn rate | % of users who cancel each month | < 8% | < 5% |
| NRR (Net Revenue Retention) | Revenue from existing customers (expansion -- churn) | > 100% | > 115% |

## 13.3 Marketing Metrics

| Metric | Definition | Target (Month 3) | Target (Month 12) |
|---|---|---|---|
| Website visitors/mo | Unique visitors to oma.party | 2,000 | 15,000 |
| Signup conversion rate | % of visitors who sign up | > 3% | > 5% |
| Organic search traffic | % of traffic from SEO | > 30% | > 40% |
| Developer community members | Discord + Slack members | 100 | 1,000 |
| Referral rate | % of new users from referrals | > 5% | > 15% |

---

# Appendix A: Pro Forma Summary

## Simplified P&L (Monthly, at 500 Users)

| Line Item | Amount |
|---|---|
| **Revenue** | |
| Credit purchases (450 users x $30 ARPU) | $13,500 |
| Subscription revenue (50 users x $50 ARPU avg) | $2,500 |
| **Total Revenue** | **$16,000** |
| **COGS** | |
| Provider API costs (blended $0.20/1M tokens x estimated usage) | ($5,000) |
| **Gross Profit** | **$11,000 (69%)** |
| **Operating Expenses** | |
| Infrastructure | ($1,500) |
| Marketing | ($2,000) |
| Customer support | ($1,000) |
| Tools / SaaS | ($300) |
| **Total OpEx** | **($4,800)** |
| **Net Operating Income** | **$6,200** |

---

# Appendix B: Competitive Feature Comparison Detail

| Feature | OpenRouter | Portkey | OMA (Target) |
|---|---|---|---|
| OpenAI-compatible API | Yes | Yes | Yes |
| Provider count | 300+ | 5+ | 10+ |
| Automatic failover | No | Partial | Yes (full context) |
| Cost-based routing | Manual | No | Yes (automatic) |
| Real-time cost comparison | Yes (manual) | Basic | Yes |
| Observability dashboard | Basic | Advanced | Advanced |
| Prompt caching | No | Yes | Planned |
| Multi-region | Yes | Yes | Planned |
| Enterprise SLA | No | Yes | Planned |
| Open-source | Yes | No | Yes |
| Free tier | No | Yes (limited) | Yes |
| Credit rollover | No | Yes | Yes |
| Team seats | No | Yes | Planned |
| SOC 2 | No | Yes | No (post-launch) |

---

> **Remember: Vault-Tec -- Building a Better Future... Underground!**
>
> *This document is a living plan. Review quarterly. Adjust based on real data.*

---

*Document prepared by Terminal VT-OS/OPENCODE, serial number VTC-2077-OC-4111.*
*Vault-Tec is not responsible for any unforeseen market disruption, regulatory changes, or existential dread.*